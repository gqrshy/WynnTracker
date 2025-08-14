const path = require('path');
const fs = require('fs');
require('dotenv').config();

class ConfigManager {
    constructor() {
        this.config = {};
        this.initialize();
    }

    initialize() {
        this.loadEnvironmentVariables();
        this.validateConfiguration();
        this.setDefaults();
    }

    loadEnvironmentVariables() {
        this.config = {
            discord: {
                token: process.env.DISCORD_TOKEN,
                clientId: process.env.DISCORD_CLIENT_ID,
                guildId: process.env.DISCORD_GUILD_ID,
                adminUsers: process.env.DISCORD_ADMIN_USERS ? 
                    process.env.DISCORD_ADMIN_USERS.split(',').map(id => id.trim()) : []
            },
            apis: {
                deepl: {
                    key: process.env.DEEPL_API_KEY,
                    baseUrl: 'https://api-free.deepl.com/v2'
                },
                wynncraft: {
                    baseUrl: 'https://api.wynncraft.com/v3',
                    timeout: 10000
                },
                wynnventory: {
                    key: process.env.WYNNVENTORY_API_KEY,
                    baseUrl: 'https://www.wynnventory.com/api',
                    timeout: 10000
                }
            },
            environment: {
                nodeEnv: process.env.NODE_ENV || 'development',
                logLevel: process.env.LOG_LEVEL || 'info'
            },
            cache: {
                ttl: parseInt(process.env.CACHE_TTL) || 300000,
                maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000
            },
            rateLimiting: {
                windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,
                maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10,
                // Command-specific rate limits
                commands: {
                    // Heavy API calls
                    guild: { windowMs: 60000, maxRequests: 3 },
                    wynn: { windowMs: 30000, maxRequests: 5 },
                    tm: { windowMs: 30000, maxRequests: 5 },
                    lr: { windowMs: 60000, maxRequests: 3 },
                    raid: { windowMs: 60000, maxRequests: 3 },
                    
                    // Light operations
                    help: { windowMs: 10000, maxRequests: 20 },
                    
                    // Admin operations
                    admin: { windowMs: 60000, maxRequests: 10 }
                },
                // API-specific rate limits (to respect external API limits)
                apis: {
                    wynncraft: { windowMs: 600000, maxRequests: 600 }, // 600 requests per 10 minutes
                    wynnventory: { windowMs: 60000, maxRequests: 100 }, // Conservative limit
                    deepl: { windowMs: 60000, maxRequests: 50 } // Conservative limit
                }
            },
            prediction: {
                updateInterval: parseInt(process.env.PREDICTION_UPDATE_INTERVAL) || 300000,
                confidenceThreshold: parseFloat(process.env.PREDICTION_CONFIDENCE_THRESHOLD) || 0.7,
                maxHistoryDays: 30
            },
            data: {
                directory: path.join(process.cwd(), 'data'),
                backup: {
                    enabled: true,
                    interval: 24 * 60 * 60 * 1000, // 24 hours
                    maxBackups: 7
                }
            },
            logging: {
                directory: path.join(process.cwd(), 'logs'),
                maxFileSize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5
            },
            translation: {
                defaultLanguage: 'en',
                supportedLanguages: ['en', 'ja'],
                cacheSize: 1000,
                batchSize: 10
            },
            guild: {
                name: process.env.GUILD_NAME || 'Your Guild Name',
                tag: process.env.GUILD_TAG || 'TAG'
            },
            server: {
                port: parseInt(process.env.SERVER_PORT) || 3000,
                timeout: parseInt(process.env.API_TIMEOUT) || 10000
            },
            api: {
                enabled: process.env.API_ENABLED === 'true',
                port: parseInt(process.env.API_PORT) || 3000,
                secretKey: process.env.API_SECRET_KEY,
                validTokens: process.env.SKJMOD_VALID_TOKENS ? 
                    process.env.SKJMOD_VALID_TOKENS.split(',').map(token => token.trim()) : [],
                rateLimit: {
                    windowMs: 60000,
                    max: 100
                }
            },
            channels: {
                na_bombbell: process.env.NA_BOMBBELL_CHANNEL,
                eu_bombbell: process.env.EU_BOMBBELL_CHANNEL,
                as_bombbell: process.env.AS_BOMBBELL_CHANNEL,
                sa_bombbell: process.env.SA_BOMBBELL_CHANNEL,
                general_bombbell: process.env.GENERAL_BOMBBELL_CHANNEL
            },
            features: {
                enableActionButtons: process.env.ENABLE_ACTION_BUTTONS === 'true',
                autoDeleteMessages: process.env.AUTO_DELETE_MESSAGES === 'true',
                enableStatistics: process.env.ENABLE_STATISTICS === 'true',
                enableHistory: process.env.ENABLE_HISTORY === 'true'
            }
        };
    }

