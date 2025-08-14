# WynnTracker Discord Bot - SKJmod連携実装ガイド

## 概要
あなたのWynnTracker Discord BotにSKJmodからのボムベル通知を受信・処理する機能を追加する完全実装ガイドです。

## 現在のWynnTrackerボット構造分析

### 想定される既存構造
```
wynntracker-bot/
├── src/
│   ├── commands/
│   ├── events/
│   ├── utils/
│   └── index.js
├── config/
├── package.json
└── README.md
```

## SKJmod連携機能の追加

### 1. 新しいファイル構造
```
wynntracker-bot/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── bombbell.js          // SKJmod専用エンドポイント
│   │   │   ├── health.js            // ヘルスチェック
│   │   │   └── index.js             // ルーター統合
│   │   ├── middleware/
│   │   │   ├── auth.js              // 認証ミドルウェア
│   │   │   ├── rateLimit.js         // レート制限
│   │   │   └── validation.js        // データ検証
│   │   └── server.js                // Express サーバー
│   ├── services/
│   │   ├── bombbell/
│   │   │   ├── BombBellService.js   // ボムベル処理サービス
│   │   │   ├── BombTracker.js       // アクティブな爆弾追跡
│   │   │   └── NotificationFormatter.js // 通知フォーマット
│   │   └── database/
│   │       ├── BombHistory.js       // 爆弾履歴管理
│   │       └── Statistics.js        // 統計データ
│   ├── utils/
│   │   ├── logger.js                // 拡張ログ機能
│   │   ├── embedBuilder.js          // Discord埋め込み
│   │   └── config.js                // 設定管理
│   ├── commands/
│   │   ├── bombbell/
│   │   │   ├── status.js            // ボムベル状況確認
│   │   │   ├── history.js           // 履歴表示
│   │   │   └── settings.js          // 設定管理
│   │   └── ... (既存コマンド)
│   ├── events/
│   └── index.js
├── config/
│   ├── bot.json                     // Bot設定
│   ├── api.json                     // API設定
│   └── database.json                // DB設定
├── database/
│   ├── models/
│   │   ├── BombEvent.js             // 爆弾イベントモデル
│   │   └── ServerStats.js           // サーバー統計モデル
│   └── migrations/
└── tests/
    ├── api/
    └── services/
```

### 2. メインサーバーファイル (src/api/server.js)

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const routes = require('./routes');
const auth = require('./middleware/auth');
const validation = require('./middleware/validation');

class APIServer {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.app = express();
        this.server = null;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    
    setupMiddleware() {
        // セキュリティ
        this.app.use(helmet());
        
        // CORS設定（SKJmod専用）
        this.app.use(cors({
            origin: ['http://localhost:25565', 'minecraft://localhost'],
            methods: ['POST', 'GET'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
        
        // レート制限
        const limiter = rateLimit({
            windowMs: 1 * 60 * 1000, // 1分
            max: 100, // リクエスト数
            message: {
                error: 'Too many requests',
                retryAfter: '1 minute'
            },
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api', limiter);
        
        // ボディパーサー
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // ログミドルウェア
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }
    
    setupRoutes() {
        // ヘルスチェック
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                discord: this.client.isReady()
            });
        });
        
        // API routes
        this.app.use('/api', routes(this.client, this.config));
        
        // 404ハンドリング
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                availableEndpoints: ['/health', '/api/skjmod/bombbell']
            });
        });
    }
    
    setupErrorHandling() {
        this.app.use((error, req, res, next) => {
            logger.error('API Error:', error);
            
            if (error.type === 'entity.parse.failed') {
                return res.status(400).json({
                    error: 'Invalid JSON payload'
                });
            }
            
            res.status(500).json({
                error: 'Internal server error',
                requestId: req.id
            });
        });
    }
    
    start(port = 3000) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, (error) => {
                if (error) {
                    logger.error('Failed to start API server:', error);
                    reject(error);
                } else {
                    logger.info(`API server started on port ${port}`);
                    resolve(port);
                }
            });
        });
    }
    
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    logger.info('API server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = APIServer;
```

### 3. SKJmod専用エンドポイント (src/api/routes/bombbell.js)

```javascript
const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const BombBellService = require('../../services/bombbell/BombBellService');
const { logger } = require('../../utils/logger');

const router = express.Router();

/**
 * SKJmodからのボムベル通知受信
 * POST /api/skjmod/bombbell
 */
router.post('/bombbell', [
    // 認証
    auth.validateToken,
    
    // バリデーション
    body('bombType').isString().notEmpty(),
    body('bombDisplayName').isString().notEmpty(),
    body('world').isString().notEmpty(),
    body('timestamp').isNumeric(),
    body('metadata').isObject(),
    body('source').isIn(['GAME', 'CHAT']),
    body('detectionPattern').isString().notEmpty(),
    
    // オプションフィールド
    body('playerName').optional().isString(),
    body('originalMessage').optional().isString()
    
], async (req, res) => {
    try {
        // バリデーションエラーチェック
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }
        
        const bombData = req.body;
        
        // BombBellServiceで処理
        const bombBellService = new BombBellService(req.client, req.config);
        const result = await bombBellService.processBombNotification(bombData);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Bomb notification processed successfully',
                data: {
                    messageId: result.messageId,
                    channelId: result.channelId,
                    region: result.region
                }
            });
        } else {
            res.status(422).json({
                success: false,
                error: result.error,
                code: result.errorCode
            });
        }
        
    } catch (error) {
        logger.error('Bomb notification processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            requestId: req.id
        });
    }
});

