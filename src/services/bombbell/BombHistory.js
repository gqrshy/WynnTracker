const fs = require('fs').promises;
const path = require('path');

class BombHistory {
    constructor() {
        this.dataDir = path.join(__dirname, '../../../data');
        this.historyFile = path.join(this.dataDir, 'bomb_history.json');
        this.ensureDataDir();
    }
    
    async ensureDataDir() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create data directory:', error);
        }
    }
    
    async saveBombEvent(bombData) {
        try {
            const history = await this.loadHistory();
            
            const event = {
                id: this.generateEventId(bombData),
                ...bombData,
                savedAt: Date.now()
            };
            
            history.events.push(event);
            
            // 古いイベントの削除（30日以上前）
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            history.events = history.events.filter(event => event.timestamp > thirtyDaysAgo);
            
            await this.saveHistory(history);
            
            return event;
            
        } catch (error) {
            console.error('Failed to save bomb event:', error);
            throw error;
        }
    }
    
    async loadHistory() {
        try {
            const data = await fs.readFile(this.historyFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // ファイルが存在しない場合は新しい履歴を作成
                return {
                    events: [],
                    createdAt: Date.now(),
                    lastUpdated: Date.now()
                };
            }
            throw error;
        }
    }
    
    async saveHistory(history) {
        try {
            history.lastUpdated = Date.now();
            await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
        } catch (error) {
            console.error('Failed to save history:', error);
            throw error;
        }
    }
    
    generateEventId(bombData) {
        return `${bombData.bombType}_${bombData.world}_${bombData.timestamp}`;
    }
    
    async getRecentBombs(bombType, world, timeWindow) {
        try {
            const history = await this.loadHistory();
            const cutoffTime = Date.now() - timeWindow;
            
            return history.events.filter(event =>
                event.bombType === bombType &&
                event.world === world &&
                event.timestamp > cutoffTime
            );
            
        } catch (error) {
            console.error('Failed to get recent bombs:', error);
            return [];
        }
    }
    
    async getBombByTimestamp(timestamp) {
        try {
            const history = await this.loadHistory();
            return history.events.find(event => event.timestamp === timestamp);
        } catch (error) {
            console.error('Failed to get bomb by timestamp:', error);
            return null;
        }
    }
    
    async getStatistics(timeframe) {
        try {
            const history = await this.loadHistory();
            const timeframeMs = this.parseTimeframe(timeframe);
            const cutoffTime = Date.now() - timeframeMs;
            
            const relevantEvents = history.events.filter(event =>
                event.timestamp > cutoffTime
            );
            
            const stats = {
                totalBombs: relevantEvents.length,
                uniqueServers: new Set(relevantEvents.map(e => e.world)).size,
                averagePerHour: (relevantEvents.length / (timeframeMs / (1000 * 60 * 60))).toFixed(1),
                bombTypes: {},
                serverRegions: {},
                worlds: {},
                timeline: this.generateTimeline(relevantEvents, timeframeMs)
            };
            
            // タイプ別統計
            relevantEvents.forEach(event => {
                stats.bombTypes[event.bombType] = (stats.bombTypes[event.bombType] || 0) + 1;
                stats.serverRegions[event.serverRegion] = (stats.serverRegions[event.serverRegion] || 0) + 1;
                stats.worlds[event.world] = (stats.worlds[event.world] || 0) + 1;
            });
            
            return stats;
            
        } catch (error) {
            console.error('Failed to get statistics:', error);
            return {
                totalBombs: 0,
                uniqueServers: 0,
                averagePerHour: 0,
                bombTypes: {},
                serverRegions: {},
                worlds: {},
                timeline: []
            };
        }
    }
    
    parseTimeframe(timeframe) {
        const unit = timeframe.slice(-1);
        const value = parseInt(timeframe.slice(0, -1));
        
        switch (unit) {
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            case 'w': return value * 7 * 24 * 60 * 60 * 1000;
            default: return 24 * 60 * 60 * 1000; // デフォルト24時間
        }
    }
    
    generateTimeline(events, timeframeMs) {
        const bucketCount = Math.min(24, Math.floor(timeframeMs / (60 * 60 * 1000))); // 最大24個のバケット
        const bucketSize = timeframeMs / bucketCount;
        const timeline = new Array(bucketCount).fill(0);
        const currentTime = Date.now();
        
        events.forEach(event => {
            const bucketIndex = Math.floor((currentTime - event.timestamp) / bucketSize);
            if (bucketIndex >= 0 && bucketIndex < bucketCount) {
                timeline[bucketCount - 1 - bucketIndex]++;
            }
        });
        
        return timeline;
    }
    
    async cleanup() {
        try {
            const history = await this.loadHistory();
            const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            
            const originalCount = history.events.length;
            history.events = history.events.filter(event => event.timestamp > oneMonthAgo);
            const cleanedCount = originalCount - history.events.length;
            
            if (cleanedCount > 0) {
                await this.saveHistory(history);
                console.log(`Cleaned up ${cleanedCount} old bomb events`);
            }
            
            return cleanedCount;
            
        } catch (error) {
            console.error('Failed to cleanup bomb history:', error);
            return 0;
        }
    }
}

module.exports = BombHistory;