const fs = require('fs');
const path = require('path');

/**
 * 設定管理システム
 */
class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', 'config.json');
        this.config = this.loadConfig();
        this.constants = {
            // レート制限設定
            RATE_LIMITS: {
                'raid_aspectpool': { interval: 60000, uses: 1 },
                'lr_lootpool': { interval: 30000, uses: 2 },
                'lr_mythranking': { interval: 300000, uses: 1 },
                'tm_search': { interval: 30000, uses: 1 },
                'wynn_stats': { interval: 10000, uses: 3 },
                'guild_ranking': { interval: 30000, uses: 1 }
            },
            // キャッシュ設定
            CACHE_SETTINGS: {
                'static_data': 3600000, // 1時間
                'api_data': 300000,     // 5分
                'price_data': 600000,   // 10分
                'player_data': 1800000  // 30分
            },
            // API設定
            API_TIMEOUTS: {
                'wynnventory': 10000,
                'wynncraft': 8000,
                'default': 5000
            },
            // 表示設定
            DISPLAY_LIMITS: {
                'embed_field_limit': 1024,
                'embed_description_limit': 4096,
                'embed_fields_max': 25,
                'listings_display': 5,
                'progress_bar_length': 20
            }
        };
    }

    /**
     * 設定ファイルを読み込む
     * @returns {Object} 設定オブジェクト
     */
    loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            console.error('[ERROR] Config file loading failed:', error);
            return {};
        }
    }

    /**
     * 設定値を取得
     * @param {string} key - 設定キー
     * @param {*} defaultValue - デフォルト値
     * @returns {*} 設定値
     */
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }

    /**
     * 定数を取得
     * @param {string} category - カテゴリ
     * @param {string} key - キー
     * @returns {*} 定数値
     */
    getConstant(category, key = null) {
        if (key) {
            return this.constants[category]?.[key];
        }
        return this.constants[category];
    }

    /**
     * レート制限設定を取得
     * @param {string} commandName - コマンド名
     * @returns {Object} レート制限設定
     */
    getRateLimit(commandName) {
        return this.constants.RATE_LIMITS[commandName] || { interval: 30000, uses: 1 };
    }

    /**
     * APIタイムアウト設定を取得
     * @param {string} apiName - API名
     * @returns {number} タイムアウト値（ミリ秒）
     */
    getApiTimeout(apiName) {
        return this.constants.API_TIMEOUTS[apiName] || this.constants.API_TIMEOUTS.default;
    }

    /**
     * キャッシュ設定を取得
     * @param {string} dataType - データタイプ
     * @returns {number} キャッシュ時間（ミリ秒）
     */
    getCacheDuration(dataType) {
        return this.constants.CACHE_SETTINGS[dataType] || this.constants.CACHE_SETTINGS.api_data;
    }

    /**
     * 表示制限を取得
     * @param {string} limitType - 制限タイプ
     * @returns {number} 制限値
     */
    getDisplayLimit(limitType) {
        return this.constants.DISPLAY_LIMITS[limitType];
    }

    /**
     * 設定の検証
     * @returns {Object} 検証結果
     */
    validate() {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        // 必須設定のチェック
        const requiredKeys = ['token', 'clientId', 'guildId', 'wynnventoryApiKey'];
        for (const key of requiredKeys) {
            if (!this.get(key)) {
                result.valid = false;
                result.errors.push(`Missing required config: ${key}`);
            }
        }

        // APIキーの形式チェック
        const apiKey = this.get('wynnventoryApiKey');
        if (apiKey && (apiKey.length < 10 || !apiKey.includes('-'))) {
            result.warnings.push('Wynnventory API key format may be incorrect');
        }

        return result;
    }

    /**
     * 設定情報を表示
     * @returns {string} 設定情報
     */
    getInfo() {
        const validation = this.validate();
        const info = {
            configFile: this.configPath,
            validation: validation.valid ? 'VALID' : 'INVALID',
            errors: validation.errors,
            warnings: validation.warnings,
            rateLimits: Object.keys(this.constants.RATE_LIMITS).length,
            cacheSettings: Object.keys(this.constants.CACHE_SETTINGS).length,
            apiTimeouts: Object.keys(this.constants.API_TIMEOUTS).length
        };

        return JSON.stringify(info, null, 2);
    }
}

// シングルトンインスタンス
const configManager = new ConfigManager();

module.exports = configManager;