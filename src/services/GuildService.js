const BaseService = require('./BaseService');
const WynncraftAPIClient = require('../api/WynncraftAPIClient');
const Guild = require('../models/Guild');
const { ErrorTypes } = require('../utils/ErrorHandler');
const RateLimiter = require('../utils/RateLimiter');
const fs = require('fs').promises;
const path = require('path');

class GuildService extends BaseService {
    constructor(options = {}) {
        super(options);
        this.wynncraftApi = null;
        this.trackingGuilds = new Map();
        this.weeklyResetDay = 1; // Monday
        this.rateLimiter = new RateLimiter();
        
        // Data storage path
        this.dataPath = path.join(process.cwd(), 'data', 'guild_rankings.json');
        
        // Guild configuration
        this.guildName = this.configManager.get('guild.name') || 'Just Here After Work';
        this.guildTag = this.configManager.get('guild.tag') || 'SKJ';
        
        this.ensureDataDirectory();
    }

    async onInitialize() {
        this.wynncraftApi = new WynncraftAPIClient();
        await this.loadGuildTrackingData();
        this.info('GuildService initialized');
    }

    async ensureDataDirectory() {
        try {
            const dataDir = path.dirname(this.dataPath);
            await fs.mkdir(dataDir, { recursive: true });
        } catch (error) {
            this.warn('Failed to create data directory:', error);
        }
    }

    async loadGuildTrackingData() {
        try {
            const trackingData = await this.cache.get('guild_tracking', { useFile: true });
            if (trackingData) {
                this.trackingGuilds = new Map(Object.entries(trackingData));
            }
        } catch (error) {
            this.warn('Failed to load guild tracking data', { error: error.message });
        }
    }

    async saveGuildTrackingData() {
        try {
            const trackingData = Object.fromEntries(this.trackingGuilds);
            await this.cache.set('guild_tracking', trackingData, { useFile: true });
        } catch (error) {
            this.error('Failed to save guild tracking data', { error: error.message });
        }
    }

