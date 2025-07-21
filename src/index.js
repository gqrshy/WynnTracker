const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const ConfigManager = require('./config/ConfigManager');
const { ErrorHandler } = require('./utils/ErrorHandler');
const RateLimiter = require('./utils/RateLimiter');

// Services
const PlayerService = require('./services/PlayerService');
const GuildService = require('./services/GuildService');
const AnniService = require('./services/AnniService');
const AnnihilationService = require('./services/AnnihilationService');
const TranslationService = require('./services/TranslationService');
const MarketService = require('./services/MarketService');

class WynnTrackerBot {
    constructor() {
        this.config = ConfigManager.getInstance();
        this.errorHandler = new ErrorHandler();
        this.rateLimiter = new RateLimiter();
        
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions
            ]
        });
        
        this.commands = new Collection();
        this.services = new Map();
        this.ready = false;
        this.startTime = new Date();
        
        this.setupEventHandlers();
    }

    async initialize() {
        try {
            console.log('🚀 Starting WynnTracker Revival...');
            
            // Initialize services
            await this.initializeServices();
            
            // Load commands
            await this.loadCommands();
            
            // Connect to Discord
            await this.client.login(this.config.get('discord.token'));
            
            console.log('✅ WynnTracker Revival initialized successfully!');
            
        } catch (error) {
            console.error('❌ Failed to initialize WynnTracker Revival:', error);
            process.exit(1);
        }
    }

    async initializeServices() {
        console.log('📦 Initializing services...');
        
        const services = [
            { name: 'player', service: PlayerService },
            { name: 'guild', service: GuildService },
            { name: 'anni', service: AnniService },
            { name: 'annihilation', service: AnnihilationService },
            { name: 'translation', service: TranslationService },
            { name: 'market', service: MarketService }
        ];
        
        for (const { name, service } of services) {
            try {
                const instance = new service();
                await instance.initialize();
                this.services.set(name, instance);
                console.log(`  ✅ ${name} service initialized`);
            } catch (error) {
                console.error(`  ❌ Failed to initialize ${name} service:`, error.message);
                // Continue with other services
            }
        }
    }

    async loadCommands() {
        console.log('🔧 Loading commands...');
        
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath)
            .filter(file => file.endsWith('.js') && !file.startsWith('Base'));
        
        for (const file of commandFiles) {
            try {
                const filePath = path.join(commandsPath, file);
                const CommandClass = require(filePath);
                
                if (typeof CommandClass.create === 'function') {
                    const command = CommandClass.create();
                    this.commands.set(command.data.name, command);
                    console.log(`  ✅ Loaded command: ${command.data.name}`);
                } else {
                    console.warn(`  ⚠️ Command ${file} does not export a create function`);
                }
            } catch (error) {
                console.error(`  ❌ Failed to load command ${file}:`, error.message);
            }
        }
        
        console.log(`📋 Loaded ${this.commands.size} commands`);
    }

    setupEventHandlers() {
        this.client.once('ready', () => this.onReady());
        this.client.on('interactionCreate', (interaction) => this.onInteractionCreate(interaction));
        this.client.on('messageCreate', (message) => this.onMessageCreate(message));
        this.client.on('messageReactionAdd', (reaction, user) => this.onMessageReactionAdd(reaction, user));
        this.client.on('messageReactionRemove', (reaction, user) => this.onMessageReactionRemove(reaction, user));
        this.client.on('error', (error) => this.onError(error));
        this.client.on('warn', (warning) => this.onWarn(warning));
        
        // Graceful shutdown
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }

    async onReady() {
        console.log(`🤖 ${this.client.user.tag} is online!`);
        console.log(`📊 Serving ${this.client.guilds.cache.size} guilds`);
        console.log(`👥 Serving ${this.client.users.cache.size} users`);
        
        this.ready = true;
        
        // Set global reference for commands to access services
        global.wynnTrackerBot = this;
        
        // Set bot status
        this.client.user.setActivity('Wynncraft data | /help', { type: ActivityType.Watching });
        
        // Start periodic tasks
        this.startPeriodicTasks();
    }

    async onInteractionCreate(interaction) {
        if (!interaction.isChatInputCommand()) return;
        
        const command = this.commands.get(interaction.commandName);
        
        if (!command) {
            console.warn(`Unknown command: ${interaction.commandName}`);
            return;
        }
        
        try {
            await command.execute(interaction);
        } catch (error) {
            const errorResponse = this.errorHandler.handle(error, {
                command: interaction.commandName,
                userId: interaction.user.id,
                guildId: interaction.guild?.id
            });
            
            console.error('Command execution error:', error);
            
            const reply = {
                content: `❌ ${errorResponse.message}`,
                ephemeral: true
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }

    async onMessageCreate(message) {
        if (message.author.bot) return;
        
        // Handle auto-translation directly through service
        const translationService = this.services.get('translation');
        if (translationService) {
            try {
                await translationService.handleMessageAutoTranslate(message);
            } catch (error) {
                // Silently fail auto-translation
                console.error('Auto-translation error:', error.message);
            }
        }
    }

    async onMessageReactionAdd(reaction, user) {
        if (user.bot) return;
        
        const translationService = this.services.get('translation');
        if (translationService) {
            try {
                // Handle reaction sync for auto-translated messages
                await translationService.handleReactionAdd(reaction, user);
                
                // Handle manual translation via flag reactions (only for JP/US flags due to API limits)
                const emojiToLanguage = {
                    '🇺🇸': 'EN-US',
                    '🇯🇵': 'JA'
                };
                
                const targetLang = emojiToLanguage[reaction.emoji.name];
                if (targetLang && reaction.message.content) {
                    const translation = await translationService.translateText(
                        reaction.message.content,
                        targetLang
                    );
                    
                    const embed = {
                        color: 0x0099ff,
                        description: `\`${targetLang}\` ${translation.translatedText}`,
                        footer: {
                            text: `Requested by ${user.username}`,
                            iconURL: user.displayAvatarURL()
                        }
                    };
                    
                    await reaction.message.reply({ embeds: [embed] });
                }
            } catch (error) {
                // Silently fail reaction translation
                console.error('Reaction handling error:', error.message);
            }
        }
    }

    async onMessageReactionRemove(reaction, user) {
        if (user.bot) return;
        
        const translationService = this.services.get('translation');
        if (translationService) {
            try {
                await translationService.handleReactionRemove(reaction, user);
            } catch (error) {
                // Silently fail reaction sync
                console.error('Reaction remove error:', error.message);
            }
        }
    }

    onError(error) {
        console.error('Discord client error:', error);
        this.errorHandler.handle(error, { context: 'client' });
    }

    onWarn(warning) {
        console.warn('Discord client warning:', warning);
    }

    startPeriodicTasks() {
        // Update bot status every 5 minutes
        setInterval(() => {
            const activities = [
                'Wynncraft data | /help',
                `${this.client.guilds.cache.size} guilds | /help`,
                `${this.client.users.cache.size} users | /help`,
                'Annihilation predictions | /help',
                'Guild rankings | /help'
            ];
            
            const activity = activities[Math.floor(Math.random() * activities.length)];
            this.client.user.setActivity(activity, { type: ActivityType.Watching });
        }, 5 * 60 * 1000);
        
        // Health check every hour
        setInterval(() => {
            this.performHealthCheck();
        }, 60 * 60 * 1000);
        
        // Cleanup old data every 24 hours
        setInterval(() => {
            this.performCleanup();
        }, 24 * 60 * 60 * 1000);
    }

    async performHealthCheck() {
        console.log('🏥 Performing health check...');
        
        const health = {
            bot: {
                uptime: Date.now() - this.startTime,
                guilds: this.client.guilds.cache.size,
                users: this.client.users.cache.size,
                commands: this.commands.size,
                ready: this.ready
            },
            services: {}
        };
        
        for (const [name, service] of this.services) {
            try {
                health.services[name] = await service.healthCheck();
            } catch (error) {
                health.services[name] = {
                    healthy: false,
                    error: error.message
                };
            }
        }
        
        console.log('📊 Health check completed');
        
        // Log any unhealthy services
        for (const [name, serviceHealth] of Object.entries(health.services)) {
            if (!serviceHealth.healthy) {
                console.warn(`⚠️ Service ${name} is unhealthy: ${serviceHealth.error}`);
            }
        }
    }

    async performCleanup() {
        console.log('🧹 Performing cleanup...');
        
        // Clear rate limiter caches
        this.rateLimiter.clear();
        
        // Cleanup services
        for (const [name, service] of this.services) {
            try {
                if (typeof service.cleanup === 'function') {
                    await service.cleanup();
                }
            } catch (error) {
                console.error(`Error cleaning up ${name} service:`, error.message);
            }
        }
        
        console.log('✅ Cleanup completed');
    }

    getService(name) {
        return this.services.get(name);
    }

    getCommand(name) {
        return this.commands.get(name);
    }

    getStats() {
        return {
            bot: {
                uptime: Date.now() - this.startTime,
                guilds: this.client.guilds.cache.size,
                users: this.client.users.cache.size,
                commands: this.commands.size,
                ready: this.ready,
                startTime: this.startTime
            },
            services: Array.from(this.services.keys()),
            commands: Array.from(this.commands.keys())
        };
    }

    async shutdown() {
        console.log('🔄 Shutting down WynnTracker Revival...');
        
        this.ready = false;
        
        // Cleanup services
        for (const [name, service] of this.services) {
            try {
                if (typeof service.cleanup === 'function') {
                    await service.cleanup();
                }
            } catch (error) {
                console.error(`Error during ${name} service cleanup:`, error.message);
            }
        }
        
        // Destroy Discord client
        if (this.client) {
            this.client.destroy();
        }
        
        console.log('👋 WynnTracker Revival shut down successfully');
        process.exit(0);
    }
}

// Initialize and start the bot
const bot = new WynnTrackerBot();
bot.initialize().catch(error => {
    console.error('Failed to start bot:', error);
    process.exit(1);
});

module.exports = WynnTrackerBot;