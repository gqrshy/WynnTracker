const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const rateLimiter = require('../utils/rateLimiter');
const dataCache = require('../utils/dataCache');
const ErrorHandler = require('../utils/errorHandler');

// レイド名のマッピング（APIのregion名 → 表示名）
const RAID_NAMES = {
    'TNA': 'TNA (The Nameless Anomaly)',
    'TCC': 'TCC (The Canyon Colossus)', 
    'NOL': 'NOL (Orphion\'s Nexus of Light)',
    'NOTG': 'NOTG (Nest of the Grootslangs)'
};

// レイドの表示順序
const RAID_DISPLAY_ORDER = ['TNA', 'TCC', 'NOL', 'NOTG'];


module.exports = {
    data: new SlashCommandBuilder()
        .setName('raid')
        .setDescription('レイド関連のコマンド')
        .addSubcommand(subcommand =>
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
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'aspectpool') {
            await handleAspectPool(interaction);
        }
    }
};

async function handleAspectPool(interaction) {
    // レート制限チェック
    const rateLimitCheck = rateLimiter.canUseCommand(interaction.user.id, 'raid_aspectpool');
    if (!rateLimitCheck.allowed) {
        const errorResponse = ErrorHandler.handleRateLimitError(rateLimitCheck.waitTime, 'raid aspectpool');
        await interaction.reply(errorResponse);
        return;
    }
    
    await interaction.deferReply();
    
    try {
        const selectedRarity = interaction.options.getString('rarity');
        const selectedLanguage = interaction.options.getString('language') || 'en';
        
        // キャッシュチェック
        const cacheKey = `${selectedRarity || 'all'}_${selectedLanguage}`;
        const cachedData = rateLimiter.getCache('raid_aspectpool', cacheKey);
        
        let raidData;
        if (cachedData) {
            console.log('[INFO] Using cached raid data for aspectpool');
            raidData = cachedData;
        } else {
            // Wynnventory APIからレイド報酬情報を取得
            raidData = await getRaidPoolData();
            if (raidData) {
                rateLimiter.setCache('raid_aspectpool', cacheKey, raidData);
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🏛️ Weekly Aspect Rotation')
            .setColor(0x9D4EDD) // 紫色
            .setTimestamp()
            .setFooter({ 
                text: 'データソース: Wynnventory (wynnventory.com)', 
                iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png' 
            });
        
        // APIレスポンスの構造に応じて処理を分岐
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
            // 週情報を表示
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
            
            // 各レイドのアスペクトを処理
            for (const raidId of RAID_DISPLAY_ORDER) {
                const regionData = regions.find(r => r.region === raidId);
                
                if (regionData) {
                    // APIドキュメントによると、group_itemsが存在する可能性がある
                    let itemsToProcess = [];
                    
                    if (regionData.items && Array.isArray(regionData.items)) {
                        itemsToProcess = regionData.items;
                    } else if (regionData.group_items && Array.isArray(regionData.group_items)) {
                        // group_itemsの中からAspectsグループを探す
                        const aspectsGroup = regionData.group_items.find(g => g.group === 'Aspects');
                        if (aspectsGroup && aspectsGroup.loot_items) {
                            itemsToProcess = aspectsGroup.loot_items;
                        }
                    }
                    
                    const raidName = RAID_NAMES[raidId] || raidId;
                    
                    if (selectedRarity) {
                        // 特定のレアリティが選択されている場合
                        const aspects = extractAspectsFromRaid(itemsToProcess, selectedRarity, selectedLanguage);
                        
                        if (aspects.length > 0) {
                            const raidEmoji = RAID_EMOJIS[raidId] || '🏛️';
                            
                            // 各レイドごとに個別のフィールドを作成（区切り線スタイル）
                            let aspectList = `　**━━━ ${raidEmoji} ${raidName} ━━━**\n`;
                            for (const aspectInfo of aspects) {
                                aspectList += `　　• **${aspectInfo.name}**\n`;
                                aspectList += aspectInfo.description;
                            }
                            
                            // シンプルに1つのフィールドとして追加
                            embed.addFields({
                                name: '\u200b',
                                value: aspectList.trim(),
                                inline: false
                            });
                        }
                    } else {
                        // 全レアリティ表示の場合
                        const aspectGroups = extractAspectsByRarity(itemsToProcess, selectedLanguage);
                        let hasAnyAspects = false;
                        const raidEmoji = RAID_EMOJIS[raidId] || '🏛️';
                        let aspectList = `　**━━━ ${raidEmoji} ${raidName} ━━━**\n`;
                        
                        // Mythicアイテムを最初に表示
                        if (aspectGroups['Mythic'].length > 0) {
                            aspectList += '　　**<:mythic:1392820964219289700> Mythic Aspects**\n';
                            for (const aspectInfo of aspectGroups['Mythic']) {
                                aspectList += `　　　• **${aspectInfo.name}**\n`;
                                aspectList += aspectInfo.description.replace(/　　　/g, '　　　　');
                            }
                            aspectList += '\n';
                            hasAnyAspects = true;
                        }
                        
                        // Fabledアイテム
                        if (aspectGroups['Fabled'].length > 0) {
                            aspectList += '　　**<:fabled:1392871012470886511> Fabled Aspects**\n';
                            for (const aspectInfo of aspectGroups['Fabled']) {
                                aspectList += `　　　• **${aspectInfo.name}**\n`;
                                aspectList += aspectInfo.description.replace(/　　　/g, '　　　　');
                            }
                            aspectList += '\n';
                            hasAnyAspects = true;
                        }
                        
                        // Legendaryアイテム
                        if (aspectGroups['Legendary'].length > 0) {
                            aspectList += '　　**<:legendary:1392870999565013118> Legendary Aspects**\n';
                            for (const aspectInfo of aspectGroups['Legendary']) {
                                aspectList += `　　　• **${aspectInfo.name}**\n`;
                                aspectList += aspectInfo.description.replace(/　　　/g, '　　　　');
                            }
                            hasAnyAspects = true;
                        }
                        
                        if (hasAnyAspects) {
                            // シンプルに1つのフィールドとして追加
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
            
            // アスペクトが見つからない場合
            if (embed.data.fields && embed.data.fields.length === 0) {
                const noAspectsMessage = selectedRarity ? 
                    `⚠️ **${selectedRarity.charAt(0).toUpperCase() + selectedRarity.slice(1)} アスペクトが見つかりません**` :
                    '⚠️ **現在の週にアスペクトが見つかりません**';
                
                embed.setDescription(
                    embed.data.description + '\n\n' + noAspectsMessage
                );
            }
            
            // Gambit情報を追加
            const gambits = await getCurrentGambits();
            if (gambits && gambits.length > 0) {
                let gambitList = `　**━━━ 🎲 Current Week Gambits ━━━**\n`;
                
                for (let i = 0; i < gambits.length; i++) {
                    const gambit = gambits[i];
                    // Gambit名を短縮（'s Gambitを削除）
                    const shortName = gambit.name.replace("'s Gambit", '');
                    
                    // 説明を1行にまとめる
                    if (gambit.description && Array.isArray(gambit.description)) {
                        const cleanedLines = gambit.description.map(line => 
                            line.replace(/§[0-9a-fk-or]/g, '')
                        );
                        const summary = cleanedLines.join(' ').replace(/\s+/g, ' ');
                        
                        // 言語設定に応じて説明文を整形
                        const formattedSummary = formatGambitDescription(summary, selectedLanguage);
                        
                        gambitList += `　　• **${shortName}**\n`;
                        gambitList += `　　　${formattedSummary}\n`;
                    }
                }
                
                // シンプルに1つのフィールドとして追加
                embed.addFields({
                    name: '\u200b',
                    value: gambitList.trim(),
                    inline: false
                });
            }
        }
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        await ErrorHandler.handleCommandError(error, 'raid aspectpool', interaction);
    }
}

// Wynnventory APIからレイドプール情報を取得
async function getRaidPoolData() {
    try {
        const response = await axios.get('https://www.wynnventory.com/api/raidpool/items', {
            timeout: 10000,
            headers: {
                'Authorization': `Api-Key ${config.wynnventoryApiKey}`,
                'User-Agent': 'WynnTracker-Bot/1.0',
                'Accept': 'application/json'
            }
        });
        
        // APIレスポンスの構造を確認
        if (response.data) {
            // もしかしたらresponse.dataが配列そのものかもしれない
            if (Array.isArray(response.data)) {
                return { regions: response.data };
            }
            // またはgroup_itemsを持つ構造かもしれない
            else if (response.data.regions && Array.isArray(response.data.regions)) {
                return response.data;
            }
            // その他の構造の場合
            else {
                return response.data;
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('[ERROR] Raid pool データ取得エラー:', ErrorHandler.handleAPIError(error, 'Wynnventory Raid Pool'));
        return null;
    }
}

// Wynnventory APIから現在のGambit情報を取得
async function getCurrentGambits() {
    try {
        const response = await axios.get('https://www.wynnventory.com/api/raidpool/gambits/current', {
            timeout: 10000,
            headers: {
                'Authorization': `Api-Key ${config.wynnventoryApiKey}`,
                'User-Agent': 'WynnTracker-Bot/1.0',
                'Accept': 'application/json'
            }
        });
        
        if (response.data && response.data.gambits) {
            return response.data.gambits;
        }
        
        return null;
        
    } catch (error) {
        console.error('[ERROR] Gambits データ取得エラー:', ErrorHandler.handleAPIError(error, 'Wynnventory Gambits'));
        return null;
    }
}

// クラス名とDiscord絵文字IDのマッピング
const CLASS_EMOJIS = {
    'Archer': '<:archer:1393313532988100749>',
    'Assassin': '<:assassin:1393313517179899904>',
    'Mage': '<:mage:1393313501237481503>',
    'Shaman': '<:shaman:1393312936616792074>',
    'Warrior': '<:warrior:1393313488075751465>'
};

// レイド名とDiscord絵文字IDのマッピング
const RAID_EMOJIS = {
    'NOL': '<:nol:1393435274712973412>',
    'NOTG': '<:notg:1393435272653443133>',
    'TCC': '<:tcc:1393435276701077564>',
    'TNA': '<:tna:1393435278819196928>'
};

// アスペクト名からクラスを判定
function getClassFromAspectName(aspectName) {
    // 直接マッピングをチェック
    if (aspectsData.aspect_class_mapping && aspectsData.aspect_class_mapping[aspectName]) {
        return aspectsData.aspect_class_mapping[aspectName];
    }
    
    // キーワードベースの判定（Embodiment系）
    for (const [className, keywords] of Object.entries(aspectsData.class_keywords)) {
        for (const keyword of keywords) {
            if (aspectName.includes(keyword)) {
                return className;
            }
        }
    }
    return null;
}

// アスペクトの説明を取得（日本語と英語両方）
function getAspectDescription(aspectName) {
    return dataCache.getAspectDescription(aspectName);
}

// テキストを指定された幅で改行し、各行をインラインコードブロックで囲む
function wrapText(text, maxWidth = 50) {
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
    
    // 各行を個別のインラインコードブロックで囲む
    return lines.map(line => `\`${line}\``).join('\n　　　');
}

// アスペクト名を短縮
function shortenAspectName(aspectName) {
    return aspectName
        .replace('Aspect of ', '')
        .replace('Aspect of the ', '');
}

// 選択された言語に応じて説明文を整形
function formatAspectDescription(description, language) {
    if (!description) return '';
    
    let result = '';
    
    switch (language) {
        case 'ja':
            if (description.ja) {
                const wrappedText = wrapText(description.ja);
                result = `　　　${wrappedText}\n`;
            }
            break;
        case 'en':
            if (description.en) {
                const wrappedText = wrapText(description.en);
                result = `　　　${wrappedText}\n`;
            } else if (description.ja) {
                // 英語がない場合は日本語をフォールバック
                const wrappedText = wrapText(description.ja);
                result = `　　　${wrappedText}\n`;
            }
            break;
        case 'both':
            if (description.ja) {
                const wrappedTextJa = wrapText(description.ja);
                result += `　　　${wrappedTextJa}\n`;
                if (description.en) {
                    const wrappedTextEn = wrapText(description.en);
                    result += `　　　${wrappedTextEn}\n`;
                }
            } else if (description.en) {
                const wrappedText = wrapText(description.en);
                result += `　　　${wrappedText}\n`;
            }
            break;
        default:
            // デフォルトは英語のみ
            if (description.en) {
                const wrappedText = wrapText(description.en);
                result = `　　　${wrappedText}\n`;
            } else if (description.ja) {
                // 英語がない場合は日本語をフォールバック
                const wrappedText = wrapText(description.ja);
                result = `　　　${wrappedText}\n`;
            }
            break;
    }
    
    return result;
}

// レイドアイテムからアスペクトを抽出
function extractAspectsFromRaid(items, rarityFilter = null, language = 'both') {
    if (!items || !Array.isArray(items)) {
        return [];
    }
    
    const aspects = [];
    
    for (const item of items) {
        // Aspectアイテムかどうかチェック
        if (item.itemType === 'AspectItem' || (item.name && item.name.includes('Aspect'))) {
            // レアリティフィルタが指定されている場合
            if (rarityFilter) {
                const itemRarity = item.rarity ? item.rarity.toLowerCase() : '';
                if (itemRarity === rarityFilter.toLowerCase()) {
                    // クラス絵文字を追加
                    const classType = getClassFromAspectName(item.name);
                    const emoji = classType ? CLASS_EMOJIS[classType] : '';
                    const description = getAspectDescription(item.name);
                    const formattedDescription = formatAspectDescription(description, language);
                    const shortName = shortenAspectName(item.name);
                    aspects.push({
                        name: `${emoji} ${shortName}`,
                        description: formattedDescription
                    });
                }
            } else {
                // クラス絵文字を追加
                const classType = getClassFromAspectName(item.name);
                const emoji = classType ? CLASS_EMOJIS[classType] : '';
                const description = getAspectDescription(item.name);
                const formattedDescription = formatAspectDescription(description, language);
                const shortName = shortenAspectName(item.name);
                aspects.push({
                    name: `${emoji} ${shortName}`,
                    description: formattedDescription
                });
            }
        }
    }
    
    return aspects;
}

// レアリティ別にアスペクトをグループ化
function extractAspectsByRarity(items, language = 'both') {
    if (!items || !Array.isArray(items)) {
        return {};
    }
    
    const aspectGroups = {
        'Mythic': [],
        'Fabled': [],
        'Legendary': []
    };
    
    for (const item of items) {
        // Aspectアイテムかどうかチェック
        if (item.itemType === 'AspectItem' || (item.name && item.name.includes('Aspect'))) {
            // APIでのレアリティは大文字の場合があるので正規化
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
                // クラス絵文字を追加
                const classType = getClassFromAspectName(item.name);
                const emoji = classType ? CLASS_EMOJIS[classType] : '';
                const description = getAspectDescription(item.name);
                const formattedDescription = formatAspectDescription(description, language);
                const shortName = shortenAspectName(item.name);
                aspectGroups[normalizedRarity].push({
                    name: `${emoji} ${shortName}`,
                    description: formattedDescription
                });
            }
        }
    }
    
    return aspectGroups;
}

// Gambit説明の処理（言語オプションに対応）
function formatGambitDescription(description, language = 'en') {
    // キャッシュからGambitデータを取得
    const gambitData = dataCache.getGambitDescription(description);
    
    if (gambitData) {
        return formatGambitText(gambitData, language);
    }
    
    // キャッシュにない場合は、gambits.jsonから直接取得してパターンマッチング
    const gambitsData = dataCache.getData('gambits.json');
    if (!gambitsData || !gambitsData.patterns) {
        return formatGambitText({ ja: description, en: description }, language);
    }
    
    // パターンマッチングで翻訳（旧システム用）
    for (const [pattern, translation] of Object.entries(gambitsData.patterns)) {
        // {X}, {Y}, {Z}を数値の正規表現に置き換え
        const regexPattern = pattern
            .replace(/\{[XYZ]\}/g, '(\\d+\\.?\\d*)')
            .replace(/\\\+/g, '\\+')
            .replace(/\\\*/g, '.*');
        
        const regex = new RegExp(regexPattern);
        const match = description.match(regex);
        
        if (match) {
            let translatedText = translation;
            // マッチした数値を翻訳文に挿入
            for (let i = 1; i < match.length; i++) {
                translatedText = translatedText.replace(`{${String.fromCharCode(87 + i)}}`, match[i]);
            }
            return formatGambitText({ ja: translatedText, en: description }, language);
        }
    }
    
    // 翻訳が見つからない場合は元の説明文を返す
    return formatGambitText({ ja: description, en: description }, language);
}

// Gambitテキストを言語設定に応じて整形
function formatGambitText(gambitData, language) {
    const wrappedTextJa = wrapText(gambitData.ja);
    const wrappedTextEn = wrapText(gambitData.en);
    
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

// テキストを1024文字制限内で複数のフィールドに分割
function splitTextIntoFields(text, maxLength = 1024) {
    if (text.length <= maxLength) {
        return [text];
    }
    
    const lines = text.split('\n');
    const fields = [];
    let currentField = '';
    
    for (const line of lines) {
        // 次の行を追加した場合の長さをチェック
        const testLength = currentField.length + (currentField ? 1 : 0) + line.length;
        
        if (testLength <= maxLength) {
            if (currentField) {
                currentField += '\n' + line;
            } else {
                currentField = line;
            }
        } else {
            // 現在のフィールドを保存して新しいフィールドを開始
            if (currentField) {
                fields.push(currentField);
            }
            currentField = line;
        }
    }
    
    // 最後のフィールドを追加
    if (currentField) {
        fields.push(currentField);
    }
    
    return fields;
}



