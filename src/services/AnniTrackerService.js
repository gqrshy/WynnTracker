const BaseService = require('./BaseService');
const axios = require('axios');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

/**
 * Annihilation Tracker Service
 * AiverAiva/anni-pred リポジトリからデータを取得し、カウンター機能を提供
 */
class AnniTrackerService extends BaseService {
    constructor() {
        super();
        
        // ロガーの初期化
        this.logger = {
            info: (msg) => console.log(`[AnniTrackerService] ${msg}`),
            error: (msg, error) => console.error(`[AnniTrackerService] ${msg}`, error || ''),
            warn: (msg) => console.warn(`[AnniTrackerService] ${msg}`),
            debug: (msg) => console.debug(`[AnniTrackerService] ${msg}`)
        };
        
        // GitHub API設定
        this.GITHUB_API_BASE = 'https://api.github.com/repos/AiverAiva/anni-pred/contents';
        this.GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/AiverAiva/anni-pred/master/data';
        
        // キャッシュファイルパス
        this.dataDir = path.join(process.cwd(), 'data', 'anni_tracker');
        this.stableFile = path.join(this.dataDir, 'stable.json');
        this.historyFile = path.join(this.dataDir, 'history.json');
        this.predictedFile = path.join(this.dataDir, 'predicted.json');
        this.metaFile = path.join(this.dataDir, 'meta.json');
        
        // メタデータ（ETag、Last-Modified等）
        this.meta = {
            stable: { etag: null, lastModified: null, lastChecked: null },
            history: { etag: null, lastModified: null, lastChecked: null },
            predicted: { etag: null, lastModified: null, lastChecked: null }
        };
        
        // カウンター管理
        this.activeCounters = new Map(); // channelId -> { messageId, intervalId }
        
        // 通知管理
        this.notificationRoles = new Map(); // guildId -> roleId
        this.notifiedEvents = new Set(); // すでに通知したイベントのタイムスタンプ
        
        // 更新間隔
        this.UPDATE_INTERVAL = 3 * 60 * 1000; // 3分
        this.STABLE_CHECK_INTERVAL = 30 * 60 * 1000; // 30分
        
        // 初期化フラグ
        this.initialized = false;
    }

    /**
     * サービスの初期化
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            // データディレクトリの作成
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // メタデータの読み込み
            await this.loadMeta();
            
            // 初回データ取得（非同期で実行、初期化をブロックしない）
            this.fetchAllData().catch(error => {
                console.error('[AnniTrackerService] Background data fetch failed:', error);
            });
            
            // 定期チェックの開始
            this.startPeriodicChecks();
            
            this.initialized = true;
            this.logger.info('AnniTrackerService initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize AnniTrackerService:', error);
            throw error;
        }
    }

    /**
     * メタデータの読み込み
     */
    async loadMeta() {
        try {
            const metaData = await fs.readFile(this.metaFile, 'utf8');
            this.meta = JSON.parse(metaData);
        } catch (error) {
            // ファイルが存在しない場合は初期状態を使用
            this.logger.info('Meta file not found, using defaults');
        }
    }

    /**
     * メタデータの保存
     */
    async saveMeta() {
        try {
            await fs.writeFile(this.metaFile, JSON.stringify(this.meta, null, 2));
        } catch (error) {
            this.logger.error('Failed to save meta data:', error);
        }
    }

