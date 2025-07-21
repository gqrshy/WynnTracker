const BaseService = require('./BaseService');
const ARIMAPredictor = require('../utils/ARIMAPredictor');
const { ErrorTypes } = require('../utils/ErrorHandler');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * 高精度Annihilation予測サービス
 * Wynnpoolと同等以上の精度を目指す
 */
class AnnihilationService extends BaseService {
    constructor(options = {}) {
        super(options);
        
        // 予測エンジン
        this.arimaPredictor = new ARIMAPredictor([1, 1, 1]);
        this.backupPredictor = new ARIMAPredictor([2, 1, 1]); // バックアップモデル
        
        // データストレージ
        this.historyFile = path.join(__dirname, '..', '..', 'data', 'annihilation_history.json');
        this.predictionsFile = path.join(__dirname, '..', '..', 'data', 'annihilation_predictions.json');
        this.accuracyFile = path.join(__dirname, '..', '..', 'data', 'prediction_accuracy.json');
        
        // メモリキャッシュ
        this.eventHistory = [];
        this.currentPredictions = {};
        this.accuracyMetrics = {};
        
        // 予測設定
        this.config = {
            minDataPoints: 5,
            maxOutlierDeviation: 3.0,
            predictionSteps: 10,
            cacheLifetime: 300000, // 5分
            accuracyThreshold: 0.8,
            retentionDays: 90,
            githubDataUrl: 'https://raw.githubusercontent.com/AiverAiva/anni-pred/main/data/history.json',
            githubDataCacheHours: 6 // 6時間ごとに更新
        };
        
        // 自動更新タイマー
        this.updateTimer = null;
    }

    async onInitialize() {
        try {
            // データファイルの初期化
            await this.ensureDataDirectories();
            
            // 履歴データの読み込み（GitHub経由）
            await this.loadHistoryFromGitHub();
            await this.loadPredictions();
            await this.loadAccuracyMetrics();
            
            // ARIMA環境のチェック
            const arimaAvailable = await this.arimaPredictor.checkAvailability();
            if (!arimaAvailable) {
                this.warn('ARIMA predictor not available, using fallback methods');
            }
            
            // 自動更新の開始
            this.startAutoUpdate();
            
            this.info('AnnihilationService initialized with enhanced prediction capabilities');
            
        } catch (error) {
            this.error('Failed to initialize AnnihilationService', { error: error.message });
            throw error;
        }
    }

    /**
     * データディレクトリの確保
     */
    async ensureDataDirectories() {
        const dataDir = path.dirname(this.historyFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    /**
     * GitHubから最新の履歴データを読み込み
     */
    async loadHistoryFromGitHub() {
        try {
            // まずローカルキャッシュをチェック
            const shouldUpdateFromGitHub = await this.shouldUpdateGitHubData();
            
            if (shouldUpdateFromGitHub) {
                this.info('Fetching latest Annihilation history from GitHub...');
                
                // GitHubから最新データを取得
                const response = await axios.get(this.config.githubDataUrl, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'WynnTracker-Revival/1.0'
                    }
                });
                
                if (response.data && Array.isArray(response.data)) {
                    // GitHub形式 [{datetime_utc: timestamp}] を内部形式に変換
                    const githubEvents = response.data.map((event, index) => ({
                        datetime_utc: event.datetime_utc,
                        server: 'asia', // デフォルトサーバー
                        source: 'github_anni_pred',
                        confidence: 100,
                        verified: true,
                        id: `github_${event.datetime_utc}`,
                        imported_at: Date.now()
                    }));
                    
                    this.eventHistory = this.cleanHistoryData(githubEvents);
                    
                    // ローカルファイルに保存（キャッシュとして）
                    await this.saveHistoryData();
                    
                    // GitHub取得時刻を記録
                    this.setGitHubUpdateTimestamp();
                    
                    this.info(`Loaded ${this.eventHistory.length} events from GitHub (AiverAiva/anni-pred)`);
                } else {
                    throw new Error('Invalid GitHub data format');
                }
                
            } else {
                // ローカルキャッシュから読み込み
                await this.loadHistoryData();
                this.info(`Using cached GitHub data (${this.eventHistory.length} events)`);
            }
            
        } catch (error) {
            this.warn('Failed to fetch from GitHub, falling back to local data', { error: error.message });
            
            // GitHubが失敗した場合はローカルデータをフォールバック
            await this.loadHistoryData();
            
            if (this.eventHistory.length === 0) {
                this.warn('No local data available, manual data entry may be required');
            }
        }
    }