/**
 * アクティブな爆弾一覧取得
 * GET /api/skjmod/bombs/active
 */
router.get('/bombs/active', [
    auth.validateToken
], async (req, res) => {
    try {
        const bombBellService = new BombBellService(req.client, req.config);
        const activeBombs = await bombBellService.getActiveBombs();
        
        res.json({
            success: true,
            data: activeBombs,
            count: activeBombs.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Active bombs fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active bombs'
        });
    }
});

/**
 * ボムベル統計取得
 * GET /api/skjmod/stats
 */
router.get('/stats', [
    auth.validateToken
], async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        
        const bombBellService = new BombBellService(req.client, req.config);
        const stats = await bombBellService.getStatistics(timeframe);
        
        res.json({
            success: true,
            data: stats,
            timeframe: timeframe,
            generatedAt: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Stats fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

/**
 * 接続テスト
 * POST /api/skjmod/test
 */
router.post('/test', [
    auth.validateToken
], async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Connection test successful',
            timestamp: new Date().toISOString(),
            botStatus: req.client.isReady(),
            receivedData: req.body
        });
        
    } catch (error) {
        logger.error('Connection test error:', error);
        res.status(500).json({
            success: false,
            error: 'Connection test failed'
        });
    }
});

module.exports = router;
```

### 4. ボムベル処理サービス (src/services/bombbell/BombBellService.js)

```javascript
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const BombTracker = require('./BombTracker');
const NotificationFormatter = require('./NotificationFormatter');
const BombHistory = require('../database/BombHistory');
const { logger } = require('../../utils/logger');

