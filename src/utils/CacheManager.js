const fs = require('fs').promises;
const path = require('path');
const ConfigManager = require('../config/ConfigManager');

class CacheManager {
    constructor(config = {}) {
        this.configManager = ConfigManager.getInstance();
        
        this.defaultTtl = config.ttl || this.configManager.get('cache.ttl');
        this.maxSize = config.maxSize || this.configManager.get('cache.maxSize');
        this.directory = config.directory || this.configManager.getCachePath('');
        
        this.memoryCache = new Map();
        this.accessTimes = new Map();
        this.fileCacheIndex = new Map();
        
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
        
        this.initializeFileCache();
    }

    async initializeFileCache() {
        try {
            await fs.mkdir(this.directory, { recursive: true });
            await this.loadFileCacheIndex();
        } catch (error) {
            console.error('Failed to initialize file cache:', error);
        }
    }

    async loadFileCacheIndex() {
        try {
            const indexPath = path.join(this.directory, 'cache-index.json');
            const indexData = await fs.readFile(indexPath, 'utf8');
            const index = JSON.parse(indexData);
            
            for (const [key, metadata] of Object.entries(index)) {
                this.fileCacheIndex.set(key, metadata);
            }
        } catch (error) {
            // Index file doesn't exist or is corrupted, start fresh
            this.fileCacheIndex.clear();
        }
    }

    async saveFileCacheIndex() {
        try {
            const indexPath = path.join(this.directory, 'cache-index.json');
            const index = Object.fromEntries(this.fileCacheIndex);
            await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
        } catch (error) {
            console.error('Failed to save file cache index:', error);
        }
    }

    async get(key, options = {}) {
        const useFile = options.useFile || false;
        
        if (useFile) {
            return this.getFromFile(key);
        }
        
        return this.getFromMemory(key);
    }

    async getFromMemory(key) {
        const entry = this.memoryCache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return null;
        }

        if (this.isExpired(entry)) {
            this.memoryCache.delete(key);
            this.accessTimes.delete(key);
            this.stats.misses++;
            return null;
        }

        this.accessTimes.set(key, Date.now());
        this.stats.hits++;
        return entry.value;
    }

    async getFromFile(key) {
        const metadata = this.fileCacheIndex.get(key);
        
        if (!metadata) {
            this.stats.misses++;
            return null;
        }

        if (this.isExpired(metadata)) {
            await this.deleteFromFile(key);
            this.stats.misses++;
            return null;
        }

        try {
            const filePath = path.join(this.directory, metadata.filename);
            const data = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(data);
            
            this.stats.hits++;
            return parsed.value;
        } catch (error) {
            // File doesn't exist or is corrupted
            this.fileCacheIndex.delete(key);
            this.stats.misses++;
            return null;
        }
    }

    async set(key, value, options = {}) {
        const ttl = options.ttl || this.defaultTtl;
        const useFile = options.useFile || false;
        
        if (useFile) {
            await this.setToFile(key, value, ttl);
        } else {
            await this.setToMemory(key, value, ttl);
        }
        
        this.stats.sets++;
    }

    async setToMemory(key, value, ttl) {
        // Check if we need to evict old entries
        if (this.memoryCache.size >= this.maxSize) {
            await this.evictLeastRecentlyUsed();
        }

        const entry = {
            value,
            createdAt: Date.now(),
            ttl,
            expiresAt: Date.now() + ttl
        };

        this.memoryCache.set(key, entry);
        this.accessTimes.set(key, Date.now());
    }

    async setToFile(key, value, ttl) {
        const filename = `${this.generateHash(key)}.json`;
        const filePath = path.join(this.directory, filename);
        
        const entry = {
            value,
            createdAt: Date.now(),
            ttl,
            expiresAt: Date.now() + ttl
        };

        try {
            await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
            
            this.fileCacheIndex.set(key, {
                filename,
                createdAt: entry.createdAt,
                ttl: entry.ttl,
                expiresAt: entry.expiresAt
            });
            
            await this.saveFileCacheIndex();
        } catch (error) {
            console.error('Failed to save to file cache:', error);
        }
    }

    async delete(key, options = {}) {
        const useFile = options.useFile || false;
        
        if (useFile) {
            await this.deleteFromFile(key);
        } else {
            this.deleteFromMemory(key);
        }
        
        this.stats.deletes++;
    }

    deleteFromMemory(key) {
        this.memoryCache.delete(key);
        this.accessTimes.delete(key);
    }

    async deleteFromFile(key) {
        const metadata = this.fileCacheIndex.get(key);
        
        if (metadata) {
            try {
                const filePath = path.join(this.directory, metadata.filename);
                await fs.unlink(filePath);
            } catch (error) {
                // File might already be deleted
            }
            
            this.fileCacheIndex.delete(key);
            await this.saveFileCacheIndex();
        }
    }

    async has(key, options = {}) {
        const useFile = options.useFile || false;
        
        if (useFile) {
            return this.hasInFile(key);
        }
        
        return this.hasInMemory(key);
    }

    hasInMemory(key) {
        const entry = this.memoryCache.get(key);
        return entry && !this.isExpired(entry);
    }

    hasInFile(key) {
        const metadata = this.fileCacheIndex.get(key);
        return metadata && !this.isExpired(metadata);
    }

    async clear(options = {}) {
        const useFile = options.useFile || false;
        
        if (useFile) {
            await this.clearFileCache();
        } else {
            this.clearMemoryCache();
        }
    }

    clearMemoryCache() {
        this.memoryCache.clear();
        this.accessTimes.clear();
    }

    async clearFileCache() {
        try {
            const files = await fs.readdir(this.directory);
            
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'cache-index.json') {
                    await fs.unlink(path.join(this.directory, file));
                }
            }
            
            this.fileCacheIndex.clear();
            await this.saveFileCacheIndex();
        } catch (error) {
            console.error('Failed to clear file cache:', error);
        }
    }

    async cleanup() {
        await this.cleanupMemoryCache();
        await this.cleanupFileCache();
    }

    cleanupMemoryCache() {
        const now = Date.now();
        
        for (const [key, entry] of this.memoryCache) {
            if (this.isExpired(entry)) {
                this.memoryCache.delete(key);
                this.accessTimes.delete(key);
            }
        }
    }

    async cleanupFileCache() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, metadata] of this.fileCacheIndex) {
            if (this.isExpired(metadata)) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            await this.deleteFromFile(key);
        }
    }

    async evictLeastRecentlyUsed() {
        let lruKey = null;
        let lruTime = Date.now();
        
        for (const [key, time] of this.accessTimes) {
            if (time < lruTime) {
                lruTime = time;
                lruKey = key;
            }
        }
        
        if (lruKey) {
            this.deleteFromMemory(lruKey);
            this.stats.evictions++;
        }
    }

    isExpired(entry) {
        return Date.now() > entry.expiresAt;
    }

    generateHash(key) {
        let hash = 0;
        
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(16);
    }

    getStats() {
        return {
            ...this.stats,
            memorySize: this.memoryCache.size,
            fileSize: this.fileCacheIndex.size,
            maxSize: this.maxSize
        };
    }

    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
    }

    async destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        await this.saveFileCacheIndex();
        this.clearMemoryCache();
    }

    static create(config) {
        return new CacheManager(config);
    }
}

module.exports = CacheManager;