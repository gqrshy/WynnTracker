const express = require('express');
const rateLimit = require('express-rate-limit');
const { EmbedBuilder } = require('discord.js');
const Logger = require('../utils/Logger');

/**
 * MOD通知用API
 * WynnTrackerMODからのBomb検知通知を受信してDiscordに送信
 */
class ModNotificationAPI {
    constructor(discordClient) {
        this.app = express();
        this.client = discordClient;
        this.logger = new Logger('ModNotificationAPI');
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // JSON解析
        this.app.use(express.json({ limit: '1mb' }));
        
        // CORS設定（必要に応じて）
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            next();
        });
        
        // Rate Limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15分
            max: 100, // プレイヤーあたり最大100回
            message: { error: 'Rate limit exceeded' },
            standardHeaders: true,
            legacyHeaders: false
        });
        
        this.app.use('/api/', limiter);
    }

    setupRoutes() {
        // ヘルスチェック
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Bomb通知エンドポイント（MODの設定に合わせて）
        this.app.post('/api/bomb', async (req, res) => {
            try {
                const { 
                    playerName, 
                    serverName, 
                    bombType, 
                    timestamp,
                    botToken 
                } = req.body;

                this.logger.info('Bomb notification received:', { playerName, serverName, bombType });

                // 基本的なバリデーション
                if (!playerName || !serverName || !bombType) {
                    return res.status(400).json({ 
                        error: 'Missing required fields: playerName, serverName, bombType' 
                    });
                }

                // BOTトークン認証（オプション）
                if (process.env.MOD_BOT_TOKEN && botToken !== process.env.MOD_BOT_TOKEN) {
                    this.logger.warn('Invalid bot token from MOD');
                    return res.status(401).json({ error: 'Unauthorized' });
                }

                // Discord通知送信
                await this.sendBombNotification(playerName, serverName, bombType, timestamp);
                
                res.json({ 
                    success: true, 
                    message: 'Notification sent successfully',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('Error processing bomb notification:', error);
                res.status(500).json({ 
                    error: 'Internal server error',
                    message: error.message 
                });
            }
        });

        // エラーハンドラー
        this.app.use((error, req, res, next) => {
            this.logger.error('Express error:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    async sendBombNotification(playerName, serverName, bombType, timestamp) {
        try {
            // 環境変数からチャンネルIDを取得
            const channelId = process.env.BOMB_NOTIFICATION_CHANNEL_ID;
            if (!channelId) {
                this.logger.warn('BOMB_NOTIFICATION_CHANNEL_ID not configured');
                return;
            }

            const channel = this.client.channels.cache.get(channelId);
            if (!channel) {
                this.logger.error(`Channel not found: ${channelId}`);
                return;
            }

            // Bomb種類に応じてアイコンと色を設定
            const bombConfig = this.getBombConfig(bombType);
            
            const embed = new EmbedBuilder()
                .setTitle(`${bombConfig.icon} Bomb Detected`)
                .setDescription(`**${bombType}** が検知されました！`)
                .addFields(
                    { name: 'プレイヤー', value: playerName, inline: true },
                    { name: 'サーバー', value: serverName, inline: true },
                    { name: '時刻', value: timestamp ? `<t:${Math.floor(new Date(timestamp).getTime() / 1000)}:R>` : `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                )
                .setColor(bombConfig.color)
                .setTimestamp()
                .setFooter({ text: 'WynnTracker MOD' });

            await channel.send({ embeds: [embed] });
            this.logger.info(`Bomb notification sent to Discord: ${bombType} by ${playerName} on ${serverName}`);

        } catch (error) {
            this.logger.error('Error sending Discord notification:', error);
            throw error;
        }
    }

    getBombConfig(bombType) {
        const configs = {
            'Double XP Bomb': { icon: '💎', color: 0x00ff00 },
            'Bomb Bell': { icon: '🔔', color: 0xffff00 },
            'Soul Point Bomb': { icon: '👻', color: 0x800080 },
            'Emerald Bomb': { icon: '💰', color: 0x00ff80 },
            'default': { icon: '💣', color: 0xff0000 }
        };

        return configs[bombType] || configs['default'];
    }

    start(port = 3000) {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(port, () => {
                    this.logger.info(`MOD API server running on port ${port}`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        this.logger.error(`Port ${port} is already in use`);
                    } else {
                        this.logger.error('Server error:', error);
                    }
                    reject(error);
                });

            } catch (error) {
                this.logger.error('Failed to start MOD API server:', error);
                reject(error);
            }
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.logger.info('MOD API server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = ModNotificationAPI;