class BombBellService {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.bombTracker = new BombTracker();
        this.formatter = new NotificationFormatter();
        this.history = new BombHistory();
    }
    
    async processBombNotification(bombData) {
        try {
            // データの正規化
            const normalizedData = this.normalizeBombData(bombData);
            
            // 重複チェック
            if (await this.isDuplicate(normalizedData)) {
                logger.debug('Duplicate bomb notification ignored', normalizedData);
                return {
                    success: false,
                    error: 'Duplicate notification',
                    errorCode: 'DUPLICATE'
                };
            }
            
            // アクティブボム追加
            this.bombTracker.addBomb(normalizedData);
            
            // 履歴に保存
            await this.history.saveBombEvent(normalizedData);
            
            // Discord通知送信
            const discordResult = await this.sendDiscordNotification(normalizedData);
            
            if (discordResult.success) {
                logger.info('Bomb notification processed successfully', {
                    bombType: normalizedData.bombType,
                    world: normalizedData.world,
                    messageId: discordResult.messageId
                });
                
                return {
                    success: true,
                    messageId: discordResult.messageId,
                    channelId: discordResult.channelId,
                    region: normalizedData.serverRegion
                };
            } else {
                throw new Error('Discord notification failed: ' + discordResult.error);
            }
            
        } catch (error) {
            logger.error('Bomb notification processing failed:', error);
            return {
                success: false,
                error: error.message,
                errorCode: 'PROCESSING_ERROR'
            };
        }
    }
    
    normalizeBombData(rawData) {
        return {
            bombType: rawData.bombType,
            bombDisplayName: rawData.bombDisplayName,
            world: this.normalizeWorldName(rawData.world),
            timestamp: rawData.timestamp,
            playerName: rawData.playerName || null,
            source: rawData.source,
            detectionPattern: rawData.detectionPattern,
            serverRegion: this.determineServerRegion(rawData.world),
            metadata: rawData.metadata || {},
            originalMessage: rawData.originalMessage
        };
    }
    
    normalizeWorldName(world) {
        if (!world) return 'Unknown';
        
        // "world 1" -> "WC1", "server EU2" -> "EU2" 等
        let normalized = world.trim().toUpperCase();
        normalized = normalized.replace(/^(WORLD|SERVER)\s+/, '');
        
        // 数字のみの場合はWCプレフィックスを追加
        if (/^\d+$/.test(normalized)) {
            normalized = 'WC' + normalized;
        }
        
        return normalized;
    }
    
    determineServerRegion(world) {
        const upperWorld = world.toUpperCase();
        
        if (upperWorld.startsWith('EU')) return 'Europe';
        if (upperWorld.startsWith('US') || upperWorld.startsWith('WC')) return 'North America';
        if (upperWorld.startsWith('AS')) return 'Asia';
        if (upperWorld.startsWith('SA')) return 'South America';
        
        return 'Unknown';
    }
    
    async isDuplicate(bombData) {
        // トラッカーでの重複チェック
        if (this.bombTracker.isDuplicate(bombData)) {
            return true;
        }
        
        // データベースでの重複チェック（過去1分以内）
        const recentBombs = await this.history.getRecentBombs(bombData.bombType, bombData.world, 60000);
        return recentBombs.length > 0;
    }
    
    async sendDiscordNotification(bombData) {
        try {
            // 地域別チャンネル決定
            const channelId = this.getChannelForRegion(bombData.serverRegion);
            const channel = this.client.channels.cache.get(channelId);
            
            if (!channel) {
                throw new Error(`Channel not found: ${channelId}`);
            }
            
            // 埋め込みメッセージ作成
            const embed = this.formatter.createBombEmbed(bombData);
            
            // アクションボタン作成
            const actionRow = this.createActionButtons(bombData);
            
            // メッセージ送信
            const message = await channel.send({
                embeds: [embed],
                components: actionRow ? [actionRow] : []
            });
            
            // 自動削除設定（爆弾の有効期限後）
            this.scheduleMessageDeletion(message, bombData);
            
            return {
                success: true,
                messageId: message.id,
                channelId: channel.id
            };
            
        } catch (error) {
            logger.error('Discord notification send failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    getChannelForRegion(region) {
        const channels = {
            'Europe': this.config.channels.eu_bombbell,
            'North America': this.config.channels.na_bombbell,
            'Asia': this.config.channels.as_bombbell,
            'South America': this.config.channels.sa_bombbell,
            'Unknown': this.config.channels.general_bombbell
        };
        
        return channels[region] || channels['Unknown'];
    }
    
    createActionButtons(bombData) {
        if (!this.config.features.enableActionButtons) {
            return null;
        }
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`join_server_${bombData.world}`)
                    .setLabel(`Join ${bombData.world}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎮'),
                
                new ButtonBuilder()
                    .setCustomId(`bomb_details_${bombData.timestamp}`)
                    .setLabel('Details')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('ℹ️'),
                
                new ButtonBuilder()
                    .setCustomId(`set_reminder_${bombData.timestamp}`)
                    .setLabel('Remind Me')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('⏰')
            );
        
        return row;
    }
    
    scheduleMessageDeletion(message, bombData) {
        if (!this.config.features.autoDeleteMessages) {
            return;
        }
        
        const deleteTime = bombData.timestamp + (bombData.metadata.duration * 60 * 1000) + (5 * 60 * 1000); // +5分
        const delay = deleteTime - Date.now();
        
        if (delay > 0) {
            setTimeout(async () => {
                try {
                    await message.delete();
                    logger.debug(`Auto-deleted expired bomb message: ${message.id}`);
                } catch (error) {
                    logger.warn(`Failed to auto-delete message: ${error.message}`);
                }
            }, delay);
        }
    }
    
    async getActiveBombs() {
        return this.bombTracker.getActiveBombs();
    }
    
    async getStatistics(timeframe) {
        return await this.history.getStatistics(timeframe);
    }
}

module.exports = BombBellService;
```

### 5. 通知フォーマッター (src/services/bombbell/NotificationFormatter.js)

```javascript
const { EmbedBuilder } = require('discord.js');

class NotificationFormatter {
    constructor() {
        this.bombColors = {
            'COMBAT_XP': 0xFF4444,
            'PROFESSION_XP': 0x44FF44,
            'PROFESSION_SPEED': 0xFFFF44,
            'DUNGEON': 0x4444FF,
            'LOOT': 0xFF44FF,
            'LOOT_CHEST': 0x44FFFF,
            'MATERIAL': 0x888888,
            'SCROLL_CHARGE': 0xFFAA44
        };
        
        this.bombEmojis = {
            'COMBAT_XP': '⚔️',
            'PROFESSION_XP': '🔨',
            'PROFESSION_SPEED': '⚡',
            'DUNGEON': '🏰',
            'LOOT': '💰',
            'LOOT_CHEST': '🗂️',
            'MATERIAL': '🧱',
            'SCROLL_CHARGE': '📜'
        };
    }
    
    createBombEmbed(bombData) {
        const emoji = this.bombEmojis[bombData.bombType] || '💣';
        const color = this.bombColors[bombData.bombType] || 0x888888;
        
        const embed = new EmbedBuilder()
            .setTitle(`${emoji} ${bombData.bombDisplayName} Bomb`)
            .setColor(color)
            .setTimestamp(new Date(bombData.timestamp));
        
        // 基本情報
        let description = `**Server:** ${bombData.world}\n`;
        description += `**Duration:** ${bombData.metadata.duration || 'Unknown'} minutes\n`;
        description += `**Region:** ${bombData.serverRegion}\n`;
        
        if (bombData.playerName) {
            description += `**Player:** ${bombData.playerName}\n`;
        }
        
        // ソース情報
        description += `**Source:** ${this.formatSource(bombData.source, bombData.detectionPattern)}\n`;
        
        // 有効期限
        if (bombData.metadata.duration) {
            const expiryTime = new Date(bombData.timestamp + (bombData.metadata.duration * 60 * 1000));
            description += `**Expires:** <t:${Math.floor(expiryTime.getTime() / 1000)}:R>\n`;
        }
        
        embed.setDescription(description);
        
        // フィールド追加
        if (bombData.originalMessage) {
            embed.addFields({
                name: 'Original Message',
                value: `\`\`\`${bombData.originalMessage.substring(0, 1000)}\`\`\``,
                inline: false
            });
        }
        
        // サーバー参加リンク
        if (this.isValidServer(bombData.world)) {
            embed.addFields({
                name: 'Quick Join',
                value: `[Join ${bombData.world}](https://wynncraft.com/servers/${bombData.world.toLowerCase()})`,
                inline: true
            });
        }
        
        // フッター
        embed.setFooter({
            text: 'SKJmod • WynnTracker',
            iconURL: 'https://cdn.wynncraft.com/img/ico/favicon-16x16.png'
        });
        
        // サムネイル
        const thumbnailUrl = this.getBombThumbnailUrl(bombData.bombType);
        if (thumbnailUrl) {
            embed.setThumbnail(thumbnailUrl);
        }
        
        return embed;
    }
    
    formatSource(source, detectionPattern) {
        const sourceNames = {
            'GAME': 'Game Message',
            'CHAT': 'Player Chat'
        };
        
        const sourceName = sourceNames[source] || source;
        return `${sourceName} (${detectionPattern})`;
    }
    
    isValidServer(world) {
        // Wynncraftサーバー名の検証
        return /^(WC|EU|AS|SA)\d+$/i.test(world);
    }
    
    getBombThumbnailUrl(bombType) {
        const baseUrl = 'https://cdn.wynncraft.com/nextgen/itemguide/icons/';
        
        const thumbnails = {
            'COMBAT_XP': 'combat_xp_bomb.png',
            'PROFESSION_XP': 'profession_xp_bomb.png',
            'PROFESSION_SPEED': 'profession_speed_bomb.png',
            'DUNGEON': 'dungeon_bomb.png',
            'LOOT': 'loot_bomb.png',
            'LOOT_CHEST': 'loot_chest_bomb.png',
            'MATERIAL': 'material_bomb.png',
            'SCROLL_CHARGE': 'scroll_bomb.png'
        };
        
        const thumbnail = thumbnails[bombType];
        return thumbnail ? baseUrl + thumbnail : null;
    }
    
    createStatsEmbed(stats, timeframe) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Bomb Bell Statistics')
            .setColor(0x00AE86)
            .setTimestamp();
        
        let description = `Statistics for the last **${timeframe}**\n\n`;
        
        // 総計
        description += `**Total Bombs:** ${stats.totalBombs}\n`;
        description += `**Unique Servers:** ${stats.uniqueServers}\n`;
        description += `**Average per Hour:** ${stats.averagePerHour.toFixed(1)}\n\n`;
        
        // 爆弾タイプ別
        if (stats.bombTypes && Object.keys(stats.bombTypes).length > 0) {
            description += '**By Type:**\n';
            Object.entries(stats.bombTypes)
                .sort(([,a], [,b]) => b - a)
                .forEach(([type, count]) => {
                    const emoji = this.bombEmojis[type] || '💣';
                    description += `${emoji} ${type}: ${count}\n`;
                });
        }
        
        embed.setDescription(description);
        
        return embed;
    }
}

