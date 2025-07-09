const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayerStats } = require('../utils/wynncraft-api');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wynn')
        .setDescription('Wynncraft関連のコマンド')
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('プレイヤーの統計情報を表示')
                .addStringOption(option =>
                    option
                        .setName('mcid')
                        .setDescription('Minecraft ID')
                        .setRequired(true)
                )
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'stats') {
            await handleStats(interaction);
        }
    }
};

// プログレスバーを作成する関数（さらに改善）
function createProgressBar(percentage, length = 10) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    
    // より明確な差のある文字を使用
    const filledChar = '■';  // または '●'
    const emptyChar = '□';   // または '○'
    
    return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

// レベル進行状況を表示
function formatLevelProgress(level, xpPercent) {
    const bar = createProgressBar(xpPercent || 0, 20);
    return `\`Lv ${level.toString().padStart(3)} \` ${bar} \`${Math.floor(xpPercent || 0)}%\``;
}

// 時間フォーマット（時間単位で受け取る）
function formatPlaytimeClean(hours) {
    if (!hours || hours < 0) return '\`  0h 00m\`';
    
    // APIから受け取る値は時間単位
    const wholeHours = Math.floor(hours);
    const mins = Math.floor((hours - wholeHours) * 60);
    
    return `\`${wholeHours.toString().padStart(3)}h ${mins.toString().padStart(2, '0')}m\``;
}

// 大きな数値をフォーマット
function formatLargeNumber(num) {
    if (!num || num < 0) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
    return num.toString();
}

