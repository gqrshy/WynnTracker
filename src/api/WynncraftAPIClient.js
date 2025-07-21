const BaseAPIClient = require('./BaseAPIClient');
const { ErrorTypes } = require('../utils/ErrorHandler');

class WynncraftAPIClient extends BaseAPIClient {
    constructor(options = {}) {
        const baseURL = options.baseURL || 'https://api.wynncraft.com/v3';
        super(baseURL, {
            timeout: 15000,
            ...options
        });
    }

    async getPlayer(username, options = {}) {
        const endpoint = `/player/${encodeURIComponent(username)}`;
        const params = {
            fullResult: options.fullResult !== false,
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 60000, // 1 minute cache
                ...options
            });

            // Also fetch character data if fullResult is requested
            if (options.fullResult !== false) {
                try {
                    const charactersResponse = await this.getPlayerCharacters(username, { 
                        cache: false, // Use same cache as player data
                        cacheTtl: 60000 
                    });
                    response.data.characters = charactersResponse;
                } catch (charError) {
                    console.warn(`[WynncraftAPIClient] Could not fetch characters for ${username}:`, charError.message);
                    response.data.characters = {};
                }
            }

            return response.data;
        } catch (error) {
            if (error.type === ErrorTypes.DATA_ERROR) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Player '${username}' not found.`
                );
            }
            throw error;
        }
    }

    async getPlayerUUID(username, options = {}) {
        const endpoint = `/player/${encodeURIComponent(username)}`;
        const params = {
            fullResult: false,
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 300000, // 5 minutes cache
                ...options
            });

            return response.data.uuid;
        } catch (error) {
            if (error.type === ErrorTypes.DATA_ERROR) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Player '${username}' not found.`
                );
            }
            throw error;
        }
    }

    async getGuild(guildName, options = {}) {
        const endpoint = `/guild/${encodeURIComponent(guildName)}`;
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 300000, // 5 minutes cache
                ...options
            });

            return response.data;
        } catch (error) {
            if (error.type === ErrorTypes.DATA_ERROR) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Guild '${guildName}' not found.`
                );
            }
            throw error;
        }
    }

    async getGuildByPrefix(prefix, options = {}) {
        const endpoint = `/guild/${encodeURIComponent(prefix)}`;
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 300000, // 5 minutes cache
                ...options
            });

            return response.data;
        } catch (error) {
            if (error.type === ErrorTypes.DATA_ERROR) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Guild with prefix '${prefix}' not found.`
                );
            }
            throw error;
        }
    }

    async getGuildList(options = {}) {
        const endpoint = '/guild/list';
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 600000, // 10 minutes cache
                ...options
            });

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async getOnlinePlayers(options = {}) {
        const endpoint = '/player';
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 30000, // 30 seconds cache
                ...options
            });

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async getServerList(options = {}) {
        // Use the online players endpoint which includes server information
        const endpoint = '/player';
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 60000, // 1 minute cache
                ...options
            });

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async getServerUptime(server, options = {}) {
        const endpoint = `/server/${encodeURIComponent(server)}/uptime`;
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 30000, // 30 seconds cache
                ...options
            });

            return response.data;
        } catch (error) {
            if (error.type === ErrorTypes.DATA_ERROR) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Server '${server}' not found.`
                );
            }
            throw error;
        }
    }

    async getLeaderboard(type, options = {}) {
        const endpoint = `/leaderboards/${encodeURIComponent(type)}`;
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 300000, // 5 minutes cache
                ...options
            });

            return response.data;
        } catch (error) {
            if (error.type === ErrorTypes.DATA_ERROR) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Leaderboard type '${type}' not found.`
                );
            }
            throw error;
        }
    }

    async getPlayerCharacters(username, options = {}) {
        const endpoint = `/player/${encodeURIComponent(username)}/characters`;
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 60000, // 1 minute cache
                ...options
            });

            return response.data;
        } catch (error) {
            if (error.type === ErrorTypes.DATA_ERROR) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Characters for player '${username}' not found.`
                );
            }
            throw error;
        }
    }

    normalizePlayerData(data) {
        if (!data) return null;

        return {
            username: data.username,
            uuid: data.uuid,
            rank: data.rank,
            supportRank: data.supportRank,
            online: data.online,
            server: data.server,
            playtime: data.playtime,
            firstJoin: data.firstJoin ? new Date(data.firstJoin) : null,
            lastJoin: data.lastJoin ? new Date(data.lastJoin) : null,
            guild: data.guild ? {
                name: data.guild.name,
                prefix: data.guild.prefix,
                rank: data.guild.rank,
                joined: data.guild.joined ? new Date(data.guild.joined) : null
            } : null,
            characters: data.characters ? Object.entries(data.characters).map(([uuid, char]) => ({
                uuid,
                type: char.type || 'Unknown',
                reskin: char.reskin,
                nickname: char.nickname,
                level: char.level || 0,
                xp: char.xp || 0,
                xpPercent: char.xpPercent || 0,
                totalLevel: char.totalLevel || 0,
                gamemode: char.gamemode || [],
                meta: char.meta || {},
                lastJoin: char.lastJoin ? new Date(char.lastJoin) : null
            })) : [],
            globalData: data.globalData,
            activeCharacter: data.activeCharacter,
            raw: data
        };
    }

    normalizeGuildData(data) {
        if (!data) return null;

        return {
            name: data.name,
            prefix: data.prefix,
            members: data.members ? Object.entries(data.members).map(([uuid, member]) => ({
                uuid,
                ...member,
                joined: member.joined ? new Date(member.joined) : null
            })) : [],
            memberCount: data.members ? Object.keys(data.members).length : 0,
            xp: data.xp,
            level: data.level,
            created: data.created ? new Date(data.created) : null,
            territories: data.territories,
            territoryCount: data.territories ? Object.keys(data.territories).length : 0,
            banner: data.banner,
            raw: data
        };
    }

    async healthCheck() {
        try {
            const response = await this.getOnlinePlayers({ cache: false });
            return {
                healthy: true,
                playerCount: response.total || 0,
                responseTime: response.metadata?.duration
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                responseTime: error.metadata?.duration
            };
        }
    }

    static create(options = {}) {
        return new WynncraftAPIClient(options);
    }
}

module.exports = WynncraftAPIClient;