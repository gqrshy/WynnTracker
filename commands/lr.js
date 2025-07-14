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
        // 小数点第二位以下は省く
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

// キャンプ名のフォーマット（特殊文字）とAPIでのregion名のマッピング
const CAMP_NAMES = {
    'COTL': 'ᴄᴀɴʏᴏɴ ᴏꜰ ᴛʜᴇ ʟᴏꜱᴛ - ᴛʜᴇꜱᴇᴀᴅ',
    'Corkus': 'ᴄᴏʀᴋᴜꜱ ᴘʀᴏᴠɪɴᴄᴇ - ᴄᴏʀᴋᴜꜱ ᴄɪᴛʏ',
    'Molten Heights': 'ᴍᴏʟᴛᴇɴ ʜᴇɪɢʜᴛꜱ - ʀᴏᴅᴏʀᴏᴄ',
    'Sky Islands': 'ꜱᴋʏ ɪꜱʟᴀɴᴅꜱ - ᴀʜᴍꜱᴏʀᴅ',
    'Silent Expanse': 'ꜱɪʟᴇɴᴛ ᴇxᴘᴀɴꜱᴇ - ʟᴜᴛʜᴏ'
};

// キャンプの表示順序（指定された順序）
const CAMP_DISPLAY_ORDER = ['COTL', 'Corkus', 'Molten Heights', 'Sky Islands', 'Silent Expanse'];