module.exports = NotificationFormatter;
```

### 6. 認証ミドルウェア (src/api/middleware/auth.js)

```javascript
const crypto = require('crypto');
const { logger } = require('../../utils/logger');

class AuthMiddleware {
    constructor(config) {
        this.config = config;
        this.validTokens = new Set(config.api.validTokens || []);
        this.secretKey = config.api.secretKey;
    }
    
    validateToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    error: 'Missing or invalid authorization header',
                    expected: 'Bearer <token>'
                });
            }
            
            const token = authHeader.substring(7);
            
            // トークン検証
            if (!this.isValidToken(token)) {
                logger.warn('Invalid API token used', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    token: token.substring(0, 8) + '...'
                });
                
                return res.status(401).json({
                    error: 'Invalid token'
                });
            }
            
            // リクエストオブジェクトに認証情報を追加
            req.auth = {
                token: token,
                tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
                validatedAt: new Date()
            };
            
            next();
            
        } catch (error) {
            logger.error('Auth middleware error:', error);
            res.status(500).json({
                error: 'Authentication error'
            });
        }
    }
    
    isValidToken(token) {
        if (!token || typeof token !== 'string') {
            return false;
        }
        
        // 設定されたトークンリストとの照合
        if (this.validTokens.has(token)) {
            return true;
        }
        
        // 動的トークン生成の場合（オプション）
        if (this.secretKey) {
            return this.validateDynamicToken(token);
        }
        
        return false;
    }
    
    validateDynamicToken(token) {
        try {
            // HMAC-SHA256を使用した動的トークン検証
            const [timestamp, signature] = token.split('.');
            
            if (!timestamp || !signature) {
                return false;
            }
            
            // タイムスタンプ検証（24時間以内）
            const tokenTime = parseInt(timestamp, 10);
            const currentTime = Math.floor(Date.now() / 1000);
            
            if (currentTime - tokenTime > 86400) { // 24時間
                return false;
            }
            
            // 署名検証
            const expectedSignature = crypto
                .createHmac('sha256', this.secretKey)
                .update(timestamp)
                .digest('hex');
            
            return signature === expectedSignature;
            
        } catch (error) {
            logger.error('Dynamic token validation error:', error);
            return false;
        }
    }
    
    generateToken() {
        if (!this.secretKey) {
            throw new Error('Secret key not configured');
        }
        
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = crypto
            .createHmac('sha256', this.secretKey)
            .update(timestamp)
            .digest('hex');
        
        return `${timestamp}.${signature}`;
    }
}

