const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayerStats } = require('../utils/wynncraft-api');
const rateLimiter = require('../utils/rateLimiter');

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

// レベルから必要XPを計算する関数（Wynncraft公式データ）
function calculateTotalXPFromLevel(level) {
    // Wynncraft公式のXP要求テーブル（各レベルアップに必要なXP）
    const xpRequirements = [
        0,      // Lv0→1 (存在しない)
        110,    // Lv1→2
        190,    // Lv2→3
        275,    // Lv3→4
        385,    // Lv4→5
        505,    // Lv5→6
        645,    // Lv6→7
        790,    // Lv7→8
        940,    // Lv8→9
        1100,   // Lv9→10
        1370,   // Lv10→11
        1570,   // Lv11→12
        1800,   // Lv12→13
        2090,   // Lv13→14
        2400,   // Lv14→15
        2720,   // Lv15→16
        3100,   // Lv16→17
        3600,   // Lv17→18
        4150,   // Lv18→19
        4800,   // Lv19→20
        5550,   // Lv20→21
        6400,   // Lv21→22
        7450,   // Lv22→23
        8650,   // Lv23→24
        10050,  // Lv24→25
        11650,  // Lv25→26
        13500,  // Lv26→27
        15650,  // Lv27→28
        18150,  // Lv28→29
        21000,  // Lv29→30
        24350,  // Lv30→31
        28200,  // Lv31→32
        32700,  // Lv32→33
        37850,  // Lv33→34
        43850,  // Lv34→35
        50750,  // Lv35→36
        58700,  // Lv36→37
        68000,  // Lv37→38
        78650,  // Lv38→39
        91000,  // Lv39→40
        105000, // Lv40→41
        122000, // Lv41→42
        141000, // Lv42→43
        163000, // Lv43→44
        189000, // Lv44→45
        218500, // Lv45→46
        253000, // Lv46→47
        292500, // Lv47→48
        338500, // Lv48→49
        392000, // Lv49→50
        453500, // Lv50→51
        524000, // Lv51→52
        606000, // Lv52→53
        700000, // Lv53→54
        808500, // Lv54→55
        935000, // Lv55→56
        1080000, // Lv56→57
        1250000, // Lv57→58
        1440000, // Lv58→59
        1670000, // Lv59→60
        1930000, // Lv60→61
        2230000, // Lv61→62
        2580000, // Lv62→63
        2980000, // Lv63→64
        3440000, // Lv64→65
        3980000, // Lv65→66
        4600000, // Lv66→67
        5320000, // Lv67→68
        6150000, // Lv68→69
        7100000, // Lv69→70
        8200000, // Lv70→71
        9500000, // Lv71→72
        11000000, // Lv72→73
        12700000, // Lv73→74
        14700000, // Lv74→75
        17000000, // Lv75→76
        19600000, // Lv76→77
        22700000, // Lv77→78
        26200000, // Lv78→79
        30200000, // Lv79→80
        34900000, // Lv80→81
        40300000, // Lv81→82
        46600000, // Lv82→83
        53800000, // Lv83→84
        62200000, // Lv84→85
        71900000, // Lv85→86
        83000000, // Lv86→87
        95900000, // Lv87→88
        110800000, // Lv88→89
        128000000, // Lv89→90
        148000000, // Lv90→91
        171000000, // Lv91→92
        197500000, // Lv92→93
        228000000, // Lv93→94
        263500000, // Lv94→95
        304500000, // Lv95→96
        351500000, // Lv96→97
        406500000, // Lv97→98
        469500000, // Lv98→99
        542500000, // Lv99→100
        627000000, // Lv100→101
        724500000, // Lv101→102
        837500000, // Lv102→103
        968000000, // Lv103→104
        1118500000, // Lv104→105
        249232940, // Lv105→106 (Lv1→105の総XPと同じ)
    ];
    
    // 指定レベルまでの総XPを計算
    let totalXP = 0;
    for (let i = 1; i < level && i < xpRequirements.length; i++) {
        totalXP += xpRequirements[i];
    }
    
    return totalXP;
}

async function handleStats(interaction) {
    const mcid = interaction.options.getString('mcid');
    
    // レート制限チェック
    const rateLimitCheck = rateLimiter.canUseCommand(interaction.user.id, 'wynn_stats');
    if (!rateLimitCheck.allowed) {
        await interaction.reply({
            content: `⏳ このコマンドは10秒に3回まで使用できます。\nあと **${rateLimitCheck.waitTime}秒** お待ちください。`,
            ephemeral: true
        });
        return;
    }
    
    await interaction.deferReply();
    
    try {
        // キャッシュチェック
        const cacheKey = mcid.toLowerCase();
        const cachedData = rateLimiter.getCache('wynn_stats', cacheKey);
        
        let playerData;
        if (cachedData) {
            console.log(`[INFO] Using cached player data for ${mcid}`);
            playerData = cachedData;
        } else {
            playerData = await getPlayerStats(mcid);
            if (playerData) {
                rateLimiter.setCache('wynn_stats', cacheKey, playerData);
            }
        }
        
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
        
        // ランク色の設定（Wynncraftの公式カラー）
        const rankColors = {
            'VIP': 0x55FF55,      // 緑
            'VIP+': 0x55FF55,     // 緑（旧表記）
            'VIPPLUS': 0x55FF55,  // 緑（新表記）
            'HERO': 0xAA00AA,     // 紫
            'Hero': 0xAA00AA,     // 紫
            'hero': 0xAA00AA,     // 紫
            'CHAMPION': 0xFFAA00, // 黄色
            'Champion': 0xFFAA00, // 黄色
            'champion': 0xFFAA00, // 黄色
            'Player': 0x7289DA    // デフォルト
        };
        
        const embedColor = rankColors[displayRank] || rankColors['Player'];
        
        // Embed作成（authorを削除）
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setThumbnail(`https://visage.surgeplay.com/bust/350/${playerData.uuid}?no=ears`)
            .setTimestamp();
        
        // タイトルをプレイヤー名とステータスに変更
        // VIPPLUSをVIP+として表示
        const displayRankFormatted = displayRank === 'VIPPLUS' ? 'VIP+' : displayRank.toUpperCase();
        let title = `${playerData.username}\n${onlineStatus} **${displayRankFormatted}**`;
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