    /**
     * ローカルファイルから履歴データを読み込み（フォールバック用）
     */
    async loadHistoryData() {
        try {
            if (fs.existsSync(this.historyFile)) {
                const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
                this.eventHistory = data.events || [];
                
                // データのクリーニング
                this.eventHistory = this.cleanHistoryData(this.eventHistory);
                
                this.info(`Loaded ${this.eventHistory.length} historical Annihilation events from local cache`);
            } else {
                this.eventHistory = [];
                this.info('No local historical data found');
            }
        } catch (error) {
            this.warn('Failed to load local history data', { error: error.message });
            this.eventHistory = [];
        }
    }

    /**
     * GitHubデータの更新が必要かチェック
     */
    async shouldUpdateGitHubData() {
        try {
            const cacheFile = path.join(path.dirname(this.historyFile), 'github_cache_info.json');
            
            if (!fs.existsSync(cacheFile)) {
                return true; // キャッシュファイルがない場合は更新
            }
            
            const cacheInfo = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            const lastUpdate = cacheInfo.last_github_update || 0;
            const cacheExpiry = this.config.githubDataCacheHours * 60 * 60 * 1000;
            
            return (Date.now() - lastUpdate) > cacheExpiry;
            
        } catch (error) {
            return true; // エラーの場合は更新
        }
    }

    /**
     * GitHub更新時刻を記録
     */
    setGitHubUpdateTimestamp() {
        try {
            const cacheFile = path.join(path.dirname(this.historyFile), 'github_cache_info.json');
            const cacheInfo = {
                last_github_update: Date.now(),
                source: 'AiverAiva/anni-pred',
                events_count: this.eventHistory.length
            };
            
            fs.writeFileSync(cacheFile, JSON.stringify(cacheInfo, null, 2));
        } catch (error) {
            this.warn('Failed to save GitHub cache info', { error: error.message });
        }
    }

    /**
     * 予測データの読み込み
     */
    async loadPredictions() {
        try {
            if (fs.existsSync(this.predictionsFile)) {
                const data = JSON.parse(fs.readFileSync(this.predictionsFile, 'utf8'));
                
                // キャッシュの有効性チェック
                if (data.timestamp && Date.now() - data.timestamp < this.config.cacheLifetime) {
                    this.currentPredictions = data;
                    this.info('Loaded cached predictions');
                } else {
                    this.currentPredictions = {};
                    this.info('Cached predictions expired');
                }
            }
        } catch (error) {
            this.warn('Failed to load predictions', { error: error.message });
            this.currentPredictions = {};
        }
    }

    /**
     * 精度メトリクスの読み込み
     */
    async loadAccuracyMetrics() {
        try {
            if (fs.existsSync(this.accuracyFile)) {
                this.accuracyMetrics = JSON.parse(fs.readFileSync(this.accuracyFile, 'utf8'));
                this.info('Loaded accuracy metrics');
            }
        } catch (error) {
            this.warn('Failed to load accuracy metrics', { error: error.message });
            this.accuracyMetrics = {};
        }
    }

