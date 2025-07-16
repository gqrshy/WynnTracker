const fs = require('fs');
const path = require('path');

/**
 * 高性能なJSONファイルキャッシュシステム
 * ファイルの変更を検知して自動更新する
 */
class DataCache {
    constructor() {
        this.cache = new Map();
        this.fileModTimes = new Map();
        this.dataDir = path.join(__dirname, '..', 'data');
    }

    /**
     * JSONファイルからデータを取得（キャッシュ付き）
     * @param {string} filename - ファイル名（拡張子含む）
     * @param {boolean} forceReload - 強制的に再読み込み
     * @returns {Object|null} パースされたJSONデータ
     */
    getData(filename, forceReload = false) {
        const filePath = path.join(this.dataDir, filename);
        
        try {
            // ファイルの存在確認
            if (!fs.existsSync(filePath)) {
                console.error(`[ERROR] File not found: ${filePath}`);
                return null;
            }

            // 現在のファイル更新時刻を取得
            const currentModTime = fs.statSync(filePath).mtime.getTime();
            const cachedModTime = this.fileModTimes.get(filename);

            // キャッシュが無効または更新が必要な場合
            if (forceReload || !this.cache.has(filename) || cachedModTime !== currentModTime) {
                console.log(`[INFO] Loading/Reloading data from: ${filename}`);
                
                const rawData = fs.readFileSync(filePath, 'utf8');
                const parsedData = JSON.parse(rawData);
                
                // キャッシュに保存
                this.cache.set(filename, parsedData);
                this.fileModTimes.set(filename, currentModTime);
                
                return parsedData;
            }

            // キャッシュから取得
            return this.cache.get(filename);
            
        } catch (error) {
            console.error(`[ERROR] Failed to load data from ${filename}:`, error);
            return null;
        }
    }

    /**
     * 静的データ（aspects, gambits）をメモリにプリロード
     */
    preloadStaticData() {
        const staticFiles = [
            'aspects.json',
            'gambits.json'
        ];

        staticFiles.forEach(filename => {
            this.getData(filename);
        });

        console.log('[INFO] Static data preloaded into memory cache');
    }

    /**
     * 特定のファイルのキャッシュをクリア
     * @param {string} filename - ファイル名
     */
    clearCache(filename) {
        if (filename) {
            this.cache.delete(filename);
            this.fileModTimes.delete(filename);
            console.log(`[INFO] Cache cleared for: ${filename}`);
        } else {
            this.cache.clear();
            this.fileModTimes.clear();
            console.log('[INFO] All cache cleared');
        }
    }

    /**
     * キャッシュの統計情報を取得
     * @returns {Object} キャッシュの統計
     */
    getCacheStats() {
        return {
            cachedFiles: Array.from(this.cache.keys()),
            cacheSize: this.cache.size,
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * aspects.jsonから特定のアスペクトの説明を取得
     * @param {string} aspectName - アスペクト名
     * @returns {Object|null} アスペクトの説明（jaとen）
     */
    getAspectDescription(aspectName) {
        const aspectsData = this.getData('aspects.json');
        if (!aspectsData || !aspectsData.aspects) {
            return null;
        }

        return aspectsData.aspects[aspectName] || null;
    }

    /**
     * gambits.jsonから特定のGambitの説明を取得
     * @param {string} gambitText - Gambitのテキスト
     * @returns {Object|null} Gambitの説明（jaとen）
     */
    getGambitDescription(gambitText) {
        const gambitsData = this.getData('gambits.json');
        if (!gambitsData || !gambitsData.gambits) {
            return null;
        }

        return gambitsData.gambits[gambitText] || null;
    }
}

// シングルトンインスタンス
const dataCache = new DataCache();

module.exports = dataCache;