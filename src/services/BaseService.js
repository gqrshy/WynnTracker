const { ErrorHandler } = require('../utils/ErrorHandler');
const ConfigManager = require('../config/ConfigManager');
const CacheManager = require('../utils/CacheManager');

class BaseService {
    constructor(options = {}) {
        this.options = options;
        this.configManager = ConfigManager.getInstance();
        this.errorHandler = new ErrorHandler();
        this.cache = new CacheManager();
        this.initialized = false;
        this.name = this.constructor.name;
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            await this.onInitialize();
            this.initialized = true;
        } catch (error) {
            const errorResponse = this.errorHandler.handle(error, {
                service: this.name,
                method: 'initialize'
            });
            throw errorResponse;
        }
    }

    async onInitialize() {
        // Override in subclasses
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    async withErrorHandling(operation, context = {}) {
        try {
            await this.ensureInitialized();
            return await operation();
        } catch (error) {
            const errorResponse = this.errorHandler.handle(error, {
                service: this.name,
                ...context
            });
            throw errorResponse;
        }
    }

    async withCache(key, operation, options = {}) {
        const cacheKey = `${this.name}:${key}`;
        
        if (options.cache !== false) {
            const cached = await this.cache.get(cacheKey, {
                useFile: options.useFileCache
            });
            
            if (cached) {
                return cached;
            }
        }

        const result = await operation();
        
        if (options.cache !== false && result) {
            await this.cache.set(cacheKey, result, {
                ttl: options.ttl || this.configManager.get('cache.ttl'),
                useFile: options.useFileCache
            });
        }

        return result;
    }

    async clearCache(pattern = null) {
        if (pattern) {
            // Clear cache entries matching pattern
            const cachePattern = `${this.name}:${pattern}`;
            await this.cache.delete(cachePattern);
        } else {
            // Clear all cache entries for this service
            await this.cache.clear();
        }
    }

    getConfig(path, defaultValue = null) {
        return this.configManager.get(path, defaultValue);
    }

    setConfig(path, value) {
        return this.configManager.set(path, value);
    }

    log(level, message, data = {}) {
        const logData = {
            service: this.name,
            ...data
        };

        if (this.logger) {
            this.logger[level](message, logData);
        } else {
            // Format data for console output to avoid character-by-character display
            const formattedData = Object.keys(logData).length > 1 ? 
                JSON.stringify(logData, null, 2) : 
                '';
            console[level === 'error' ? 'error' : 'log'](`[${this.name}] ${message}${formattedData ? '\n' + formattedData : ''}`);
        }
    }

    info(message, data = {}) {
        this.log('info', message, data);
    }

    warn(message, data = {}) {
        this.log('warn', message, data);
    }

    error(message, data = {}) {
        this.log('error', message, data);
    }

    debug(message, data = {}) {
        this.log('debug', message, data);
    }

    async healthCheck() {
        try {
            await this.ensureInitialized();
            const serviceHealth = await this.checkServiceHealth();
            
            return {
                service: this.name,
                healthy: true,
                initialized: this.initialized,
                ...serviceHealth
            };
        } catch (error) {
            return {
                service: this.name,
                healthy: false,
                initialized: this.initialized,
                error: error.message
            };
        }
    }

    async checkServiceHealth() {
        // Override in subclasses
        return {};
    }

    getStats() {
        return {
            service: this.name,
            initialized: this.initialized,
            cache: this.cache.getStats(),
            errors: this.errorHandler.getErrorStats()
        };
    }

    async cleanup() {
        try {
            await this.onCleanup();
            await this.cache.destroy();
        } catch (error) {
            this.error('Error during cleanup', { error: error.message });
        }
    }

    async onCleanup() {
        // Override in subclasses
    }

    static create(options = {}) {
        return new this(options);
    }
}

module.exports = BaseService;