    /**
     * 履歴データのクリーニング
     */
    cleanHistoryData(events) {
        // 重複の除去
        const uniqueEvents = events.filter((event, index, self) => 
            index === self.findIndex(e => Math.abs(e.datetime_utc - event.datetime_utc) < 30000)
        );

        // 時間順ソート
        uniqueEvents.sort((a, b) => a.datetime_utc - b.datetime_utc);

        // 異常値の除去（間隔が異常に長い/短いもの）
        if (uniqueEvents.length > 2) {
            const intervals = [];
            for (let i = 1; i < uniqueEvents.length; i++) {
                intervals.push(uniqueEvents[i].datetime_utc - uniqueEvents[i-1].datetime_utc);
            }

            const meanInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
            const stdInterval = Math.sqrt(intervals.reduce((sum, interval) => 
                sum + Math.pow(interval - meanInterval, 2), 0) / intervals.length);

            const filteredEvents = [uniqueEvents[0]]; // 最初のイベントは保持
            
            for (let i = 1; i < uniqueEvents.length; i++) {
                const interval = uniqueEvents[i].datetime_utc - uniqueEvents[i-1].datetime_utc;
                if (Math.abs(interval - meanInterval) <= this.config.maxOutlierDeviation * stdInterval) {
                    filteredEvents.push(uniqueEvents[i]);
                }
            }

            return filteredEvents;
        }

        return uniqueEvents;
    }

    /**
     * 新しいAnnihilationイベントの追加
     */
    async addEvent(timestamp, source = 'manual', metadata = {}) {
        return this.withErrorHandling(async () => {
            const event = {
                datetime_utc: new Date(timestamp).getTime(),
                source: source,
                predicted: false,
                confidence: metadata.confidence || 1.0,
                addedAt: Date.now(),
                ...metadata
            };

            // 重複チェック
            const isDuplicate = this.eventHistory.some(e => 
                Math.abs(e.datetime_utc - event.datetime_utc) < 30000
            );

            if (!isDuplicate) {
                this.eventHistory.push(event);
                this.eventHistory.sort((a, b) => a.datetime_utc - b.datetime_utc);
                
                await this.saveHistoryData();
                
                this.info('Added new Annihilation event', {
                    timestamp: new Date(event.datetime_utc).toISOString(),
                    source: source
                });

                // 予測の自動更新
                await this.updatePredictions();
                
                return event;
            }

            this.info('Event already exists, skipping duplicate');
            return null;

        }, {
            method: 'addEvent',
            timestamp: new Date(timestamp).toISOString()
        });
    }

    /**
     * 次のAnnihilation予測の取得
     */
    async getNextPrediction() {
        return this.withErrorHandling(async () => {
            // データの新鮮さをチェック
            const lastEventTime = this.eventHistory.length > 0 ? 
                Math.max(...this.eventHistory.map(e => e.datetime_utc)) : 0;
            const dataAge = Date.now() - lastEventTime;
            const maxDataAge = 7 * 24 * 60 * 60 * 1000; // 7日間
            
            if (dataAge > maxDataAge) {
                this.warn(`Data is too old (${Math.floor(dataAge / (24 * 60 * 60 * 1000))} days), predictions may be inaccurate`);
                
                // 古いデータでも予測可能な場合の警告付き予測
                const fallbackPrediction = this.generateEmergencyPrediction(lastEventTime);
                return fallbackPrediction;
            }

            // キャッシュされた予測をチェック
            if (this.currentPredictions.next && 
                this.currentPredictions.timestamp && 
                Date.now() - this.currentPredictions.timestamp < this.config.cacheLifetime) {
                
                const prediction = this.currentPredictions.next;
                
                // 予測時刻が過去でないかチェック
                if (prediction.datetime_utc > Date.now()) {
                    return prediction;
                }
            }

            // 新しい予測を生成
            await this.updatePredictions();
            return this.currentPredictions.next || null;

        }, {
            method: 'getNextPrediction'
        });
    }

    /**
     * 複数の予測の取得
     */
    async getMultiplePredictions(count = 5) {
        return this.withErrorHandling(async () => {
            await this.updatePredictions();
            
            const predictions = this.currentPredictions.multiple || [];
            return predictions.slice(0, count);

        }, {
            method: 'getMultiplePredictions',
            count
        });
    }

