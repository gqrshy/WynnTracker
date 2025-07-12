const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { HybridPredictionSystem } = require('./anniPredictionEngine');

const ANNI_DATA_PATH = path.join(__dirname, '..', 'data', 'annihilation.json');

class AutoSyncSystem {
    constructor(client) {
        this.client = client;
        this.syncInterval = 30 * 60 * 1000; // 30分ごと
        this.hybridSystem = new HybridPredictionSystem();
        this.lastSync = null;
        this.syncTimer = null;
        this.isRunning = false;
    }
    
    start() {
        if (this.isRunning) {
            console.log('[WARN] 自動同期システムは既に動作中です');
            return;
        }
        
        this.isRunning = true;
        console.log('[INFO] 自動同期システムを開始します');
        
        // 初回同期を即座に実行
        this.sync();
        
        // 定期同期の設定
        this.syncTimer = setInterval(() => {
            this.sync();
        }, this.syncInterval);
    }
    
    stop() {
        if (!this.isRunning) {
            return;
        }
        
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        
        this.isRunning = false;
        console.log('[INFO] 自動同期システムを停止しました');
    }
    
    async sync() {
        try {
            console.log('[INFO] 予測データの同期を開始...');
            const startTime = Date.now();
            
            // 複数ソースから最新データを取得
            const optimal = await this.hybridSystem.getOptimalPrediction();
            
            if (!optimal) {
                console.log('[WARN] 同期用データが取得できませんでした');
                return;
            }
            
            // 既存データとの比較
            const existingData = this.loadExistingData();
            const significantChange = this.hasSignificantChange(existingData, optimal);
            
            // ローカルデータを更新
            const anniData = {
                startTime: optimal.predictedTime.toISOString(),
                setBy: 'auto_sync',
                setAt: new Date().toISOString(),
                confidence: optimal.confidence,
                sources: optimal.sources,
                agreement: optimal.agreement,
                method: optimal.method,
                predictions: optimal.predictions.map(p => ({
                    source: p.source,
                    time: p.nextEvent.toISOString(),
                    confidence: p.confidence
                }))
            };
            
            fs.writeFileSync(ANNI_DATA_PATH, JSON.stringify(anniData, null, 2));
            
            this.lastSync = {
                time: new Date(),
                prediction: optimal,
                syncDuration: Date.now() - startTime
            };
            
            console.log(`[INFO] 同期完了 (${this.lastSync.syncDuration}ms): ${optimal.predictedTime.toLocaleString('ja-JP')}`);
            console.log(`[INFO] 信頼度: ${optimal.confidence}%, 一致度: ${optimal.agreement}%, ソース: ${optimal.sources.join(', ')}`);
            
            // 大きな変更があれば通知
            if (significantChange) {
                await this.notifySignificantChange(existingData, optimal);
            }
            
            // 予測の不一致があれば通知
            if (this.shouldNotifyDiscrepancy(optimal)) {
                await this.notifyDiscrepancy(optimal);
            }
            
        } catch (error) {
            console.error('[ERROR] 自動同期エラー:', error);
        }
    }
    
    loadExistingData() {
        try {
            if (fs.existsSync(ANNI_DATA_PATH)) {
                return JSON.parse(fs.readFileSync(ANNI_DATA_PATH, 'utf8'));
            }
        } catch (error) {
            console.error('[ERROR] 既存データロードエラー:', error);
        }
        return null;
    }
    
    hasSignificantChange(existingData, newPrediction) {
        if (!existingData || !existingData.startTime) {
            return true; // 初回設定
        }
        
        const existingTime = new Date(existingData.startTime);
        const newTime = new Date(newPrediction.predictedTime);
        
        // 30分以上の差があれば有意な変更
        const timeDiff = Math.abs(newTime - existingTime);
        const significantTimeDiff = timeDiff > 30 * 60 * 1000;
        
        // 信頼度が20%以上変化した場合
        const confidenceDiff = Math.abs((existingData.confidence || 50) - newPrediction.confidence);
        const significantConfidenceDiff = confidenceDiff > 20;
        
        return significantTimeDiff || significantConfidenceDiff;
    }
    