// 選択肢の値からAPIのregion名へのマッピング
const CHOICE_TO_REGION = {
    'COTL': 'COTL',
    'CP': 'Corkus',
    'MH': 'Molten Heights',
    'SI': 'Sky Islands',
    'SE': 'Silent Expanse'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lr')
        .setDescription('Lootrun関連のコマンド')
        .addSubcommand(subcommand =>
            subcommand
                .setName('lootpool')
                .setDescription('各キャンプのルートプールを表示（ページ指定可能）')
                .addIntegerOption(option =>
                    option
                        .setName('page')
                        .setDescription('表示するページ番号（1=最新、2=1週前、など）')
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('camp')
                        .setDescription('表示するキャンプを選択')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Canyon of the Lost - Thesead', value: 'COTL' },
                            { name: 'Corkus Province - Corkus City', value: 'CP' },
                            { name: 'Molten Heights - Rodoroc', value: 'MH' },
                            { name: 'Sky Islands - Ahmsord', value: 'SI' },
                            { name: 'Silent Expanse - Lutho', value: 'SE' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('mythranking')
                .setDescription('Mythicアイテムの相場ランキングを表示')
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'lootpool') {
            await handleLootpool(interaction);
        } else if (subcommand === 'mythranking') {
            await handleMythRanking(interaction);
        }
    }
};

async function handleLootpool(interaction) {
    // レート制限チェック
    const rateLimitCheck = rateLimiter.canUseCommand(interaction.user.id, 'lr_lootpool');
    if (!rateLimitCheck.allowed) {
        await interaction.reply({
            content: `⏳ このコマンドは30秒に2回まで使用できます。\nあと **${rateLimitCheck.waitTime}秒** お待ちください。`,
            ephemeral: true
        });
        return;
    }
    
    await interaction.deferReply();
    
    try {
        const page = interaction.options.getInteger('page') || 1;
        const selectedCamp = interaction.options.getString('camp');
        
        // キャッシュチェック
        const cacheKey = `page_${page}_camp_${selectedCamp || 'all'}`;
        const cachedData = rateLimiter.getCache('lr_lootpool', cacheKey);
        
        let lootpoolData;
        if (cachedData) {
            console.log('[INFO] Using cached lootpool data');
            lootpoolData = cachedData;
        } else {
            // Wynnventory APIから過去のルートプール情報を取得（ページ指定）
            lootpoolData = await getLootpoolHistoryData(page);
            if (lootpoolData) {
                rateLimiter.setCache('lr_lootpool', cacheKey, lootpoolData);
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🎁 Loot Pool History')
            .setColor(0x00AE86)
            .setTimestamp()
            .setFooter({ 
                text: `データソース: Wynnventory (wynnventory.com) | Page ${page}`, 
                iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png' 
            });
        
        if (!lootpoolData || !lootpoolData.pools || lootpoolData.pools.length === 0) {
            embed.setDescription(
                '⚠️ **Wynnventory APIからデータを取得できませんでした**\n\n' +
                '**現在のルートプール確認方法:**\n' +
                '• [Wynnventory.com](https://wynnventory.com) でブラウザから確認\n' +
                '• ゲーム内のルートランキャンプでReward Chestを確認\n' +
                '• コミュニティDiscordでの情報共有'
            );
        } else {
            const poolData = lootpoolData.pools[0];
            const isCurrentWeek = page === 1;
            
            // 期間情報を表示
            const weekInfo = `**Week ${poolData.week}, ${poolData.year}**`;
            const pageInfo = `**Page ${lootpoolData.page}/${Math.ceil(lootpoolData.count / (lootpoolData.page_size || 1))}**`;
            const timeStatus = isCurrentWeek ? '*現在のルートプール*' : `*${page === 1 ? '最新' : page - 1 + '週前'}のルートプール*`;
            
            embed.setDescription(
                `${weekInfo}\n` +
                `${pageInfo}\n\n` +
                `${timeStatus}`
            );
            
            // キャンプが選択されている場合は選択されたキャンプのみ表示、そうでなければ全キャンプ表示
            const campsToShow = selectedCamp ? [CHOICE_TO_REGION[selectedCamp]] : CAMP_DISPLAY_ORDER;
            
            for (const campId of campsToShow) {
                const regionData = poolData.regions.find(r => r.region === campId);
                if (regionData) {
                    const campName = CAMP_NAMES[campId] || campId;
                    const itemsDisplay = formatLootpoolItems(regionData.items);
                    
                    embed.addFields({
                        name: `<:lootcamp:1392860439641067692> ${campName}`,
                        value: `\u200b\n　${itemsDisplay || '*No items in pool*'}`,
                        inline: false
                    });
                }
            }
        }
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ERROR] Lootpool取得エラー:', error);
        await interaction.editReply(
            '❌ ルートプール情報の取得中にエラーが発生しました。\n' +
            'Wynnventory (wynnventory.com) で最新情報を確認してください。'
        );
    }
}

async function handleMythRanking(interaction) {
    // レート制限チェック
    const rateLimitCheck = rateLimiter.canUseCommand(interaction.user.id, 'lr_mythranking');
    if (!rateLimitCheck.allowed) {
        await interaction.reply({
            content: `⏳ このコマンドは5分に1回しか使用できます。\nあと **${rateLimitCheck.waitTime}秒** お待ちください。`,
            ephemeral: true
        });
        return;
    }
    
    await interaction.deferReply();
    
    try {
        const embed = new EmbedBuilder()
            .setTitle('<:mythic:1392820964219289700> Mythic Unidentified Price Ranking')
            .setColor(0xAA00AA) // 紫色
            .setTimestamp()
            .setFooter({ 
                text: '価格データ: Wynnventory (wynnventory.com) | Unidentified価格', 
                iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png' 
            });
        
        // キャッシュチェック
        const cacheKey = 'mythranking';
        const cachedData = rateLimiter.getCache('lr_mythranking', cacheKey);
        
        let campData = [];
        if (cachedData) {
            console.log('[INFO] Using cached mythranking data');
            campData = cachedData;
        } else {
            // 各キャンプのMythic情報と平均価格を取得
            const lootpoolData = await getLootpoolData();
        
        if (!lootpoolData || lootpoolData.length === 0) {
            embed.setDescription(
                '⚠️ **Wynnventory APIからデータを取得できませんでした**\n\n' +
                '**Mythicアイテム価格確認方法:**\n' +
                '• ゲーム内のTrade Marketで検索\n' +
                '• [Wynnventory.com](https://wynnventory.com) のブラウザ版\n' +
                '• コミュニティDiscordでの相場情報'
            );
        } else {
            // 各キャンプのMythicアイテムと価格を取得
            for (const campInfo of lootpoolData) {
                const campName = CAMP_NAMES[campInfo.region] || campInfo.region;
                const mythics = await getCampMythicsWithPrices(campInfo);
                
                if (mythics && mythics.length > 0) {
                    // unidentified価格のみで平均を計算
                    const unidMythics = mythics.filter(mythic => mythic.price > 0);
                    if (unidMythics.length > 0) {
                        const totalValue = unidMythics.reduce((sum, item) => sum + (item.price || 0), 0);
                        const avgValue = totalValue / unidMythics.length;
                        
                        campData.push({
                            campId: campInfo.region,
                            campName,
                            avgValue,
                            mythics: mythics
                        });
                    }
                }
            }
                
                // キャッシュに保存
                if (campData.length > 0) {
                    rateLimiter.setCache('lr_mythranking', cacheKey, campData);
                }
            }
            
            // 平均価格でソート（高い順）
            campData.sort((a, b) => b.avgValue - a.avgValue);
            
            if (campData.length === 0) {
                embed.setDescription(
                    '⚠️ **現在のルートプールにMythicアイテムが見つかりません**\n\n' +
                    'または価格データの取得に失敗しました。\n' +
                    '[Wynnventory.com](https://wynnventory.com) で最新情報を確認してください。'
                );
            } else {
                embed.setDescription(
                    `**各キャンプのMythic Unidentified価格ランキング**\n` +
                    `*平均価格順（高い順）*\n\n` +
                    `*価格は過去7日間のUnidentified取引データに基づきます*`
                );
                
                for (const camp of campData) {
                    const avgValueFormatted = formatEmeraldCurrency(camp.avgValue);
                    const mythicList = formatMythicsWithPricesDiscord(camp.mythics);
                    
                    embed.addFields({
                        name: `**<:lootcamp:1392860439641067692> ${camp.campName}**`,
                        value: `　**平均価格: <:liquid_emerald:1392820980006522993> ${avgValueFormatted}**\n\n　${mythicList || '*No mythics available*'}`,
                        inline: false
                    });
                }
            }
        }
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ERROR] MythRanking取得エラー:', error);
        await interaction.editReply(
            '❌ Mythicランキング情報の取得中にエラーが発生しました。\n' +
            'Trade Market価格は変動するため、最新情報はゲーム内で確認してください。'
        );
    }
}

// Wynnventory APIからルートプール履歴情報を取得（ページ指定）
async function getLootpoolHistoryData(page = 1) {
    try {
        const response = await axios.get(`https://www.wynnventory.com/api/lootpool/all?page=${page}&page_size=1`, {
            timeout: 10000,
            headers: {
                'Authorization': `Api-Key ${config.wynnventoryApiKey}`,
                'User-Agent': 'WynnTracker-Bot/1.0',
                'Accept': 'application/json'
            }
        });
        
        if (response.data && response.data.pools && Array.isArray(response.data.pools)) {
            console.log(`[SUCCESS] Lootpool history data retrieved: page ${page}`);
            return response.data;
        }
        
        return null;
        
    } catch (error) {
        console.error('[ERROR] Lootpool 履歴データ取得エラー:', error.response?.status || error.message);
        return null;
    }
}

// Wynnventory APIからルートプール情報を取得（mythranking用）
async function getLootpoolData() {
    try {
        const response = await axios.get('https://www.wynnventory.com/api/lootpool/items', {
            timeout: 10000,
            headers: {
                'Authorization': `Api-Key ${config.wynnventoryApiKey}`,
                'User-Agent': 'WynnTracker-Bot/1.0',
                'Accept': 'application/json'
            }
        });
        
        if (response.data && Array.isArray(response.data)) {
            console.log(`[SUCCESS] Lootpool data retrieved: ${response.data.length} camps`);
            return response.data;
        }
        
        return null;
        
    } catch (error) {
        console.error('[ERROR] Lootpool データ取得エラー:', error.response?.status || error.message);
        return null;
    }
}

// ルートプールアイテムをフォーマット
function formatLootpoolItems(items) {
    if (!items || items.length === 0) {
        return '*No items in pool*';
    }
    
    const rarityGroups = {
        'Mythic': [],
        'Fabled': [],
        'Legendary': [],
        'Rare': [],
        'Set': [],
        'Unique': []
    };
    
    // レアリティ別にグループ化
    for (const item of items) {
        if (rarityGroups[item.rarity]) {
            rarityGroups[item.rarity].push(item);
        }
    }
    
    let result = '';
    
    // Mythicアイテムを最初に表示
    if (rarityGroups['Mythic'].length > 0) {
        result += '　**━━━ <:mythic:1392820964219289700> Mythic Items ━━━**\n';
        for (const item of rarityGroups['Mythic']) {
            if (item.shiny) {
                result += `　　**<:shiny:1392820945638654124> ${item.name}**\n`;
                if (item.shinyStat && item.shinyStat.statType && item.shinyStat.statType.displayName) {
                    result += `　　　　\`Tracker: ${item.shinyStat.statType.displayName}\`\n`;
                }
            } else {
                result += `　　• **${item.name}**\n`;
            }
        }
        result += '\n';
    }
    
    // Fabledアイテム
    if (rarityGroups['Fabled'].length > 0) {
        result += '　**━━━ <:fabled:1392871012470886511> Fabled Items ━━━**\n';
        for (const item of rarityGroups['Fabled']) {
            result += `　　• **${item.name}**\n`;
        }
        result += '\n';
    }
    
    // Legendaryアイテム
    if (rarityGroups['Legendary'].length > 0) {
        result += '　**━━━ <:legendary:1392870999565013118> Legendary Items ━━━**\n';
        for (const item of rarityGroups['Legendary']) {
            result += `　　• **${item.name}**\n`;
        }
        result += '\n';
    }
    
    // Setアイテム
    if (rarityGroups['Set'].length > 0) {
        result += '　**━━━ 🟢 Set Items ━━━**\n';
        for (const item of rarityGroups['Set']) {
            result += `　　• **${item.name}**\n`;
        }
        result += '\n';
    }
    
    // Rareアイテム
    if (rarityGroups['Rare'].length > 0) {
        result += '　**━━━ <:rare:1392870987749523616> Rare Items ━━━**\n';
        for (const item of rarityGroups['Rare']) {
            result += `　　• **${item.name}**\n`;
        }
        result += '\n';
    }
    
    // Uniqueアイテム
    if (rarityGroups['Unique'].length > 0) {
        result += '　**━━━ <:unique:1392870974440869988> Unique Items ━━━**\n';
        for (const item of rarityGroups['Unique']) {
            result += `　　• **${item.name}**\n`;
        }
    }
    
    return result.trim() || '*No items in pool*';
}

// キャンプのMythicアイテムと価格データを取得（並列処理で高速化）
async function getCampMythicsWithPrices(campData) {
    try {
        const mythicGroups = campData.region_items.filter(group => 
            group.group === 'Mythic' || group.group === 'Shiny'
        );
        
        const mythics = [];
        
        // 並列処理で価格取得を高速化
        const pricePromises = [];
        
        for (const group of mythicGroups) {
            for (const item of group.loot_items) {
                if (item.rarity === 'Mythic') {
                    pricePromises.push(
                        getItemMarketPrice(item.name, item.shiny || false)
                            .then(priceData => ({
                                name: item.name,
                                shiny: item.shiny || false,
                                shinyStat: item.shinyStat || null,
                                price: priceData.averagePrice || 0
                            }))
                            .catch(error => {
                                console.error(`[ERROR] ${item.name}の価格取得エラー:`, error);
                                return {
                                    name: item.name,
                                    shiny: item.shiny || false,
                                    shinyStat: item.shinyStat || null,
                                    price: 0
                                };
                            })
                    );
                }
            }
        }
        
        // 並列で全ての価格を取得（バッチサイズを制限）
        const batchSize = 5;
        for (let i = 0; i < pricePromises.length; i += batchSize) {
            const batch = pricePromises.slice(i, i + batchSize);
            const results = await Promise.all(batch);
            mythics.push(...results);
            
            // バッチ間で短い待機時間
            if (i + batchSize < pricePromises.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        return mythics;
        
    } catch (error) {
        console.error('[ERROR] Mythic価格データ取得エラー:', error);
        return [];
    }
}

// キャンプからMythicアイテムを抽出（mythranking用）
function getMythicItemsFromCamp(campData) {
    try {
        const mythicGroups = campData.region_items.filter(group => 
            group.group === 'Mythic' || group.group === 'Shiny'
        );
        
        if (!mythicGroups || mythicGroups.length === 0) {
            return '*No mythics in current pool*';
        }
        
        let result = '🟣 **Mythics:**\n';
        
        for (const group of mythicGroups) {
            for (const item of group.loot_items) {
                if (item.rarity === 'Mythic') {
                    if (item.shiny) {
                        result += `- ✨ ${item.name}`;
                        if (item.shinyStat) {
                            result += ` (${item.shinyStat.statType.displayName})`;
                        }
                        result += '\n';
                    } else {
                        result += `- ${item.name}\n`;
                    }
                }
            }
        }
        
        return result || '*No mythics in current pool*';
        
    } catch (error) {
        console.error('[ERROR] Mythicアイテム抽出エラー:', error);
        return '*Error extracting mythics*';
    }
}

// Discord絵文字を使用したMythicリストフォーマット（mythranking用）
function formatMythicsWithPricesDiscord(mythics) {
    if (!mythics || mythics.length === 0) {
        return '*No mythics in current pool*';
    }
    
    let result = '　**━━━ <:mythic:1392820964219289700> Mythic Items ━━━**\n';
    
    for (const mythic of mythics) {
        const priceFormatted = formatEmeraldCurrency(mythic.price || 0);
        if (mythic.shiny) {
            result += `　　**<:shiny:1392820945638654124> ${mythic.name}** <:liquid_emerald:1392820980006522993> **${priceFormatted}**\n`;
            if (mythic.shinyStat && mythic.shinyStat.statType) {
                result += `　　　　\`Tracker: ${mythic.shinyStat.statType.displayName}\`\n`;
            }
        } else {
            result += `　　• **${mythic.name}** <:liquid_emerald:1392820980006522993> **${priceFormatted}**\n`;
        }
    }
    
    return result;
}

// Trade Market価格を取得（unidentified価格優先）
async function getItemMarketPrice(itemName, isShiny = false) {
    try {
        const endpoint = `https://www.wynnventory.com/api/trademarket/item/${encodeURIComponent(itemName)}/price`;
        
        // Shinyアイテムの場合、shinyパラメータを追加
        const params = isShiny ? { shiny: true } : {};
        
        const response = await axios.get(endpoint, {
            timeout: 5000,
            headers: {
                'Authorization': `Api-Key ${config.wynnventoryApiKey}`,
                'User-Agent': 'WynnTracker-Bot/1.0',
                'Accept': 'application/json'
            },
            params: params
        });
        
        if (response.data) {
            // Unidentified価格を優先的に取得
            const unidPrice = response.data.unidentified_average_mid_80_percent_price || response.data.unidentified_average_price;
            const identifiedPrice = response.data.average_mid_80_percent_price || response.data.average_price;
            
            // Unidentified価格がある場合は優先、なければIdentified価格
            const averagePrice = unidPrice || identifiedPrice || 0;
            
            return { 
                averagePrice: averagePrice,
                highestPrice: response.data.highest_price || 0,
                lowestPrice: response.data.lowest_price || 0,
                isUnidentified: !!unidPrice
            };
        }
        
        return { averagePrice: 0, isUnidentified: false };
        
    } catch (error) {
        console.error(`[ERROR] アイテム ${itemName} (${isShiny ? 'Shiny' : 'Regular'}) の価格取得エラー:`, error.response?.status || error.message);
        return { averagePrice: 0, isUnidentified: false };
    }
}

