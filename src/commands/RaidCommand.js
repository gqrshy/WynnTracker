const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('./BaseCommand');
const WynnventoryAPIClient = require('../api/WynnventoryAPIClient');
const RateLimiter = require('../utils/RateLimiter');
const fs = require('fs');
const path = require('path');

class RaidCommand extends BaseCommand {
    constructor() {
        super({
            name: 'raid',
            description: 'レイド関連のコマンド',
            category: 'Raid',
            cooldown: 5000
        });
        this.wynnventoryAPI = new WynnventoryAPIClient();
        this.rateLimiter = new RateLimiter();
        this.aspectsData = this.loadAspectsData();
        this.gambitsData = this.loadGambitsData();
    }

    addOptions(command) {
        command.addSubcommand(subcommand =>
            subcommand
                .setName('aspectpool')
                .setDescription('今週の各レイドのアスペクトを表示')
                .addStringOption(option =>
                    option
                        .setName('rarity')
                        .setDescription('表示するレアリティを選択')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Mythic', value: 'mythic' },
                            { name: 'Fabled', value: 'fabled' },
                            { name: 'Legendary', value: 'legendary' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('language')
                        .setDescription('説明文の言語を選択')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Japanese only (日本語のみ)', value: 'ja' },
                            { name: 'English only (英語のみ)', value: 'en' }
                        )
                )
        );
    }

