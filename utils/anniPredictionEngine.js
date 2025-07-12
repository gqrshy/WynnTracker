const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PythonBridge } = require('./pythonBridge');

// Annihilationの基本間隔: 3日4時間31分（ミリ秒）
const ANNI_INTERVAL = (3 * 24 * 60 * 60 * 1000) + (4 * 60 * 60 * 1000) + (31 * 60 * 1000);
const HISTORY_DATA_PATH = path.join(__dirname, '..', 'data', 'anni_history.json');
const PREDICTION_CACHE_PATH = path.join(__dirname, '..', 'data', 'prediction_cache.json');

// 1. 基本予測エンジン
class AnniPredictionEngine {
    constructor() {
        this.history = this.loadHistory();
        this.cache = this.loadCache();
    }
    
    loadHistory() {
        try {
            if (fs.existsSync(HISTORY_DATA_PATH)) {
                const history = JSON.parse(fs.readFileSync(HISTORY_DATA_PATH, 'utf8'));
                console.log(`[DEBUG] Loaded history: ${history.events?.length || 0} events from ${HISTORY_DATA_PATH}`);
                return history;
            } else {
                console.log(`[DEBUG] History file not found: ${HISTORY_DATA_PATH}`);
            }
        } catch (error) {
            console.error('[ERROR] 履歴ロードエラー:', error);
        }
        return { events: [] };
    }
    
    loadCache() {
        try {
            if (fs.existsSync(PREDICTION_CACHE_PATH)) {
                const cache = JSON.parse(fs.readFileSync(PREDICTION_CACHE_PATH, 'utf8'));
                // 1時間以内のキャッシュのみ有効
                if (new Date() - new Date(cache.timestamp) < 60 * 60 * 1000) {
                    // predictedTimeをDateオブジェクトに変換
                    if (cache.predictedTime && typeof cache.predictedTime === 'string') {
                        cache.predictedTime = new Date(cache.predictedTime);
                    }
                    return cache;
                }
            }
        } catch (error) {
            console.error('[ERROR] キャッシュロードエラー:', error);
        }
        return null;
    }
    
    saveHistory() {
        try {
            fs.writeFileSync(HISTORY_DATA_PATH, JSON.stringify(this.history, null, 2));
        } catch (error) {
            console.error('[ERROR] 履歴保存エラー:', error);
        }
    }
    
    saveCache(prediction) {
        try {
            const cache = {
                ...prediction,
                timestamp: new Date().toISOString()
            };
            fs.writeFileSync(PREDICTION_CACHE_PATH, JSON.stringify(cache, null, 2));
        } catch (error) {
            console.error('[ERROR] キャッシュ保存エラー:', error);
        }
    }
    
    // イベント記録を追加
    addEvent(timestamp, source = 'manual', confidence = 100, metadata = {}) {
        const event = {
            timestamp: new Date(timestamp).toISOString(),
            source: source,
            confidence: confidence,
            addedAt: new Date().toISOString(),
            ...metadata
        };
        
        // 重複チェック（30分以内の記録は重複とみなす）
        const isDuplicate = this.history.events.some(e => {
            const timeDiff = Math.abs(new Date(e.timestamp) - new Date(timestamp));
            return timeDiff < 30 * 60 * 1000;
        });
        
        if (!isDuplicate) {
            this.history.events.push(event);
            this.history.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            this.saveHistory();
        }
        
        return !isDuplicate;
    }
    
    // 統計的予測
    predictNext() {
        if (this.cache && this.cache.predictedTime) {
            return this.cache;
        }
        
        const now = new Date();
        // 過去のイベントのみを使用（未来の予測データは除外）
        const events = this.history.events.filter(e => {
            const eventTime = new Date(e.timestamp);
            return e.confidence >= 70 && eventTime <= now;
        });
        
        console.log(`[DEBUG] Local prediction: ${this.history.events.length} total events, ${events.length} confident past events`);
        
        if (events.length > 0) {
            const lastPastEvent = events[events.length - 1];
            console.log(`[DEBUG] Most recent past event: ${lastPastEvent.timestamp} (${lastPastEvent.source})`);
        }
        
        if (events.length === 0) {
            console.log('[DEBUG] Local prediction: No confident past events found');
            return null;
        }
        
        let prediction;
        
        if (events.length === 1) {
            // 1つのイベントのみの場合、基本間隔を使用
            prediction = this.basicPrediction(events[0]);
        } else {
            // 複数のイベントがある場合、統計的分析
            prediction = this.statisticalPrediction(events);
        }
        
        this.saveCache(prediction);
        return prediction;
    }
    