    /**
     * 予測の更新
     */
    async updatePredictions() {
        return this.withErrorHandling(async () => {
            if (this.eventHistory.length < this.config.minDataPoints) {
                throw new Error(`Insufficient data for prediction (need at least ${this.config.minDataPoints} events)`);
            }

            const timestamps = this.eventHistory.map(e => e.datetime_utc);
            
            try {
                // ARIMAモデルによる予測
                const arimaPrediction = await this.arimaPredictor.predictNextEvent(timestamps);
                const arimaMultiple = await this.arimaPredictor.predictMultipleEvents(timestamps, this.config.predictionSteps);
                
                // 統計的予測（フォールバック）
                const statisticalPrediction = this.generateStatisticalPrediction(timestamps);
                
                // アンサンブル予測（複数モデルの組み合わせ）
                const ensemblePrediction = this.generateEnsemblePrediction([
                    arimaPrediction,
                    statisticalPrediction
                ]);

                // 予測結果の保存
                this.currentPredictions = {
                    timestamp: Date.now(),
                    next: ensemblePrediction,
                    arima: arimaPrediction,
                    statistical: statisticalPrediction,
                    multiple: arimaMultiple,
                    model_info: {
                        data_points: this.eventHistory.length,
                        last_event: Math.max(...timestamps),
                        prediction_method: 'ensemble_arima_statistical'
                    }
                };

                await this.savePredictions();
                
                this.info('Predictions updated successfully', {
                    next_prediction: new Date(ensemblePrediction.datetime_utc).toISOString(),
                    confidence: ensemblePrediction.confidence,
                    method: ensemblePrediction.method
                });

                return this.currentPredictions;

            } catch (arimaError) {
                // ARIMAが失敗した場合の統計的フォールバック
                this.warn('ARIMA prediction failed, using statistical fallback', {
                    error: arimaError.message
                });

                const statisticalPrediction = this.generateStatisticalPrediction(timestamps);
                
                this.currentPredictions = {
                    timestamp: Date.now(),
                    next: statisticalPrediction,
                    statistical: statisticalPrediction,
                    model_info: {
                        data_points: this.eventHistory.length,
                        last_event: Math.max(...timestamps),
                        prediction_method: 'statistical_fallback'
                    }
                };

                await this.savePredictions();
                return this.currentPredictions;
            }

        }, {
            method: 'updatePredictions'
        });
    }

    /**
     * 統計的予測の生成
     */
    generateStatisticalPrediction(timestamps) {
        const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
        
        // 間隔の計算
        const intervals = [];
        for (let i = 1; i < sortedTimestamps.length; i++) {
            intervals.push(sortedTimestamps[i] - sortedTimestamps[i-1]);
        }

        // 異常値の除去
        const meanInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const stdInterval = Math.sqrt(intervals.reduce((sum, interval) => 
            sum + Math.pow(interval - meanInterval, 2), 0) / intervals.length);

        const filteredIntervals = intervals.filter(interval => 
            Math.abs(interval - meanInterval) <= 2 * stdInterval
        );

        // 予測間隔の計算
        const predictedInterval = filteredIntervals.length > 0 ? 
            filteredIntervals.reduce((sum, interval) => sum + interval, 0) / filteredIntervals.length :
            meanInterval;

        // 次のイベント時刻
        const lastTimestamp = Math.max(...sortedTimestamps);
        const nextTimestamp = lastTimestamp + predictedInterval;

        // 信頼度の計算
        const variability = stdInterval / meanInterval;
        const confidence = Math.max(0.5, Math.min(0.95, 1 - variability));

        return {
            datetime_utc: nextTimestamp,
            predicted: true,
            confidence: confidence,
            method: 'statistical',
            model_info: {
                predicted_interval_ms: predictedInterval,
                predicted_interval_hours: predictedInterval / (1000 * 60 * 60),
                data_points: timestamps.length,
                variability: variability
            }
        };
    }