    shouldNotifyDiscrepancy(optimal) {
        if (optimal.predictions.length < 2) return false;
        
        const times = optimal.predictions.map(p => p.nextEvent.getTime());
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        
        // 1時間以上の差があれば不一致として通知
        return (maxTime - minTime) > (60 * 60 * 1000);
    }
    
    async notifySignificantChange(oldData, newPrediction) {
        const configPath = path.join(__dirname, '..', 'data', 'anni_config.json');
        if (!fs.existsSync(configPath)) return;
        
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (!config.notificationChannel) return;
            
            const channel = await this.client.channels.fetch(config.notificationChannel);
            
            const oldTime = oldData ? new Date(oldData.startTime) : null;
            const newTime = new Date(newPrediction.predictedTime);
            
            let description = `**🔄 予測が更新されました**\n\n`;
            
            if (oldTime) {
                const timeDiff = Math.abs(newTime - oldTime);
                const diffMinutes = Math.round(timeDiff / (60 * 1000));
                
                description += `**Previous:** <t:${Math.floor(oldTime.getTime() / 1000)}:F>\n`;
                description += `**Updated:** <t:${Math.floor(newTime.getTime() / 1000)}:F>\n`;
                description += `**Difference:** ${diffMinutes} minutes\n\n`;
            } else {
                description += `**New Prediction:** <t:${Math.floor(newTime.getTime() / 1000)}:F>\n\n`;
            }
            
            description += `**Confidence:** ${newPrediction.confidence}%\n`;
            description += `**Agreement:** ${newPrediction.agreement}%\n`;
            description += `**Sources:** ${newPrediction.sources.join(', ')}`;
            
            const embed = new EmbedBuilder()
                .setTitle('🔮 Annihilation Prediction Updated')
                .setDescription(description)
                .setColor('#00ff00')
                .setTimestamp();
            
            await channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('[ERROR] 変更通知エラー:', error);
        }
    }
    
    async notifyDiscrepancy(optimal) {
        const configPath = path.join(__dirname, '..', 'data', 'anni_config.json');
        if (!fs.existsSync(configPath)) return;
        
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (!config.notificationChannel) return;
            
            const channel = await this.client.channels.fetch(config.notificationChannel);
            
            const times = optimal.predictions.map(p => p.nextEvent.getTime());
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            const diffHours = Math.round((maxTime - minTime) / (60 * 60 * 1000));
            
            let description = `**⚠️ 予測ソース間で大きな差異が検出されました**\n\n`;
            description += `**Time Spread:** ${diffHours} hours\n`;
            description += `**Agreement Score:** ${optimal.agreement}%\n\n`;
            
            description += `**Individual Predictions:**\n`;
            optimal.predictions.forEach(pred => {
                const emoji = this.getSourceEmoji(pred.source);
                description += `${emoji} **${pred.source}:** <t:${Math.floor(pred.nextEvent.getTime() / 1000)}:t> (${pred.confidence}%)\n`;
            });
            
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Prediction Discrepancy Alert')
                .setDescription(description)
                .setColor('#ff9900')
                .setTimestamp();
            
            await channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('[ERROR] 差異通知エラー:', error);
        }
    }
    
    getSourceEmoji(source) {
        const emojis = {
            'Local': '🏠',
            'Wynnpool': '🌐',
            'Community': '👥',
            'Activity': '📊',
            'ARIMA': '🧮'
        };
        return emojis[source] || '❓';
    }
    
    // システム状態の取得
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastSync: this.lastSync,
            syncInterval: this.syncInterval,
            nextSync: this.syncTimer ? new Date(Date.now() + this.syncInterval) : null
        };
    }
    
    // 手動同期の実行
    async forcSync() {
        console.log('[INFO] 手動同期を実行中...');
        await this.sync();
        return this.lastSync;
    }
}

module.exports = { AutoSyncSystem };