module.exports = new AuthMiddleware(require('../../utils/config'));
```

### 7. メインボットファイル統合 (src/index.js)

```javascript
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const APIServer = require('./api/server');
const { logger } = require('./utils/logger');
const config = require('./utils/config');

class WynnTrackerBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });
        
        this.commands = new Collection();
        this.apiServer = null;
        
        this.setupEventListeners();
        this.loadCommands();
    }
    
    setupEventListeners() {
        this.client.once('ready', async () => {
            logger.info(`WynnTracker Bot logged in as ${this.client.user.tag}`);
            
            // API サーバーの開始
            if (config.api.enabled) {
                try {
                    this.apiServer = new APIServer(this.client, config);
                    await this.apiServer.start(config.api.port);
                    logger.info(`API server started on port ${config.api.port}`);
                } catch (error) {
                    logger.error('Failed to start API server:', error);
                }
            }
        });
        
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            const command = this.commands.get(interaction.commandName);
            if (!command) return;
            
            try {
                await command.execute(interaction);
            } catch (error) {
                logger.error('Command execution error:', error);
                await interaction.reply({
                    content: 'An error occurred while executing this command.',
                    ephemeral: true
                });
            }
        });
        
        // ボタンインタラクション処理
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;
            
            try {
                await this.handleButtonInteraction(interaction);
            } catch (error) {
                logger.error('Button interaction error:', error);
            }
        });
    }
    
    loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        const commandFolders = fs.readdirSync(commandsPath);
        
        for (const folder of commandFolders) {
            const commandsInFolder = fs.readdirSync(path.join(commandsPath, folder))
                .filter(file => file.endsWith('.js'));
            
            for (const file of commandsInFolder) {
                const filePath = path.join(commandsPath, folder, file);
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    this.commands.set(command.data.name, command);
                } else {
                    logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
                }
            }
        }
        
        logger.info(`Loaded ${this.commands.size} commands`);
    }
    
    async handleButtonInteraction(interaction) {
        const customId = interaction.customId;
        
        if (customId.startsWith('join_server_')) {
            const server = customId.replace('join_server_', '');
            await this.handleJoinServer(interaction, server);
        } else if (customId.startsWith('bomb_details_')) {
            const timestamp = customId.replace('bomb_details_', '');
            await this.handleBombDetails(interaction, timestamp);
        } else if (customId.startsWith('set_reminder_')) {
            const timestamp = customId.replace('set_reminder_', '');
            await this.handleSetReminder(interaction, timestamp);
        }
    }
    
    async handleJoinServer(interaction, server) {
        const serverUrl = `https://wynncraft.com/servers/${server.toLowerCase()}`;
        
        await interaction.reply({
            content: `🎮 Join ${server}: ${serverUrl}`,
            ephemeral: true
        });
    }
    
    async handleBombDetails(interaction, timestamp) {
        const BombBellService = require('./services/bombbell/BombBellService');
        const bombService = new BombBellService(this.client, config);
        
        // タイムスタンプから爆弾詳細を取得
        const details = await bombService.getBombDetails(parseInt(timestamp));
        
        if (details) {
            await interaction.reply({
                content: `📋 **Bomb Details:**\n\`\`\`json\n${JSON.stringify(details, null, 2)}\`\`\``,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '❌ Bomb details not found.',
                ephemeral: true
            });
        }
    }
    
    async handleSetReminder(interaction, timestamp) {
        // TODO: リマインダー機能の実装
        await interaction.reply({
            content: '⏰ Reminder feature coming soon!',
            ephemeral: true
        });
    }
    
    async start() {
        try {
            await this.client.login(config.bot.token);
        } catch (error) {
            logger.error('Failed to start bot:', error);
            process.exit(1);
        }
    }
    
    async stop() {
        if (this.apiServer) {
            await this.apiServer.stop();
        }
        
        this.client.destroy();
        logger.info('WynnTracker Bot stopped');
    }
}