    /**
     * アンサンブル予測の生成
     */
    generateEnsemblePrediction(predictions) {
        const validPredictions = predictions.filter(p => p && p.datetime_utc);
        
        if (validPredictions.length === 0) {
            throw new Error('No valid predictions for ensemble');
        }

        if (validPredictions.length === 1) {
            return {
                ...validPredictions[0],
                method: 'ensemble_single'
            };
        }

        // 重み付き平均（信頼度による重み付け）
        const totalWeight = validPredictions.reduce((sum, p) => sum + (p.confidence || 0.5), 0);
        const weightedTime = validPredictions.reduce((sum, p) => 
            sum + (p.datetime_utc * (p.confidence || 0.5)), 0) / totalWeight;

        // 合成信頼度
        const avgConfidence = validPredictions.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / validPredictions.length;
        
        // 予測の一致度
        const deviations = validPredictions.map(p => Math.abs(p.datetime_utc - weightedTime));
        const maxDeviation = Math.max(...deviations);
        const agreement = Math.max(0, 1 - (maxDeviation / (24 * 60 * 60 * 1000))); // 24時間で0

        const finalConfidence = Math.min(0.95, (avgConfidence + agreement) / 2);

        return {
            datetime_utc: weightedTime,
            predicted: true,
            confidence: finalConfidence,
            method: 'ensemble',
            model_info: {
                source_methods: validPredictions.map(p => p.method),
                agreement_score: agreement,
                component_confidences: validPredictions.map(p => p.confidence),
                weighted_average: true
            }
        };
    }

    /**
     * 予測精度の評価
     */
    async evaluatePredictionAccuracy() {
        return this.withErrorHandling(async () => {
            if (this.eventHistory.length < 10) {
                throw new Error('Insufficient data for accuracy evaluation');
            }

            const arimaAvailable = await this.arimaPredictor.checkAvailability();
            
            if (arimaAvailable) {
                const timestamps = this.eventHistory.map(e => e.datetime_utc);
                const accuracy = await this.arimaPredictor.evaluateAccuracy(timestamps);
                
                this.accuracyMetrics = {
                    ...accuracy,
                    evaluated_at: Date.now(),
                    method: 'arima_cross_validation'
                };
                
                await this.saveAccuracyMetrics();
                return this.accuracyMetrics;
            } else {
                throw new Error('ARIMA predictor not available for accuracy evaluation');
            }

        }, {
            method: 'evaluatePredictionAccuracy'
        });
    }

