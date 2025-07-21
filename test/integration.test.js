// Integration tests for WynnTracker Revival
const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const ConfigManager = require('../src/config/ConfigManager');
const RateLimiter = require('../src/utils/RateLimiter');
const { ErrorHandler } = require('../src/utils/ErrorHandler');
const CacheManager = require('../src/utils/CacheManager');

// Mock Services
const PlayerService = require('../src/services/PlayerService');
const GuildService = require('../src/services/GuildService');
const MarketService = require('../src/services/MarketService');

// Mock API Clients
const WynncraftAPIClient = require('../src/api/WynncraftAPIClient');
const WynnventoryAPIClient = require('../src/api/WynnventoryAPIClient');

describe('WynnTracker Revival Integration Tests', () => {
    let configManager;
    let rateLimiter;
    let errorHandler;
    let cacheManager;

    beforeAll(() => {
        // Initialize core components
        configManager = ConfigManager.getInstance();
        rateLimiter = new RateLimiter();
        errorHandler = new ErrorHandler();
        cacheManager = new CacheManager();
    });

    afterAll(() => {
        // Cleanup
        if (rateLimiter) rateLimiter.destroy();
        if (cacheManager) cacheManager.clear();
    });

    describe('Core Components', () => {
        it('should initialize ConfigManager', () => {
            expect(configManager).toBeDefined();
            expect(['development', 'test'].includes(configManager.get('environment.nodeEnv'))).toBe(true);
        });

        it('should initialize RateLimiter', () => {
            expect(rateLimiter).toBeDefined();
            expect(typeof rateLimiter.checkCommandLimit).toBe('function');
        });

        it('should initialize ErrorHandler', () => {
            expect(errorHandler).toBeDefined();
            expect(typeof errorHandler.handle).toBe('function');
        });

        it('should initialize CacheManager', () => {
            expect(cacheManager).toBeDefined();
            expect(typeof cacheManager.get).toBe('function');
        });
    });

    describe('Rate Limiting', () => {
        it('should allow requests within limit', async () => {
            const result = await rateLimiter.checkCommandLimit('test_user', 'test_command');
            expect(result.allowed).toBe(true);
        });

        it('should deny requests over limit', async () => {
            const userId = 'test_user_limit';
            const commandName = 'test_command_limit';
            
            // Make requests up to limit
            for (let i = 0; i < 10; i++) {
                await rateLimiter.checkCommandLimit(userId, commandName);
            }
            
            // Next request should be denied
            const result = await rateLimiter.checkCommandLimit(userId, commandName);
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeGreaterThan(0);
        });

        it('should reset limits after window', async () => {
            const userId = 'test_user_reset';
            const commandName = 'test_command_reset';
            const customLimit = { windowMs: 100, maxRequests: 1 };
            
            // Use up the limit
            await rateLimiter.checkCommandLimit(userId, commandName, customLimit);
            let result = await rateLimiter.checkCommandLimit(userId, commandName, customLimit);
            expect(result.allowed).toBe(false);
            
            // Wait for window to reset
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Should allow again
            result = await rateLimiter.checkCommandLimit(userId, commandName, customLimit);
            expect(result.allowed).toBe(true);
        });
    });

    describe('Cache Management', () => {
        it('should store and retrieve cached data', async () => {
            const key = 'test_key';
            const value = { data: 'test_data', timestamp: Date.now() };
            
            await cacheManager.set(key, value);
            const retrieved = await cacheManager.get(key);
            
            expect(retrieved).toEqual(value);
        });

        it('should respect TTL', async () => {
            const key = 'test_ttl_key';
            const value = { data: 'test_ttl_data' };
            const ttl = 100; // 100ms
            
            await cacheManager.set(key, value, { ttl });
            
            // Should be available immediately
            let retrieved = await cacheManager.get(key);
            expect(retrieved).toEqual(value);
            
            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Should be expired
            retrieved = await cacheManager.get(key);
            expect(retrieved).toBeNull();
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', () => {
            const error = new Error('API Error');
            const context = { command: 'test', userId: 'test_user' };
            
            const result = errorHandler.handle(error, context);
            
            expect(result).toBeDefined();
            expect(result.message).toBeTruthy();
        });

        it('should handle network errors', () => {
            const error = new Error('Network Error');
            error.code = 'ECONNREFUSED';
            
            const result = errorHandler.handle(error);
            
            expect(result).toBeDefined();
            expect(result.message.toLowerCase()).toContain('network');
        });
    });

    describe('Services', () => {
        it('should create PlayerService', () => {
            const service = new PlayerService();
            expect(service).toBeDefined();
            expect(typeof service.initialize).toBe('function');
        });

        it('should create GuildService', () => {
            const service = new GuildService();
            expect(service).toBeDefined();
            expect(typeof service.initialize).toBe('function');
        });

        it('should create MarketService', () => {
            const service = new MarketService();
            expect(service).toBeDefined();
            expect(typeof service.initialize).toBe('function');
        });
    });

    describe('API Clients', () => {
        it('should create WynncraftAPIClient', () => {
            const client = new WynncraftAPIClient();
            expect(client).toBeDefined();
            expect(typeof client.getPlayer).toBe('function');
            expect(typeof client.getGuild).toBe('function');
        });

        it('should create WynnventoryAPIClient', () => {
            const client = new WynnventoryAPIClient();
            expect(client).toBeDefined();
            expect(typeof client.getTradeMarket).toBe('function');
        });
    });

    describe('Environment Configuration', () => {
        it('should load required environment variables', () => {
            expect(configManager.get('discord.token')).toBeTruthy();
            expect(configManager.get('discord.clientId')).toBeTruthy();
        });

        it('should have API configurations', () => {
            expect(configManager.get('apis.wynncraft.baseUrl')).toBeTruthy();
            expect(configManager.get('apis.wynnventory.baseUrl')).toBeTruthy();
        });

        it('should have rate limiting configuration', () => {
            expect(configManager.get('rateLimiting.windowMs')).toBeGreaterThan(0);
            expect(configManager.get('rateLimiting.maxRequests')).toBeGreaterThan(0);
        });
    });
});