    basicPrediction(lastEvent) {
        const lastTime = new Date(lastEvent.timestamp);
        const nextTime = new Date(lastTime.getTime() + ANNI_INTERVAL);
        
        return {
            predictedTime: nextTime,
            confidence: 70,
            method: 'basic',
            basedOnEvents: 1,
            lastEvent: lastEvent.timestamp
        };
    }
    
    statisticalPrediction(events) {
        // ダウンタイム調整済み間隔の計算
        const intervals = [];
        const downtimeAdjustments = [];
        
        for (let i = 1; i < events.length; i++) {
            const currentEvent = events[i];
            const previousEvent = events[i-1];
            
            let interval = new Date(currentEvent.timestamp) - new Date(previousEvent.timestamp);
            
            // ダウンタイム考慮: ダウンタイム中のイベントは間隔を調整
            let downtimeAdjustment = 0;
            if (currentEvent.downtime) {
                // ダウンタイム中のイベントは通常より遅延していると仮定
                // 1-4時間のランダムな遅延を想定して調整
                downtimeAdjustment = Math.min(4 * 60 * 60 * 1000, interval * 0.1);
                interval -= downtimeAdjustment;
            }
            
            intervals.push(interval);
            downtimeAdjustments.push(downtimeAdjustment);
        }
        
        // 平均間隔と標準偏差（ダウンタイム調整後）
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const stdDeviation = Math.sqrt(variance);
        
        // 最後のイベントから予測
        const lastEvent = events[events.length - 1];
        const lastTime = new Date(lastEvent.timestamp);
        let nextTime = new Date(lastTime.getTime() + avgInterval);
        
        // 最後のイベントがダウンタイム中だった場合、次回予測に補正を追加
        if (lastEvent.downtime) {
            // ダウンタイム補正: 次回は通常より少し早く来る可能性
            const downtimeCorrection = Math.random() * 2 * 60 * 60 * 1000; // 0-2時間早く
            nextTime = new Date(nextTime.getTime() - downtimeCorrection);
        }
        
        // 信頼度計算（標準偏差とダウンタイムの影響を考慮）
        const maxStdDev = 6 * 60 * 60 * 1000; // 6時間
        let confidence = Math.max(60, 95 - (stdDeviation / maxStdDev) * 35);
        
        // ダウンタイムが含まれている場合は信頼度を下げる
        const downtimeEvents = events.filter(e => e.downtime).length;
        const downtimeRatio = downtimeEvents / events.length;
        confidence = confidence * (1 - downtimeRatio * 0.2); // 最大20%減
        
        return {
            predictedTime: nextTime,
            confidence: Math.round(confidence),
            method: 'statistical_downtime_aware',
            basedOnEvents: events.length,
            averageInterval: avgInterval,
            standardDeviation: stdDeviation,
            downtimeEvents: downtimeEvents,
            downtimeAdjustments: downtimeAdjustments.reduce((sum, adj) => sum + adj, 0),
            lastEvent: lastEvent.timestamp
        };
    }
    
    // 予測の精度評価
    evaluatePredictionAccuracy() {
        const now = new Date();
        // 過去のイベントのみを使用
        const events = this.history.events.filter(e => {
            const eventTime = new Date(e.timestamp);
            return eventTime <= now;
        });
        
        if (events.length < 3) return null;
        
        const predictions = [];
        
        // 過去の予測と実際の結果を比較
        for (let i = 2; i < events.length; i++) {
            const historicalEvents = events.slice(0, i);
            const actualEvent = events[i];
            
            // その時点での予測を再現
            const prediction = this.statisticalPrediction(historicalEvents);
            const actualTime = new Date(actualEvent.timestamp);
            const predictedTime = new Date(prediction.predictedTime);
            
            const errorMinutes = Math.abs(actualTime - predictedTime) / (60 * 1000);
            
            predictions.push({
                predicted: prediction.predictedTime,
                actual: actualEvent.timestamp,
                errorMinutes: errorMinutes
            });
        }
        
        const avgError = predictions.reduce((sum, p) => sum + p.errorMinutes, 0) / predictions.length;
        const accuracyScore = Math.max(0, 100 - (avgError / 60) * 20); // 1時間の誤差で20%減
        
        return {
            averageErrorMinutes: Math.round(avgError),
            accuracyScore: Math.round(accuracyScore),
            totalPredictions: predictions.length,
            predictions: predictions
        };
    }
}


