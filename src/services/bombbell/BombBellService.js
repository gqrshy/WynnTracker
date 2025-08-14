const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const BombTracker = require('./BombTracker');
const NotificationFormatter = require('./NotificationFormatter');
const BombHistory = require('./BombHistory');
const BaseService = require('../BaseService');

class BombBellService extends BaseService {
    constructor(client, config) {
        super('BombBellService', client);
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
                this.logger.debug('Duplicate bomb notification ignored', normalizedData);
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
                this.logger.info('Bomb notification processed successfully', {
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
            this.logger.error('Bomb notification processing failed:', error);
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
            this.logger.error('Discord notification send failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    getChannelForRegion(region) {
        const channels = {
            'Europe': this.config.get('channels.eu_bombbell', ''),
            'North America': this.config.get('channels.na_bombbell', ''),
            'Asia': this.config.get('channels.as_bombbell', ''),
            'South America': this.config.get('channels.sa_bombbell', ''),
            'Unknown': this.config.get('channels.general_bombbell', '')
        };
        
        return channels[region] || channels['Unknown'];
    }
    
    createActionButtons(bombData) {
        if (!this.config.get('features.enableActionButtons', false)) {
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
        if (!this.config.get('features.autoDeleteMessages', false)) {
            return;
        }
        
        const deleteTime = bombData.timestamp + (bombData.metadata.duration * 60 * 1000) + (5 * 60 * 1000); // +5分
        const delay = deleteTime - Date.now();
        
        if (delay > 0) {
            setTimeout(async () => {
                try {
                    await message.delete();
                    this.logger.debug(`Auto-deleted expired bomb message: ${message.id}`);
                } catch (error) {
                    this.logger.warn(`Failed to auto-delete message: ${error.message}`);
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
    
    async getBombDetails(timestamp) {
        return await this.history.getBombByTimestamp(timestamp);
    }
}

module.exports = BombBellService;