    validateConfiguration() {
        const requiredFields = [
            'discord.token',
            'discord.clientId'
        ];

        const missing = requiredFields.filter(field => !this.get(field));
        
        if (missing.length > 0) {
            throw new Error(`Missing required configuration: ${missing.join(', ')}`);
        }

        if (this.config.apis.deepl.key && 
            this.config.apis.deepl.key !== '***REDACTED***' && 
            !this.isValidDeepLApiKey(this.config.apis.deepl.key)) {
            throw new Error('Invalid DeepL API key format');
        }

        if (this.config.cache.ttl < 0) {
            throw new Error('Cache TTL must be non-negative');
        }

        if (this.config.rateLimiting.maxRequests < 1) {
            throw new Error('Rate limit max requests must be at least 1');
        }
    }

    setDefaults() {
        this.ensureDirectoryExists(this.config.data.directory);
        this.ensureDirectoryExists(this.config.logging.directory);
        this.ensureDirectoryExists(path.join(this.config.data.directory, 'cache'));
        this.ensureDirectoryExists(path.join(this.config.data.directory, 'backups'));
    }

    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    get(path, defaultValue = null) {
        const keys = path.split('.');
        let current = this.config;

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }

        return current;
    }

    set(path, value) {
        const keys = path.split('.');
        let current = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }

    isDevelopment() {
        return this.get('environment.nodeEnv') === 'development';
    }

    isProduction() {
        return this.get('environment.nodeEnv') === 'production';
    }

    isTest() {
        return this.get('environment.nodeEnv') === 'test';
    }

    getDataPath(filename) {
        return path.join(this.get('data.directory'), filename);
    }

    getLogPath(filename) {
        return path.join(this.get('logging.directory'), filename);
    }

    getCachePath(filename) {
        return path.join(this.get('data.directory'), 'cache', filename);
    }

    getBackupPath(filename) {
        return path.join(this.get('data.directory'), 'backups', filename);
    }

    isValidDeepLApiKey(key) {
        return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(:fx)?$/i.test(key);
    }

    getApiTimeout(api) {
        return this.get(`apis.${api}.timeout`, 10000);
    }

    getApiBaseUrl(api) {
        return this.get(`apis.${api}.baseUrl`);
    }

    reload() {
        this.initialize();
    }

    exportConfig() {
        const safeConfig = JSON.parse(JSON.stringify(this.config));
        
        if (safeConfig.discord?.token) {
            safeConfig.discord.token = '***REDACTED***';
        }
        if (safeConfig.apis?.deepl?.key) {
            safeConfig.apis.deepl.key = '***REDACTED***';
        }
        if (safeConfig.apis?.wynnventory?.key) {
            safeConfig.apis.wynnventory.key = '***REDACTED***';
        }
        if (safeConfig.api?.secretKey) {
            safeConfig.api.secretKey = '***REDACTED***';
        }
        if (safeConfig.api?.validTokens) {
            safeConfig.api.validTokens = safeConfig.api.validTokens.map(() => '***REDACTED***');
        }

        return safeConfig;
    }

    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
}

module.exports = ConfigManager;