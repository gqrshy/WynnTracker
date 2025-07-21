const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('./BaseCommand');
const WynnventoryAPIClient = require('../api/WynnventoryAPIClient');
const RateLimiter = require('../utils/RateLimiter');

class LRCommand extends BaseCommand {
    constructor() {
        super({
            name: 'lr',
            description: 'Lootrun関連のコマンド',
            category: 'Lootrun',
            cooldown: 5000
        });
        this.wynnventoryAPI = new WynnventoryAPIClient();
        this.rateLimiter = new RateLimiter();
    }

    addOptions(command) {
        command
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
            );
    }

    async run(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'lootpool') {
            await this.handleLootpool(interaction);
        } else if (subcommand === 'mythranking') {
            await this.handleMythRanking(interaction);
        }
    }

    async handleLootpool(interaction) {
        // Rate limit check
        const rateLimitResult = await this.rateLimiter.checkCommandLimit(
            interaction.user.id, 
            'lr_lootpool',
            { windowMs: 30000, maxRequests: 2 }
        );
        
        if (!rateLimitResult.allowed) {
            await interaction.reply({
                content: `⏳ このコマンドは30秒に2回まで使用できます。\nあと **${rateLimitResult.retryAfter}秒** お待ちください。`,
                ephemeral: true
            });
            return;
        }
        
        await interaction.deferReply();
        
        try {
            const page = interaction.options.getInteger('page') || 1;
            const selectedCamp = interaction.options.getString('camp');
            
            // Get lootpool data
            const lootpoolData = await this.getLootpoolHistoryData(page);
            
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
                
                // Period information
                const weekInfo = `**Week ${poolData.week}, ${poolData.year}**`;
                const pageInfo = `**Page ${lootpoolData.page}/${Math.ceil(lootpoolData.count / (lootpoolData.page_size || 1))}**`;
                const timeStatus = isCurrentWeek ? '*現在のルートプール*' : `*${page === 1 ? '最新' : page - 1 + '週前'}のルートプール*`;
                
                embed.setDescription(
                    `${weekInfo}\n` +
                    `${pageInfo}\n\n` +
                    `${timeStatus}`
                );
                
                // Show selected camp only or all camps
                const campsToShow = selectedCamp ? [this.getCampMapping()[selectedCamp]] : this.getCampDisplayOrder();
                
                for (const campId of campsToShow) {
                    const regionData = poolData.regions.find(r => r.region === campId);
                    if (regionData) {
                        const campName = this.getCampNames()[campId] || campId;
                        const itemsDisplay = this.formatLootpoolItems(regionData.items);
                        
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
            console.error('Error in lootpool command:', error);
            await interaction.editReply(
                '❌ ルートプール情報の取得中にエラーが発生しました。\n' +
                'Wynnventory (wynnventory.com) で最新情報を確認してください。'
            );
        }
    }

    async handleMythRanking(interaction) {
        // Rate limit check
        const rateLimitResult = await this.rateLimiter.checkRateLimit(
            interaction.user.id, 
            'lr_mythranking'
        );
        
        if (!rateLimitResult.allowed) {
            await interaction.reply({
                content: `⏳ このコマンドは5分に1回しか使用できます。\nあと **${Math.ceil(rateLimitResult.waitTime / 1000)}秒** お待ちください。`,
                ephemeral: true
            });
            return;
        }
        
        await interaction.deferReply();
        
        try {
            const embed = new EmbedBuilder()
                .setTitle('<:mythic:1392820964219289700> Mythic Unidentified Price Ranking')
                .setColor(0xAA00AA)
                .setTimestamp()
                .setFooter({ 
                    text: '価格データ: Wynnventory (wynnventory.com) | Unidentified価格', 
                    iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png' 
                });
            
            // Get mythic ranking data
            const campData = await this.getMythicRankingData();
            
            if (!campData || campData.length === 0) {
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
                    const avgValueFormatted = this.formatEmeraldCurrency(camp.avgValue);
                    const mythicList = this.formatMythicsWithPricesDiscord(camp.mythics);
                    
                    embed.addFields({
                        name: `**<:lootcamp:1392860439641067692> ${camp.campName}**`,
                        value: `　**平均価格: <:liquid_emerald:1392820980006522993> ${avgValueFormatted}**\n\n　${mythicList || '*No mythics available*'}`,
                        inline: false
                    });
                }
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error in mythranking command:', error);
            await interaction.editReply(
                '❌ Mythicランキング情報の取得中にエラーが発生しました。\n' +
                'Trade Market価格は変動するため、最新情報はゲーム内で確認してください。'
            );
        }
    }

    async getLootpoolHistoryData(page = 1) {
        try {
            const response = await this.wynnventoryAPI.getLootpoolData({
                params: { page, page_size: 1 }
            });
            
            if (response && response.pools && Array.isArray(response.pools)) {
                console.log(`Lootpool history data retrieved: page ${page}`);
                return response;
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching lootpool history:', error);
            return null;
        }
    }

    async getMythicRankingData() {
        try {
            const lootpoolData = await this.wynnventoryAPI.getLootrunData();
            
            if (!lootpoolData || !lootpoolData.routes || lootpoolData.routes.length === 0) {
                return [];
            }
            
            const campData = [];
            
            // Process each camp's mythic items and prices
            for (const route of lootpoolData.routes) {
                const campName = this.getCampNames()[route.name] || route.name;
                const mythics = await this.getCampMythicsWithPrices(route);
                
                if (mythics && mythics.length > 0) {
                    const unidMythics = mythics.filter(mythic => mythic.price > 0);
                    if (unidMythics.length > 0) {
                        const totalValue = unidMythics.reduce((sum, item) => sum + (item.price || 0), 0);
                        const avgValue = totalValue / unidMythics.length;
                        
                        campData.push({
                            campId: route.name,
                            campName,
                            avgValue,
                            mythics: mythics
                        });
                    }
                }
            }
            
            // Sort by average price (highest first)
            campData.sort((a, b) => b.avgValue - a.avgValue);
            
            return campData;
        } catch (error) {
            console.error('Error fetching mythic ranking data:', error);
            return [];
        }
    }

    async getCampMythicsWithPrices(campData) {
        try {
            const mythicItems = campData.rewards?.filter(item => 
                item.rarity === 'Mythic' && item.name
            ) || [];
            
            const mythics = [];
            const batchSize = 5;
            
            for (let i = 0; i < mythicItems.length; i += batchSize) {
                const batch = mythicItems.slice(i, i + batchSize);
                const pricePromises = batch.map(async item => {
                    try {
                        const priceHistory = await this.wynnventoryAPI.getItemPriceHistory(item.name, { days: 7 });
                        const price = priceHistory?.unidentified_average_price || 0;
                        
                        return {
                            name: item.name,
                            shiny: item.shiny || false,
                            price: price
                        };
                    } catch (error) {
                        console.error(`Error fetching price for ${item.name}:`, error);
                        return {
                            name: item.name,
                            shiny: item.shiny || false,
                            price: 0
                        };
                    }
                });
                
                const results = await Promise.all(pricePromises);
                mythics.push(...results);
                
                // Brief wait between batches
                if (i + batchSize < mythicItems.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            return mythics;
        } catch (error) {
            console.error('Error fetching mythic prices:', error);
            return [];
        }
    }

    formatLootpoolItems(items) {
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
        
        // Group by rarity
        for (const item of items) {
            if (rarityGroups[item.rarity]) {
                rarityGroups[item.rarity].push(item);
            }
        }
        
        let result = '';
        
        // Display Mythic items first
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
        
        // Fabled items
        if (rarityGroups['Fabled'].length > 0) {
            result += '　**━━━ <:fabled:1392871012470886511> Fabled Items ━━━**\n';
            for (const item of rarityGroups['Fabled']) {
                result += `　　• **${item.name}**\n`;
            }
            result += '\n';
        }
        
        // Legendary items
        if (rarityGroups['Legendary'].length > 0) {
            result += '　**━━━ <:legendary:1392870999565013118> Legendary Items ━━━**\n';
            for (const item of rarityGroups['Legendary']) {
                result += `　　• **${item.name}**\n`;
            }
            result += '\n';
        }
        
        // Set items
        if (rarityGroups['Set'].length > 0) {
            result += '　**━━━ 🟢 Set Items ━━━**\n';
            for (const item of rarityGroups['Set']) {
                result += `　　• **${item.name}**\n`;
            }
            result += '\n';
        }
        
        // Rare items
        if (rarityGroups['Rare'].length > 0) {
            result += '　**━━━ <:rare:1392870987749523616> Rare Items ━━━**\n';
            for (const item of rarityGroups['Rare']) {
                result += `　　• **${item.name}**\n`;
            }
            result += '\n';
        }
        
        // Unique items
        if (rarityGroups['Unique'].length > 0) {
            result += '　**━━━ <:unique:1392870974440869988> Unique Items ━━━**\n';
            for (const item of rarityGroups['Unique']) {
                result += `　　• **${item.name}**\n`;
            }
        }
        
        return result.trim() || '*No items in pool*';
    }

    formatMythicsWithPricesDiscord(mythics) {
        if (!mythics || mythics.length === 0) {
            return '*No mythics in current pool*';
        }
        
        let result = '　**━━━ <:mythic:1392820964219289700> Mythic Items ━━━**\n';
        
        for (const mythic of mythics) {
            const priceFormatted = this.formatEmeraldCurrency(mythic.price || 0);
            if (mythic.shiny) {
                result += `　　**<:shiny:1392820945638654124> ${mythic.name}** <:liquid_emerald:1392820980006522993> **${priceFormatted}**\n`;
            } else {
                result += `　　• **${mythic.name}** <:liquid_emerald:1392820980006522993> **${priceFormatted}**\n`;
            }
        }
        
        return result;
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

    getCampNames() {
        return {
            'COTL': 'ᴄᴀɴʏᴏɴ ᴏꜰ ᴛʜᴇ ʟᴏꜱᴛ - ᴛʜᴇꜱᴇᴀᴅ',
            'Corkus': 'ᴄᴏʀᴋᴜꜱ ᴘʀᴏᴠɪɴᴄᴇ - ᴄᴏʀᴋᴜꜱ ᴄɪᴛʏ',
            'Molten Heights': 'ᴍᴏʟᴛᴇɴ ʜᴇɪɢʜᴛꜱ - ʀᴏᴅᴏʀᴏᴄ',
            'Sky Islands': 'ꜱᴋʏ ɪꜱʟᴀɴᴅꜱ - ᴀʜᴍꜱᴏʀᴅ',
            'Silent Expanse': 'ꜱɪʟᴇɴᴛ ᴇxᴘᴀɴꜱᴇ - ʟᴜᴛʜᴏ'
        };
    }

    getCampDisplayOrder() {
        return ['COTL', 'Corkus', 'Molten Heights', 'Sky Islands', 'Silent Expanse'];
    }

    getCampMapping() {
        return {
            'COTL': 'COTL',
            'CP': 'Corkus',
            'MH': 'Molten Heights',
            'SI': 'Sky Islands',
            'SE': 'Silent Expanse'
        };
    }

    static create() {
        return new LRCommand();
    }
}

module.exports = LRCommand;