// シグナルハンドリング
const bot = new WynnTrackerBot();

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
});

// 未処理エラーのハンドリング
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// ボット開始
bot.start();
```

### 8. 設定ファイル (config/api.json)

```json
{
  "api": {
    "enabled": true,
    "port": 3000,
    "secretKey": "your_secret_key_here",
    "validTokens": [
      "skjmod_token_1234567890abcdef",
      "another_valid_token_here"
    ],
    "rateLimit": {
      "windowMs": 60000,
      "max": 100
    }
  },
  "channels": {
    "na_bombbell": "CHANNEL_ID_HERE",
    "eu_bombbell": "CHANNEL_ID_HERE",
    "as_bombbell": "CHANNEL_ID_HERE",
    "sa_bombbell": "CHANNEL_ID_HERE",
    "general_bombbell": "CHANNEL_ID_HERE"
  },
  "features": {
    "enableActionButtons": true,
    "autoDeleteMessages": true,
    "enableStatistics": true,
    "enableHistory": true
  },
  "database": {
    "type": "sqlite",
    "path": "./database/wynntracker.db"
  }
}
```

### 9. Discord コマンド例 (src/commands/bombbell/status.js)

```javascript
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BombBellService = require('../../services/bombbell/BombBellService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bombstatus')
        .setDescription('Show current active bombs'),
    
    async execute(interaction) {
        try {
            const config = require('../../utils/config');
            const bombService = new BombBellService(interaction.client, config);
            
            const activeBombs = await bombService.getActiveBombs();
            
            if (activeBombs.length === 0) {
                await interaction.reply({
                    content: '💣 No active bombs currently.',
                    ephemeral: true
                });
                return;
            }
            
            const embed = new EmbedBuilder()
                .setTitle('💣 Active Bombs')
                .setColor(0x00AE86)
                .setTimestamp();
            
            let description = '';
            activeBombs.forEach((bomb, index) => {
                const remainingMinutes = Math.max(0, Math.floor((bomb.expiryTime - Date.now()) / 60000));
                description += `**${index + 1}.** ${bomb.emoji} ${bomb.displayName} on ${bomb.world} (${remainingMinutes}m left)\n`;
            });
            
            embed.setDescription(description);
            embed.setFooter({
                text: `${activeBombs.length} active bomb(s)`,
                iconURL: 'https://cdn.wynncraft.com/img/ico/favicon-16x16.png'
            });
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } catch (error) {
            console.error('Bomb status command error:', error);
            await interaction.reply({
                content: '❌ Failed to fetch bomb status.',
                ephemeral: true
            });
        }
    }
};
```

### 10. package.json の依存関係追加

```json
{
  "name": "wynntracker-bot",
  "version": "2.0.0",
  "description": "Discord bot for Wynncraft tracking with SKJmod integration",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "lint": "eslint src/",
    "deploy-commands": "node scripts/deploy-commands.js"
  },
  "dependencies": {
    "discord.js": "^14.14.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "sqlite3": "^5.1.6",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "eslint": "^8.56.0",
    "@types/node": "^20.10.6"
  },
  "keywords": ["discord", "bot", "wynncraft", "minecraft", "tracking"],
  "author": "gqrshy",
  "license": "MIT"
}
```

### 11. 環境変数設定 (.env)

```env
# Discord Bot
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# API設定
API_PORT=3000
API_SECRET_KEY=your_very_secure_secret_key_here
SKJMOD_TOKEN=skjmod_token_1234567890abcdef

