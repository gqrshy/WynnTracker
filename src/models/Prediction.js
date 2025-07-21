class Prediction {
    constructor(data) {
        this.predictedTime = data.predictedTime ? new Date(data.predictedTime) : null;
        this.confidence = data.confidence || 0;
        this.method = data.method;
        this.basedOnEvents = data.basedOnEvents || [];
        this.sources = data.sources || [];
        this.agreement = data.agreement || 0;
        this.generatedAt = data.generatedAt ? new Date(data.generatedAt) : new Date();
        this.server = data.server;
        this.downtime = data.downtime || false;
        this.metadata = data.metadata || {};
        this.id = data.id || this.generateId();
    }

    generateId() {
        return `${this.method}_${this.server}_${this.generatedAt.getTime()}`;
    }

    getTimeUntil() {
        if (!this.predictedTime) {
            return null;
        }

        const now = new Date();
        const diff = this.predictedTime - now;
        
        if (diff <= 0) {
            return {
                isPast: true,
                totalMilliseconds: Math.abs(diff),
                totalSeconds: Math.abs(Math.floor(diff / 1000)),
                totalMinutes: Math.abs(Math.floor(diff / (1000 * 60))),
                totalHours: Math.abs(Math.floor(diff / (1000 * 60 * 60))),
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0
            };
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return {
            isPast: false,
            totalMilliseconds: diff,
            totalSeconds: Math.floor(diff / 1000),
            totalMinutes: Math.floor(diff / (1000 * 60)),
            totalHours: Math.floor(diff / (1000 * 60 * 60)),
            days,
            hours,
            minutes,
            seconds
        };
    }

    getFormattedTimeUntil() {
        const timeUntil = this.getTimeUntil();
        
        if (!timeUntil) {
            return 'Unknown';
        }

        if (timeUntil.isPast) {
            if (timeUntil.totalMinutes < 1) {
                return 'Just passed';
            } else if (timeUntil.totalMinutes < 60) {
                return `${timeUntil.totalMinutes} minute${timeUntil.totalMinutes !== 1 ? 's' : ''} ago`;
            } else if (timeUntil.totalHours < 24) {
                return `${timeUntil.totalHours} hour${timeUntil.totalHours !== 1 ? 's' : ''} ago`;
            } else {
                const days = Math.floor(timeUntil.totalHours / 24);
                return `${days} day${days !== 1 ? 's' : ''} ago`;
            }
        }

        const parts = [];
        
        if (timeUntil.days > 0) {
            parts.push(`${timeUntil.days} day${timeUntil.days !== 1 ? 's' : ''}`);
        }
        
        if (timeUntil.hours > 0) {
            parts.push(`${timeUntil.hours} hour${timeUntil.hours !== 1 ? 's' : ''}`);
        }
        
        if (timeUntil.minutes > 0) {
            parts.push(`${timeUntil.minutes} minute${timeUntil.minutes !== 1 ? 's' : ''}`);
        }
        
        if (parts.length === 0) {
            parts.push(`${timeUntil.seconds} second${timeUntil.seconds !== 1 ? 's' : ''}`);
        }

        return parts.join(', ');
    }

    getConfidenceLevel() {
        if (this.confidence >= 90) {
            return 'Very High';
        } else if (this.confidence >= 70) {
            return 'High';
        } else if (this.confidence >= 50) {
            return 'Medium';
        } else if (this.confidence >= 30) {
            return 'Low';
        } else {
            return 'Very Low';
        }
    }

    getConfidenceColor() {
        if (this.confidence >= 90) {
            return '#00ff00'; // Green
        } else if (this.confidence >= 70) {
            return '#7fff00'; // Yellow-green
        } else if (this.confidence >= 50) {
            return '#ffff00'; // Yellow
        } else if (this.confidence >= 30) {
            return '#ff7f00'; // Orange
        } else {
            return '#ff0000'; // Red
        }
    }

    getMethodIcon() {
        switch (this.method?.toLowerCase()) {
            case 'arima':
                return '🤖';
            case 'community':
                return '👥';
            case 'wynncraft':
                return '🎮';
            case 'manual':
                return '👤';
            case 'hybrid':
                return '🔄';
            case 'statistical':
                return '📊';
            case 'neural':
                return '🧠';
            default:
                return '❓';
        }
    }

    getAgreementLevel() {
        if (this.agreement >= 90) {
            return 'Very High';
        } else if (this.agreement >= 70) {
            return 'High';
        } else if (this.agreement >= 50) {
            return 'Medium';
        } else if (this.agreement >= 30) {
            return 'Low';
        } else {
            return 'Very Low';
        }
    }

    isRecent(hours = 1) {
        if (!this.generatedAt) {
            return false;
        }

        const now = new Date();
        const diff = now - this.generatedAt;
        const diffHours = diff / (1000 * 60 * 60);
        
        return diffHours <= hours;
    }

    isUpcoming(hours = 24) {
        if (!this.predictedTime) {
            return false;
        }

        const now = new Date();
        const diff = this.predictedTime - now;
        const diffHours = diff / (1000 * 60 * 60);
        
        return diffHours > 0 && diffHours <= hours;
    }

    isPast() {
        if (!this.predictedTime) {
            return false;
        }

        return this.predictedTime < new Date();
    }

    isExpired(hours = 24) {
        if (!this.generatedAt) {
            return true;
        }

        const now = new Date();
        const diff = now - this.generatedAt;
        const diffHours = diff / (1000 * 60 * 60);
        
        return diffHours > hours;
    }

    getAccuracy(actualTime) {
        if (!actualTime || !this.predictedTime) {
            return null;
        }

        const predictedTime = this.predictedTime.getTime();
        const actualTimeMs = actualTime.getTime();
        const diff = Math.abs(predictedTime - actualTimeMs);
        
        return {
            differenceMs: diff,
            differenceMinutes: Math.floor(diff / (1000 * 60)),
            accuracyPercentage: Math.max(0, 100 - (diff / (1000 * 60 * 60)) * 10) // 10% penalty per hour off
        };
    }

    updateConfidence(newConfidence) {
        this.confidence = Math.max(0, Math.min(100, newConfidence));
    }

    updateAgreement(newAgreement) {
        this.agreement = Math.max(0, Math.min(100, newAgreement));
    }

    addSource(source) {
        if (!this.sources.includes(source)) {
            this.sources.push(source);
        }
    }

    removeSource(source) {
        this.sources = this.sources.filter(s => s !== source);
    }

    addMetadata(key, value) {
        this.metadata[key] = value;
    }

    getMetadata(key) {
        return this.metadata[key];
    }

    getFormattedPredictedTime(timezone = 'UTC') {
        if (!this.predictedTime) {
            return 'Unknown';
        }

        const options = {
            timeZone: timezone === 'JST' ? 'Asia/Tokyo' : 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };

        return this.predictedTime.toLocaleString('en-US', options);
    }

    compare(other) {
        if (!this.predictedTime || !other.predictedTime) {
            return 0;
        }

        const timeDiff = Math.abs(this.predictedTime - other.predictedTime);
        const confidenceDiff = Math.abs(this.confidence - other.confidence);
        const agreementDiff = Math.abs(this.agreement - other.agreement);

        return {
            timeDifferenceMs: timeDiff,
            timeDifferenceMinutes: Math.floor(timeDiff / (1000 * 60)),
            confidenceDifference: confidenceDiff,
            agreementDifference: agreementDiff,
            similarity: Math.max(0, 100 - (timeDiff / (1000 * 60 * 60)) * 10 - confidenceDiff * 0.5)
        };
    }

    toJSON() {
        return {
            id: this.id,
            predictedTime: this.predictedTime,
            confidence: this.confidence,
            method: this.method,
            basedOnEvents: this.basedOnEvents,
            sources: this.sources,
            agreement: this.agreement,
            generatedAt: this.generatedAt,
            server: this.server,
            downtime: this.downtime,
            metadata: this.metadata,
            timeUntil: this.getTimeUntil(),
            confidenceLevel: this.getConfidenceLevel(),
            agreementLevel: this.getAgreementLevel(),
            isRecent: this.isRecent(),
            isUpcoming: this.isUpcoming(),
            isPast: this.isPast(),
            isExpired: this.isExpired()
        };
    }

    static fromARIMA(data) {
        return new Prediction({
            predictedTime: data.predictedTime,
            confidence: data.confidence,
            method: 'ARIMA',
            server: data.server,
            downtime: data.downtime,
            metadata: {
                model: data.model,
                mse: data.mse,
                mae: data.mae,
                dataPoints: data.dataPoints
            }
        });
    }

    static fromCommunity(data) {
        return new Prediction({
            predictedTime: data.predictedTime,
            confidence: data.confidence,
            method: 'Community',
            server: data.server,
            sources: data.sources,
            metadata: {
                submitter: data.submitter,
                verified: data.verified
            }
        });
    }

    static fromHybrid(predictions) {
        if (!Array.isArray(predictions) || predictions.length === 0) {
            return null;
        }

        const avgTime = predictions.reduce((sum, pred) => {
            return sum + pred.predictedTime.getTime();
        }, 0) / predictions.length;

        const avgConfidence = predictions.reduce((sum, pred) => {
            return sum + pred.confidence;
        }, 0) / predictions.length;

        const allSources = predictions.reduce((sources, pred) => {
            return sources.concat(pred.sources || []);
        }, []);

        const uniqueSources = [...new Set(allSources)];

        const agreement = predictions.length > 1 ? 
            this.calculateAgreement(predictions) : 100;

        return new Prediction({
            predictedTime: new Date(avgTime),
            confidence: avgConfidence,
            method: 'Hybrid',
            server: predictions[0].server,
            sources: uniqueSources,
            agreement: agreement,
            basedOnEvents: predictions.map(p => p.id),
            metadata: {
                componentPredictions: predictions.length,
                methods: predictions.map(p => p.method)
            }
        });
    }

    static calculateAgreement(predictions) {
        if (predictions.length <= 1) {
            return 100;
        }

        const times = predictions.map(p => p.predictedTime.getTime());
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        
        const variance = times.reduce((sum, time) => {
            return sum + Math.pow(time - avgTime, 2);
        }, 0) / times.length;

        const stdDev = Math.sqrt(variance);
        const agreementScore = Math.max(0, 100 - (stdDev / (1000 * 60 * 60)) * 10);
        
        return Math.round(agreementScore);
    }

    static compare(a, b) {
        if (!a.predictedTime && !b.predictedTime) return 0;
        if (!a.predictedTime) return 1;
        if (!b.predictedTime) return -1;
        return a.predictedTime - b.predictedTime;
    }
}

module.exports = Prediction;