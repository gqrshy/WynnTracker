const BaseAPIClient = require('./BaseAPIClient');
const { ErrorTypes } = require('../utils/ErrorHandler');
const ConfigManager = require('../config/ConfigManager');

class WynnventoryAPIClient extends BaseAPIClient {
    constructor(options = {}) {
        const baseURL = options.baseURL || 'https://wynnventory.com/api';
        const configManager = ConfigManager.getInstance();
        const apiKey = options.apiKey || configManager.get('apis.wynnventory.key');
        
        super(baseURL, {
            timeout: 15000,
            headers: {
                'Authorization': apiKey ? `Api-Key ${apiKey}` : undefined,
                'Accept': 'application/json',
                ...options.headers
            },
            ...options
        });
    }

    async getTradeMarket(options = {}) {
        const endpoint = '/market/trades';
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 60000, // 1 minute cache
                ...options
            });

            return this.normalizeTradeMarketData(response.data);
        } catch (error) {
            throw error;
        }
    }

    async searchTradeMarket(query, options = {}) {
        const endpoint = '/market/search';
        const params = {
            q: query,
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 30000, // 30 seconds cache
                ...options
            });

            return this.normalizeTradeMarketData(response.data);
        } catch (error) {
            if (error.type === ErrorTypes.DATA_ERROR) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `No items found for query '${query}'.`
                );
            }
            throw error;
        }
    }

    async getItemPrice(itemName, options = {}) {
        const endpoint = `/market/item/${encodeURIComponent(itemName)}`;
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 300000, // 5 minutes cache
                ...options
            });

            return this.normalizeItemPriceData(response.data);
        } catch (error) {
            if (error.type === ErrorTypes.DATA_ERROR) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `Item '${itemName}' not found in trade market.`
                );
            }
            throw error;
        }
    }

    async getLootpoolData(options = {}) {
        const endpoint = '/lootpool';
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 3600000, // 1 hour cache
                ...options
            });

            return this.normalizeLootpoolData(response.data);
        } catch (error) {
            throw error;
        }
    }

    async getLootrunData(options = {}) {
        const endpoint = '/lootrun';
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 3600000, // 1 hour cache
                ...options
            });

            return this.normalizeLootrunData(response.data);
        } catch (error) {
            throw error;
        }
    }

    async getRaidData(options = {}) {
        const endpoint = '/raid';
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 3600000, // 1 hour cache
                ...options
            });

            return this.normalizeRaidData(response.data);
        } catch (error) {
            throw error;
        }
    }

    async getAspectsData(options = {}) {
        const endpoint = '/raid/aspects';
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 3600000, // 1 hour cache
                ...options
            });

            return this.normalizeAspectsData(response.data);
        } catch (error) {
            throw error;
        }
    }

    async getGambitsData(options = {}) {
        const endpoint = '/raid/gambits';
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 3600000, // 1 hour cache
                ...options
            });

            return this.normalizeGambitsData(response.data);
        } catch (error) {
            throw error;
        }
    }

    async getMythicPrices(options = {}) {
        const endpoint = '/market/mythics';
        const params = {
            ...options.params
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 300000, // 5 minutes cache
                ...options
            });

            return this.normalizeMythicPricesData(response.data);
        } catch (error) {
            throw error;
        }
    }

    async getItemListings(itemName, options = {}) {
        const endpoint = `/trademarket/listings/${encodeURIComponent(itemName)}`;
        const params = {
            page: options.page || 1,
            page_size: options.pageSize || 50,
            ...options.params
        };

        if (options.unidentified !== undefined) {
            params.unidentified = options.unidentified;
        }

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 30000, // 30 seconds cache
                ...options
            });

            return this.normalizeItemListingsData(response.data);
        } catch (error) {
            if (error.type === ErrorTypes.DATA_ERROR) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    `No listings found for item '${itemName}'.`
                );
            }
            throw error;
        }
    }

    async getItemPriceHistory(itemName, options = {}) {
        const endpoint = `/trademarket/history/${encodeURIComponent(itemName)}/price`;
        const params = {
            ...options.params
        };

        if (options.days) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - options.days);
            
            params.start_date = startDate.toISOString().split('T')[0];
            params.end_date = endDate.toISOString().split('T')[0];
        }

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 300000, // 5 minutes cache
                ...options
            });

            return this.normalizeItemPriceHistoryData(response.data);
        } catch (error) {
            // Price history is optional, return null if not available
            return null;
        }
    }

    normalizeTradeMarketData(data) {
        if (!data || !Array.isArray(data.trades)) return { trades: [] };

        return {
            trades: data.trades.map(trade => ({
                id: trade.id,
                item: trade.item,
                price: trade.price,
                amount: trade.amount,
                seller: trade.seller,
                timestamp: trade.timestamp ? new Date(trade.timestamp) : null,
                identified: trade.identified,
                shiny: trade.shiny,
                stats: trade.stats
            })),
            totalCount: data.totalCount,
            page: data.page,
            limit: data.limit
        };
    }

    normalizeItemPriceData(data) {
        if (!data) return null;

        return {
            item: data.item,
            averagePrice: data.averagePrice,
            medianPrice: data.medianPrice,
            minPrice: data.minPrice,
            maxPrice: data.maxPrice,
            totalTrades: data.totalTrades,
            recentTrades: data.recentTrades?.map(trade => ({
                ...trade,
                timestamp: trade.timestamp ? new Date(trade.timestamp) : null
            })),
            priceHistory: data.priceHistory?.map(entry => ({
                ...entry,
                date: entry.date ? new Date(entry.date) : null
            })),
            lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null
        };
    }

    normalizeLootpoolData(data) {
        if (!data || !Array.isArray(data.pools)) return { pools: [] };

        return {
            pools: data.pools.map(pool => ({
                id: pool.id,
                name: pool.name,
                type: pool.type,
                items: pool.items,
                dropRates: pool.dropRates,
                requirements: pool.requirements,
                location: pool.location
            })),
            lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null
        };
    }

    normalizeLootrunData(data) {
        if (!data || !Array.isArray(data.routes)) return { routes: [] };

        return {
            routes: data.routes.map(route => ({
                id: route.id,
                name: route.name,
                camps: route.camps,
                difficulty: route.difficulty,
                estimatedTime: route.estimatedTime,
                rewards: route.rewards,
                requirements: route.requirements
            })),
            lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null
        };
    }

    normalizeRaidData(data) {
        if (!data) return null;

        return {
            currentWeek: data.currentWeek,
            raids: data.raids?.map(raid => ({
                name: raid.name,
                difficulty: raid.difficulty,
                requirements: raid.requirements,
                rewards: raid.rewards,
                bosses: raid.bosses
            })),
            lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null
        };
    }

    normalizeAspectsData(data) {
        if (!data || !Array.isArray(data.aspects)) return { aspects: [] };

        return {
            aspects: data.aspects.map(aspect => ({
                id: aspect.id,
                name: aspect.name,
                description: aspect.description,
                type: aspect.type,
                rarity: aspect.rarity,
                effects: aspect.effects,
                classes: aspect.classes,
                available: aspect.available
            })),
            currentWeek: data.currentWeek,
            lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null
        };
    }

    normalizeGambitsData(data) {
        if (!data || !Array.isArray(data.gambits)) return { gambits: [] };

        return {
            gambits: data.gambits.map(gambit => ({
                id: gambit.id,
                name: gambit.name,
                description: gambit.description,
                type: gambit.type,
                effects: gambit.effects,
                requirements: gambit.requirements,
                available: gambit.available
            })),
            lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null
        };
    }

    normalizeMythicPricesData(data) {
        if (!data || !Array.isArray(data.mythics)) return { mythics: [] };

        return {
            mythics: data.mythics.map(mythic => ({
                name: mythic.name,
                type: mythic.type,
                level: mythic.level,
                averagePrice: mythic.averagePrice,
                medianPrice: mythic.medianPrice,
                minPrice: mythic.minPrice,
                maxPrice: mythic.maxPrice,
                totalTrades: mythic.totalTrades,
                lastTrade: mythic.lastTrade ? new Date(mythic.lastTrade) : null,
                priceChange: mythic.priceChange
            })),
            lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null
        };
    }

    normalizeItemListingsData(data) {
        if (!data || !Array.isArray(data.items)) return { items: [], total: 0 };

        return {
            items: data.items.map(item => ({
                id: item.id,
                listing_price: item.listing_price,
                amount: item.amount,
                timestamp: item.timestamp ? new Date(item.timestamp) : null,
                unidentified: item.unidentified,
                shiny_stat: item.shiny_stat,
                rarity: item.rarity,
                type: item.type,
                seller: item.seller,
                stats: item.stats
            })),
            total: data.total,
            page: data.page,
            pageSize: data.page_size
        };
    }

    normalizeItemPriceHistoryData(data) {
        if (!data) return null;

        return {
            average_price: data.average_price,
            average_mid_80_percent_price: data.average_mid_80_percent_price,
            unidentified_average_price: data.unidentified_average_price,
            unidentified_count: data.unidentified_count,
            total_trades: data.total_trades,
            start_date: data.start_date,
            end_date: data.end_date,
            generated_at: data.generated_at ? new Date(data.generated_at) : null
        };
    }

    async healthCheck() {
        try {
            const response = await this.getTradeMarket({ 
                cache: false, 
                params: { limit: 1 } 
            });
            return {
                healthy: true,
                tradeCount: response.totalCount,
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
        return new WynnventoryAPIClient(options);
    }
}

module.exports = WynnventoryAPIClient;