# Discord チャンネルID
NA_BOMBBELL_CHANNEL=123456789012345678
EU_BOMBBELL_CHANNEL=123456789012345679
AS_BOMBBELL_CHANNEL=123456789012345680
SA_BOMBBELL_CHANNEL=123456789012345681
GENERAL_BOMBBELL_CHANNEL=123456789012345682

# データベース
DATABASE_PATH=./database/wynntracker.db

# ログレベル
LOG_LEVEL=info

# 機能フラグ
ENABLE_ACTION_BUTTONS=true
AUTO_DELETE_MESSAGES=true
ENABLE_STATISTICS=true
```

### 12. SKJmod側の設定例 (config/skjmod.json)

```json
{
  "enabled": true,
  "debugMode": false,
  "wynntrackerApiUrl": "http://localhost:3000/api/skjmod",
  "wynntrackerApiToken": "skjmod_token_1234567890abcdef",
  "discordWebhookUrl": "",
  "connectionTimeout": 15,
  "bombBellConfig": {
    "enabled": true,
    "discordNotificationEnabled": true,
    "overlayEnabled": true,
    "ingameNotificationEnabled": true,
    "guildRelayEnabled": true,
    "partyRelayEnabled": false,
    "unicodePatternEnabled": true,
    "filterDuplicates": true,
    "duplicateTimeWindow": 5000,
    "enableCombatXpBombs": true,
    "enableProfessionXpBombs": true,
    "enableProfessionSpeedBombs": true,
    "enableDungeonBombs": true,
    "enableLootBombs": true,
    "enableLootChestBombs": true,
    "allowedServers": "",
    "blockedServers": ""
  }
}
```

### 13. Docker Compose での開発環境

```yaml
version: '3.8'

