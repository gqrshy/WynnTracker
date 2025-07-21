const ConfigManager = require('../config/ConfigManager');

class RateLimiter {
    constructor(config = {}) {
        this.configManager = ConfigManager.getInstance();
        
        this.globalLimits = {
            windowMs: config.windowMs || this.configManager.get('rateLimiting.windowMs'),
            maxRequests: config.maxRequests || this.configManager.get('rateLimiting.maxRequests')
        };
        
        // Load command-specific limits from config
        this.commandLimits = config.commandLimits || this.configManager.get('rateLimiting.commands') || {};
        this.userLimits = config.userLimits || {};
        this.apiLimits = config.apiLimits || this.configManager.get('rateLimiting.apis') || {};
        
        this.globalStore = new Map();
        this.commandStore = new Map();
        this.userStore = new Map();
        this.apiStore = new Map();
        
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    async checkLimit(identifier, type = 'global', customLimit = null) {
        const limit = customLimit || this.getLimit(identifier, type);
        const store = this.getStore(type);
        
        const now = Date.now();
        const key = this.generateKey(identifier, type);
        
        if (!store.has(key)) {
            store.set(key, {
                count: 1,
                resetTime: now + limit.windowMs,
                firstRequest: now
            });
            return {
                allowed: true,
                remaining: limit.maxRequests - 1,
                resetTime: now + limit.windowMs,
                retryAfter: null
            };
        }

        const entry = store.get(key);
        
        if (now > entry.resetTime) {
            entry.count = 1;
            entry.resetTime = now + limit.windowMs;
            entry.firstRequest = now;
            
            return {
                allowed: true,
                remaining: limit.maxRequests - 1,
                resetTime: entry.resetTime,
                retryAfter: null
            };
        }

        if (entry.count >= limit.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.resetTime,
                retryAfter: Math.ceil((entry.resetTime - now) / 1000)
            };
        }

        entry.count++;
        
        return {
            allowed: true,
            remaining: limit.maxRequests - entry.count,
            resetTime: entry.resetTime,
            retryAfter: null
        };
    }

    async checkCommandLimit(userId, commandName, customLimit = null) {
        const commandKey = `${userId}:${commandName}`;
        return this.checkLimit(commandKey, 'command', customLimit);
    }

    async checkUserLimit(userId, customLimit = null) {
        return this.checkLimit(userId, 'user', customLimit);
    }

    async checkGlobalLimit(identifier = 'global', customLimit = null) {
        return this.checkLimit(identifier, 'global', customLimit);
    }

    async checkApiLimit(apiName, customLimit = null) {
        return this.checkLimit(apiName, 'api', customLimit);
    }

    // 統一されたレート制限チェック（旧コードとの互換性）
    async checkRateLimit(userId, commandName, customLimit = null) {
        return this.checkCommandLimit(userId, commandName, customLimit);
    }

    getLimit(identifier, type) {
        switch (type) {
            case 'command':
                const commandName = identifier.split(':')[1];
                return this.commandLimits[commandName] || this.globalLimits;
            
            case 'user':
                return this.userLimits[identifier] || this.globalLimits;
            
            case 'api':
                return this.apiLimits[identifier] || this.globalLimits;
            
            case 'global':
            default:
                return this.globalLimits;
        }
    }

    getStore(type) {
        switch (type) {
            case 'command':
                return this.commandStore;
            case 'user':
                return this.userStore;
            case 'api':
                return this.apiStore;
            case 'global':
            default:
                return this.globalStore;
        }
    }

    generateKey(identifier, type) {
        return `${type}:${identifier}`;
    }

    setCommandLimit(commandName, limit) {
        this.commandLimits[commandName] = {
            windowMs: limit.windowMs || this.globalLimits.windowMs,
            maxRequests: limit.maxRequests || this.globalLimits.maxRequests
        };
    }

    setUserLimit(userId, limit) {
        this.userLimits[userId] = {
            windowMs: limit.windowMs || this.globalLimits.windowMs,
            maxRequests: limit.maxRequests || this.globalLimits.maxRequests
        };
    }

    resetLimit(identifier, type = 'global') {
        const store = this.getStore(type);
        const key = this.generateKey(identifier, type);
        store.delete(key);
    }

    resetCommandLimit(userId, commandName) {
        const commandKey = `${userId}:${commandName}`;
        this.resetLimit(commandKey, 'command');
    }

    resetUserLimit(userId) {
        this.resetLimit(userId, 'user');
    }

    resetGlobalLimit(identifier = 'global') {
        this.resetLimit(identifier, 'global');
    }

    getLimitStatus(identifier, type = 'global') {
        const store = this.getStore(type);
        const key = this.generateKey(identifier, type);
        const entry = store.get(key);
        
        if (!entry) {
            const limit = this.getLimit(identifier, type);
            return {
                count: 0,
                limit: limit.maxRequests,
                remaining: limit.maxRequests,
                resetTime: null,
                retryAfter: null
            };
        }

        const now = Date.now();
        const limit = this.getLimit(identifier, type);
        
        if (now > entry.resetTime) {
            return {
                count: 0,
                limit: limit.maxRequests,
                remaining: limit.maxRequests,
                resetTime: null,
                retryAfter: null
            };
        }

        return {
            count: entry.count,
            limit: limit.maxRequests,
            remaining: Math.max(0, limit.maxRequests - entry.count),
            resetTime: entry.resetTime,
            retryAfter: entry.count >= limit.maxRequests ? 
                Math.ceil((entry.resetTime - now) / 1000) : null
        };
    }

    getCommandLimitStatus(userId, commandName) {
        const commandKey = `${userId}:${commandName}`;
        return this.getLimitStatus(commandKey, 'command');
    }

    getUserLimitStatus(userId) {
        return this.getLimitStatus(userId, 'user');
    }

    getGlobalLimitStatus(identifier = 'global') {
        return this.getLimitStatus(identifier, 'global');
    }

    cleanup() {
        const now = Date.now();
        
        const cleanupStore = (store) => {
            for (const [key, entry] of store) {
                if (now > entry.resetTime) {
                    store.delete(key);
                }
            }
        };

        cleanupStore(this.globalStore);
        cleanupStore(this.commandStore);
        cleanupStore(this.userStore);
        cleanupStore(this.apiStore);
    }

    getStats() {
        const getStoreStats = (store, type) => {
            const stats = {
                totalEntries: store.size,
                activeEntries: 0,
                expiredEntries: 0
            };

            const now = Date.now();
            
            for (const [key, entry] of store) {
                if (now > entry.resetTime) {
                    stats.expiredEntries++;
                } else {
                    stats.activeEntries++;
                }
            }

            return stats;
        };

        return {
            global: getStoreStats(this.globalStore, 'global'),
            command: getStoreStats(this.commandStore, 'command'),
            user: getStoreStats(this.userStore, 'user'),
            api: getStoreStats(this.apiStore, 'api'),
            limits: {
                global: this.globalLimits,
                command: this.commandLimits,
                user: this.userLimits,
                api: this.apiLimits
            }
        };
    }

    clear() {
        this.globalStore.clear();
        this.commandStore.clear();
        this.userStore.clear();
        this.apiStore.clear();
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clear();
    }

    static create(config) {
        return new RateLimiter(config);
    }
}

module.exports = RateLimiter;