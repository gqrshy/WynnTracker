const BaseService = require('./BaseService');
const AnniEvent = require('../models/AnniEvent');
const Prediction = require('../models/Prediction');
const { ErrorTypes } = require('../utils/ErrorHandler');

class AnniService extends BaseService {
    constructor(options = {}) {
        super(options);
        this.eventHistory = new Map();
        this.predictions = new Map();
        this.timers = new Map();
        this.updateInterval = null;
        this.predictionModels = {
            arima: null,
            community: null,
            wynncraft: null,
            hybrid: null
        };
    }

    async onInitialize() {
        await this.loadEventHistory();
        await this.loadPredictions();
        this.startUpdateInterval();
        this.info('AnniService initialized');
    }

    async loadEventHistory() {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const dataDir = path.join(__dirname, '..', '..', 'data');
            const historyFile = path.join(dataDir, 'anni_history.json');
            
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            if (fs.existsSync(historyFile)) {
                const historyData = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
                
                // AnniEventオブジェクトを再構築
                const AnniEvent = require('../models/AnniEvent');
                this.eventHistory = new Map();
                
                for (const [id, eventData] of Object.entries(historyData)) {
                    const event = new AnniEvent({
                        server: eventData.server,
                        timestamp: new Date(eventData.timestamp),
                        source: eventData.source,
                        confidence: eventData.confidence,
                        downtime: eventData.downtime
                    });
                    this.eventHistory.set(id, event);
                }
                
                this.info(`Loaded ${this.eventHistory.size} events from history file`);
            }
        } catch (error) {
            this.warn('Failed to load event history', { error: error.message });
        }
    }

    async saveEventHistory() {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const dataDir = path.join(__dirname, '..', '..', 'data');
            const historyFile = path.join(dataDir, 'anni_history.json');
            
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            const history = {};
            for (const [id, event] of this.eventHistory.entries()) {
                history[id] = {
                    server: event.server,
                    timestamp: event.timestamp.toISOString(),
                    source: event.source,
                    confidence: event.confidence,
                    downtime: event.downtime,
                    verified: event.verified
                };
            }
            
            fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
            this.info(`Saved ${this.eventHistory.size} events to history file`);
        } catch (error) {
            this.error('Failed to save event history', { error: error.message });
        }
    }

    async loadPredictions() {
        try {
            const predictions = await this.cache.get('predictions', { useFile: true });
            if (predictions) {
                this.predictions = new Map(Object.entries(predictions));
            }
        } catch (error) {
            this.warn('Failed to load predictions', { error: error.message });
        }
    }

    async savePredictions() {
        try {
            const predictions = Object.fromEntries(this.predictions);
            await this.cache.set('predictions', predictions, { useFile: true });
        } catch (error) {
            this.error('Failed to save predictions', { error: error.message });
        }
    }

    async addEvent(eventData, options = {}) {
        return this.withErrorHandling(async () => {
            const event = new AnniEvent(eventData);
            
            this.eventHistory.set(event.id, event);
            await this.saveEventHistory();
            
            this.info('Event added', {
                id: event.id,
                server: event.server,
                timestamp: event.timestamp,
                source: event.source
            });
            
            // Trigger prediction update if this is a verified event
            if (event.verified) {
                await this.updatePredictions(event.server);
            }
            
            return event;
        }, {
            method: 'addEvent',
            server: eventData.server
        });
    }

    async getEvent(eventId) {
        return this.eventHistory.get(eventId) || null;
    }

    async getEvents(server = null, options = {}) {
        return this.withErrorHandling(async () => {
            let events = Array.from(this.eventHistory.values());
            
            if (server) {
                events = events.filter(event => event.server === server);
            }
            
            if (options.limit) {
                events = events.slice(0, options.limit);
            }
            
            if (options.since) {
                const sinceDate = new Date(options.since);
                events = events.filter(event => event.timestamp > sinceDate);
            }
            
            if (options.verified !== undefined) {
                events = events.filter(event => event.verified === options.verified);
            }
            
            // Sort by timestamp (most recent first)
            events.sort((a, b) => b.timestamp - a.timestamp);
            
            return events;
        }, {
            method: 'getEvents',
            server,
            options
        });
    }

    async getUpcomingEvents(server = null, hours = 24) {
        return this.withErrorHandling(async () => {
            const events = await this.getEvents(server);
            const now = new Date();
            const futureTime = new Date(now.getTime() + (hours * 60 * 60 * 1000));
            
            return events.filter(event => {
                return event.timestamp > now && event.timestamp <= futureTime;
            });
        }, {
            method: 'getUpcomingEvents',
            server,
            hours
        });
    }

    async getPastEvents(server = null, hours = 24) {
        return this.withErrorHandling(async () => {
            const events = await this.getEvents(server);
            const now = new Date();
            const pastTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
            
            return events.filter(event => {
                return event.timestamp < now && event.timestamp >= pastTime;
            });
        }, {
            method: 'getPastEvents',
            server,
            hours
        });
    }

    async verifyEvent(eventId, actualTime = null) {
        return this.withErrorHandling(async () => {
            const event = this.eventHistory.get(eventId);
            
            if (!event) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Event with ID '${eventId}' not found.`
                );
            }
            
            const accuracy = event.verify(actualTime);
            await this.saveEventHistory();
            
            this.info('Event verified', {
                id: eventId,
                accuracy: accuracy?.accuracyPercentage,
                difference: accuracy?.differenceMinutes
            });
            
            // Update predictions based on verification
            await this.updatePredictions(event.server);
            
            return { event, accuracy };
        }, {
            method: 'verifyEvent',
            eventId
        });
    }

    async createPrediction(predictionData, options = {}) {
        return this.withErrorHandling(async () => {
            const prediction = new Prediction(predictionData);
            
            this.predictions.set(prediction.id, prediction);
            await this.savePredictions();
            
            this.info('Prediction created', {
                id: prediction.id,
                method: prediction.method,
                server: prediction.server,
                confidence: prediction.confidence
            });
            
            return prediction;
        }, {
            method: 'createPrediction',
            method: predictionData.method,
            server: predictionData.server
        });
    }

    async getPrediction(predictionId) {
        return this.predictions.get(predictionId) || null;
    }

    async getPredictions(server = null, options = {}) {
        return this.withErrorHandling(async () => {
            let predictions = Array.from(this.predictions.values());
            
            if (server) {
                predictions = predictions.filter(pred => pred.server === server);
            }
            
            if (options.method) {
                predictions = predictions.filter(pred => pred.method === options.method);
            }
            
            if (options.minConfidence) {
                predictions = predictions.filter(pred => pred.confidence >= options.minConfidence);
            }
            
            if (options.onlyUpcoming) {
                predictions = predictions.filter(pred => pred.isUpcoming());
            }
            
            if (options.limit) {
                predictions = predictions.slice(0, options.limit);
            }
            
            // Sort by predicted time
            predictions.sort(Prediction.compare);
            
            return predictions;
        }, {
            method: 'getPredictions',
            server,
            options
        });
    }

    async getLatestPrediction(server, method = null) {
        return this.withErrorHandling(async () => {
            const predictions = await this.getPredictions(server, {
                method,
                onlyUpcoming: true,
                limit: 1
            });
            
            return predictions[0] || null;
        }, {
            method: 'getLatestPrediction',
            server,
            predictionMethod: method
        });
    }

    async updatePredictions(server) {
        return this.withErrorHandling(async () => {
            const events = await this.getEvents(server, {
                limit: 100
            });
            
            // Clear existing predictions for this server
            for (const [id, prediction] of this.predictions.entries()) {
                if (prediction.server === server) {
                    this.predictions.delete(id);
                }
            }
            
            const predictions = [];
            
            // Generate statistical prediction (always available)
            try {
                const statisticalPrediction = await this.generateStatisticalPrediction(server, events);
                if (statisticalPrediction) {
                    predictions.push(statisticalPrediction);
                }
            } catch (error) {
                this.warn('Statistical prediction failed', { error: error.message });
            }
            
            // Generate ARIMA prediction (if Python is available)
            try {
                const arimaPrediction = await this.generateARIMAPrediction(server, events);
                if (arimaPrediction) {
                    predictions.push(arimaPrediction);
                }
            } catch (error) {
                this.warn('ARIMA prediction failed', { error: error.message });
            }
            
            // Generate hybrid prediction if multiple predictions exist
            if (predictions.length > 1) {
                try {
                    const hybridPrediction = await this.generateHybridPrediction(server, predictions);
                    if (hybridPrediction) {
                        predictions.push(hybridPrediction);
                    }
                } catch (error) {
                    this.warn('Hybrid prediction failed', { error: error.message });
                }
            }
            
            // Save new predictions
            for (const prediction of predictions) {
                this.predictions.set(prediction.id, prediction);
            }
            
            await this.savePredictions();
            
            this.info('Predictions updated', {
                server,
                count: predictions.length,
                methods: predictions.map(p => p.method)
            });
            
            return predictions;
        }, {
            method: 'updatePredictions',
            server
        });
    }

    async generateARIMAPrediction(server, events) {
        // Simplified ARIMA based on original WynnTracker approach
        if (events.length < 3) {
            return null;
        }
        
        // Sort events by timestamp (oldest first)
        const sortedEvents = events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Annihilation interval constants (from original WynnTracker)
        const EMPIRICAL_INTERVAL_DAYS = 3.0927;
        const ANNI_INTERVAL = EMPIRICAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
        
        // Calculate recent intervals
        const intervals = [];
        for (let i = 1; i < sortedEvents.length; i++) {
            const interval = new Date(sortedEvents[i].timestamp) - new Date(sortedEvents[i-1].timestamp);
            intervals.push(interval);
        }
        
        // Filter out outliers (intervals > 10 days are clearly wrong)
        const filteredIntervals = intervals.filter(interval => {
            const days = interval / (24 * 60 * 60 * 1000);
            return days >= 1 && days <= 10; // Keep intervals between 1-10 days
        });
        
        // Use last 5 filtered intervals for trend analysis
        const recentIntervals = filteredIntervals.slice(-5);
        const avgInterval = recentIntervals.length > 0 ? 
            recentIntervals.reduce((sum, interval) => sum + interval, 0) / recentIntervals.length :
            ANNI_INTERVAL;
        const avgIntervalDays = avgInterval / (24 * 60 * 60 * 1000);
        
        // Check if the average is reasonable (within 0.5 days of expected)
        const predictedInterval = Math.abs(avgIntervalDays - EMPIRICAL_INTERVAL_DAYS) < 0.5 ? 
            avgInterval : ANNI_INTERVAL;
        
        // Predict next event
        const lastEvent = sortedEvents[sortedEvents.length - 1];
        const predictedTime = new Date(lastEvent.timestamp.getTime() + predictedInterval);
        
        // Calculate confidence based on interval consistency
        const variance = recentIntervals.reduce((sum, interval) => {
            return sum + Math.pow(interval - avgInterval, 2);
        }, 0) / recentIntervals.length;
        
        const stdDev = Math.sqrt(variance);
        const stdDevHours = stdDev / (60 * 60 * 1000);
        
        // Confidence calculation (similar to original)
        let confidence = 75; // Base confidence for ARIMA
        
        if (stdDevHours > 6) {
            confidence = Math.max(50, 75 - ((stdDevHours - 6) * 3));
        }
        
        if (stdDevHours < 3) {
            confidence = Math.min(90, confidence + 10);
        }
        
        return new Prediction({
            predictedTime,
            confidence: Math.round(confidence),
            method: 'ARIMA',
            server,
            basedOnEvents: sortedEvents.slice(-10).map(e => e.id),
            metadata: {
                method: 'arima_empirical',
                eventCount: events.length,
                avgIntervalDays: avgIntervalDays,
                predictedIntervalDays: predictedInterval / (24 * 60 * 60 * 1000),
                standardDeviationHours: stdDevHours,
                usedEmpiricalInterval: Math.abs(avgIntervalDays - EMPIRICAL_INTERVAL_DAYS) >= 0.5
            }
        });
    }

    async generateStatisticalPrediction(server, events) {
        if (events.length < 1) {
            return null;
        }
        
        // Sort events by timestamp (oldest first for interval calculation)
        const sortedEvents = events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Annihilation interval constants (from original WynnTracker)
        const EMPIRICAL_INTERVAL_DAYS = 3.0927; // From original data analysis
        const ANNI_INTERVAL = EMPIRICAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
        
        if (sortedEvents.length === 1) {
            // Single event: use empirical interval
            const lastEvent = sortedEvents[0];
            const predictedTime = new Date(lastEvent.timestamp.getTime() + ANNI_INTERVAL);
            
            return new Prediction({
                predictedTime,
                confidence: 70,
                method: 'Statistical',
                server,
                basedOnEvents: [lastEvent.id],
                metadata: {
                    method: 'basic_empirical',
                    eventCount: 1,
                    intervalDays: EMPIRICAL_INTERVAL_DAYS,
                    lastEventTime: lastEvent.timestamp
                }
            });
        }
        
        // Multiple events: calculate actual intervals
        const intervals = [];
        
        for (let i = 1; i < sortedEvents.length; i++) {
            const previousEvent = sortedEvents[i-1];
            const currentEvent = sortedEvents[i];
            
            const interval = new Date(currentEvent.timestamp) - new Date(previousEvent.timestamp);
            intervals.push(interval);
        }
        
        // Filter out outliers (intervals > 10 days are clearly wrong)
        const filteredIntervals = intervals.filter(interval => {
            const days = interval / (24 * 60 * 60 * 1000);
            return days >= 1 && days <= 10; // Keep intervals between 1-10 days
        });
        
        // Calculate average interval from filtered data
        const avgInterval = filteredIntervals.length > 0 ? 
            filteredIntervals.reduce((sum, interval) => sum + interval, 0) / filteredIntervals.length :
            ANNI_INTERVAL;
        const avgIntervalDays = avgInterval / (24 * 60 * 60 * 1000);
        
        // Use empirical interval if our calculated average is too far from expected
        const expectedInterval = Math.abs(avgIntervalDays - EMPIRICAL_INTERVAL_DAYS) < 1.0 ? 
            avgInterval : ANNI_INTERVAL;
        
        // Calculate variance for confidence (use filtered intervals)
        const variance = filteredIntervals.length > 0 ? 
            filteredIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / filteredIntervals.length :
            0;
        const stdDeviation = Math.sqrt(variance);
        const stdDeviationHours = stdDeviation / (60 * 60 * 1000);
        
        // Predict next event from most recent event
        const lastEvent = sortedEvents[sortedEvents.length - 1];
        const predictedTime = new Date(lastEvent.timestamp.getTime() + expectedInterval);
        
        // Confidence calculation (original algorithm style)
        let confidence = 85; // Base confidence
        
        // Reduce confidence based on variance
        if (stdDeviationHours > 6) {
            confidence = Math.max(60, 85 - ((stdDeviationHours - 6) * 5));
        }
        
        // Boost confidence if intervals are very consistent
        if (stdDeviationHours < 2) {
            confidence = Math.min(95, confidence + 10);
        }
        
        return new Prediction({
            predictedTime,
            confidence: Math.round(confidence),
            method: 'Statistical',
            server,
            basedOnEvents: sortedEvents.slice(-10).map(e => e.id),
            metadata: {
                method: 'statistical_empirical',
                eventCount: sortedEvents.length,
                averageIntervalDays: avgIntervalDays,
                expectedIntervalDays: expectedInterval / (24 * 60 * 60 * 1000),
                standardDeviationHours: stdDeviationHours,
                lastEventTime: lastEvent.timestamp
            }
        });
    }

    async generateHybridPrediction(server, predictions) {
        if (predictions.length < 2) {
            return null;
        }
        
        // Weight predictions by confidence
        const weightedSum = predictions.reduce((sum, pred) => {
            const weight = (pred.confidence || 50) / 100;
            return sum + (pred.predictedTime.getTime() * weight);
        }, 0);
        
        const totalWeight = predictions.reduce((sum, pred) => {
            return sum + ((pred.confidence || 50) / 100);
        }, 0);
        
        const averageTime = new Date(weightedSum / totalWeight);
        
        // Calculate agreement score
        const deviations = predictions.map(pred => {
            return Math.abs(pred.predictedTime.getTime() - averageTime.getTime());
        });
        
        const maxDeviation = Math.max(...deviations);
        const agreementScore = Math.max(0, 100 - (maxDeviation / (60 * 60 * 1000)) * 10);
        
        // Final confidence is combination of individual confidences and agreement
        const avgConfidence = predictions.reduce((sum, pred) => sum + (pred.confidence || 50), 0) / predictions.length;
        const finalConfidence = Math.round((avgConfidence + agreementScore) / 2);
        
        return new Prediction({
            predictedTime: averageTime,
            confidence: Math.max(0, Math.min(100, finalConfidence)),
            method: 'Hybrid',
            server,
            basedOnEvents: predictions.flatMap(p => p.basedOnEvents || []),
            metadata: {
                method: 'hybrid_weighted_average',
                sourceCount: predictions.length,
                sources: predictions.map(p => p.method),
                agreement: Math.round(agreementScore),
                avgConfidence: Math.round(avgConfidence),
                sourcePredictions: predictions.map(p => ({
                    method: p.method,
                    time: p.predictedTime.toISOString(),
                    confidence: p.confidence
                }))
            }
        });
    }

    async createTimer(server, eventTime, options = {}) {
        return this.withErrorHandling(async () => {
            const timer = {
                id: this.generateTimerId(),
                server,
                eventTime: new Date(eventTime),
                createdAt: new Date(),
                active: true,
                channelId: options.channelId,
                messageId: options.messageId,
                notifyRoles: options.notifyRoles || [],
                notifyMinutes: options.notifyMinutes || [60, 30, 15, 5, 1],
                timezone: options.timezone || 'UTC',
                confidence: options.confidence || 100,
                source: options.source || 'Manual'
            };
            
            this.timers.set(timer.id, timer);
            
            this.info('Timer created', {
                id: timer.id,
                server,
                eventTime: timer.eventTime
            });
            
            return timer;
        }, {
            method: 'createTimer',
            server
        });
    }

    async getTimer(timerId) {
        return this.timers.get(timerId) || null;
    }

    async getActiveTimers(server = null) {
        let timers = Array.from(this.timers.values());
        
        if (server) {
            timers = timers.filter(timer => timer.server === server);
        }
        
        return timers.filter(timer => timer.active);
    }

    async updateTimer(timerId, updates) {
        return this.withErrorHandling(async () => {
            const timer = this.timers.get(timerId);
            
            if (!timer) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Timer with ID '${timerId}' not found.`
                );
            }
            
            Object.assign(timer, updates);
            
            this.info('Timer updated', {
                id: timerId,
                updates: Object.keys(updates)
            });
            
            return timer;
        }, {
            method: 'updateTimer',
            timerId
        });
    }

    async deleteTimer(timerId) {
        return this.withErrorHandling(async () => {
            const timer = this.timers.get(timerId);
            
            if (!timer) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Timer with ID '${timerId}' not found.`
                );
            }
            
            this.timers.delete(timerId);
            
            this.info('Timer deleted', { id: timerId });
            
            return true;
        }, {
            method: 'deleteTimer',
            timerId
        });
    }

    async getEventStatistics(server = null, days = 30) {
        return this.withErrorHandling(async () => {
            const events = await this.getEvents(server, {
                since: new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
            });
            
            const verifiedEvents = events.filter(e => e.verified);
            const intervals = [];
            
            for (let i = 1; i < verifiedEvents.length; i++) {
                const interval = verifiedEvents[i-1].timestamp - verifiedEvents[i].timestamp;
                intervals.push(interval / (1000 * 60)); // Convert to minutes
            }
            
            const stats = {
                totalEvents: events.length,
                verifiedEvents: verifiedEvents.length,
                averageInterval: intervals.length > 0 ? 
                    intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length : 0,
                minInterval: intervals.length > 0 ? Math.min(...intervals) : 0,
                maxInterval: intervals.length > 0 ? Math.max(...intervals) : 0,
                sources: {},
                confidenceLevels: {}
            };
            
            // Count by source
            events.forEach(event => {
                stats.sources[event.source] = (stats.sources[event.source] || 0) + 1;
            });
            
            // Count by confidence level
            events.forEach(event => {
                const level = event.getConfidenceLevel();
                stats.confidenceLevels[level] = (stats.confidenceLevels[level] || 0) + 1;
            });
            
            return stats;
        }, {
            method: 'getEventStatistics',
            server,
            days
        });
    }

    startUpdateInterval() {
        const interval = this.getConfig('prediction.updateInterval', 300000); // 5 minutes
        
        this.updateInterval = setInterval(async () => {
            try {
                const servers = new Set(Array.from(this.eventHistory.values()).map(e => e.server));
                
                for (const server of servers) {
                    await this.updatePredictions(server);
                }
            } catch (error) {
                this.error('Auto-update failed', { error: error.message });
            }
        }, interval);
    }

    generateTimerId() {
        return `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async checkServiceHealth() {
        return {
            eventHistory: this.eventHistory.size,
            predictions: this.predictions.size,
            timers: this.timers.size,
            updateInterval: this.updateInterval !== null
        };
    }

    async onCleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        await this.saveEventHistory();
        await this.savePredictions();
    }

    static create(options = {}) {
        return new AnniService(options);
    }
}

module.exports = AnniService;