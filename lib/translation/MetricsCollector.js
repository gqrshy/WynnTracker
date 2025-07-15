const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class MetricsCollector extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.metrics = {
            translation: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                avgResponseTime: 0,
                cacheHitRate: 0,
                byLanguage: new Map(),
                byChannel: new Map()
            },
            system: {
                memoryUsage: 0,
                cpuUsage: 0,
                uptime: process.uptime(),
                startTime: Date.now()
            },
            errors: {
                total: 0,
                byType: new Map(),
                recent: []
            }
        };
        
        this.timeSeries = new Map();
        this.startSystemMonitoring();
        this.startMetricsLogging();
    }

    recordTranslationRequest(data) {
        this.metrics.translation.totalRequests++;
        
        if (data.success) {
            this.metrics.translation.successfulRequests++;
            this.updateResponseTime(data.responseTime);
        } else {
            this.metrics.translation.failedRequests++;
            this.recordError('translation', data.error);
        }

        // 言語別統計
        const langKey = `${data.sourceLang}-${data.targetLang}`;
        const langStats = this.metrics.translation.byLanguage.get(langKey) || { count: 0, errors: 0 };
        langStats.count++;
        if (!data.success) langStats.errors++;
        this.metrics.translation.byLanguage.set(langKey, langStats);

        // チャンネル別統計
        const channelStats = this.metrics.translation.byChannel.get(data.channelId) || { count: 0, characters: 0 };
        channelStats.count++;
        channelStats.characters += data.textLength || 0;
        this.metrics.translation.byChannel.set(data.channelId, channelStats);

        this.recordTimeSeries('translation_requests', 1);
        this.emit('translationRecorded', data);
    }

    recordCacheHit(hit) {
        this.metrics.translation.cacheHitRate = this.calculateCacheHitRate();
        this.recordTimeSeries('cache_hits', hit ? 1 : 0);
    }

    recordError(type, error) {
        this.metrics.errors.total++;
        
        const errorType = error.name || 'UnknownError';
        const count = this.metrics.errors.byType.get(errorType) || 0;
        this.metrics.errors.byType.set(errorType, count + 1);

        // 最近のエラーを記録（最新100件）
        this.metrics.errors.recent.unshift({
            type: errorType,
            message: error.message,
            timestamp: Date.now(),
            stack: error.stack
        });

        if (this.metrics.errors.recent.length > 100) {
            this.metrics.errors.recent.pop();
        }

        this.recordTimeSeries('errors', 1);
        this.emit('errorRecorded', { type, error });
    }

    updateResponseTime(responseTime) {
        const alpha = 0.1; // 平滑化係数
        if (this.metrics.translation.avgResponseTime === 0) {
            this.metrics.translation.avgResponseTime = responseTime;
        } else {
            this.metrics.translation.avgResponseTime = 
                (alpha * responseTime) + ((1 - alpha) * this.metrics.translation.avgResponseTime);
        }

        this.recordTimeSeries('response_time', responseTime);
    }

    calculateCacheHitRate() {
        // 実際のキャッシュマネージャーから取得する想定
        return 0; // プレースホルダー
    }

    recordTimeSeries(metric, value) {
        const now = Date.now();
        const minute = Math.floor(now / 60000) * 60000; // 分単位で丸める
        
        if (!this.timeSeries.has(metric)) {
            this.timeSeries.set(metric, new Map());
        }

        const series = this.timeSeries.get(metric);
        const current = series.get(minute) || { count: 0, sum: 0, min: Infinity, max: -Infinity };
        
        current.count++;
        current.sum += value;
        current.min = Math.min(current.min, value);
        current.max = Math.max(current.max, value);
        
        series.set(minute, current);

        // 古いデータを削除（24時間分のみ保持）
        const cutoff = now - (24 * 60 * 60 * 1000);
        for (const [timestamp] of series) {
            if (timestamp < cutoff) {
                series.delete(timestamp);
            }
        }
    }

    startSystemMonitoring() {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            this.metrics.system.memoryUsage = memUsage.heapUsed;
            this.metrics.system.uptime = process.uptime();
            
            this.recordTimeSeries('memory_usage', memUsage.heapUsed);
            this.recordTimeSeries('heap_total', memUsage.heapTotal);
            
        }, 30000); // 30秒間隔
    }

    startMetricsLogging() {
        if (!this.config.logMetrics) return;
        
        const logInterval = this.config.logInterval || 300000; // 5分
        setInterval(() => {
            this.logMetrics();
        }, logInterval);
    }

    logMetrics() {
        const summary = this.getSummary();
        const logEntry = {
            timestamp: new Date().toISOString(),
            metrics: summary
        };

        const logPath = path.join(__dirname, '..', '..', 'logs', 'metrics.log');
        fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    }

    getSummary() {
        const now = Date.now();
        return {
            translation: {
                totalRequests: this.metrics.translation.totalRequests,
                successRate: this.metrics.translation.totalRequests > 0 ? 
                    (this.metrics.translation.successfulRequests / this.metrics.translation.totalRequests) * 100 : 0,
                avgResponseTime: Math.round(this.metrics.translation.avgResponseTime),
                cacheHitRate: this.metrics.translation.cacheHitRate,
                activeLanguages: this.metrics.translation.byLanguage.size,
                activeChannels: this.metrics.translation.byChannel.size
            },
            system: {
                memoryUsage: Math.round(this.metrics.system.memoryUsage / 1024 / 1024), // MB
                uptime: Math.round(this.metrics.system.uptime / 60), // 分
                runtime: Math.round((now - this.metrics.system.startTime) / 1000 / 60) // 分
            },
            errors: {
                total: this.metrics.errors.total,
                recentCount: this.metrics.errors.recent.length,
                topErrorTypes: Array.from(this.metrics.errors.byType.entries())
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
            }
        };
    }

    getTimeSeries(metric, duration = 3600000) { // 1時間分
        const series = this.timeSeries.get(metric);
        if (!series) return [];
        
        const now = Date.now();
        const cutoff = now - duration;
        
        return Array.from(series.entries())
            .filter(([timestamp]) => timestamp >= cutoff)
            .sort(([a], [b]) => a - b)
            .map(([timestamp, data]) => ({
                timestamp,
                ...data,
                avg: data.sum / data.count
            }));
    }

    getChannelStats(channelId) {
        return this.metrics.translation.byChannel.get(channelId) || { count: 0, characters: 0 };
    }

    getLanguageStats() {
        return Array.from(this.metrics.translation.byLanguage.entries())
            .map(([language, stats]) => ({ language, ...stats }))
            .sort((a, b) => b.count - a.count);
    }

    reset() {
        this.metrics = {
            translation: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                avgResponseTime: 0,
                cacheHitRate: 0,
                byLanguage: new Map(),
                byChannel: new Map()
            },
            system: {
                memoryUsage: 0,
                cpuUsage: 0,
                uptime: process.uptime(),
                startTime: Date.now()
            },
            errors: {
                total: 0,
                byType: new Map(),
                recent: []
            }
        };
        
        this.timeSeries.clear();
        this.emit('metricsReset');
    }

    exportMetrics() {
        return {
            summary: this.getSummary(),
            timeSeries: Object.fromEntries(
                Array.from(this.timeSeries.entries()).map(([metric, series]) => [
                    metric,
                    this.getTimeSeries(metric)
                ])
            ),
            channelStats: Object.fromEntries(this.metrics.translation.byChannel),
            languageStats: this.getLanguageStats(),
            recentErrors: this.metrics.errors.recent.slice(0, 20)
        };
    }
}

module.exports = MetricsCollector;