// 経過時間をフォーマット
function formatDuration(lastJoin) {
    if (!lastJoin) return 'Unknown';
    
    const seconds = Math.floor((Date.now() - new Date(lastJoin).getTime()) / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.length > 0 ? parts.join(' ') + ' ago' : 'Just now';
}

// クラス絵文字
function getClassEmoji(className) {
    const classEmojis = {
        'archer': '🏹',
        'warrior': '⚔️', 
        'mage': '🔮',
        'assassin': '🗡️',
        'shaman': '🌿',
        'darkwizard': '🌑',
        'hunter': '🎯',
        'knight': '🛡️',
        'ninja': '🥷',
        'skyseer': '☁️'
    };
    
    return classEmojis[className?.toLowerCase()] || '❓';
}

// レイドアイコン
const raidIcons = {
    'notg': '🦎',
    'tna': '👁️',
    'nol': '✨',
    'tcc': '⛰️'
};

// レベルから必要XPを計算する関数（概算）
function calculateTotalXPFromLevel(level) {
    // Wynncraftのレベリング曲線に基づく概算
    let totalXP = 0;
    for (let i = 1; i < level; i++) {
        if (i <= 15) {
            totalXP += 110 + (i * 10);
        } else if (i <= 30) {
            totalXP += 300 + (i * 20);
        } else if (i <= 50) {
            totalXP += 1000 + (i * 50);
        } else if (i <= 75) {
            totalXP += 5000 + (i * 200);
        } else if (i <= 100) {
            totalXP += 20000 + (i * 1000);
        } else {
            // レベル100以降
            totalXP += 1000000 + ((i - 100) * 50000);
        }
    }
    return totalXP;
}

async function handleStats(interaction) {
    const mcid = interaction.options.getString('mcid');
    
    await interaction.deferReply();
    
    try {
        const playerData = await getPlayerStats(mcid);
        
        if (!playerData) {
            return await interaction.editReply('❌ プレイヤーが見つかりませんでした');
        }
        
        // アクティブなキャラクターを取得
        let activeClass = null;
        let allCharacters = [];
        
        // characters オブジェクトがある場合
        if (playerData.characters && typeof playerData.characters === 'object') {
            allCharacters = Object.entries(playerData.characters).map(([uuid, char]) => ({
                uuid: uuid,
                ...char
            }));
            
            // アクティブキャラクターがある場合はそれを使用
            if (playerData.activeCharacter && playerData.characters[playerData.activeCharacter]) {
                activeClass = playerData.characters[playerData.activeCharacter];
            } else if (allCharacters.length > 0) {
                // なければ最高レベルのキャラクターを使用
                activeClass = allCharacters.sort((a, b) => (b.level || 0) - (a.level || 0))[0];
            }
        }
        
        // デフォルト値
        if (!activeClass) {
            activeClass = {
                type: 'No Character',
                level: 0,
                xp: 0,
                xpPercent: 0,
                wars: 0,
                playtime: 0
            };
        }
        
        // 基本情報
        const onlineStatus = playerData.online ? '🟢' : '🔴';
        const serverInfo = playerData.online && playerData.server ? playerData.server : '';
        const displayRank = playerData.supportRank || playerData.rank || 'Player';
        
        // グローバルデータ
        const globalData = playerData.globalData || {};
        const totalWars = globalData.wars || 0;
        
        // 全キャラクターの総XPを計算
        let totalXP = 0;
        allCharacters.forEach(char => {
            // 現在のレベルまでの総XP + 現在のレベルでの獲得XP
            const levelXP = calculateTotalXPFromLevel(char.level || 0);
            const currentXP = char.xp || 0;
            totalXP += levelXP + currentXP;
        });
        
        // ランク色の設定
        const rankColors = {
            'VIP': 0x55FF55,
            'VIP+': 0x55FF55,
            'HERO': 0xFF55FF,
            'CHAMPION': 0xFFAA00,
            'champion': 0xFFAA00,
            'Player': 0x7289DA
        };
        
        const embedColor = rankColors[displayRank] || 0x2B2D31;
        
        // Embed作成（authorを削除）
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setThumbnail(`https://visage.surgeplay.com/bust/350/${playerData.uuid}?no=ears`)
            .setTimestamp();
        
        // タイトルをプレイヤー名とステータスに変更
        let title = `${playerData.username}\n${onlineStatus} **${displayRank.toUpperCase()}**`;
        if (serverInfo) {
            title += ` • 現在 **${serverInfo}** でプレイ中`;
        }
        embed.setTitle(title);
        
        // メインクラス情報
        const classEmoji = getClassEmoji(activeClass.type);
        const levelProgress = formatLevelProgress(activeClass.level || 0, activeClass.xpPercent || 0);
        
        embed.addFields({
            name: `${classEmoji} **${activeClass.type.toUpperCase()}**`,
            value: levelProgress,
            inline: false
        });
        
        // 統計情報（3列）
        const totalPlaytime = playerData.playtime || 0;
        
        embed.addFields(
            {
                name: '⏱️ **Playtime**',
                value: formatPlaytimeClean(totalPlaytime),
                inline: true
            },
            {
                name: '⚔️ **Wars**',
                value: `\`${totalWars.toString().padStart(10)}\``,
                inline: true
            },
            {
                name: '📊 **Total XP**',
                value: `\`${formatLargeNumber(totalXP).padStart(10)}\``,
                inline: true
            }
        );
        
        // ギルド情報
        if (playerData.guild && playerData.guild.name) {
            const guildRank = playerData.guild.rank || 'RECRUIT';
            const guildPrefix = playerData.guild.prefix || '';
            const rankStars = playerData.guild.rankStars || '';
            
            embed.addFields({
                name: '🏰 **Guild**',
                value: `\`\`\`${playerData.guild.name}${guildPrefix ? ` [${guildPrefix}]` : ''}\`\`\`Rank: **${guildRank}** ${rankStars}`,
                inline: false
            });
        }
        
        // プレイヤー履歴
        const firstJoin = playerData.firstJoin ? 
            new Date(playerData.firstJoin).toLocaleDateString('en-CA') : 'Unknown';
        const lastSeen = formatDuration(playerData.lastJoin);
        
        embed.addFields(
            {
                name: '📅 **First Join**',
                value: `\`${firstJoin}\``,
                inline: true
            },
            {
                name: '👤 **Last Seen**',
                value: `\`${lastSeen}\``,
                inline: true
            }
        );
        
        // レイド統計
        if (globalData.raids && globalData.raids.list) {
            const raids = globalData.raids.list;
            const raidCounts = {
                notg: raids['Nest of the Grootslangs'] || 0,
                tna: raids['The Nameless Anomaly'] || 0,
                nol: raids['Orphion\'s Nexus of Light'] || 0,
                tcc: raids['The Canyon Colossus'] || 0
            };
            
            const totalRaids = Object.values(raidCounts).reduce((sum, count) => sum + count, 0);
            
            if (totalRaids > 0) {
                const raidLines = [];
                
                if (raidCounts.notg > 0) raidLines.push(`${raidIcons.notg} **NOTG** \`${raidCounts.notg.toString().padStart(3)}\``);
                if (raidCounts.tna > 0) raidLines.push(`${raidIcons.tna} **TNA**  \`${raidCounts.tna.toString().padStart(3)}\``);
                if (raidCounts.nol > 0) raidLines.push(`${raidIcons.nol} **NOL**  \`${raidCounts.nol.toString().padStart(3)}\``);
                if (raidCounts.tcc > 0) raidLines.push(`${raidIcons.tcc} **TCC**  \`${raidCounts.tcc.toString().padStart(3)}\``);
                
                embed.addFields({
                    name: '🗡️ **Raid Completions**',
                    value: raidLines.join('  '),
                    inline: false
                });
            }
        }
        
        // フッター
        embed.setFooter({
            text: 'Wynncraft Stats',
            iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png'
        });
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ERROR] プレイヤー統計取得エラー:', error);
        
        let errorMessage = '❌ エラーが発生しました: ';
        if (error.response && error.response.status === 404) {
            errorMessage += `プレイヤー "${mcid}" が見つかりません。`;
        } else {
            errorMessage += '不明なエラーが発生しました。';
        }
        
        await interaction.editReply({ content: errorMessage });
    }
}