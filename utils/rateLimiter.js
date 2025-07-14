// レート制限とキャッシュ管理システム

class RateLimiter {
    constructor() {
        // コマンドごとのレート制限設定
        this.limits = {
            'raid_aspectpool': { interval: 60000, uses: 1 }, // 1分に1回
            'lr_lootpool': { interval: 30000, uses: 2 }, // 30秒に2回
            'lr_mythranking': { interval: 300000, uses: 1 }, // 5分に1回
            'wynn_stats': { interval: 10000, uses: 3 }, // 10秒に3回
            'guild_ranking': { interval: 60000, uses: 1 }, // 1分に1回
            'guild_setrank': { interval: 300000, uses: 1 }, // 5分に1回
            'anni_timer': { interval: 60000, uses: 1 }, // 1分に1回
            'anni_predict': { interval: 30000, uses: 2 } // 30秒に2回
        };
        
        // ユーザーごとの使用履歴
        this.userUsage = new Map();
        
        // キャッシュストレージ
        this.cache = new Map();
        
        // キャッシュ有効期限設定（ミリ秒）
        this.cacheDuration = {
            'raid_aspectpool': 3600000, // 1時間
            'lr_lootpool': 1800000, // 30分
            'lr_mythranking': 1800000, // 30分
            'wynn_stats': 300000, // 5分
            'guild_ranking': 600000, // 10分
            'anni_predict': 60000 // 1分
        };
    }
    
    // レート制限チェック
    canUseCommand(userId, command) {
        const limit = this.limits[command];
        if (!limit) return { allowed: true };
        
        const now = Date.now();
        const userKey = `${userId}_${command}`;
        const usage = this.userUsage.get(userKey) || [];
        
        // 期限切れの使用履歴を削除
        const validUsage = usage.filter(time => now - time < limit.interval);
        
        if (validUsage.length >= limit.uses) {
            const oldestUsage = validUsage[0];
            const waitTime = limit.interval - (now - oldestUsage);
            return {
                allowed: false,
                waitTime: Math.ceil(waitTime / 1000),
                resetAt: new Date(oldestUsage + limit.interval)
            };
        }
        
        // 使用履歴を更新
        validUsage.push(now);
        this.userUsage.set(userKey, validUsage);
        
        return { allowed: true };
    }
    
    // キャッシュ取得
    getCache(command, key) {
        const cacheKey = `${command}_${key}`;
        const cached = this.cache.get(cacheKey);
        
        if (!cached) return null;
        
        const now = Date.now();
        const duration = this.cacheDuration[command] || 600000; // デフォルト10分
        
        if (now - cached.timestamp > duration) {
            this.cache.delete(cacheKey);
            return null;
        }
        
        return cached.data;
    }
    
    // キャッシュ設定
    setCache(command, key, data) {
        const cacheKey = `${command}_${key}`;
        this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    // キャッシュクリア
    clearCache(command = null) {
        if (command) {
            // 特定コマンドのキャッシュのみクリア
            const prefix = `${command}_`;
            for (const [key] of this.cache) {
                if (key.startsWith(prefix)) {
                    this.cache.delete(key);
                }
            }
        } else {
            // 全キャッシュクリア
            this.cache.clear();
        }
    }
    
    // 定期的なクリーンアップ
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            
            // 期限切れキャッシュの削除
            for (const [key, value] of this.cache) {
                const command = key.split('_')[0];
                const duration = this.cacheDuration[command] || 600000;
                if (now - value.timestamp > duration) {
                    this.cache.delete(key);
                }
            }
            
            // 古い使用履歴の削除
            for (const [userKey, usage] of this.userUsage) {
                const command = userKey.split('_').slice(1).join('_');
                const limit = this.limits[command];
                if (limit) {
                    const validUsage = usage.filter(time => now - time < limit.interval);
                    if (validUsage.length === 0) {
                        this.userUsage.delete(userKey);
                    } else if (validUsage.length !== usage.length) {
                        this.userUsage.set(userKey, validUsage);
                    }
                }
            }
        }, 60000); // 1分ごとにクリーンアップ
    }
}

// シングルトンインスタンス
const rateLimiter = new RateLimiter();
rateLimiter.startCleanup();

module.exports = rateLimiter;