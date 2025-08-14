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
        
        this.japaneseNames = {
            'COMBAT_XP': 'コンバット経験値',
            'PROFESSION_XP': 'プロフェッション経験値',
            'PROFESSION_SPEED': 'プロフェッション速度',
            'DUNGEON': 'ダンジョン',
            'LOOT': 'ルート',
            'LOOT_CHEST': 'ルートチェスト',
            'MATERIAL': 'マテリアル',
            'SCROLL_CHARGE': 'スクロールチャージ'
        };
    }
    
    createBombEmbed(bombData) {
        const emoji = this.bombEmojis[bombData.bombType] || '💣';
        const color = this.bombColors[bombData.bombType] || 0x888888;
        const japaneseName = this.japaneseNames[bombData.bombType] || bombData.bombDisplayName;
        
        const embed = new EmbedBuilder()
            .setTitle(`${emoji} ${japaneseName} ボム`)
            .setColor(color)
            .setTimestamp(new Date(bombData.timestamp));
        
        // 基本情報
        let description = `**サーバー:** ${bombData.world}\n`;
        description += `**持続時間:** ${bombData.metadata.duration || '不明'} 分\n`;
        description += `**地域:** ${this.translateRegion(bombData.serverRegion)}\n`;
        
        if (bombData.playerName) {
            description += `**プレイヤー:** ${bombData.playerName}\n`;
        }
        
        // ソース情報
        description += `**検出元:** ${this.formatSource(bombData.source, bombData.detectionPattern)}\n`;
        
        // 有効期限
        if (bombData.metadata.duration) {
            const expiryTime = new Date(bombData.timestamp + (bombData.metadata.duration * 60 * 1000));
            description += `**期限:** <t:${Math.floor(expiryTime.getTime() / 1000)}:R>\n`;
        }
        
        embed.setDescription(description);
        
        // フィールド追加
        if (bombData.originalMessage) {
            embed.addFields({
                name: '📝 元メッセージ',
                value: `\`\`\`${bombData.originalMessage.substring(0, 1000)}\`\`\``,
                inline: false
            });
        }
        
        // サーバー参加リンク
        if (this.isValidServer(bombData.world)) {
            embed.addFields({
                name: '🎮 クイック参加',
                value: `[${bombData.world}に参加](https://wynncraft.com/servers/${bombData.world.toLowerCase()})`,
                inline: true
            });
        }
        
        // フッター
        embed.setFooter({
            text: 'SKJmod • WynnTracker Revival',
            iconURL: 'https://cdn.wynncraft.com/img/ico/favicon-16x16.png'
        });
        
        // サムネイル
        const thumbnailUrl = this.getBombThumbnailUrl(bombData.bombType);
        if (thumbnailUrl) {
            embed.setThumbnail(thumbnailUrl);
        }
        
        return embed;
    }
    
    translateRegion(region) {
        const regionTranslations = {
            'Europe': 'ヨーロッパ',
            'North America': '北アメリカ',
            'Asia': 'アジア',
            'South America': '南アメリカ',
            'Unknown': '不明'
        };
        
        return regionTranslations[region] || region;
    }
    
    formatSource(source, detectionPattern) {
        const sourceNames = {
            'GAME': 'ゲーム内メッセージ',
            'CHAT': 'プレイヤーチャット'
        };
        
        const sourceName = sourceNames[source] || source;
        return `${sourceName} (${detectionPattern})`;
    }
    
    isValidServer(world) {
        // Wynncraftサーバー名の検証
        return /^(WC|EU|AS|SA)\d+$/i.test(world);
    }
    
    getBombThumbnailUrl(bombType) {
        // Wynncraftの公式アイコンURLは実際には存在しないため、
        // プレースホルダーまたは独自のアイコンを使用
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
            .setTitle('📊 ボムベル統計')
            .setColor(0x00AE86)
            .setTimestamp();
        
        let description = `過去 **${this.translateTimeframe(timeframe)}** の統計\n\n`;
        
        // 総計
        description += `**総ボム数:** ${stats.totalBombs}\n`;
        description += `**ユニークサーバー:** ${stats.uniqueServers}\n`;
        description += `**1時間あたり平均:** ${stats.averagePerHour}\n\n`;
        
        // 爆弾タイプ別
        if (stats.bombTypes && Object.keys(stats.bombTypes).length > 0) {
            description += '**タイプ別:**\n';
            Object.entries(stats.bombTypes)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 8) // 上位8つ
                .forEach(([type, count]) => {
                    const emoji = this.bombEmojis[type] || '💣';
                    const japaneseName = this.japaneseNames[type] || type;
                    description += `${emoji} ${japaneseName}: ${count}\n`;
                });
        }
        
        embed.setDescription(description);
        
        // 地域別フィールド
        if (stats.serverRegions && Object.keys(stats.serverRegions).length > 0) {
            let regionText = '';
            Object.entries(stats.serverRegions)
                .sort(([,a], [,b]) => b - a)
                .forEach(([region, count]) => {
                    regionText += `${this.translateRegion(region)}: ${count}\n`;
                });
            
            if (regionText) {
                embed.addFields({
                    name: '🌍 地域別',
                    value: regionText,
                    inline: true
                });
            }
        }
        
        // アクティブサーバー
        if (stats.worlds && Object.keys(stats.worlds).length > 0) {
            let worldText = '';
            Object.entries(stats.worlds)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10) // 上位10サーバー
                .forEach(([world, count]) => {
                    worldText += `${world}: ${count}\n`;
                });
            
            if (worldText) {
                embed.addFields({
                    name: '🎮 アクティブサーバー',
                    value: worldText,
                    inline: true
                });
            }
        }
        
        embed.setFooter({
            text: 'WynnTracker Revival • ボムベル統計',
            iconURL: 'https://cdn.wynncraft.com/img/ico/favicon-16x16.png'
        });
        
        return embed;
    }
    
    translateTimeframe(timeframe) {
        const timeframes = {
            '1h': '1時間',
            '6h': '6時間',
            '12h': '12時間',
            '24h': '24時間',
            '1d': '1日',
            '3d': '3日',
            '7d': '7日',
            '1w': '1週間'
        };
        
        return timeframes[timeframe] || timeframe;
    }
    
    createActiveBombsEmbed(activeBombs) {
        const embed = new EmbedBuilder()
            .setTitle('💣 アクティブボム一覧')
            .setColor(0xFF6B35)
            .setTimestamp();
        
        if (activeBombs.length === 0) {
            embed.setDescription('現在アクティブなボムはありません。');
        } else {
            let description = '';
            activeBombs.slice(0, 10).forEach((bomb, index) => {
                const emoji = this.bombEmojis[bomb.bombType] || '💣';
                const japaneseName = this.japaneseNames[bomb.bombType] || bomb.displayName;
                description += `**${index + 1}.** ${emoji} ${japaneseName} - ${bomb.world} (${bomb.remainingMinutes}分残り)\n`;
            });
            
            if (activeBombs.length > 10) {
                description += `\n... その他 ${activeBombs.length - 10} 個`;
            }
            
            embed.setDescription(description);
        }
        
        embed.setFooter({
            text: `${activeBombs.length} 個のアクティブボム`,
            iconURL: 'https://cdn.wynncraft.com/img/ico/favicon-16x16.png'
        });
        
        return embed;
    }
}

module.exports = NotificationFormatter;