    /**
     * 履歴データの保存
     */
    async saveHistoryData() {
        try {
            const data = {
                events: this.eventHistory,
                updated_at: Date.now(),
                version: '2.0'
            };
            
            fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2));
            this.debug('History data saved', { events: this.eventHistory.length });
        } catch (error) {
            this.error('Failed to save history data', { error: error.message });
        }
    }

    /**
     * 予測データの保存
     */
    async savePredictions() {
        try {
            fs.writeFileSync(this.predictionsFile, JSON.stringify(this.currentPredictions, null, 2));
            this.debug('Predictions saved');
        } catch (error) {
            this.error('Failed to save predictions', { error: error.message });
        }
    }

    /**
     * 精度メトリクスの保存
     */
    async saveAccuracyMetrics() {
        try {
            fs.writeFileSync(this.accuracyFile, JSON.stringify(this.accuracyMetrics, null, 2));
            this.debug('Accuracy metrics saved');
        } catch (error) {
            this.error('Failed to save accuracy metrics', { error: error.message });
        }
    }

    /**
     * 自動更新の開始
     */
    startAutoUpdate() {
        // 5分ごとに予測を更新
        this.updateTimer = setInterval(async () => {
            try {
                await this.updatePredictions();
            } catch (error) {
                this.warn('Auto-update failed', { error: error.message });
            }
        }, this.config.cacheLifetime);

        // 6時間ごとにGitHubから最新データを更新
        this.githubUpdateTimer = setInterval(async () => {
            try {
                await this.updateFromGitHub();
            } catch (error) {
                this.warn('GitHub auto-update failed', { error: error.message });
            }
        }, this.config.githubDataCacheHours * 60 * 60 * 1000);

        this.info('Auto-update started (predictions: 5min, GitHub data: 6h)');
    }

    /**
     * GitHubから最新データを強制更新
     */
    async updateFromGitHub() {
        try {
            this.info('Performing scheduled GitHub data update...');
            
            // キャッシュを無視して強制更新
            const response = await axios.get(this.config.githubDataUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'WynnTracker-Revival/1.0'
                }
            });
            
            if (response.data && Array.isArray(response.data)) {
                const oldCount = this.eventHistory.length;
                
                // GitHub形式を内部形式に変換
                const githubEvents = response.data.map((event, index) => ({
                    datetime_utc: event.datetime_utc,
                    server: 'asia',
                    source: 'github_anni_pred',
                    confidence: 100,
                    verified: true,
                    id: `github_${event.datetime_utc}`,
                    imported_at: Date.now()
                }));
                
                this.eventHistory = this.cleanHistoryData(githubEvents);
                
                // データ保存とキャッシュ更新
                await this.saveHistoryData();
                this.setGitHubUpdateTimestamp();
                
                const newCount = this.eventHistory.length;
                const addedEvents = newCount - oldCount;
                
                if (addedEvents > 0) {
                    this.info(`GitHub update: ${addedEvents} new events added (total: ${newCount})`);
                    
                    // 新しいデータがある場合は予測を再計算
                    await this.updatePredictions();
                } else {
                    this.info(`GitHub update: No new events (total: ${newCount})`);
                }
            }
            
        } catch (error) {
            this.warn('GitHub scheduled update failed', { error: error.message });
        }
    }

    /**
     * サービスの統計情報
     */
    async getStatistics() {
        return {
            total_events: this.eventHistory.length,
            oldest_event: this.eventHistory.length > 0 ? 
                new Date(Math.min(...this.eventHistory.map(e => e.datetime_utc))).toISOString() : null,
            newest_event: this.eventHistory.length > 0 ? 
                new Date(Math.max(...this.eventHistory.map(e => e.datetime_utc))).toISOString() : null,
            prediction_cache_age: this.currentPredictions.timestamp ? 
                Date.now() - this.currentPredictions.timestamp : null,
            arima_available: await this.arimaPredictor.checkAvailability(),
            accuracy_metrics: this.accuracyMetrics
        };
    }

    /**
     * クリーンアップ
     */
    async onCleanup() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }

        if (this.githubUpdateTimer) {
            clearInterval(this.githubUpdateTimer);
            this.githubUpdateTimer = null;
        }

        await this.saveHistoryData();
        await this.savePredictions();
        await this.saveAccuracyMetrics();

        this.info('AnnihilationService cleanup completed');
    }

    /**
     * 緊急時予測生成（データが古い場合）
     */
    generateEmergencyPrediction(lastEventTime) {
        // 平均間隔を72時間（3日）と仮定（Wynncraft Annihilationの一般的な間隔）
        const averageInterval = 72 * 60 * 60 * 1000; // 72時間
        const now = Date.now();
        
        // 最後のイベントから次のイベントまでの推定時間
        let nextPredictedTime = lastEventTime + averageInterval;
        
        // 予測時刻が過去の場合、現在時刻から次の間隔で計算
        while (nextPredictedTime < now) {
            nextPredictedTime += averageInterval;
        }
        
        return {
            datetime_utc: nextPredictedTime,
            predicted: true,
            confidence: 0.3, // 低い信頼度
            method: 'emergency_fallback',
            warning: 'データが古いため低精度予測',
            model_info: {
                data_age_days: Math.floor((now - lastEventTime) / (24 * 60 * 60 * 1000)),
                last_event: lastEventTime,
                predicted_interval_hours: 72,
                emergency_mode: true
            }
        };
    }

    static create(options = {}) {
        return new AnnihilationService(options);
    }
}

module.exports = AnnihilationService;