// 3. コミュニティAPI（プレースホルダー）
class CommunityAnniAPI {
    constructor() {
        this.apiUrl = process.env.COMMUNITY_API_URL || null;
        this.apiKey = process.env.COMMUNITY_API_KEY || null;
    }
    
    async reportEvent(timestamp, reporterDiscordId, confidence = 100) {
        if (!this.apiUrl || !this.apiKey) {
            console.log('[INFO] コミュニティAPI未設定のため、報告をスキップ');
            return null;
        }
        
        try {
            const response = await axios.post(`${this.apiUrl}/api/annihilation/report`, {
                timestamp: timestamp,
                reporter: reporterDiscordId,
                confidence: confidence,
                source: 'discord_bot'
            }, {
                timeout: 5000,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            return response.data;
        } catch (error) {
            console.error('[ERROR] コミュニティAPI報告エラー:', error.message);
            return null;
        }
    }
    
    async getPrediction() {
        if (!this.apiUrl || !this.apiKey) {
            return null;
        }
        
        try {
            const response = await axios.get(`${this.apiUrl}/api/annihilation/prediction`, {
                timeout: 5000,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            return {
                nextEvent: new Date(response.data.predicted_time),
                confidence: response.data.confidence || 75,
                basedOnReports: response.data.report_count || 0,
                lastUpdate: new Date(response.data.last_update),
                source: 'Community'
            };
        } catch (error) {
            console.error('[ERROR] コミュニティAPI予測取得エラー:', error.message);
            return null;
        }
    }
}

// 4. WynncraftAPI（アクティビティベース予測）
class WynncraftAPI {
    constructor() {
        this.baseUrl = 'https://api.wynncraft.com/v3';
    }
    
    async detectRecentSpikes() {
        try {
            // プレイヤー数の急増を検出
            const response = await axios.get(`${this.baseUrl}/player`, {
                timeout: 5000
            });
            
            // 実装は実際のAPIレスポンス構造に依存
            // ここではプレースホルダー
            return [];
            
        } catch (error) {
            console.error('[ERROR] WynncraftAPI エラー:', error.message);
            return [];
        }
    }
}

// 5. ハイブリッド予測システム
class HybridPredictionSystem {
    constructor() {
        this.localEngine = new AnniPredictionEngine();
        this.communityAPI = new CommunityAnniAPI();
        this.wynncraftAPI = new WynncraftAPI();
        this.pythonBridge = new PythonBridge();
    }
    
    async getOptimalPrediction() {
        console.log('[INFO] 複数ソースからの予測を開始...');
        
        const predictions = await Promise.allSettled([
            this.getLocalPrediction(),
            this.getCommunityPrediction(),
            this.getARIMAPrediction()
        ]);
        
        const validPredictions = predictions
            .filter(result => result.status === 'fulfilled' && result.value !== null)
            .map(result => result.value);
        
        // デバッグ情報を詳細に出力
        console.log('[DEBUG] Prediction results:');
        predictions.forEach((result, index) => {
            const sources = ['Local', 'Community', 'ARIMA'];
            if (result.status === 'fulfilled') {
                console.log(`[DEBUG] ${sources[index]}: ${result.value ? 'Success' : 'Null'}`);
                if (result.value) {
                    console.log(`[DEBUG] ${sources[index]} confidence: ${result.value.confidence}%`);
                }
            } else {
                console.log(`[DEBUG] ${sources[index]}: Error - ${result.reason?.message || 'Unknown'}`);
            }
        });
        
        if (validPredictions.length === 0) {
            console.log('[WARN] 有効な予測が見つかりませんでした');
            return null;
        }
        
        console.log(`[INFO] ${validPredictions.length}個の予測を統合中...`);
        
        // 信頼度で重み付け平均を計算
        const weightedSum = validPredictions.reduce((sum, pred) => {
            const weight = (pred.confidence || 50) / 100;
            // nextEventがDateオブジェクトでない場合はDateに変換
            const eventTime = pred.nextEvent instanceof Date ? 
                pred.nextEvent.getTime() : 
                new Date(pred.nextEvent).getTime();
            return sum + (eventTime * weight);
        }, 0);
        
        const totalWeight = validPredictions.reduce((sum, pred) => {
            return sum + ((pred.confidence || 50) / 100);
        }, 0);
        
        const averageTime = new Date(weightedSum / totalWeight);
        
        // 予測の一致度を計算
        const deviations = validPredictions.map(pred => {
            // nextEventがDateオブジェクトでない場合はDateに変換
            const eventTime = pred.nextEvent instanceof Date ? 
                pred.nextEvent.getTime() : 
                new Date(pred.nextEvent).getTime();
            return Math.abs(eventTime - averageTime.getTime());
        });
        
        const maxDeviation = Math.max(...deviations);
        const agreementScore = Math.max(0, 100 - (maxDeviation / (60 * 60 * 1000) * 10));
        
        // 最終信頼度は個別の信頼度と一致度の組み合わせ
        const avgConfidence = validPredictions.reduce((sum, pred) => sum + (pred.confidence || 50), 0) / validPredictions.length;
        const finalConfidence = Math.round((avgConfidence + agreementScore) / 2);
        
        return {
            predictedTime: averageTime,
            confidence: Math.max(0, Math.min(100, finalConfidence)),
            agreement: Math.round(agreementScore),
            sources: validPredictions.map(p => p.source),
            predictions: validPredictions,
            method: 'hybrid'
        };
    }
    
    async getLocalPrediction() {
        try {
            const pred = this.localEngine.predictNext();
            if (!pred) return null;
            
            // Dateオブジェクトであることを確認
            if (!(pred.predictedTime instanceof Date)) {
                console.warn('[WARN] Local prediction predictedTime is not a Date object:', typeof pred.predictedTime);
                return null;
            }
            
            return {
                nextEvent: pred.predictedTime,
                confidence: pred.confidence,
                source: 'Local',
                method: pred.method,
                basedOnEvents: pred.basedOnEvents
            };
        } catch (error) {
            console.error('[ERROR] Local prediction error:', error);
            return null;
        }
    }
    
    
    async getCommunityPrediction() {
        try {
            const pred = await this.communityAPI.getPrediction();
            if (!pred) return null;
            
            // Dateオブジェクトであることを確認
            if (!(pred.nextEvent instanceof Date)) {
                console.warn('[WARN] Community prediction nextEvent is not a Date object:', typeof pred.nextEvent);
                return null;
            }
            
            return {
                nextEvent: pred.nextEvent,
                confidence: pred.confidence,
                source: 'Community',
                basedOnReports: pred.basedOnReports
            };
        } catch (error) {
            console.error('[ERROR] Community prediction error:', error);
            return null;
        }
    }
    
    async getARIMAPrediction() {
        try {
            const pred = await this.pythonBridge.getNextPrediction();
            if (!pred || !pred.success) return null;
            
            // Dateオブジェクトであることを確認
            if (!(pred.nextEvent instanceof Date)) {
                console.warn('[WARN] ARIMA prediction nextEvent is not a Date object:', typeof pred.nextEvent);
                return null;
            }
            
            return {
                nextEvent: pred.nextEvent,
                confidence: pred.confidence,
                source: 'ARIMA',
                method: pred.method,
                modelInfo: pred.modelInfo,
                qualityMetrics: pred.qualityMetrics,
                intervalDays: pred.intervalDays
            };
        } catch (error) {
            console.error('[ERROR] ARIMA予測エラー:', error);
            return null;
        }
    }
    
    // イベント発生の自動検出と記録
    async detectAndRecordEvent() {
        // 複数のソースからイベント発生を検出
        const spikes = await this.wynncraftAPI.detectRecentSpikes();
        
        // 検出ロジックの実装
        // 実際の実装では、プレイヤー数の急増、チャット活動の増加などを監視
        
        return false; // プレースホルダー
    }
}

module.exports = {
    AnniPredictionEngine,
    CommunityAnniAPI,
    WynncraftAPI,
    HybridPredictionSystem
};