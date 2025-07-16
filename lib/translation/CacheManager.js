const EventEmitter = require('events');
const crypto = require('crypto');

class CacheManager extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.cache = new Map();
        this.statistics = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0
        };
        
        // LRU実装のためのアクセス順序追跡
        this.accessOrder = new Map();
        this.accessCounter = 0;
        
        // 定期的なクリーンアップ
        this.cleanupInterval = setInterval(() => this.cleanup(), config.cleanupInterval || 300000); // 5分
    }

    generateKey(text, sourceLang, targetLang) {
        const data = `${text}_${sourceLang}_${targetLang}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
    }

    async get(text, sourceLang, targetLang) {
        const key = this.generateKey(text, sourceLang, targetLang);
        const cached = this.cache.get(key);
        
        if (!cached) {
            this.statistics.misses++;
            this.emit('cacheMiss', { key, text });
            return null;
        }

        // TTLチェック
        if (Date.now() > cached.expiry) {
            this.cache.delete(key);
            this.accessOrder.delete(key);
            this.statistics.misses++;
            this.emit('cacheExpired', { key, text });
            return null;
        }

        // LRUアクセス順序更新
        this.accessOrder.set(key, ++this.accessCounter);
        this.statistics.hits++;
        this.emit('cacheHit', { key, text });
        
        return cached.value;
    }

    async set(text, sourceLang, targetLang, value, options = {}) {
        const key = this.generateKey(text, sourceLang, targetLang);
        const ttl = options.ttl || this.config.defaultTTL || 1800000; // 30分
        
        // キャッシュサイズ制限チェック
        if (this.cache.size >= this.config.maxSize) {
            this.evictLRU();
        }

        const entry = {
            value,
            expiry: Date.now() + ttl,
            size: this.calculateSize(text, value),
            createdAt: Date.now(),
            accessCount: 1
        };

        this.cache.set(key, entry);
        this.accessOrder.set(key, ++this.accessCounter);
        this.statistics.sets++;
        
        this.emit('cacheSet', { key, text, size: entry.size });
        
        return true;
    }

    evictLRU() {
        if (this.accessOrder.size === 0) return;
        
        // 最も古いアクセスのキーを見つける
        let oldestKey = null;
        let oldestAccess = Infinity;
        
        for (const [key, accessTime] of this.accessOrder) {
            if (accessTime < oldestAccess) {
                oldestAccess = accessTime;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.accessOrder.delete(oldestKey);
            this.statistics.evictions++;
            this.emit('cacheEviction', { key: oldestKey });
        }
    }

    calculateSize(text, value) {
        // 簡易的なサイズ計算
        return (text.length + JSON.stringify(value).length) * 2; // UTF-16文字として計算
    }

    cleanup() {
        const now = Date.now();
        let expiredCount = 0;
        
        for (const [key, entry] of this.cache) {
            if (now > entry.expiry) {
                this.cache.delete(key);
                this.accessOrder.delete(key);
                expiredCount++;
            }
        }
        
        if (expiredCount > 0) {
            this.emit('cacheCleanup', { expiredCount });
        }
    }

    getStats() {
        const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
        const hitRate = this.statistics.hits / (this.statistics.hits + this.statistics.misses) || 0;
        
        return {
            size: this.cache.size,
            maxSize: this.config.maxSize,
            totalBytes: totalSize,
            hitRate: Math.round(hitRate * 10000) / 100, // パーセンテージ
            statistics: { ...this.statistics }
        };
    }

    clear() {
        this.cache.clear();
        this.accessOrder.clear();
        this.accessCounter = 0;
        this.emit('cacheClear');
    }

    destroy() {
        clearInterval(this.cleanupInterval);
        this.clear();
    }
}

module.exports = CacheManager;