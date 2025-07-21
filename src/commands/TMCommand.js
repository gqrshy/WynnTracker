const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('./BaseCommand');
const { ErrorHandler } = require('../utils/ErrorHandler');
const MarketService = require('../services/MarketService');

class TMCommand extends BaseCommand {
    constructor() {
        super({
            name: 'tm',
            description: 'Trade Market関連のコマンド',
            category: 'Market',
            cooldown: 5000
        });
        this.marketService = new MarketService();
    }

    addOptions(command) {
        command.addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('アイテムの最新出品情報を検索')
                .addStringOption(option =>
                    option
                        .setName('item')
                        .setDescription('検索するアイテム名')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option
                        .setName('unidentified')
                        .setDescription('Unidentifiedのみ表示（デフォルト: 両方）')
                        .setRequired(false)
                )
        );
    }

    async run(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'search') {
            await this.handleSearch(interaction);
        }
    }

    async handleSearch(interaction) {
        const itemName = interaction.options.getString('item');
        const unidentifiedOnly = interaction.options.getBoolean('unidentified');
        
        // レート制限チェック
        const rateLimitCheck = await this.rateLimiter.checkCommandLimit(
            interaction.user.id, 
            'tm_search',
            { windowMs: 30000, maxRequests: 1 }
        );
        
        if (!rateLimitCheck.allowed) {
            await interaction.reply({
                content: `⏳ このコマンドは30秒に1回しか使用できます。\nあと **${rateLimitCheck.retryAfter}秒** お待ちください。`,
                ephemeral: true
            });
            return;
        }
        
        await interaction.deferReply();
        
        try {
            // MarketServiceを使用してデータを取得
            const searchResult = await this.marketService.searchItems(itemName, {
                unidentifiedOnly,
                limit: 5
            });
            
            if (!searchResult || searchResult.items.length === 0) {
                await interaction.editReply({
                    content: `❌ **${itemName}** の出品が見つかりませんでした。`,
                    embeds: []
                });
                return;
            }
            
            // Embedを作成
            const embed = this.createSearchEmbed(searchResult);
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            const errorResponse = this.errorHandler.handle(error, {
                command: 'tm_search',
                userId: interaction.user.id,
                guildId: interaction.guild?.id
            });
            
            await interaction.editReply({
                content: `❌ ${errorResponse.message}`,
                embeds: []
            });
        }
    }

    createSearchEmbed(searchResult) {
        const { items, metadata, priceData } = searchResult;
        const firstItem = items[0];
        const rarity = firstItem.rarity || 'Normal';
        const itemType = firstItem.type || 'Unknown';
        
        // レアリティ情報
        const rarityInfo = this.getRarityInfo(rarity);
        
        const embed = new EmbedBuilder()
            .setTitle(`${rarityInfo.emoji} ${metadata.itemName} - Trade Market`)
            .setColor(rarityInfo.color)
            .setTimestamp()
            .setFooter({
                text: 'データソース: Wynnventory (wynnventory.com)',
                iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png'
            });
        
        // 基本情報
        let description = `**アイテムタイプ:** ${itemType}\n`;
        description += `**レアリティ:** ${rarity}\n`;
        description += `**出品総数:** ${metadata.totalListings}件\n\n`;
        
        // 価格情報
        if (priceData && this.hasPriceData(priceData)) {
            description += this.formatPriceInfo(priceData);
        }
        
        embed.setDescription(description);
        
        // 最安出品リスト
        const listingText = this.formatListings(items);
        embed.addFields({
            name: '💰 最安の出品（5件）',
            value: listingText || '出品情報なし',
            inline: false
        });
        
        // 検索条件
        if (metadata.unidentifiedOnly !== null) {
            embed.addFields({
                name: '🔍 検索条件',
                value: metadata.unidentifiedOnly ? 'Unidentifiedのみ' : 'すべて',
                inline: true
            });
        }
        
        return embed;
    }

    getRarityInfo(rarity) {
        const rarityData = {
            'Mythic': { color: 0xAA00AA, emoji: '<:mythic:1392820964219289700>' },
            'Fabled': { color: 0xFF5555, emoji: '<:fabled:1392871012470886511>' },
            'Legendary': { color: 0x55FFFF, emoji: '<:legendary:1392870999565013118>' },
            'Rare': { color: 0xFF55FF, emoji: '<:rare:1392870987749523616>' },
            'Unique': { color: 0xFFFF55, emoji: '<:unique:1392870974440869988>' },
            'Set': { color: 0x00AA00, emoji: '🟢' },
            'Normal': { color: 0xFFFFFF, emoji: '⚪' }
        };
        
        return rarityData[rarity] || rarityData['Normal'];
    }

    hasPriceData(priceData) {
        return priceData && (
            priceData.average_price > 0 || 
            priceData.unidentified_average_price > 0
        );
    }

    formatPriceInfo(priceData) {
        let priceInfo = '**平均価格（過去7日間）:**\n';
        
        if (priceData.average_price > 0) {
            priceInfo += `• 全体平均: **${this.formatEmeraldCurrency(priceData.average_price)}**\n`;
        }
        if (priceData.average_mid_80_percent_price > 0) {
            priceInfo += `• 中央80%平均: **${this.formatEmeraldCurrency(priceData.average_mid_80_percent_price)}**\n`;
        }
        if (priceData.unidentified_average_price > 0) {
            priceInfo += `• Unid平均: **${this.formatEmeraldCurrency(priceData.unidentified_average_price)}**\n`;
        }
        
        return priceInfo;
    }

    formatListings(items) {
        return items.map((listing, index) => {
            const price = this.formatEmeraldCurrency(listing.listing_price);
            const timeAgo = this.formatTimeAgo(listing.timestamp);
            const unidStatus = listing.unidentified ? '📦 Unid' : '🔍 Identified';
            const shinyStatus = listing.shiny_stat ? '✨ Shiny' : '';
            
            let text = `**${index + 1}.** ${unidStatus} ${shinyStatus}\n`;
            text += `　　価格: **${price}**\n`;
            text += `　　数量: ${listing.amount}個\n`;
            text += `　　出品: ${timeAgo}`;
            
            return text;
        }).join('\n\n');
    }

    formatEmeraldCurrency(emeralds) {
        if (!emeralds || emeralds < 0) return '0E';
        
        const STX = 262144; // 1stx = 262,144E
        const LE = 4096;    // 1LE = 4,096E
        const EB = 64;      // 1EB = 64E
        
        if (emeralds >= STX) {
            const stxValue = Math.floor((emeralds / STX) * 10) / 10;
            return `${stxValue}stx`;
        } else if (emeralds >= LE) {
            const leValue = Math.floor((emeralds / LE) * 10) / 10;
            return `${leValue}LE`;
        } else if (emeralds >= EB) {
            const ebValue = Math.floor((emeralds / EB) * 10) / 10;
            return `${ebValue}EB`;
        } else {
            return `${Math.floor(emeralds)}E`;
        }
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const time = new Date(timestamp).getTime();
        const diff = now - time;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}日前`;
        if (hours > 0) return `${hours}時間前`;
        if (minutes > 0) return `${minutes}分前`;
        return '数秒前';
    }

    static create() {
        return new TMCommand();
    }
}

module.exports = TMCommand;