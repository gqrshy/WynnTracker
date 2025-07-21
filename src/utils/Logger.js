const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
    constructor() {
        this.logger = null;
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;

        // Ensure logs directory exists
        const logsDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Console format
        const consoleFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, stack }) => {
                return `${timestamp} [${level}] ${stack || message}`;
            })
        );

        // File format
        const fileFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.json()
        );

        // Configure transports
        const transports = [
            new winston.transports.Console({
                format: consoleFormat,
                level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
            }),
            new winston.transports.File({
                filename: path.join(logsDir, 'error.log'),
                level: 'error',
                format: fileFormat,
                maxsize: 10485760, // 10MB
                maxFiles: 5
            }),
            new winston.transports.File({
                filename: path.join(logsDir, 'combined.log'),
                format: fileFormat,
                maxsize: 10485760, // 10MB
                maxFiles: 5
            })
        ];

        this.logger = winston.createLogger({
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            format: fileFormat,
            transports,
            exitOnError: false
        });

        this.initialized = true;
    }

    getLogger() {
        if (!this.initialized) {
            this.initialize();
        }
        return this.logger;
    }

    // Convenience methods
    error(message, meta = {}) {
        this.getLogger().error(message, meta);
    }

    warn(message, meta = {}) {
        this.getLogger().warn(message, meta);
    }

    info(message, meta = {}) {
        this.getLogger().info(message, meta);
    }

    debug(message, meta = {}) {
        this.getLogger().debug(message, meta);
    }

    // Bot-specific logging methods
    botStart() {
        this.info('🚀 WynnTracker Revival starting up');
    }

    botReady(guilds, users) {
        this.info(`🤖 Bot is ready - Serving ${guilds} guilds and ${users} users`);
    }

    commandExecution(commandName, userId, guildId, success = true) {
        const level = success ? 'info' : 'warn';
        this.getLogger().log(level, `Command executed: ${commandName}`, {
            command: commandName,
            userId,
            guildId,
            success
        });
    }

    serviceInitialization(serviceName, success = true) {
        const level = success ? 'info' : 'error';
        const message = success ? 
            `✅ Service initialized: ${serviceName}` : 
            `❌ Service failed to initialize: ${serviceName}`;
        this.getLogger().log(level, message, { service: serviceName, success });
    }

    apiCall(apiName, endpoint, success = true, duration = null) {
        const level = success ? 'debug' : 'warn';
        this.getLogger().log(level, `API call: ${apiName}${endpoint}`, {
            api: apiName,
            endpoint,
            success,
            duration
        });
    }

    healthCheck(results) {
        this.info('🏥 Health check completed', results);
    }

    shutdown() {
        this.info('🔄 WynnTracker Revival shutting down');
    }

    // Static instance
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
}

module.exports = Logger;