    /**
     * GitHub APIからファイルを取得
     */
    async fetchFromGitHub(filename, type) {
        try {
            const url = `${this.GITHUB_RAW_BASE}/${filename}`;
            const headers = {
                'User-Agent': 'WynnTracker-Revival/1.0',
                'Accept': 'application/json'
            };
            
            // ETagがある場合は条件付きリクエスト
            if (this.meta[type] && this.meta[type].etag) {
                headers['If-None-Match'] = this.meta[type].etag;
            }
            
            const response = await axios.get(url, { 
                headers,
                validateStatus: (status) => status < 500 // 304も正常として扱う
            });
            
            // 304 Not Modified
            if (response.status === 304) {
                this.logger.debug(`${filename} has not changed`);
                return null;
            }
            
            // メタデータの更新
            this.meta[type] = {
                etag: response.headers.etag || null,
                lastModified: response.headers['last-modified'] || null,
                lastChecked: Date.now()
            };
            await this.saveMeta();
            
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch ${filename} from GitHub:`, error);
            throw error;
        }
    }

    /**
     * すべてのデータを取得
     */
    async fetchAllData() {
        try {
            // stable.jsonの取得
            const stableData = await this.fetchFromGitHub('stable.json', 'stable');
            if (stableData) {
                await fs.writeFile(this.stableFile, JSON.stringify(stableData, null, 2));
                this.logger.info('Updated stable.json');
            }
            
            // history.jsonの取得
            const historyData = await this.fetchFromGitHub('history.json', 'history');
            if (historyData) {
                await fs.writeFile(this.historyFile, JSON.stringify(historyData, null, 2));
                this.logger.info('Updated history.json');
            }
            
            // predicted.jsonの取得
            const predictedData = await this.fetchFromGitHub('predicted.json', 'predicted');
            if (predictedData) {
                await fs.writeFile(this.predictedFile, JSON.stringify(predictedData, null, 2));
                this.logger.info('Updated predicted.json');
            }
        } catch (error) {
            this.logger.error('Failed to fetch all data:', error);
            // ローカルキャッシュを使用
        }
    }

    /**
     * 定期チェックの開始
     */
    startPeriodicChecks() {
        // 30分ごとにstable.jsonをチェック
        setInterval(async () => {
            try {
                const oldStable = await this.getStableData();
                await this.fetchFromGitHub('stable.json', 'stable');
                const newStable = await this.getStableData();
                
                // stable.jsonが更新された場合
                if (oldStable?.timestamp !== newStable?.timestamp) {
                    this.logger.info('Stable data updated!');
                    await this.onStableUpdate(newStable);
                }
            } catch (error) {
                this.logger.error('Failed to check stable data:', error);
            }
        }, this.STABLE_CHECK_INTERVAL);
        
        // その他のデータも定期的に更新
        setInterval(async () => {
            try {
                await this.fetchFromGitHub('history.json', 'history');
                await this.fetchFromGitHub('predicted.json', 'predicted');
            } catch (error) {
                this.logger.error('Failed to update data:', error);
            }
        }, 6 * 60 * 60 * 1000); // 6時間ごと
    }

    /**
     * stable.jsonが更新された時の処理
     */
    async onStableUpdate(stableData) {
        // すべてのアクティブなカウンターを更新
        const client = this.getClient();
        for (const [channelId, counter] of this.activeCounters) {
            try {
                const channel = await client.channels.fetch(channelId);
                const message = await channel.messages.fetch(counter.messageId);
                
                // Embedを確定状態に更新
                const embed = await this.createCounterEmbed(true);
                await message.edit({ embeds: [embed] });
            } catch (error) {
                this.logger.error(`Failed to update counter in channel ${channelId}:`, error);
            }
        }
    }

    /**
     * 現在のデータを取得
     */
    async getStableData() {
        try {
            const data = await fs.readFile(this.stableFile, 'utf8');
            // 404エラーチェック
            if (data.includes('404: Not Found')) {
                console.log('[AnniTrackerService] Stable file contains 404 error, attempting fresh fetch');
                await this.fetchFromGitHub('stable.json', 'stable');
                const freshData = await fs.readFile(this.stableFile, 'utf8');
                return JSON.parse(freshData);
            }
            return JSON.parse(data);
        } catch (error) {
            console.log('[AnniTrackerService] Failed to read stable data:', error.message);
            return null;
        }
    }

    async getHistoryData() {
        try {
            const data = await fs.readFile(this.historyFile, 'utf8');
            // 404エラーチェック
            if (data.includes('404: Not Found')) {
                console.log('[AnniTrackerService] History file contains 404 error, attempting fresh fetch');
                await this.fetchFromGitHub('history.json', 'history');
                const freshData = await fs.readFile(this.historyFile, 'utf8');
                return JSON.parse(freshData);
            }
            return JSON.parse(data);
        } catch (error) {
            console.log('[AnniTrackerService] Failed to read history data:', error.message);
            return [];
        }
    }

    async getPredictedData() {
        try {
            const data = await fs.readFile(this.predictedFile, 'utf8');
            // 404エラーチェック
            if (data.includes('404: Not Found')) {
                console.log('[AnniTrackerService] Predicted file contains 404 error, attempting fresh fetch');
                await this.fetchFromGitHub('predicted.json', 'predicted');
                const freshData = await fs.readFile(this.predictedFile, 'utf8');
                return JSON.parse(freshData);
            }
            return JSON.parse(data);
        } catch (error) {
            console.log('[AnniTrackerService] Failed to read predicted data:', error.message);
            return null;
        }
    }

    /**
     * 次のAnnihilationまでの時間を計算
     */
    async getNextAnnihilation() {
        const stable = await this.getStableData();
        const predicted = await this.getPredictedData();
        
        const now = Date.now();
        
        // stable.jsonに確定時刻がある場合
        if (stable && stable.timestamp && stable.timestamp > now) {
            return {
                timestamp: stable.timestamp,
                type: 'confirmed',
                source: 'stable'
            };
        }
        
        // predicted.jsonから予測を使用
        if (predicted && predicted.timestamp && predicted.timestamp > now) {
            return {
                timestamp: predicted.timestamp,
                type: 'predicted',
                source: 'predicted',
                confidence: predicted.confidence || 0.8
            };
        }
        
        // 履歴から推測（フォールバック）
        const history = await this.getHistoryData();
        if (history && history.length > 0) {
            const lastEvent = history[history.length - 1];
            const predictedTime = lastEvent.timestamp + (3 * 24 * 60 * 60 * 1000); // 3日後
            
            return {
                timestamp: predictedTime,
                type: 'estimated',
                source: 'history',
                confidence: 0.5
            };
        }
        
        return null;
    }

    /**
     * カウンターEmbedの作成
     */
    async createCounterEmbed(forceUpdate = false) {
        const next = await this.getNextAnnihilation();
        
        if (!next) {
            return new EmbedBuilder()
                .setTitle('❌ Annihilation予測不可')
                .setDescription('十分なデータがありません')
                .setColor('#ff0000')
                .setTimestamp();
        }
        
        const now = Date.now();
        const timeUntil = next.timestamp - now;
        
        // 状態アイコンの決定
        let statusIcon = '';
        let statusText = '';
        let color = '#ff6600';
        
        if (next.type === 'confirmed') {
            statusIcon = '✅';
            statusText = '確定';
            color = '#00ff00';
        } else if (next.type === 'predicted') {
            statusIcon = '🔮';
            statusText = '予測中';
            color = '#ffaa00';
        } else {
            statusIcon = '❓';
            statusText = '推定';
            color = '#888888';
        }
        
        // カウントダウンの計算
        const days = Math.floor(timeUntil / (24 * 60 * 60 * 1000));
        const hours = Math.floor((timeUntil % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((timeUntil % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeUntil % (60 * 1000)) / 1000);
        
        const embed = new EmbedBuilder()
            .setTitle(`${statusIcon} 次のAnnihilation ${statusText}`)
            .setColor(color)
            .addFields(
                {
                    name: '⏰ 開催時刻',
                    value: `<t:${Math.floor(next.timestamp / 1000)}:F>`,
                    inline: false
                },
                {
                    name: '⏳ カウントダウン',
                    value: timeUntil > 0 
                        ? `**${days}日 ${hours}時間 ${minutes}分 ${seconds}秒**`
                        : '**開催中または終了**',
                    inline: false
                }
            );
        
        if (next.confidence !== undefined) {
            embed.addFields({
                name: '📊 信頼度',
                value: `${Math.round(next.confidence * 100)}%`,
                inline: true
            });
        }
        
        embed.setFooter({ 
            text: `データソース: ${next.source} | 更新: 3分毎`,
            iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_16x16.png'
        })
        .setTimestamp();
        
        return embed;
    }

    /**
     * カウンターの開始
     */
    async startCounter(channel, roleId = null) {
        try {
            // 既存のカウンターがあれば停止
            if (this.activeCounters.has(channel.id)) {
                await this.stopCounter(channel.id);
            }
            
            // 初回Embedの送信
            const embed = await this.createCounterEmbed();
            const message = await channel.send({ embeds: [embed] });
            
            // カウンターの更新間隔設定
            const intervalId = setInterval(async () => {
                try {
                    const updatedEmbed = await this.createCounterEmbed();
                    await message.edit({ embeds: [updatedEmbed] });
                    
                    // 通知チェック
                    await this.checkNotifications(channel, roleId);
                } catch (error) {
                    this.logger.error('Failed to update counter:', error);
                }
            }, this.UPDATE_INTERVAL);
            
            // カウンター情報の保存
            this.activeCounters.set(channel.id, {
                messageId: message.id,
                intervalId: intervalId,
                roleId: roleId
            });
            
            return message;
        } catch (error) {
            this.logger.error('Failed to start counter:', error);
            throw error;
        }
    }
    
    /**
     * Discordクライアントの取得
     */
    getClient() {
        if (global.wynnTrackerBot && global.wynnTrackerBot.client) {
            return global.wynnTrackerBot.client;
        }
        throw new Error('Discord client not available');
    }

    /**
     * カウンターの停止
     */
    async stopCounter(channelId) {
        const counter = this.activeCounters.get(channelId);
        if (counter) {
            clearInterval(counter.intervalId);
            this.activeCounters.delete(channelId);
        }
    }

    /**
     * 通知チェック
     */
    async checkNotifications(channel, roleId) {
        if (!roleId) return;
        
        const next = await this.getNextAnnihilation();
        if (!next || next.type !== 'confirmed') return;
        
        const now = Date.now();
        const timeUntil = next.timestamp - now;
        const hoursUntil = timeUntil / (60 * 60 * 1000);
        
        // 通知タイミング（12時間前、45分前）
        const notificationKey12h = `${next.timestamp}_12h`;
        const notificationKey45m = `${next.timestamp}_45m`;
        
        // 12時間前通知
        if (hoursUntil <= 12 && hoursUntil > 11.5 && !this.notifiedEvents.has(notificationKey12h)) {
            await channel.send({
                content: `<@&${roleId}> ⚔️ **Annihilationまであと12時間です！**\n開催時刻: <t:${Math.floor(next.timestamp / 1000)}:F>`,
                allowedMentions: { roles: [roleId] }
            });
            this.notifiedEvents.add(notificationKey12h);
        }
        
        // 45分前通知
        if (hoursUntil <= 0.75 && hoursUntil > 0.5 && !this.notifiedEvents.has(notificationKey45m)) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('anni_notify_again')
                        .setLabel('再通知を受け取る')
                        .setEmoji('🔔')
                        .setStyle(ButtonStyle.Primary)
                );
            
            await channel.send({
                content: `<@&${roleId}> 🔥 **Annihilationまであと45分です！**\n開催時刻: <t:${Math.floor(next.timestamp / 1000)}:F>`,
                allowedMentions: { roles: [roleId] },
                components: [row]
            });
            this.notifiedEvents.add(notificationKey45m);
        }
        
        // 古い通知記録の削除
        if (this.notifiedEvents.size > 100) {
            const oldestKeys = Array.from(this.notifiedEvents).slice(0, 50);
            oldestKeys.forEach(key => this.notifiedEvents.delete(key));
        }
    }

    /**
     * 予測精度の評価
     */
    async evaluateAccuracy() {
        const history = await this.getHistoryData();
        if (!history || history.length < 10) {
            return {
                message: 'データ不足により精度評価ができません',
                dataCount: history ? history.length : 0
            };
        }
        
        // 簡易的な精度評価
        const intervals = [];
        for (let i = 1; i < history.length; i++) {
            intervals.push(history[i].timestamp - history[i-1].timestamp);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const expectedInterval = 3 * 24 * 60 * 60 * 1000; // 3日
        const accuracy = 100 - Math.abs(avgInterval - expectedInterval) / expectedInterval * 100;
        
        return {
            accuracy: Math.max(0, accuracy),
            avgIntervalHours: avgInterval / (60 * 60 * 1000),
            dataCount: history.length
        };
    }
}

module.exports = AnniTrackerService;