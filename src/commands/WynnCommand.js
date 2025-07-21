const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('./BaseCommand');
const WynncraftAPIClient = require('../api/WynncraftAPIClient');
const RateLimiter = require('../utils/RateLimiter');

class WynnCommand extends BaseCommand {
    constructor() {
        super({
            name: 'wynn',
            description: 'Wynncraft関連のコマンド',
            category: 'Wynncraft',
            cooldown: 5000
        });
        this.wynncraftAPI = new WynncraftAPIClient();
        this.rateLimiter = new RateLimiter();
    }

    addOptions(command) {
        command.addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('プレイヤーの統計情報を表示')
                .addStringOption(option =>
                    option
                        .setName('mcid')
                        .setDescription('Minecraft ID')
                        .setRequired(true)
                )
        );
    }

    async run(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'stats') {
            await this.handleStats(interaction);
        }
    }

    async handleStats(interaction) {
        const mcid = interaction.options.getString('mcid');
        
        // Rate limit check
        const rateLimitResult = await this.rateLimiter.checkCommandLimit(
            interaction.user.id, 
            'wynn_stats',
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
            const playerData = await this.wynncraftAPI.getPlayer(mcid);
            
            console.log('[WynnCommand] Player data received:', {
                username: playerData?.username,
                hasCharacters: !!playerData?.characters,
                charactersCount: playerData?.characters?.length || 0,
                activeCharacter: playerData?.activeCharacter,
                charactersData: playerData?.characters
            });
            
            if (!playerData) {
                await interaction.editReply('❌ プレイヤーが見つかりませんでした');
                return;
            }

            const embed = await this.createStatsEmbed(playerData);
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error fetching player stats:', error);
            await interaction.editReply('❌ プレイヤー情報の取得中にエラーが発生しました');
        }
    }

    async createStatsEmbed(playerData) {
        // Get active character
        let activeClass = this.getActiveCharacter(playerData);
        
        // Basic information - using animated GIF emojis
        console.log('[WynnCommand] Online status debug:', {
            online: playerData.online,
            onlineType: typeof playerData.online,
            server: playerData.server,
            hasServer: !!playerData.server
        });
        
        const onlineStatus = playerData.online ? '<a:online:1396221830485774457>' : '<a:offline:1396221833031843882>';
        const serverInfo = playerData.online && playerData.server ? playerData.server : '';
        const displayRank = playerData.supportRank || playerData.rank || 'Player';
        
        // Global data
        const globalData = playerData.globalData || {};
        const totalWars = globalData.wars || 0;
        
        // Calculate total XP across all characters
        let totalXP = 0;
        const allCharacters = this.getAllCharacters(playerData);
        allCharacters.forEach(char => {
            const levelXP = this.calculateTotalXPFromLevel(char.level || 0);
            const currentXP = char.xp || 0;
            totalXP += levelXP + currentXP;
        });
        
        // Set rank color
        const embedColor = this.getRankColor(displayRank);
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setThumbnail(`https://visage.surgeplay.com/bust/350/${playerData.uuid}?no=ears`)
            .setTimestamp();

        // Title with status and player name
        let title = `${onlineStatus} ${playerData.username}`;
        if (serverInfo) {
            title += ` • 現在 **${serverInfo}** でプレイ中`;
        }
        
        embed.setTitle(title);
        
        // Add rank emoji to description based on rank
        let rankEmoji = '';
        const rankLower = displayRank.toLowerCase();
        
        if (rankLower === 'champion') {
            rankEmoji = '<:c1:1396345595949744178><:c2:1396345594439532625><:c3:1396345591738535936><:c4:1396345589012234263><:c5:1396345586931994694><:c6:1396345584960671844><:c7:1396345583555448836><:c8:1396345581848363038>';
        } else if (rankLower === 'hero') {
            rankEmoji = '<:h1:1396347917589286972><:h2:1396347914988683305><:h3:1396347912690073610><:h4:1396347910362234900>';
        } else if (rankLower === 'vipplus') {
            rankEmoji = '<:vp1:1396347902288461824><:vp2:1396347900551761952><:vp3:1396347897380868106><:vp4:1396347895384637582>';
        } else if (rankLower === 'vip') {
            rankEmoji = '<:v1:1396347893476233287><:v2:1396347891429281802><:v3:1396347888828944405>';
        }
        
        if (rankEmoji) {
            embed.setDescription(rankEmoji);
        }
        
        // Main class information
        let displayType = activeClass.type || 'No Character';
        if (activeClass.reskin) {
            displayType = activeClass.reskin;
        }
        
        const classEmoji = this.getClassEmoji(displayType);
        const levelProgress = this.formatLevelProgress(activeClass.level || 0, activeClass.xpPercent || 0);
        
        embed.addFields({
            name: `${classEmoji} **${displayType.toUpperCase()}**`,
            value: levelProgress,
            inline: false
        });

        // Statistics (3 columns)
        const totalPlaytime = playerData.playtime || 0;
        
        embed.addFields(
            {
                name: '⏱️ **Playtime**',
                value: this.formatPlaytimeClean(totalPlaytime),
                inline: true
            },
            {
                name: '⚔️ **Wars**',
                value: `\`${totalWars.toString().padStart(10)}\``,
                inline: true
            },
            {
                name: '📊 **Total XP**',
                value: `\`${this.formatLargeNumber(totalXP).padStart(10)}\``,
                inline: true
            }
        );

        // Guild information
        if (playerData.guild && playerData.guild.name) {
            const guildRank = playerData.guild.rank || 'RECRUIT';
            const guildPrefix = playerData.guild.prefix || '';
            const rankStars = ''; // No rank stars in v3 API
            
            embed.addFields({
                name: '🏰 **Guild**',
                value: `\`\`\`${playerData.guild.name}${guildPrefix ? ` [${guildPrefix}]` : ''}\`\`\`Rank: **${guildRank}** ${rankStars}`,
                inline: false
            });
        }

        // Player history
        const firstJoin = playerData.firstJoin ? 
            new Date(playerData.firstJoin).toLocaleDateString('en-CA') : 'Unknown';
        const lastSeen = this.formatDuration(playerData.lastJoin);
        
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

        // Raid statistics
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
                const raidIcons = {
                    notg: '🦎',
                    tna: '👁️',
                    nol: '✨',
                    tcc: '⛰️'
                };
                
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

        // Footer
        embed.setFooter({
            text: 'Wynncraft Stats',
            iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png'
        });

        return embed;
    }

    getActiveCharacter(playerData) {
        let activeClass = null;
        let allCharacters = [];
        
        console.log('[WynnCommand] getActiveCharacter called with:', {
            hasCharacters: !!playerData.characters,
            charactersIsArray: Array.isArray(playerData.characters),
            charactersIsObject: typeof playerData.characters === 'object',
            charactersKeys: playerData.characters ? Object.keys(playerData.characters) : [],
            activeCharacterUUID: playerData.activeCharacter
        });
        
        // Get characters from the data - handle both array and object formats
        if (playerData.characters) {
            if (Array.isArray(playerData.characters)) {
                allCharacters = playerData.characters;
            } else if (typeof playerData.characters === 'object') {
                // Convert object to array format
                allCharacters = Object.entries(playerData.characters).map(([uuid, char]) => ({
                    uuid,
                    ...char
                }));
            }
            
            console.log('[WynnCommand] Characters found:', allCharacters.map(char => ({
                uuid: char.uuid,
                type: char.type,
                level: char.level,
                reskin: char.reskin
            })));
            
            // Use active character if available
            if (playerData.activeCharacter && allCharacters.length > 0) {
                activeClass = allCharacters.find(char => char.uuid === playerData.activeCharacter);
                console.log('[WynnCommand] Active character search result:', activeClass ? {
                    uuid: activeClass.uuid,
                    type: activeClass.type,
                    reskin: activeClass.reskin,
                    level: activeClass.level
                } : 'not found');
            }
            
            // Otherwise use highest level character
            if (!activeClass && allCharacters.length > 0) {
                activeClass = allCharacters.sort((a, b) => (b.level || 0) - (a.level || 0))[0];
                console.log('[WynnCommand] Using highest level character:', {
                    type: activeClass.type,
                    reskin: activeClass.reskin,
                    level: activeClass.level
                });
            }
        }
        
        // Default values
        if (!activeClass) {
            console.log('[WynnCommand] No active character found, using default');
            activeClass = {
                type: 'No Character',
                level: 0,
                xp: 0,
                xpPercent: 0,
                wars: 0,
                playtime: 0
            };
        }
        
        return activeClass;
    }

    getAllCharacters(playerData) {
        if (playerData.characters) {
            if (Array.isArray(playerData.characters)) {
                return playerData.characters;
            } else if (typeof playerData.characters === 'object') {
                // Convert object to array format
                return Object.entries(playerData.characters).map(([uuid, char]) => ({
                    uuid,
                    ...char
                }));
            }
        }
        return [];
    }

    createProgressBar(percentage, length = 10) {
        const filled = Math.round((percentage / 100) * length);
        const empty = length - filled;
        
        const filledChar = '■';
        const emptyChar = '□';
        
        return filledChar.repeat(filled) + emptyChar.repeat(empty);
    }

    formatLevelProgress(level, xpPercent) {
        const bar = this.createProgressBar(xpPercent || 0, 20);
        return `\`Lv ${level.toString().padStart(3)} \` ${bar} \`${Math.floor(xpPercent || 0)}%\``;
    }

    formatPlaytimeClean(hours) {
        if (!hours || hours < 0) return '\`  0h 00m\`';
        
        const wholeHours = Math.floor(hours);
        const mins = Math.floor((hours - wholeHours) * 60);
        
        return `\`${wholeHours.toString().padStart(3)}h ${mins.toString().padStart(2, '0')}m\``;
    }

    formatLargeNumber(num) {
        if (!num || num < 0) return '0';
        if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
        return num.toString();
    }

    formatDuration(lastJoin) {
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

    getClassEmoji(className) {
        const classEmojis = {
            // Archer series
            'archer': '<:archer:1393312613357588490>',
            'hunter': '<:archer:1393312613357588490>',
            
            // Warrior series  
            'warrior': '<:warrior:1393312590574387362>',
            'knight': '<:warrior:1393312590574387362>',
            
            // Mage series
            'mage': '<:mage:1393312624355311638>',
            'darkwizard': '<:mage:1393312624355311638>',
            
            // Assassin series
            'assassin': '<:assassin:1393312576992968784>',
            'ninja': '<:assassin:1393312576992968784>',
            
            // Shaman series
            'shaman': '<:shaman:1393312601517068499>',
            'skyseer': '<:shaman:1393312601517068499>'
        };
        
        return classEmojis[className?.toLowerCase()] || '❓';
    }

    getRankColor(displayRank) {
        const rankColors = {
            'VIP': 0x55FF55,
            'VIP+': 0x55FF55,
            'VIPPLUS': 0x55FF55,
            'HERO': 0xAA00AA,
            'Hero': 0xAA00AA,
            'hero': 0xAA00AA,
            'CHAMPION': 0xFFAA00,
            'Champion': 0xFFAA00,
            'champion': 0xFFAA00,
            'Player': 0x7289DA
        };
        
        return rankColors[displayRank] || rankColors['Player'];
    }

    calculateTotalXPFromLevel(level) {
        // Wynncraft official XP requirements table
        const xpRequirements = [
            0, 110, 190, 275, 385, 505, 645, 790, 940, 1100, 1370, 1570, 1800, 2090, 2400,
            2720, 3100, 3600, 4150, 4800, 5550, 6400, 7450, 8650, 10050, 11650, 13500, 15650,
            18150, 21000, 24350, 28200, 32700, 37850, 43850, 50750, 58700, 68000, 78650, 91000,
            105000, 122000, 141000, 163000, 189000, 218500, 253000, 292500, 338500, 392000,
            453500, 524000, 606000, 700000, 808500, 935000, 1080000, 1250000, 1440000, 1670000,
            1930000, 2230000, 2580000, 2980000, 3440000, 3980000, 4600000, 5320000, 6150000,
            7100000, 8200000, 9500000, 11000000, 12700000, 14700000, 17000000, 19600000, 22700000,
            26200000, 30200000, 34900000, 40300000, 46600000, 53800000, 62200000, 71900000,
            83000000, 95900000, 110800000, 128000000, 148000000, 171000000, 197500000, 228000000,
            263500000, 304500000, 351500000, 406500000, 469500000, 542500000, 627000000, 724500000,
            837500000, 968000000, 1118500000, 249232940
        ];
        
        let totalXP = 0;
        for (let i = 1; i < level && i < xpRequirements.length; i++) {
            totalXP += xpRequirements[i];
        }
        
        return totalXP;
    }

    static create() {
        return new WynnCommand();
    }
}

module.exports = WynnCommand;