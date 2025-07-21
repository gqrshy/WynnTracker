const BaseService = require('./BaseService');
const WynnventoryAPIClient = require('../api/WynnventoryAPIClient');
const { ErrorTypes } = require('../utils/ErrorHandler');

class MarketService extends BaseService {
    constructor(options = {}) {
        super(options);
        this.wynnventoryApi = null;
        this.priceHistory = new Map();
        this.marketTrends = new Map();
    }

    async onInitialize() {
        this.wynnventoryApi = new WynnventoryAPIClient();
        await this.loadPriceHistory();
        this.info('MarketService initialized');
    }

    async loadPriceHistory() {
        try {
            const history = await this.cache.get('price_history', { useFile: true });
            if (history) {
                this.priceHistory = new Map(Object.entries(history));
            }
        } catch (error) {
            this.warn('Failed to load price history', { error: error.message });
        }
    }

    async savePriceHistory() {
        try {
            const history = Object.fromEntries(this.priceHistory);
            await this.cache.set('price_history', history, { useFile: true });
        } catch (error) {
            this.error('Failed to save price history', { error: error.message });
        }
    }

    async searchItems(itemName, options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `search_items:${itemName}:${JSON.stringify(options)}`;
            
            return this.withCache(cacheKey, async () => {
                // Get item listings
                const listings = await this.wynnventoryApi.getItemListings(itemName, {
                    unidentified: options.unidentifiedOnly,
                    page: 1,
                    pageSize: 50
                });
                
                if (!listings || listings.items.length === 0) {
                    return null;
                }
                
                // Sort by price (ascending)
                const sortedItems = listings.items
                    .sort((a, b) => a.listing_price - b.listing_price)
                    .slice(0, options.limit || 5);
                
                // Get price history
                const priceData = await this.wynnventoryApi.getItemPriceHistory(itemName, {
                    days: 7
                });
                
                return {
                    items: sortedItems,
                    metadata: {
                        itemName,
                        totalListings: listings.total,
                        unidentifiedOnly: options.unidentifiedOnly
                    },
                    priceData: priceData
                };
            }, {
                ttl: 30000, // 30 seconds cache
                ...options
            });
        }, {
            method: 'searchItems',
            itemName,
            options
        });
    }

    async searchMarket(query, options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `search:${query}:${JSON.stringify(options)}`;
            
            return this.withCache(cacheKey, async () => {
                const result = await this.wynnventoryApi.searchTradeMarket(query, options);
                
                // Sort trades by price if requested
                if (options.sortBy === 'price') {
                    result.trades.sort((a, b) => {
                        const priceA = a.price || 0;
                        const priceB = b.price || 0;
                        return options.sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
                    });
                }
                
                // Filter by identified/unidentified
                if (options.identified !== undefined) {
                    result.trades = result.trades.filter(trade => 
                        trade.identified === options.identified
                    );
                }
                
                // Filter by shiny
                if (options.shiny !== undefined) {
                    result.trades = result.trades.filter(trade => 
                        trade.shiny === options.shiny
                    );
                }
                
                // Filter by price range
                if (options.minPrice !== undefined || options.maxPrice !== undefined) {
                    result.trades = result.trades.filter(trade => {
                        const price = trade.price || 0;
                        if (options.minPrice !== undefined && price < options.minPrice) {
                            return false;
                        }
                        if (options.maxPrice !== undefined && price > options.maxPrice) {
                            return false;
                        }
                        return true;
                    });
                }
                
                this.info('Market search completed', {
                    query,
                    results: result.trades.length,
                    totalCount: result.totalCount
                });
                
                return result;
            }, {
                ttl: 30000, // 30 seconds cache
                ...options
            });
        }, {
            method: 'searchMarket',
            query,
            options
        });
    }

    async getItemPrice(itemName, options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `item_price:${itemName.toLowerCase()}`;
            
            return this.withCache(cacheKey, async () => {
                const priceData = await this.wynnventoryApi.getItemPrice(itemName, options);
                
                // Store in price history
                const historyKey = `${itemName.toLowerCase()}:${new Date().toISOString().split('T')[0]}`;
                this.priceHistory.set(historyKey, {
                    itemName,
                    date: new Date(),
                    averagePrice: priceData.averagePrice,
                    medianPrice: priceData.medianPrice,
                    totalTrades: priceData.totalTrades
                });
                
                await this.savePriceHistory();
                
                this.info('Item price fetched', {
                    itemName,
                    averagePrice: priceData.averagePrice,
                    totalTrades: priceData.totalTrades
                });
                
                return priceData;
            }, {
                ttl: 300000, // 5 minutes cache
                ...options
            });
        }, {
            method: 'getItemPrice',
            itemName
        });
    }

    async getMythicPrices(options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `mythic_prices:${JSON.stringify(options)}`;
            
            return this.withCache(cacheKey, async () => {
                const mythicData = await this.wynnventoryApi.getMythicPrices(options);
                
                // Sort by average price if requested
                if (options.sortBy === 'price') {
                    mythicData.mythics.sort((a, b) => {
                        const priceA = a.averagePrice || 0;
                        const priceB = b.averagePrice || 0;
                        return options.sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
                    });
                }
                
                // Filter by type
                if (options.type) {
                    mythicData.mythics = mythicData.mythics.filter(mythic => 
                        mythic.type?.toLowerCase() === options.type.toLowerCase()
                    );
                }
                
                // Filter by level range
                if (options.minLevel !== undefined || options.maxLevel !== undefined) {
                    mythicData.mythics = mythicData.mythics.filter(mythic => {
                        const level = mythic.level || 0;
                        if (options.minLevel !== undefined && level < options.minLevel) {
                            return false;
                        }
                        if (options.maxLevel !== undefined && level > options.maxLevel) {
                            return false;
                        }
                        return true;
                    });
                }
                
                this.info('Mythic prices fetched', {
                    count: mythicData.mythics.length,
                    filters: options
                });
                
                return mythicData;
            }, {
                ttl: 300000, // 5 minutes cache
                ...options
            });
        }, {
            method: 'getMythicPrices',
            options
        });
    }

    async getMarketTrends(itemName, days = 7, options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `trends:${itemName.toLowerCase()}:${days}`;
            
            return this.withCache(cacheKey, async () => {
                const priceData = await this.getItemPrice(itemName, options);
                
                // Get historical data from price history
                const historicalData = [];
                const today = new Date();
                
                for (let i = 0; i < days; i++) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    const dateKey = date.toISOString().split('T')[0];
                    const historyKey = `${itemName.toLowerCase()}:${dateKey}`;
                    
                    const historyEntry = this.priceHistory.get(historyKey);
                    if (historyEntry) {
                        historicalData.push(historyEntry);
                    }
                }
                
                // Calculate trends
                const trends = this.calculateTrends(historicalData);
                
                const trendData = {
                    itemName,
                    period: days,
                    current: priceData,
                    historical: historicalData,
                    trends: trends,
                    generatedAt: new Date()
                };
                
                this.info('Market trends calculated', {
                    itemName,
                    days,
                    dataPoints: historicalData.length,
                    trend: trends.priceDirection
                });
                
                return trendData;
            }, {
                ttl: 600000, // 10 minutes cache
                ...options
            });
        }, {
            method: 'getMarketTrends',
            itemName,
            days
        });
    }

    calculateTrends(historicalData) {
        if (historicalData.length < 2) {
            return {
                priceDirection: 'stable',
                priceChange: 0,
                priceChangePercent: 0,
                volatility: 0,
                confidence: 0
            };
        }
        
        // Sort by date
        historicalData.sort((a, b) => a.date - b.date);
        
        const prices = historicalData.map(entry => entry.averagePrice || 0);
        const firstPrice = prices[0];
        const lastPrice = prices[prices.length - 1];
        
        const priceChange = lastPrice - firstPrice;
        const priceChangePercent = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;
        
        // Calculate volatility (standard deviation of price changes)
        const priceChanges = [];
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            priceChanges.push(change);
        }
        
        const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
        const variance = priceChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / priceChanges.length;
        const volatility = Math.sqrt(variance);
        
        // Determine trend direction
        let priceDirection = 'stable';
        if (Math.abs(priceChangePercent) >= 5) {
            priceDirection = priceChangePercent > 0 ? 'rising' : 'falling';
        }
        
        // Calculate confidence based on data points and consistency
        const confidence = Math.min(100, (historicalData.length / 7) * 100);
        
        return {
            priceDirection,
            priceChange,
            priceChangePercent: Math.round(priceChangePercent * 100) / 100,
            volatility: Math.round(volatility),
            confidence: Math.round(confidence),
            dataPoints: historicalData.length
        };
    }

    async getPopularItems(options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `popular_items:${JSON.stringify(options)}`;
            
            return this.withCache(cacheKey, async () => {
                const marketData = await this.wynnventoryApi.getTradeMarket({
                    limit: 1000,
                    ...options
                });
                
                // Count item occurrences
                const itemCounts = new Map();
                
                marketData.trades.forEach(trade => {
                    const itemName = trade.item;
                    const count = itemCounts.get(itemName) || 0;
                    itemCounts.set(itemName, count + 1);
                });
                
                // Sort by popularity
                const popularItems = Array.from(itemCounts.entries())
                    .map(([itemName, count]) => ({ itemName, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, options.limit || 20);
                
                this.info('Popular items fetched', {
                    totalItems: itemCounts.size,
                    topItems: popularItems.length
                });
                
                return {
                    items: popularItems,
                    totalTrades: marketData.totalCount,
                    generatedAt: new Date()
                };
            }, {
                ttl: 600000, // 10 minutes cache
                ...options
            });
        }, {
            method: 'getPopularItems',
            options
        });
    }

    async getMarketSummary(options = {}) {
        return this.withErrorHandling(async () => {
            const cacheKey = `market_summary:${JSON.stringify(options)}`;
            
            return this.withCache(cacheKey, async () => {
                const [marketData, mythicData, popularItems] = await Promise.all([
                    this.wynnventoryApi.getTradeMarket({ limit: 100 }),
                    this.wynnventoryApi.getMythicPrices({ limit: 10 }),
                    this.getPopularItems({ limit: 5 })
                ]);
                
                const summary = {
                    totalTrades: marketData.totalCount,
                    recentTrades: marketData.trades.length,
                    topMythics: mythicData.mythics.slice(0, 5),
                    popularItems: popularItems.items,
                    marketActivity: this.calculateMarketActivity(marketData.trades),
                    generatedAt: new Date()
                };
                
                this.info('Market summary generated', {
                    totalTrades: summary.totalTrades,
                    recentTrades: summary.recentTrades
                });
                
                return summary;
            }, {
                ttl: 300000, // 5 minutes cache
                ...options
            });
        }, {
            method: 'getMarketSummary',
            options
        });
    }

    calculateMarketActivity(trades) {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
        
        const recentTrades = trades.filter(trade => trade.timestamp > oneHourAgo);
        const totalValue = trades.reduce((sum, trade) => sum + (trade.price || 0), 0);
        
        return {
            recentTrades: recentTrades.length,
            totalValue: Math.round(totalValue),
            averagePrice: trades.length > 0 ? Math.round(totalValue / trades.length) : 0,
            activity: recentTrades.length > 10 ? 'high' : 
                     recentTrades.length > 5 ? 'medium' : 'low'
        };
    }

    async compareItems(itemName1, itemName2, options = {}) {
        return this.withErrorHandling(async () => {
            const [item1Data, item2Data] = await Promise.all([
                this.getItemPrice(itemName1, options),
                this.getItemPrice(itemName2, options)
            ]);
            
            const comparison = {
                items: {
                    item1: {
                        name: itemName1,
                        averagePrice: item1Data.averagePrice,
                        totalTrades: item1Data.totalTrades
                    },
                    item2: {
                        name: itemName2,
                        averagePrice: item2Data.averagePrice,
                        totalTrades: item2Data.totalTrades
                    }
                },
                comparison: {
                    priceDifference: item1Data.averagePrice - item2Data.averagePrice,
                    priceRatio: item2Data.averagePrice > 0 ? 
                        item1Data.averagePrice / item2Data.averagePrice : 0,
                    tradeDifference: item1Data.totalTrades - item2Data.totalTrades,
                    moreExpensive: item1Data.averagePrice > item2Data.averagePrice ? itemName1 : itemName2,
                    morePopular: item1Data.totalTrades > item2Data.totalTrades ? itemName1 : itemName2
                }
            };
            
            this.info('Item comparison completed', {
                item1: itemName1,
                item2: itemName2,
                priceDifference: comparison.comparison.priceDifference
            });
            
            return comparison;
        }, {
            method: 'compareItems',
            items: [itemName1, itemName2]
        });
    }

    async checkServiceHealth() {
        try {
            const health = await this.wynnventoryApi.healthCheck();
            return {
                wynnventoryApi: health,
                priceHistory: this.priceHistory.size,
                marketTrends: this.marketTrends.size
            };
        } catch (error) {
            return {
                wynnventoryApi: {
                    healthy: false,
                    error: error.message
                },
                priceHistory: this.priceHistory.size,
                marketTrends: this.marketTrends.size
            };
        }
    }

    async onCleanup() {
        await this.savePriceHistory();
    }

    static create(options = {}) {
        return new MarketService(options);
    }
}

module.exports = MarketService;