    async loadGuildRankingData() {
        try {
            const data = await fs.readFile(this.dataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {
                lastRankSet: null,
                members: {},
                weeklyRankings: []
            };
        }
    }

    async saveGuildRankingData(data) {
        try {
            await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            this.error('Failed to save guild ranking data', { error: error.message });
            throw error;
        }
    }

    async fetchGuildDataWithMembers(fetchFullMemberData = false) {
        try {
            // Get guild by name (prefix search not reliable in API v3)
            const response = await this.wynncraftApi.getGuild(this.guildName);
            
            if (!response || !response.members) {
                throw new Error('Invalid guild data response');
            }

            const guildData = response;
            
            this.debug('Guild API Response Structure:', {
                hasMembers: !!guildData.members,
                membersType: typeof guildData.members,
                membersIsArray: Array.isArray(guildData.members),
                memberCount: guildData.members ? Object.keys(guildData.members).length : 0
            });

            if (fetchFullMemberData && guildData.members) {
                this.info('各メンバーの詳細データを取得中...');
                const updatedMembers = {};
                
                for (const [rank, rankMembers] of Object.entries(guildData.members)) {
                    if (rank === 'total') continue; // Skip the total count
                    
                    if (typeof rankMembers === 'object' && rankMembers !== null) {
                        for (const [playerName, playerData] of Object.entries(rankMembers)) {
                            try {
                                updatedMembers[playerData.uuid] = {
                                    uuid: playerData.uuid,
                                    username: playerName,
                                    contributed: playerData.contributed || 0,
                                    contributionRank: playerData.contributionRank || 0,
                                    wars: 0,
                                    raids: { total: 0, list: {} },
                                    joined: playerData.joined || null,
                                    rank: rank,
                                    online: playerData.online || false,
                                    server: playerData.server || null
                                };
                            } catch (error) {
                                this.warn(`プレイヤー ${playerName} のデータ処理エラー:`, error.message);
                            }
                        }
                    }
                }
                
                guildData.members = updatedMembers;
                const memberCount = Object.keys(updatedMembers).length;
                this.info(`メンバーデータの取得完了, 処理したメンバー数: ${memberCount}`);
            }
            
            return guildData;
        } catch (error) {
            this.error('Guild data fetch error:', error.message);
            throw error;
        }
    }

    async setGuildRankings(userId) {
        // レート制限チェック
        const rateLimitResult = await this.rateLimiter.checkRateLimit(userId, 'guild_setrank');
        if (!rateLimitResult.allowed) {
            throw new Error(`レート制限: ${rateLimitResult.waitTime}秒待機してください`);
        }

        try {
            const guildData = await this.fetchGuildDataWithMembers(true);
            const currentData = await this.loadGuildRankingData();
            
            const newMemberData = {};
            const timestamp = new Date().toISOString();
            
            for (const [uuid, member] of Object.entries(guildData.members)) {
                const memberUsername = member?.username || `Unknown_${uuid.substring(0, 8)}`;
                
                newMemberData[memberUsername] = {
                    uuid: member?.uuid || uuid,
                    username: memberUsername,
                    contributed: member?.contributed || 0,
                    contributionRank: member?.contributionRank || 0,
                    wars: member?.wars || 0,
                    raids: member?.raids || { total: 0, list: {} },
                    joined: member?.joined || null
                };
            }
            
            currentData.lastRankSet = timestamp;
            currentData.members = newMemberData;
            await this.saveGuildRankingData(currentData);
            
            return {
                timestamp,
                memberCount: Object.keys(newMemberData).length,
                topContributors: this.getTopContributors(newMemberData, 10)
            };
        } catch (error) {
            this.error('Set guild rankings error:', error);
            throw error;
        }
    }

    async getGXPRanking() {
        try {
            const currentData = await this.loadGuildRankingData();
            
            if (!currentData.lastRankSet) {
                throw new Error('ランキングデータが見つかりません');
            }

            const guildData = await this.fetchGuildDataWithMembers(true);
            const rankings = [];
            
            for (const [uuid, currentMember] of Object.entries(guildData.members)) {
                const savedMember = Object.values(currentData.members).find(m => m.uuid === uuid);
                
                let gxpGained = 0;
                const username = currentMember.username || 'Unknown';
                const currentContributed = currentMember.contributed || 0;
                
                if (savedMember) {
                    const savedContributed = savedMember.contributed || 0;
                    gxpGained = currentContributed - savedContributed;
                } else {
                    gxpGained = currentContributed;
                }
                
                if (gxpGained >= 0) {
                    rankings.push({
                        username,
                        gxpGained,
                        currentTotal: currentContributed
                    });
                }
            }
            
            rankings.sort((a, b) => b.gxpGained - a.gxpGained);
            
            return {
                rankings,
                period: this.calculatePeriod(currentData.lastRankSet),
                totalGXP: rankings.reduce((sum, member) => sum + member.gxpGained, 0),
                activeMembers: rankings.filter(m => m.gxpGained > 0).length
            };
        } catch (error) {
            this.error('GXP ranking error:', error);
            throw error;
        }
    }

    async getRaidRanking() {
        try {
            const currentData = await this.loadGuildRankingData();
            
            if (!currentData.lastRankSet) {
                throw new Error('ランキングデータが見つかりません');
            }

            const guildData = await this.fetchGuildDataWithMembers(true);
            const rankings = [];
            
            for (const [uuid, currentMember] of Object.entries(guildData.members)) {
                const savedMember = Object.values(currentData.members).find(m => m.uuid === uuid);
                
                let raidsCompleted = 0;
                const username = currentMember.username || 'Unknown';
                const currentTotal = currentMember.raids?.total || 0;
                
                if (savedMember) {
                    const savedRaids = savedMember.raids?.total || 0;
                    raidsCompleted = currentTotal - savedRaids;
                } else {
                    raidsCompleted = currentTotal;
                }
                
                if (raidsCompleted >= 0) {
                    rankings.push({
                        username,
                        raidsCompleted,
                        currentTotal
                    });
                }
            }
            
            rankings.sort((a, b) => b.raidsCompleted - a.raidsCompleted);
            
            return {
                rankings,
                period: this.calculatePeriod(currentData.lastRankSet),
                totalRaids: rankings.reduce((sum, member) => sum + member.raidsCompleted, 0),
                activeMembers: rankings.filter(m => m.raidsCompleted > 0).length
            };
        } catch (error) {
            this.error('Raid ranking error:', error);
            throw error;
        }
    }

    isAdmin(userId) {
        const adminUsers = this.configManager.get('discord.adminUsers', []);
        return adminUsers.includes(userId);
    }

    getTopContributors(memberData, limit = 10) {
        return Object.values(memberData)
            .sort((a, b) => b.contributed - a.contributed)
            .slice(0, limit)
            .map((member, index) => ({
                rank: index + 1,
                username: member.username,
                contributed: member.contributed
            }));
    }

    calculatePeriod(lastRankSet) {
        const startDate = new Date(lastRankSet);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        const now = new Date();
        
        const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, Math.floor((endDate - now) / (1000 * 60 * 60 * 24)));
        
        return {
            startDate,
            endDate,
            daysElapsed,
            daysRemaining
        };
    }

    formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(2) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toString();
    }

    formatDate(date) {
        const options = { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Tokyo',
            hour12: false
        };
        return new Date(date).toLocaleString('ja-JP', options);
    }

    async getGuild(guildName, options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `guild:${guildName.toLowerCase()}`;
            
            return this.withCache(cacheKey, async () => {
                const guildData = await this.wynncraftApi.getGuild(guildName, options);
                const guild = Guild.fromWynncraftAPI(guildData);
                
                this.info('Guild data fetched', {
                    name: guild.name,
                    members: guild.memberCount,
                    level: guild.level
                });
                
                return guild;
            }, {
                ttl: 300000, // 5 minutes cache
                ...options
            });
        }, {
            method: 'getGuild',
            guildName
        });
    }

    async getGuildByPrefix(prefix, options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `guild_prefix:${prefix.toLowerCase()}`;
            
            return this.withCache(cacheKey, async () => {
                const guildData = await this.wynncraftApi.getGuildByPrefix(prefix, options);
                const guild = Guild.fromWynncraftAPI(guildData);
                
                this.info('Guild data fetched by prefix', {
                    prefix: guild.prefix,
                    name: guild.name,
                    members: guild.memberCount
                });
                
                return guild;
            }, {
                ttl: 300000, // 5 minutes cache
                ...options
            });
        }, {
            method: 'getGuildByPrefix',
            prefix
        });
    }

    async getGuildStats(guildName, options = {}) {
        return this.withErrorHandling(async () => {
            const guild = await this.getGuild(guildName, options);
            
            const stats = {
                basic: {
                    name: guild.name,
                    prefix: guild.prefix,
                    level: guild.level,
                    xp: guild.xp,
                    created: guild.created,
                    guildAge: guild.getGuildAge(),
                    memberCount: guild.memberCount,
                    territoryCount: guild.territoryCount,
                    territoriesPerMember: guild.getTerritoriesPerMember()
                },
                members: {
                    total: guild.memberCount,
                    online: guild.getOnlineMembers().length,
                    offline: guild.getOfflineMembers().length,
                    rankDistribution: guild.getRankDistribution(),
                    inactive: guild.getInactiveMembers().length,
                    newMembers: guild.getNewMembers().length
                },
                contribution: {
                    total: guild.getTotalContributed(),
                    weekly: guild.getTotalWeeklyContributed(),
                    average: guild.getAverageContribution(),
                    weeklyAverage: guild.getAverageWeeklyContribution(),
                    topContributor: guild.getTopContributor(),
                    topWeeklyContributor: guild.getTopWeeklyContributor(),
                    stats: guild.getContributionStats(),
                    weeklyStats: guild.getWeeklyContributionStats()
                },
                territories: {
                    total: guild.territoryCount,
                    list: guild.getTerritoryList(),
                    perMember: guild.getTerritoriesPerMember()
                }
            };
            
            this.info('Guild stats compiled', {
                name: guild.name,
                members: stats.members.total,
                territories: stats.territories.total
            });
            
            return stats;
        }, {
            method: 'getGuildStats',
            guildName
        });
    }

    async getGuildRankings(guildName, type = 'total', options = {}) {
        return this.withErrorHandling(async () => {
            const guild = await this.getGuild(guildName, options);
            
            let rankings;
            switch (type.toLowerCase()) {
                case 'weekly':
                    rankings = guild.getWeeklyRankings();
                    break;
                case 'total':
                default:
                    rankings = guild.getMemberRankings();
                    break;
            }
            
            // Add additional info for each member
            const enhancedRankings = rankings.map(member => ({
                ...member,
                contributionPercentage: guild.getTotalContributed() > 0 ? 
                    Math.round((member.contributed / guild.getTotalContributed()) * 100) : 0,
                weeklyContributionPercentage: guild.getTotalWeeklyContributed() > 0 ? 
                    Math.round((member.contributedDelta / guild.getTotalWeeklyContributed()) * 100) : 0
            }));
            
            this.info('Guild rankings fetched', {
                name: guild.name,
                type,
                count: enhancedRankings.length
            });
            
            return {
                guild: {
                    name: guild.name,
                    prefix: guild.prefix
                },
                type,
                rankings: enhancedRankings,
                totalMembers: guild.memberCount,
                generatedAt: new Date()
            };
        }, {
            method: 'getGuildRankings',
            guildName,
            type
        });
    }

    async getGuildMember(guildName, memberName, options = {}) {
        return this.withErrorHandling(async () => {
            const guild = await this.getGuild(guildName, options);
            
            const member = guild.getMemberByUsername(memberName);
            
            if (!member) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Member '${memberName}' not found in guild '${guildName}'.`
                );
            }
            
            const rankings = guild.getMemberRankings();
            const weeklyRankings = guild.getWeeklyRankings();
            
            const memberRank = rankings.find(r => r.uuid === member.uuid);
            const memberWeeklyRank = weeklyRankings.find(r => r.uuid === member.uuid);
            
            const memberInfo = {
                ...member,
                rank: memberRank ? memberRank.rank : null,
                weeklyRank: memberWeeklyRank ? memberWeeklyRank.rank : null,
                contributionPercentage: guild.getTotalContributed() > 0 ? 
                    Math.round((member.contributed / guild.getTotalContributed()) * 100) : 0,
                weeklyContributionPercentage: guild.getTotalWeeklyContributed() > 0 ? 
                    Math.round((member.contributedDelta / guild.getTotalWeeklyContributed()) * 100) : 0,
                memberSince: member.joined ? 
                    Math.floor((new Date() - member.joined) / (1000 * 60 * 60 * 24)) : null
            };
            
            this.info('Guild member info fetched', {
                guild: guildName,
                member: memberName,
                rank: memberInfo.rank
            });
            
            return memberInfo;
        }, {
            method: 'getGuildMember',
            guildName,
            memberName
        });
    }

    async startGuildTracking(guildName, options = {}) {
        return this.withErrorHandling(async () => {
            const guild = await this.getGuild(guildName, options);
            
            const trackingData = {
                name: guild.name,
                prefix: guild.prefix,
                startedAt: new Date(),
                lastUpdate: new Date(),
                memberHistory: {},
                weeklyResets: []
            };
            
            // Initialize member history
            guild.members.forEach(member => {
                trackingData.memberHistory[member.uuid] = {
                    username: member.username,
                    contributions: [{
                        date: new Date(),
                        total: member.contributed,
                        delta: member.contributedDelta
                    }]
                };
            });
            
            this.trackingGuilds.set(guild.name.toLowerCase(), trackingData);
            await this.saveGuildTrackingData();
            
            this.info('Guild tracking started', {
                name: guild.name,
                members: guild.memberCount
            });
            
            return trackingData;
        }, {
            method: 'startGuildTracking',
            guildName
        });
    }

    async updateGuildTracking(guildName, options = {}) {
        return this.withErrorHandling(async () => {
            const trackingData = this.trackingGuilds.get(guildName.toLowerCase());
            
            if (!trackingData) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Guild '${guildName}' is not being tracked.`
                );
            }
            
            const guild = await this.getGuild(guildName, options);
            
            // Update member history
            guild.members.forEach(member => {
                if (!trackingData.memberHistory[member.uuid]) {
                    trackingData.memberHistory[member.uuid] = {
                        username: member.username,
                        contributions: []
                    };
                }
                
                trackingData.memberHistory[member.uuid].contributions.push({
                    date: new Date(),
                    total: member.contributed,
                    delta: member.contributedDelta
                });
                
                // Keep only last 30 days of history
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                trackingData.memberHistory[member.uuid].contributions = 
                    trackingData.memberHistory[member.uuid].contributions.filter(
                        contrib => contrib.date > thirtyDaysAgo
                    );
            });
            
            trackingData.lastUpdate = new Date();
            await this.saveGuildTrackingData();
            
            this.info('Guild tracking updated', {
                name: guild.name,
                members: guild.memberCount
            });
            
            return trackingData;
        }, {
            method: 'updateGuildTracking',
            guildName
        });
    }

    async performWeeklyReset(guildName, options = {}) {
        return this.withErrorHandling(async () => {
            const trackingData = this.trackingGuilds.get(guildName.toLowerCase());
            
            if (!trackingData) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Guild '${guildName}' is not being tracked.`
                );
            }
            
            const guild = await this.getGuild(guildName, options);
            const weeklyRankings = guild.getWeeklyRankings();
            
            const resetData = {
                date: new Date(),
                rankings: weeklyRankings,
                totalWeeklyContribution: guild.getTotalWeeklyContributed(),
                memberCount: guild.memberCount
            };
            
            trackingData.weeklyResets.push(resetData);
            
            // Keep only last 12 weeks of resets
            if (trackingData.weeklyResets.length > 12) {
                trackingData.weeklyResets = trackingData.weeklyResets.slice(-12);
            }
            
            await this.saveGuildTrackingData();
            
            this.info('Weekly reset performed', {
                name: guild.name,
                totalWeeklyContribution: resetData.totalWeeklyContribution,
                topContributor: weeklyRankings[0]?.username
            });
            
            return resetData;
        }, {
            method: 'performWeeklyReset',
            guildName
        });
    }

    async getGuildHistory(guildName, days = 30, options = {}) {
        return this.withErrorHandling(async () => {
            const trackingData = this.trackingGuilds.get(guildName.toLowerCase());
            
            if (!trackingData) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Guild '${guildName}' is not being tracked.`
                );
            }
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const history = {
                guild: {
                    name: trackingData.name,
                    prefix: trackingData.prefix
                },
                period: {
                    days,
                    from: cutoffDate,
                    to: new Date()
                },
                memberHistory: {},
                weeklyResets: trackingData.weeklyResets.filter(
                    reset => reset.date > cutoffDate
                )
            };
            
            // Filter member history by date range
            Object.entries(trackingData.memberHistory).forEach(([uuid, memberData]) => {
                const filteredContributions = memberData.contributions.filter(
                    contrib => contrib.date > cutoffDate
                );
                
                if (filteredContributions.length > 0) {
                    history.memberHistory[uuid] = {
                        username: memberData.username,
                        contributions: filteredContributions
                    };
                }
            });
            
            this.info('Guild history fetched', {
                name: trackingData.name,
                days,
                membersWithHistory: Object.keys(history.memberHistory).length
            });
            
            return history;
        }, {
            method: 'getGuildHistory',
            guildName,
            days
        });
    }

    async compareGuilds(guildName1, guildName2, options = {}) {
        return this.withErrorHandling(async () => {
            const [guild1, guild2] = await Promise.all([
                this.getGuild(guildName1, options),
                this.getGuild(guildName2, options)
            ]);
            
            const comparison = {
                guilds: {
                    guild1: {
                        name: guild1.name,
                        prefix: guild1.prefix,
                        level: guild1.level,
                        created: guild1.created
                    },
                    guild2: {
                        name: guild2.name,
                        prefix: guild2.prefix,
                        level: guild2.level,
                        created: guild2.created
                    }
                },
                comparison: {
                    level: {
                        guild1: guild1.level,
                        guild2: guild2.level,
                        difference: guild1.level - guild2.level
                    },
                    members: {
                        guild1: guild1.memberCount,
                        guild2: guild2.memberCount,
                        difference: guild1.memberCount - guild2.memberCount
                    },
                    territories: {
                        guild1: guild1.territoryCount,
                        guild2: guild2.territoryCount,
                        difference: guild1.territoryCount - guild2.territoryCount
                    },
                    totalContribution: {
                        guild1: guild1.getTotalContributed(),
                        guild2: guild2.getTotalContributed(),
                        difference: guild1.getTotalContributed() - guild2.getTotalContributed()
                    },
                    weeklyContribution: {
                        guild1: guild1.getTotalWeeklyContributed(),
                        guild2: guild2.getTotalWeeklyContributed(),
                        difference: guild1.getTotalWeeklyContributed() - guild2.getTotalWeeklyContributed()
                    },
                    averageContribution: {
                        guild1: guild1.getAverageContribution(),
                        guild2: guild2.getAverageContribution(),
                        difference: guild1.getAverageContribution() - guild2.getAverageContribution()
                    }
                }
            };
            
            this.info('Guild comparison completed', {
                guild1: guildName1,
                guild2: guildName2
            });
            
            return comparison;
        }, {
            method: 'compareGuilds',
            guilds: [guildName1, guildName2]
        });
    }

    async checkServiceHealth() {
        try {
            const health = await this.wynncraftApi.healthCheck();
            return {
                wynncraftApi: health,
                trackedGuilds: this.trackingGuilds.size
            };
        } catch (error) {
            return {
                wynncraftApi: {
                    healthy: false,
                    error: error.message
                },
                trackedGuilds: this.trackingGuilds.size
            };
        }
    }

    static create(options = {}) {
        return new GuildService(options);
    }
}

module.exports = GuildService;