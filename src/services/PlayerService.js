const BaseService = require('./BaseService');
const WynncraftAPIClient = require('../api/WynncraftAPIClient');
const Player = require('../models/Player');
const { ErrorTypes } = require('../utils/ErrorHandler');

class PlayerService extends BaseService {
    constructor(options = {}) {
        super(options);
        this.wynncraftApi = null;
    }

    async onInitialize() {
        this.wynncraftApi = new WynncraftAPIClient();
        this.info('PlayerService initialized');
    }

    async getPlayer(username, options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `player:${username.toLowerCase()}`;
            
            return this.withCache(cacheKey, async () => {
                const playerData = await this.wynncraftApi.getPlayer(username, {
                    fullResult: true,
                    ...options
                });
                
                const player = Player.fromWynncraftAPI(playerData);
                
                this.info('Player data fetched', {
                    username,
                    online: player.online,
                    characters: player.characters.length
                });
                
                return player;
            }, {
                ttl: 60000, // 1 minute cache
                ...options
            });
        }, {
            method: 'getPlayer',
            username
        });
    }

    async getPlayerUUID(username, options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `uuid:${username.toLowerCase()}`;
            
            return this.withCache(cacheKey, async () => {
                const uuid = await this.wynncraftApi.getPlayerUUID(username, options);
                
                this.info('Player UUID fetched', { username, uuid });
                
                return uuid;
            }, {
                ttl: 300000, // 5 minutes cache
                ...options
            });
        }, {
            method: 'getPlayerUUID',
            username
        });
    }

    async getPlayerStats(username, options = {}) {
        return this.withErrorHandling(async () => {
            const player = await this.getPlayer(username, options);
            
            const stats = {
                basic: {
                    username: player.username,
                    uuid: player.uuid,
                    rank: player.rank,
                    supportRank: player.supportRank,
                    online: player.online,
                    server: player.server,
                    firstJoin: player.firstJoin,
                    lastJoin: player.lastJoin,
                    accountAge: player.getAccountAge(),
                    timeSinceLastSeen: player.getTimeSinceLastSeen()
                },
                guild: player.hasGuild() ? {
                    name: player.getGuildName(),
                    prefix: player.getGuildPrefix(),
                    rank: player.getGuildRank(),
                    joined: player.getGuildJoinDate()
                } : null,
                characters: {
                    total: player.characters.length,
                    active: player.getActiveCharacter(),
                    byClass: this.groupCharactersByClass(player.characters)
                },
                totals: {
                    xp: player.getTotalXP(),
                    level: player.getTotalLevel(),
                    maxLevel: player.getMaxCharacterLevel(),
                    playtime: player.getTotalPlaytime(),
                    playtimeFormatted: player.formatPlaytime(),
                    wars: player.getTotalWars(),
                    mobsKilled: player.getTotalMobsKilled(),
                    chestsFound: player.getTotalChestsFound(),
                    pvpKills: player.getTotalPvpKills(),
                    pvpDeaths: player.getTotalPvpDeaths(),
                    pvpKDRatio: player.getPvpKDRatio()
                },
                completions: {
                    dungeons: player.getCompletedDungeons(),
                    raids: player.getCompletedRaids(),
                    quests: player.getCompletedQuests().length
                }
            };
            
            this.info('Player stats compiled', {
                username,
                charactersCount: stats.characters.total,
                totalLevel: stats.totals.level
            });
            
            return stats;
        }, {
            method: 'getPlayerStats',
            username
        });
    }

    async getPlayerCharacters(username, options = {}) {
        return this.withErrorHandling(async () => {
            const player = await this.getPlayer(username, options);
            
            const characters = player.characters.map(char => ({
                ...char,
                isActive: char.uuid === player.activeCharacter,
                formattedPlaytime: player.formatPlaytime(char.playtime)
            }));
            
            // Sort by total level (highest first)
            characters.sort((a, b) => (b.totalLevel || 0) - (a.totalLevel || 0));
            
            this.info('Player characters fetched', {
                username,
                count: characters.length,
                activeCharacter: player.activeCharacter
            });
            
            return characters;
        }, {
            method: 'getPlayerCharacters',
            username
        });
    }

    async getPlayerGuildInfo(username, options = {}) {
        return this.withErrorHandling(async () => {
            const player = await this.getPlayer(username, options);
            
            if (!player.hasGuild()) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Player '${username}' is not in a guild.`
                );
            }
            
            const guildInfo = {
                name: player.getGuildName(),
                prefix: player.getGuildPrefix(),
                rank: player.getGuildRank(),
                joined: player.getGuildJoinDate(),
                memberSince: player.getGuildJoinDate() ? 
                    Math.floor((new Date() - player.getGuildJoinDate()) / (1000 * 60 * 60 * 24)) : null
            };
            
            this.info('Player guild info fetched', {
                username,
                guild: guildInfo.name,
                rank: guildInfo.rank
            });
            
            return guildInfo;
        }, {
            method: 'getPlayerGuildInfo',
            username
        });
    }

    async comparePlayers(username1, username2, options = {}) {
        return this.withErrorHandling(async () => {
            const [player1, player2] = await Promise.all([
                this.getPlayer(username1, options),
                this.getPlayer(username2, options)
            ]);
            
            const comparison = {
                players: {
                    player1: {
                        username: player1.username,
                        rank: player1.rank,
                        online: player1.online
                    },
                    player2: {
                        username: player2.username,
                        rank: player2.rank,
                        online: player2.online
                    }
                },
                comparison: {
                    totalLevel: {
                        player1: player1.getTotalLevel(),
                        player2: player2.getTotalLevel(),
                        difference: player1.getTotalLevel() - player2.getTotalLevel()
                    },
                    totalXP: {
                        player1: player1.getTotalXP(),
                        player2: player2.getTotalXP(),
                        difference: player1.getTotalXP() - player2.getTotalXP()
                    },
                    playtime: {
                        player1: player1.getTotalPlaytime(),
                        player2: player2.getTotalPlaytime(),
                        difference: player1.getTotalPlaytime() - player2.getTotalPlaytime()
                    },
                    characters: {
                        player1: player1.characters.length,
                        player2: player2.characters.length,
                        difference: player1.characters.length - player2.characters.length
                    },
                    wars: {
                        player1: player1.getTotalWars(),
                        player2: player2.getTotalWars(),
                        difference: player1.getTotalWars() - player2.getTotalWars()
                    },
                    pvpKills: {
                        player1: player1.getTotalPvpKills(),
                        player2: player2.getTotalPvpKills(),
                        difference: player1.getTotalPvpKills() - player2.getTotalPvpKills()
                    }
                }
            };
            
            this.info('Player comparison completed', {
                player1: username1,
                player2: username2
            });
            
            return comparison;
        }, {
            method: 'compareUsers',
            players: [username1, username2]
        });
    }

    async getTopCharacterByClass(username, className, options = {}) {
        return this.withErrorHandling(async () => {
            const player = await this.getPlayer(username, options);
            
            const character = player.getHighestLevelCharacterByClass(className);
            
            if (!character) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Player '${username}' has no ${className} characters.`
                );
            }
            
            this.info('Top character by class fetched', {
                username,
                className,
                characterLevel: character.totalLevel
            });
            
            return {
                ...character,
                formattedPlaytime: player.formatPlaytime(character.playtime)
            };
        }, {
            method: 'getTopCharacterByClass',
            username,
            className
        });
    }

    groupCharactersByClass(characters) {
        const grouped = {};
        
        characters.forEach(char => {
            const className = char.type || 'Unknown';
            if (!grouped[className]) {
                grouped[className] = [];
            }
            grouped[className].push(char);
        });
        
        // Sort characters within each class by level
        Object.keys(grouped).forEach(className => {
            grouped[className].sort((a, b) => (b.totalLevel || 0) - (a.totalLevel || 0));
        });
        
        return grouped;
    }

    async searchPlayers(query, options = {}) {
        return this.withErrorHandling(async () => {
            // This would require a search API or database
            // For now, just try to get the player by exact username
            try {
                const player = await this.getPlayer(query, options);
                return [player];
            } catch (error) {
                if (error.type === ErrorTypes.DATA_ERROR) {
                    return [];
                }
                throw error;
            }
        }, {
            method: 'searchPlayers',
            query
        });
    }

    async checkServiceHealth() {
        try {
            const health = await this.wynncraftApi.healthCheck();
            return {
                wynncraftApi: health
            };
        } catch (error) {
            return {
                wynncraftApi: {
                    healthy: false,
                    error: error.message
                }
            };
        }
    }

    static create(options = {}) {
        return new PlayerService(options);
    }
}

module.exports = PlayerService;