const axios = require('axios');
const { ErrorHandler, ErrorTypes } = require('../utils/ErrorHandler');
const CacheManager = require('../utils/CacheManager');
const ConfigManager = require('../config/ConfigManager');
const RateLimiter = require('../utils/RateLimiter');

class BaseAPIClient {
    constructor(baseURL, options = {}) {
        this.baseURL = baseURL;
        this.options = options;
        this.configManager = ConfigManager.getInstance();
        this.errorHandler = new ErrorHandler();
        this.cache = new CacheManager();
        this.rateLimiter = new RateLimiter();
        
        // Extract API name from baseURL for rate limiting
        this.apiName = this.extractApiName(baseURL);
        
        this.client = this.createClient();
        this.setupInterceptors();
    }

    createClient() {
        return axios.create({
            baseURL: this.baseURL,
            timeout: this.options.timeout || 10000,
            headers: {
                'User-Agent': 'WynnTracker-Revival/2.0.0',
                'Content-Type': 'application/json',
                ...this.options.headers
            },
            ...this.options.axiosConfig
        });
    }

    setupInterceptors() {
        this.client.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: Date.now() };
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        this.client.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.metadata.startTime;
                response.metadata = { duration };
                return response;
            },
            (error) => {
                if (error.config && error.config.metadata) {
                    error.metadata = { 
                        duration: Date.now() - error.config.metadata.startTime 
                    };
                }
                return Promise.reject(error);
            }
        );
    }

    async request(config) {
        // Check API rate limit
        const rateLimitCheck = await this.rateLimiter.checkApiLimit(this.apiName);
        if (!rateLimitCheck.allowed) {
            throw ErrorHandler.createRateLimitError(
                `API rate limit exceeded for ${this.apiName}. Please try again later.`,
                rateLimitCheck.retryAfter
            );
        }

        const cacheKey = this.generateCacheKey(config);
        
        if (config.cache !== false) {
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            const response = await this.client.request(config);
            const result = this.normalizeResponse(response);
            
            if (config.cache !== false) {
                await this.cache.set(cacheKey, result, {
                    ttl: config.cacheTtl || this.configManager.get('cache.ttl')
                });
            }
            
            return result;
        } catch (error) {
            const errorResponse = this.errorHandler.handle(error, {
                service: this.constructor.name,
                endpoint: config.url,
                method: config.method
            });
            
            throw errorResponse;
        }
    }

    async get(endpoint, params = {}, options = {}) {
        return this.request({
            method: 'GET',
            url: endpoint,
            params,
            ...options
        });
    }

    async post(endpoint, data = {}, options = {}) {
        return this.request({
            method: 'POST',
            url: endpoint,
            data,
            cache: false,
            ...options
        });
    }

    async put(endpoint, data = {}, options = {}) {
        return this.request({
            method: 'PUT',
            url: endpoint,
            data,
            cache: false,
            ...options
        });
    }

    async patch(endpoint, data = {}, options = {}) {
        return this.request({
            method: 'PATCH',
            url: endpoint,
            data,
            cache: false,
            ...options
        });
    }

    async delete(endpoint, options = {}) {
        return this.request({
            method: 'DELETE',
            url: endpoint,
            cache: false,
            ...options
        });
    }

    normalizeResponse(response) {
        // Return the response object with our metadata attached
        // This preserves the original structure while adding our timing metadata
        response.metadata = response.metadata || {};
        return response;
    }

    generateCacheKey(config) {
        const keyParts = [
            config.method?.toUpperCase() || 'GET',
            config.url,
            JSON.stringify(config.params || {}),
            JSON.stringify(config.data || {})
        ];
        
        return keyParts.join(':');
    }

    setAuthToken(token) {
        if (token) {
            this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete this.client.defaults.headers.common['Authorization'];
        }
    }

    setApiKey(key, header = 'X-API-Key') {
        if (key) {
            this.client.defaults.headers.common[header] = key;
        } else {
            delete this.client.defaults.headers.common[header];
        }
    }

    async healthCheck() {
        try {
            const response = await this.get('/health', {}, { 
                cache: false, 
                timeout: 5000 
            });
            return {
                healthy: true,
                status: response.status,
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

    async clearCache() {
        await this.cache.clear();
    }

    getStats() {
        return {
            cache: this.cache.getStats(),
            client: {
                baseURL: this.baseURL,
                timeout: this.client.defaults.timeout
            }
        };
    }

    extractApiName(baseURL) {
        // Extract API name from baseURL for rate limiting
        if (baseURL.includes('wynncraft.com')) {
            return 'wynncraft';
        } else if (baseURL.includes('wynnventory.com')) {
            return 'wynnventory';
        } else if (baseURL.includes('deepl.com')) {
            return 'deepl';
        } else {
            return 'unknown';
        }
    }

    static create(baseURL, options = {}) {
        return new BaseAPIClient(baseURL, options);
    }
}

module.exports = BaseAPIClient;