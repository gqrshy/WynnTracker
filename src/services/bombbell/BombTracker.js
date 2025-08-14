class BombTracker {
    constructor() {
        this.activeBombs = new Map();
        this.duplicateWindow = 60000; // 1分以内は重複とみなす
        
        // 定期的に期限切れの爆弾を削除
        setInterval(() => {
            this.cleanupExpiredBombs();
        }, 30000); // 30秒ごと
    }
    
    addBomb(bombData) {
        const bombKey = this.generateBombKey(bombData);
        const expiryTime = bombData.timestamp + (bombData.metadata.duration * 60 * 1000);
        
        const bomb = {
            ...bombData,
            expiryTime: expiryTime,
            key: bombKey,
            addedAt: Date.now(),
            emoji: this.getBombEmoji(bombData.bombType)
        };
        
        this.activeBombs.set(bombKey, bomb);
        
        return bomb;
    }
    
    generateBombKey(bombData) {
        return `${bombData.bombType}_${bombData.world}_${bombData.timestamp}`;
    }
    
    isDuplicate(bombData) {
        const currentTime = Date.now();
        
        // 同じタイプの爆弾を検索
        for (const [key, existingBomb] of this.activeBombs) {
            if (existingBomb.bombType === bombData.bombType &&
                existingBomb.world === bombData.world &&
                Math.abs(existingBomb.timestamp - bombData.timestamp) < this.duplicateWindow) {
                return true;
            }
        }
        
        return false;
    }
    
    getActiveBombs() {
        const currentTime = Date.now();
        const activeBombs = [];
        
        for (const [key, bomb] of this.activeBombs) {
            if (bomb.expiryTime > currentTime) {
                activeBombs.push({
                    key: bomb.key,
                    bombType: bomb.bombType,
                    displayName: bomb.bombDisplayName,
                    world: bomb.world,
                    playerName: bomb.playerName,
                    timestamp: bomb.timestamp,
                    expiryTime: bomb.expiryTime,
                    remainingMinutes: Math.max(0, Math.ceil((bomb.expiryTime - currentTime) / 60000)),
                    emoji: bomb.emoji,
                    serverRegion: bomb.serverRegion
                });
            }
        }
        
        // 残り時間でソート
        activeBombs.sort((a, b) => a.expiryTime - b.expiryTime);
        
        return activeBombs;
    }
    
    cleanupExpiredBombs() {
        const currentTime = Date.now();
        const expiredKeys = [];
        
        for (const [key, bomb] of this.activeBombs) {
            if (bomb.expiryTime <= currentTime) {
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => {
            this.activeBombs.delete(key);
        });
        
        if (expiredKeys.length > 0) {
            console.log(`Cleaned up ${expiredKeys.length} expired bombs`);
        }
    }
    
    getBombEmoji(bombType) {
        const emojis = {
            'COMBAT_XP': '⚔️',
            'PROFESSION_XP': '🔨',
            'PROFESSION_SPEED': '⚡',
            'DUNGEON': '🏰',
            'LOOT': '💰',
            'LOOT_CHEST': '🗂️',
            'MATERIAL': '🧱',
            'SCROLL_CHARGE': '📜'
        };
        
        return emojis[bombType] || '💣';
    }
    
    getBombByWorld(world) {
        return this.getActiveBombs().filter(bomb => bomb.world === world);
    }
    
    getBombByType(bombType) {
        return this.getActiveBombs().filter(bomb => bomb.bombType === bombType);
    }
    
    getStats() {
        const activeBombs = this.getActiveBombs();
        const stats = {
            totalActive: activeBombs.length,
            byType: {},
            byRegion: {},
            byWorld: {}
        };
        
        activeBombs.forEach(bomb => {
            // タイプ別
            stats.byType[bomb.bombType] = (stats.byType[bomb.bombType] || 0) + 1;
            
            // 地域別
            stats.byRegion[bomb.serverRegion] = (stats.byRegion[bomb.serverRegion] || 0) + 1;
            
            // ワールド別
            stats.byWorld[bomb.world] = (stats.byWorld[bomb.world] || 0) + 1;
        });
        
        return stats;
    }
}

module.exports = BombTracker;