services:
  wynntracker-bot:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DISCORD_TOKEN=${DISCORD_TOKEN}
      - API_PORT=3000
      - DATABASE_PATH=/app/data/wynntracker.db
    volumes:
      - ./src:/app/src
      - ./config:/app/config
      - ./data:/app/data
    restart: unless-stopped
    
  # テスト用のSKJmodシミュレーター
  skjmod-simulator:
    build: ./tests/simulator
    ports:
      - "8080:8080"
    environment:
      - WYNNTRACKER_API_URL=http://wynntracker-bot:3000/api/skjmod
      - API_TOKEN=skjmod_token_1234567890abcdef
    depends_on:
      - wynntracker-bot
```

### 14. テスト用シミュレーター (tests/simulator/index.js)

```javascript
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const API_URL = process.env.WYNNTRACKER_API_URL || 'http://localhost:3000/api/skjmod';
const API_TOKEN = process.env.API_TOKEN || 'skjmod_token_1234567890abcdef';

// SKJmodからの通知をシミュレート
app.post('/simulate', async (req, res) => {
    try {
        const { bombType = 'COMBAT_XP', world = 'WC1', playerName = 'TestPlayer' } = req.body;
        
        const bombData = {
            bombType: bombType,
            bombDisplayName: getBombDisplayName(bombType),
            world: world,
            timestamp: Date.now(),
            playerName: playerName,
            metadata: {
                duration: getBombDuration(bombType),
                emoji: getBombEmoji(bombType),
                serverRegion: getRegion(world)
            },
            source: 'GAME',
            detectionPattern: 'Simulator',
            originalMessage: `${playerName} has thrown a ${getBombDisplayName(bombType)} Bomb on ${world}`
        };
        
        const response = await axios.post(`${API_URL}/bombbell`, bombData, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            message: 'Bomb notification sent',
            response: response.data
        });
        
    } catch (error) {
        console.error('Simulation error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});

function getBombDisplayName(type) {
    const names = {
        'COMBAT_XP': 'Combat Experience',
        'PROFESSION_XP': 'Profession Experience',
        'PROFESSION_SPEED': 'Profession Speed',
        'DUNGEON': 'Dungeon',
        'LOOT': 'Loot',
        'LOOT_CHEST': 'Loot Chest'
    };
    return names[type] || 'Unknown';
}

function getBombDuration(type) {
    const durations = {
        'COMBAT_XP': 20,
        'PROFESSION_XP': 20,
        'PROFESSION_SPEED': 10,
        'DUNGEON': 10,
        'LOOT': 20,
        'LOOT_CHEST': 20
    };
    return durations[type] || 20;
}

function getBombEmoji(type) {
    const emojis = {
        'COMBAT_XP': '⚔️',
        'PROFESSION_XP': '🔨',
        'PROFESSION_SPEED': '⚡',
        'DUNGEON': '🏰',
        'LOOT': '💰',
        'LOOT_CHEST': '🗂️'
    };
    return emojis[type] || '💣';
}

function getRegion(world) {
    const upperWorld = world.toUpperCase();
    if (upperWorld.startsWith('EU')) return 'Europe';
    if (upperWorld.startsWith('US') || upperWorld.startsWith('WC')) return 'North America';
    if (upperWorld.startsWith('AS')) return 'Asia';
    return 'Unknown';
}

app.listen(8080, () => {
    console.log('SKJmod Simulator running on port 8080');
    console.log('Visit http://localhost:8080 to simulate bomb notifications');
});
```

## 🚀 **導入手順**

### 1. WynnTrackerボット側の設定
```bash
# 新しい依存関係をインストール
npm install express express-rate-limit express-validator helmet cors sqlite3 winston

# API設定ファイルを作成
cp config/api.json.example config/api.json

# 環境変数を設定
cp .env.example .env
# .envファイルを編集してトークンとチャンネルIDを設定
```

### 2. SKJmod側の設定
```json
{
  "wynnTrackerApiUrl": "http://localhost:3000/api/skjmod",
  "wynnTrackerApiToken": "your_secure_token_here"
}
```

### 3. テスト実行
```bash
# ボット起動
npm start

# 別ターミナルでテスト
curl -X POST http://localhost:3000/api/skjmod/bombbell \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"bombType":"COMBAT_XP","bombDisplayName":"Combat Experience","world":"WC1","timestamp":1640995200000,"metadata":{"duration":20,"emoji":"⚔️"},"source":"GAME","detectionPattern":"Test"}'
```

この完全な実装により、SKJmodとWynnTrackerボットが完全に連携し、リアルタイムでボムベル通知をDiscordに送信できるようになります！