    async run(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'aspectpool') {
            await this.handleAspectPool(interaction);
        }
    }

    async handleAspectPool(interaction) {
        // Rate limit check
        const rateLimitResult = await this.rateLimiter.checkCommandLimit(
            interaction.user.id, 
            'raid_aspectpool',
            { windowMs: 30000, maxRequests: 2 }
        );
        
        if (!rateLimitResult.allowed) {
            await interaction.reply({
                content: `❌ レート制限に達しました。${rateLimitResult.retryAfter}秒後に再試行してください。`,
                ephemeral: true
            });
            return;
        }
        
        await interaction.deferReply();
        
        try {
            const selectedRarity = interaction.options.getString('rarity');
            const selectedLanguage = interaction.options.getString('language') || 'en';
            
            // Get raid aspect data
            const raidData = await this.getRaidPoolData();
            
            const embed = new EmbedBuilder()
                .setTitle('🏛️ Weekly Aspect Rotation')
                .setColor(0x9D4EDD)
                .setTimestamp()
                .setFooter({ 
                    text: 'データソース: Wynnventory (wynnventory.com)', 
                    iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png' 
                });
            
            // Process API response structure
            let regions = null;
            if (raidData) {
                if (raidData.regions) {
                    regions = raidData.regions;
                } else if (Array.isArray(raidData)) {
                    regions = raidData;
                }
            }
            
            if (!regions || regions.length === 0) {
                embed.setDescription(
                    '⚠️ **Wynnventory APIからデータを取得できませんでした**\n\n' +
                    '**レイドアスペクト確認方法:**\n' +
                    '• [Wynnventory.com](https://wynnventory.com) でブラウザから確認\n' +
                    '• ゲーム内のレイド報酬チェストで確認\n' +
                    '• コミュニティDiscordでの情報共有'
                );
            } else {
                // Week information
                const weekInfo = raidData.week && raidData.year ? 
                    `**Week ${raidData.week}, ${raidData.year}**` : 
                    '**Current Week**';
                
                const rarityText = selectedRarity ? 
                    `*${selectedRarity.charAt(0).toUpperCase() + selectedRarity.slice(1)} アスペクトのみ表示*` : 
                    '*全レアリティのアスペクトを表示*';
                
                const languageText = selectedLanguage === 'ja' ? '*日本語のみ表示*' :
                                   selectedLanguage === 'en' ? '*英語のみ表示（デフォルト）*' :
                                   '*日本語・英語両方表示*';
                
                embed.setDescription(
                    `${weekInfo}\n` +
                    `${rarityText}\n` +
                    `${languageText}\n\n` +
                    `*アスペクトは毎週木曜日に更新されます*`
                );
                
                // Process each raid's aspects
                const raidDisplayOrder = this.getRaidDisplayOrder();
                for (const raidId of raidDisplayOrder) {
                    const regionData = regions.find(r => r.region === raidId);
                    
                    if (regionData) {
                        let itemsToProcess = [];
                        
                        if (regionData.items && Array.isArray(regionData.items)) {
                            itemsToProcess = regionData.items;
                        } else if (regionData.group_items && Array.isArray(regionData.group_items)) {
                            const aspectsGroup = regionData.group_items.find(g => g.group === 'Aspects');
                            if (aspectsGroup && aspectsGroup.loot_items) {
                                itemsToProcess = aspectsGroup.loot_items;
                            }
                        }
                        
                        const raidName = this.getRaidNames()[raidId] || raidId;
                        
                        if (selectedRarity) {
                            // Show specific rarity only
                            const aspects = this.extractAspectsFromRaid(itemsToProcess, selectedRarity, selectedLanguage);
                            
                            if (aspects.length > 0) {
                                const raidEmoji = this.getRaidEmojis()[raidId] || '🏛️';
                                let aspectList = `　**━━━ ${raidEmoji} ${raidName} ━━━**\n`;
                                
                                for (const aspectInfo of aspects) {
                                    aspectList += `　　• **${aspectInfo.name}**\n`;
                                    aspectList += aspectInfo.description;
                                }
                                
                                embed.addFields({
                                    name: '\u200b',
                                    value: aspectList.trim(),
                                    inline: false
                                });
                            }
                        } else {
                            // Show all rarities
                            const aspectGroups = this.extractAspectsByRarity(itemsToProcess, selectedLanguage);
                            let hasAnyAspects = false;
                            const raidEmoji = this.getRaidEmojis()[raidId] || '🏛️';
                            let aspectList = `　**━━━ ${raidEmoji} ${raidName} ━━━**\n`;
                            
                            // Show Mythic aspects first
                            if (aspectGroups['Mythic'].length > 0) {
                                aspectList += '　　**<:mythic:1392820964219289700> Mythic Aspects**\n';
                                for (const aspectInfo of aspectGroups['Mythic']) {
                                    aspectList += `　　　• **${aspectInfo.name}**\n`;
                                    aspectList += aspectInfo.description.replace(/　　　/g, '　　　　');
                                }
                                aspectList += '\n';
                                hasAnyAspects = true;
                            }
                            
                            // Show Fabled aspects
                            if (aspectGroups['Fabled'].length > 0) {
                                aspectList += '　　**<:fabled:1392871012470886511> Fabled Aspects**\n';
                                for (const aspectInfo of aspectGroups['Fabled']) {
                                    aspectList += `　　　• **${aspectInfo.name}**\n`;
                                    aspectList += aspectInfo.description.replace(/　　　/g, '　　　　');
                                }
                                aspectList += '\n';
                                hasAnyAspects = true;
                            }
                            
                            // Show Legendary aspects
                            if (aspectGroups['Legendary'].length > 0) {
                                aspectList += '　　**<:legendary:1392870999565013118> Legendary Aspects**\n';
                                for (const aspectInfo of aspectGroups['Legendary']) {
                                    aspectList += `　　　• **${aspectInfo.name}**\n`;
                                    aspectList += aspectInfo.description.replace(/　　　/g, '　　　　');
                                }
                                hasAnyAspects = true;
                            }
                            
                            if (hasAnyAspects) {
                                embed.addFields({
                                    name: '\u200b',
                                    value: aspectList.trim(),
                                    inline: false
                                });
                            } else {
                                embed.addFields({
                                    name: '\u200b',
                                    value: `　**━━━ ${raidEmoji} ${raidName} ━━━**\n　*No aspects in current pool*`,
                                    inline: false
                                });
                            }
                        }
                    }
                }
                
                // Add Gambit information
                const gambits = await this.getCurrentGambits();
                if (gambits && gambits.length > 0) {
                    let gambitList = `　**━━━ 🎲 Current Week Gambits ━━━**\n`;
                    
                    for (const gambit of gambits) {
                        const shortName = gambit.name.replace("'s Gambit", '');
                        
                        if (gambit.description && Array.isArray(gambit.description)) {
                            const cleanedLines = gambit.description.map(line => 
                                line.replace(/§[0-9a-fk-or]/g, '')
                            );
                            const summary = cleanedLines.join(' ').replace(/\\s+/g, ' ');
                            const formattedSummary = this.formatGambitDescription(summary, selectedLanguage);
                            
                            gambitList += `　　• **${shortName}**\n`;
                            gambitList += `　　　${formattedSummary}\n`;
                        }
                    }
                    
                    embed.addFields({
                        name: '\u200b',
                        value: gambitList.trim(),
                        inline: false
                    });
                }
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error in aspectpool command:', error);
            await interaction.editReply('❌ アスペクトプール情報の取得中にエラーが発生しました。');
        }
    }

    async getRaidPoolData() {
        try {
            const response = await this.wynnventoryAPI.getRaidPoolData();
            
            if (response) {
                if (Array.isArray(response)) {
                    return { regions: response };
                } else if (response.regions && Array.isArray(response.regions)) {
                    return response;
                } else {
                    return response;
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching raid pool data:', error);
            return null;
        }
    }

    async getCurrentGambits() {
        try {
            const response = await this.wynnventoryAPI.getCurrentGambits();
            
            if (response && response.gambits) {
                return response.gambits;
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching gambits data:', error);
            return null;
        }
    }

    extractAspectsFromRaid(items, rarityFilter = null, language = 'en') {
        if (!items || !Array.isArray(items)) {
            return [];
        }
        
        const aspects = [];
        
        for (const item of items) {
            if (item.itemType === 'AspectItem' || (item.name && item.name.includes('Aspect'))) {
                if (rarityFilter) {
                    const itemRarity = item.rarity ? item.rarity.toLowerCase() : '';
                    if (itemRarity === rarityFilter.toLowerCase()) {
                        const classType = this.getClassFromAspectName(item.name);
                        const emoji = classType ? this.getClassEmojis()[classType] : '';
                        const description = this.getAspectDescription(item.name);
                        const formattedDescription = this.formatAspectDescription(description, language);
                        const shortName = this.shortenAspectName(item.name);
                        
                        aspects.push({
                            name: `${emoji} ${shortName}`,
                            description: formattedDescription
                        });
                    }
                } else {
                    const classType = this.getClassFromAspectName(item.name);
                    const emoji = classType ? this.getClassEmojis()[classType] : '';
                    const description = this.getAspectDescription(item.name);
                    const formattedDescription = this.formatAspectDescription(description, language);
                    const shortName = this.shortenAspectName(item.name);
                    
                    aspects.push({
                        name: `${emoji} ${shortName}`,
                        description: formattedDescription
                    });
                }
            }
        }
        
        return aspects;
    }

    extractAspectsByRarity(items, language = 'en') {
        if (!items || !Array.isArray(items)) {
            return {};
        }
        
        const aspectGroups = {
            'Mythic': [],
            'Fabled': [],
            'Legendary': []
        };
        
        for (const item of items) {
            if (item.itemType === 'AspectItem' || (item.name && item.name.includes('Aspect'))) {
                const itemRarity = item.rarity;
                let normalizedRarity = null;
                
                if (itemRarity === 'Mythic' || itemRarity === 'MYTHIC') {
                    normalizedRarity = 'Mythic';
                } else if (itemRarity === 'Fabled' || itemRarity === 'FABLED') {
                    normalizedRarity = 'Fabled';
                } else if (itemRarity === 'Legendary' || itemRarity === 'LEGENDARY') {
                    normalizedRarity = 'Legendary';
                }
                
                if (normalizedRarity && aspectGroups[normalizedRarity]) {
                    const classType = this.getClassFromAspectName(item.name);
                    const emoji = classType ? this.getClassEmojis()[classType] : '';
                    const description = this.getAspectDescription(item.name);
                    const formattedDescription = this.formatAspectDescription(description, language);
                    const shortName = this.shortenAspectName(item.name);
                    
                    aspectGroups[normalizedRarity].push({
                        name: `${emoji} ${shortName}`,
                        description: formattedDescription
                    });
                }
            }
        }
        
        return aspectGroups;
    }

    getClassFromAspectName(aspectName) {
        if (!this.aspectsData.aspect_class_mapping) return null;
        
        if (this.aspectsData.aspect_class_mapping[aspectName]) {
            return this.aspectsData.aspect_class_mapping[aspectName];
        }
        
        // Keyword-based detection
        for (const [className, keywords] of Object.entries(this.aspectsData.class_keywords || {})) {
            for (const keyword of keywords) {
                if (aspectName.includes(keyword)) {
                    return className;
                }
            }
        }
        
        return null;
    }

    getAspectDescription(aspectName) {
        if (!this.aspectsData.aspects) return null;
        
        const aspect = this.aspectsData.aspects[aspectName];
        if (aspect) {
            return {
                ja: aspect.ja || '',
                en: aspect.en || ''
            };
        }
        
        return null;
    }

    formatAspectDescription(description, language) {
        if (!description) return '';
        
        let result = '';
        
        switch (language) {
            case 'ja':
                if (description.ja) {
                    const wrappedText = this.wrapText(description.ja);
                    result = `　　　${wrappedText}\\n`;
                }
                break;
            case 'en':
                if (description.en) {
                    const wrappedText = this.wrapText(description.en);
                    result = `　　　${wrappedText}\\n`;
                } else if (description.ja) {
                    const wrappedText = this.wrapText(description.ja);
                    result = `　　　${wrappedText}\\n`;
                }
                break;
            default:
                if (description.en) {
                    const wrappedText = this.wrapText(description.en);
                    result = `　　　${wrappedText}\\n`;
                } else if (description.ja) {
                    const wrappedText = this.wrapText(description.ja);
                    result = `　　　${wrappedText}\\n`;
                }
                break;
        }
        
        return result;
    }

    formatGambitDescription(description, language = 'en') {
        // Get gambit translation from data
        const gambitData = this.getGambitTranslation(description);
        
        if (gambitData) {
            return this.formatGambitText(gambitData, language);
        }
        
        // Fallback to pattern matching for legacy system
        if (this.gambitsData && this.gambitsData.patterns) {
            for (const [pattern, translation] of Object.entries(this.gambitsData.patterns)) {
                const regexPattern = pattern
                    .replace(/\{[XYZ]\}/g, '(\\d+\\.?\\d*)')
                    .replace(/\\\+/g, '\\+')
                    .replace(/\\\*/g, '.*');
                
                const regex = new RegExp(regexPattern);
                const match = description.match(regex);
                
                if (match) {
                    let translatedText = translation;
                    for (let i = 1; i < match.length; i++) {
                        translatedText = translatedText.replace(`{${String.fromCharCode(87 + i)}}`, match[i]);
                    }
                    return this.formatGambitText({ ja: translatedText, en: description }, language);
                }
            }
        }
        
        // If no translation found, return original
        return this.formatGambitText({ ja: description, en: description }, language);
    }

    getGambitTranslation(gambitText) {
        if (!this.gambitsData || !this.gambitsData.gambits) {
            return null;
        }
        return this.gambitsData.gambits[gambitText] || null;
    }

    formatGambitText(gambitData, language) {
        const wrappedTextJa = this.wrapText(gambitData.ja);
        const wrappedTextEn = this.wrapText(gambitData.en);
        
        switch (language) {
            case 'ja':
                return wrappedTextJa;
            case 'en':
                return wrappedTextEn;
            case 'both':
                return `${wrappedTextJa}\n　　　${wrappedTextEn}`;
            default:
                return wrappedTextEn;
        }
    }

    wrapText(text, maxWidth = 50) {
        if (!text || text.length <= maxWidth) return `\`${text}\``;
        
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            if (currentLine.length === 0) {
                currentLine = word;
            } else if (currentLine.length + word.length + 1 <= maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        
        return lines.map(line => `\`${line}\``).join('\\n　　　');
    }

    shortenAspectName(aspectName) {
        return aspectName
            .replace('Aspect of ', '')
            .replace('Aspect of the ', '');
    }

    loadAspectsData() {
        try {
            const dataPath = path.join(__dirname, '..', '..', 'data', 'aspects.json');
            if (fs.existsSync(dataPath)) {
                const rawData = fs.readFileSync(dataPath, 'utf8');
                return JSON.parse(rawData);
            }
        } catch (error) {
            console.error('Error loading aspects data:', error);
        }
        
        // Fallback data if file not found
        return {
            aspect_class_mapping: {},
            class_keywords: {
                'Warrior': ['Warrior', 'Strength'],
                'Mage': ['Mage', 'Intelligence'],
                'Archer': ['Archer', 'Dexterity'],
                'Assassin': ['Assassin', 'Agility'],
                'Shaman': ['Shaman', 'Defense']
            },
            aspects: {}
        };
    }

    loadGambitsData() {
        try {
            const dataPath = path.join(__dirname, '..', '..', 'data', 'gambits.json');
            if (fs.existsSync(dataPath)) {
                const rawData = fs.readFileSync(dataPath, 'utf8');
                return JSON.parse(rawData);
            }
        } catch (error) {
            console.error('Error loading gambits data:', error);
        }
        
        return {
            gambit_names: {},
            gambits: {},
            patterns: {}
        };
    }

    getRaidNames() {
        return {
            'TNA': 'TNA (The Nameless Anomaly)',
            'TCC': 'TCC (The Canyon Colossus)', 
            'NOL': 'NOL (Orphion\'s Nexus of Light)',
            'NOTG': 'NOTG (Nest of the Grootslangs)'
        };
    }

    getRaidDisplayOrder() {
        return ['TNA', 'TCC', 'NOL', 'NOTG'];
    }

    getRaidEmojis() {
        return {
            'NOL': '<:nol:1393435274712973412>',
            'NOTG': '<:notg:1393435272653443133>',
            'TCC': '<:tcc:1393435276701077564>',
            'TNA': '<:tna:1393435278819196928>'
        };
    }

    getClassEmojis() {
        return {
            'Archer': '<:archer:1393313532988100749>',
            'Assassin': '<:assassin:1393313517179899904>',
            'Mage': '<:mage:1393313501237481503>',
            'Shaman': '<:shaman:1393312936616792074>',
            'Warrior': '<:warrior:1393313488075751465>'
        };
    }

    static create() {
        return new RaidCommand();
    }
}

module.exports = RaidCommand;