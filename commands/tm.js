const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const config = require('../config');
const rateLimiter = require('../utils/rateLimiter');

// エメラルド通貨のフォーマット関数
function formatEmeraldCurrency(emeralds) {
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

// 時間差をフォーマット
function formatTimeAgo(timestamp) {
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

// レアリティカラー
const RARITY_COLORS = {
    'Mythic': 0xAA00AA,
    'Fabled': 0xFF5555,
    'Legendary': 0x55FFFF,
    'Rare': 0xFF55FF,
    'Unique': 0xFFFF55,
    'Normal': 0xFFFFFF,
    'Set': 0x00AA00
};

// レアリティ絵文字
const RARITY_EMOJIS = {
    'Mythic': '<:mythic:1392820964219289700>',
    'Fabled': '<:fabled:1392871012470886511>',
    'Legendary': '<:legendary:1392870999565013118>',
    'Rare': '<:rare:1392870987749523616>',
    'Unique': '<:unique:1392870974440869988>',
    'Set': '🟢'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tm')
        .setDescription('Trade Market関連のコマンド')
        .addSubcommand(subcommand =>
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
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'search') {
            await handleSearch(interaction);
        }
    }
};

async function handleSearch(interaction) {
    const itemName = interaction.options.getString('item');
    const unidentifiedOnly = interaction.options.getBoolean('unidentified');
    
    // レート制限チェック（30秒）
    const rateLimitCheck = rateLimiter.canUseCommand(interaction.user.id, 'tm_search');
    if (!rateLimitCheck.allowed) {
        await interaction.reply({
            content: `⏳ このコマンドは30秒に1回しか使用できます。\nあと **${rateLimitCheck.waitTime}秒** お待ちください。`,
            ephemeral: true
        });
        return;
    }
    
    await interaction.deferReply();
    
    try {
        // 最新の出品情報を取得
        const listings = await getItemListings(itemName, unidentifiedOnly);
        
        if (!listings || listings.items.length === 0) {
            await interaction.editReply({
                content: `❌ **${itemName}** の出品が見つかりませんでした。`,
                embeds: []
            });
            return;
        }
        
        // 平均価格を取得
        const priceData = await getItemAveragePrice(itemName);
        
        // デバッグ: 価格データを確認
        if (priceData) {
            console.log(`[DEBUG] Price data for ${itemName}:`, {
                average_price: priceData.average_price,
                average_mid_80: priceData.average_mid_80_percent_price,
                unid_average: priceData.unidentified_average_price,
                unid_count: priceData.unidentified_count
            });
        }
        
        // 価格順（安い順）でソートして最安5件を取得
        const sortedListings = listings.items
            .sort((a, b) => a.listing_price - b.listing_price)
            .slice(0, 5);
        
        // 最初のアイテムからレアリティとタイプを取得
        const firstItem = sortedListings[0];
        const rarity = firstItem.rarity || 'Normal';
        const itemType = firstItem.type || 'Unknown';
        const rarityEmoji = RARITY_EMOJIS[rarity] || '';
        
        const embed = new EmbedBuilder()
            .setTitle(`${rarityEmoji} ${itemName} - Trade Market`)
            .setColor(RARITY_COLORS[rarity] || 0x808080)
            .setTimestamp()
            .setFooter({
                text: 'データソース: Wynnventory (wynnventory.com)',
                iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png'
            });
        
        // 価格情報
        let priceInfo = `**アイテムタイプ:** ${itemType}\n`;
        priceInfo += `**レアリティ:** ${rarity}\n`;
        priceInfo += `**出品総数:** ${listings.total}件\n\n`;
        
        if (priceData && (priceData.average_price > 0 || priceData.unidentified_average_price > 0)) {
            const avgPrice = formatEmeraldCurrency(priceData.average_price || 0);
            const avgMidPrice = formatEmeraldCurrency(priceData.average_mid_80_percent_price || 0);
            const unidAvgPrice = formatEmeraldCurrency(priceData.unidentified_average_price || 0);
            
            priceInfo += `**平均価格（過去7日間）:**\n`;
            if (priceData.average_price > 0) {
                priceInfo += `• 全体平均: **${avgPrice}**\n`;
            }
            if (priceData.average_mid_80_percent_price > 0) {
                priceInfo += `• 中央80%平均: **${avgMidPrice}**\n`;
            }
            if (priceData.unidentified_average_price > 0) {
                priceInfo += `• Unid平均: **${unidAvgPrice}**\n`;
            }
        } else if (sortedListings.length > 0 && unidentifiedOnly) {
            // 価格履歴がない場合、現在の出品から簡易的な平均を計算
            const currentPrices = sortedListings
                .filter(listing => listing.unidentified)
                .map(listing => listing.listing_price);
            
            if (currentPrices.length > 0) {
                const avgCurrentPrice = currentPrices.reduce((sum, price) => sum + price, 0) / currentPrices.length;
                priceInfo += `**現在の出品価格（平均）:**\n`;
                priceInfo += `• Unid平均: **${formatEmeraldCurrency(avgCurrentPrice)}** (${currentPrices.length}件)\n`;
            }
        }
        
        embed.setDescription(priceInfo);
        
        // 最安5件の出品
        let listingText = '';
        sortedListings.forEach((listing, index) => {
            const price = formatEmeraldCurrency(listing.listing_price);
            const timeAgo = formatTimeAgo(listing.timestamp);
            const unidStatus = listing.unidentified ? '📦 Unid' : '🔍 Identified';
            const shinyStatus = listing.shiny_stat ? '✨ Shiny' : '';
            
            listingText += `**${index + 1}.** ${unidStatus} ${shinyStatus}\n`;
            listingText += `　　価格: **${price}**\n`;
            listingText += `　　数量: ${listing.amount}個\n`;
            listingText += `　　出品: ${timeAgo}\n`;
            
            if (index < sortedListings.length - 1) {
                listingText += '\n';
            }
        });
        
        embed.addFields({
            name: '💰 最安の出品（5件）',
            value: listingText || '出品情報なし',
            inline: false
        });
        
        // 検索条件
        if (unidentifiedOnly !== null) {
            embed.addFields({
                name: '🔍 検索条件',
                value: unidentifiedOnly ? 'Unidentifiedのみ' : 'すべて',
                inline: true
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ERROR] TM search error:', error);
        await interaction.editReply({
            content: '❌ Trade Market情報の取得中にエラーが発生しました。',
            embeds: []
        });
    }
}

// アイテムの出品情報を取得
async function getItemListings(itemName, unidentifiedOnly = null) {
    try {
        const params = {
            page: 1,
            page_size: 50
        };
        
        if (unidentifiedOnly !== null) {
            params.unidentified = unidentifiedOnly;
        }
        
        const response = await axios.get(
            `https://www.wynnventory.com/api/trademarket/listings/${encodeURIComponent(itemName)}`,
            {
                params: params,
                timeout: 10000,
                headers: {
                    'Authorization': `Api-Key ${config.wynnventoryApiKey}`,
                    'User-Agent': 'WynnTracker-Bot/1.0',
                    'Accept': 'application/json'
                }
            }
        );
        
        return response.data;
        
    } catch (error) {
        console.error('[ERROR] Get item listings error:', error.response?.status || error.message);
        return null;
    }
}

// アイテムの平均価格を取得
async function getItemAveragePrice(itemName) {
    try {
        // 過去7日間の平均価格を取得
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        
        const response = await axios.get(
            `https://www.wynnventory.com/api/trademarket/history/${encodeURIComponent(itemName)}/price`,
            {
                params: {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                },
                timeout: 10000,
                headers: {
                    'Authorization': `Api-Key ${config.wynnventoryApiKey}`,
                    'User-Agent': 'WynnTracker-Bot/1.0',
                    'Accept': 'application/json'
                }
            }
        );
        
        return response.data;
        
    } catch (error) {
        console.error('[ERROR] Get average price error:', error.response?.status || error.message);
        return null;
    }
}

// レート制限設定を追加
if (!rateLimiter.limits['tm_search']) {
    rateLimiter.limits['tm_search'] = { interval: 30000, uses: 1 }; // 30秒に1回
}