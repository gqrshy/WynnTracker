const EventEmitter = require('events');
const TranslationEngine = require('./TranslationEngine');
const CacheManager = require('./CacheManager');
const BatchProcessor = require('./BatchProcessor');
const MetricsCollector = require('./MetricsCollector');

class TranslationService extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        
        // コンポーネントの初期化
        this.engine = new TranslationEngine(config.engine);
        this.cache = new CacheManager(config.cache);
        this.batchProcessor = new BatchProcessor(config.batch);
        this.metrics = new MetricsCollector(config.metrics);
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        // サービスの準備完了
        this.isReady = true;
        this.emit('serviceReady');
    }

    setupEventListeners() {
        // キャッシュイベント
        this.cache.on('cacheHit', () => this.metrics.recordCacheHit(true));
        this.cache.on('cacheMiss', () => this.metrics.recordCacheHit(false));
        
        // 翻訳エンジンイベント
        this.engine.on('translationSuccess', (data) => {
            this.metrics.recordTranslationRequest({
                success: true,
                responseTime: Date.now() - data.startTime,
                sourceLang: data.sourceLang,
                targetLang: data.targetLang,
                textLength: data.text.length
            });
        });
        
        this.engine.on('translationError', (data) => {
            this.metrics.recordError('translation', data.error);
        });
        
        // バッチプロセッサーイベント
        this.batchProcessor.on('batchComplete', (data) => {
            this.emit('batchProcessed', data);
        });
    }

    async translateText(text, sourceLang, targetLang, options = {}) {
        const startTime = Date.now();
        
        try {
            // キャッシュチェック
            const cached = await this.cache.get(text, sourceLang, targetLang);
            if (cached) {
                return cached;
            }

            // 翻訳実行
            const result = await this.engine.translate(text, sourceLang, targetLang, options);
            
            // キャッシュに保存
            await this.cache.set(text, sourceLang, targetLang, result);
            
            return result;
            
        } catch (error) {
            this.metrics.recordTranslationRequest({
                success: false,
                error,
                responseTime: Date.now() - startTime,
                sourceLang,
                targetLang,
                textLength: text.length
            });
            throw error;
        }
    }

    async processMessageBatch(channelId, messages, settings) {
        const options = {
            settings,
            timeout: this.config.batch.timeout || 30000,
            delay: this.config.batch.delay || 100
        };

        // メッセージにタイムスタンプを追加
        const timestampedMessages = messages.map(msg => ({
            ...msg,
            timestamp: Date.now()
        }));

        // バッチ処理に追加
        await this.batchProcessor.addToBatch(channelId, timestampedMessages, options);
        
        return { queued: messages.length, channelId };
    }

    async getChannelStats(channelId) {
        return {
            translation: this.metrics.getChannelStats(channelId),
            cache: this.cache.getStats(),
            batch: this.batchProcessor.getStats()
        };
    }

    async getSystemHealth() {
        const engineStats = this.engine.getStats();
        const cacheStats = this.cache.getStats();
        const batchStats = this.batchProcessor.getStats();
        const metricsStats = this.metrics.getSummary();

        return {
            status: this.isReady && engineStats.isHealthy ? 'healthy' : 'unhealthy',
            uptime: process.uptime(),
            components: {
                engine: engineStats,
                cache: cacheStats,
                batch: batchStats,
                metrics: metricsStats
            },
            performance: {
                avgResponseTime: metricsStats.translation.avgResponseTime,
                cacheHitRate: cacheStats.hitRate,
                successRate: metricsStats.translation.successRate
            }
        };
    }

    async getDetailedMetrics() {
        return {
            system: await this.getSystemHealth(),
            metrics: this.metrics.exportMetrics(),
            timeSeries: {
                translation: this.metrics.getTimeSeries('translation_requests'),
                errors: this.metrics.getTimeSeries('errors'),
                responseTime: this.metrics.getTimeSeries('response_time'),
                memoryUsage: this.metrics.getTimeSeries('memory_usage')
            },
            languages: this.metrics.getLanguageStats()
        };
    }

    async clearCache() {
        this.cache.clear();
        return { success: true, message: 'Cache cleared' };
    }

    async resetMetrics() {
        this.metrics.reset();
        return { success: true, message: 'Metrics reset' };
    }

    async shutdown() {
        this.emit('serviceShutdown');
        
        // 各コンポーネントのクリーンアップ
        if (this.cache) {
            this.cache.destroy();
        }
        
        if (this.batchProcessor) {
            await this.batchProcessor.destroy();
        }
        
        this.isReady = false;
        return { success: true, message: 'Service shutdown complete' };
    }

    // 設定のホットリロード
    async reloadConfig(newConfig) {
        this.emit('configReloading', newConfig);
        
        try {
            // 新しい設定でコンポーネントを更新
            this.config = { ...this.config, ...newConfig };
            
            // 必要に応じてコンポーネントを再初期化
            if (newConfig.cache) {
                this.cache.destroy();
                this.cache = new CacheManager(newConfig.cache);
            }
            
            this.emit('configReloaded', this.config);
            return { success: true, message: 'Configuration reloaded' };
            
        } catch (error) {
            this.emit('configReloadError', error);
            throw error;
        }
    }
}

module.exports = TranslationService;