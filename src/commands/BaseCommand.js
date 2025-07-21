const { SlashCommandBuilder } = require('discord.js');
const { ErrorHandler } = require('../utils/ErrorHandler');
const RateLimiter = require('../utils/RateLimiter');
const ConfigManager = require('../config/ConfigManager');

class BaseCommand {
    constructor(options = {}) {
        this.name = options.name || 'unknown';
        this.description = options.description || 'No description provided';
        this.category = options.category || 'General';
        this.permissions = options.permissions || [];
        this.cooldown = options.cooldown || 3000; // 3 seconds default
        this.adminOnly = options.adminOnly || false;
        this.guildOnly = options.guildOnly || false;
        this.options = options;
        
        this.configManager = ConfigManager.getInstance();
        this.errorHandler = new ErrorHandler();
        this.rateLimiter = new RateLimiter();
        
        this.data = this.getSlashCommandData ? this.getSlashCommandData() : this.buildSlashCommand();
    }

    buildSlashCommand() {
        const command = new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
        
        this.addOptions(command);
        
        return command;
    }

    addOptions(command) {
        // Override in subclasses to add specific options
    }

    async execute(interaction) {
        try {
            // Check if command is disabled
            if (this.isDisabled()) {
                return await this.sendError(interaction, 'This command is currently disabled.');
            }

            // Check guild-only restriction
            if (this.guildOnly && !interaction.guild) {
                return await this.sendError(interaction, 'This command can only be used in a server.');
            }

            // Check admin-only restriction
            if (this.adminOnly && !this.isAdmin(interaction.user.id)) {
                return await this.sendError(interaction, 'This command is restricted to administrators.');
            }

            // Check permissions
            if (this.permissions.length > 0 && !this.hasPermissions(interaction)) {
                return await this.sendError(interaction, 'You don\'t have the required permissions to use this command.');
            }

            // Check rate limit
            const rateLimitResult = await this.rateLimiter.checkCommandLimit(
                interaction.user.id,
                this.name,
                { windowMs: this.cooldown, maxRequests: 1 }
            );

            if (!rateLimitResult.allowed) {
                return await this.sendError(interaction, 
                    `Command on cooldown. Please wait ${rateLimitResult.retryAfter} seconds.`
                );
            }

            // Execute the command
            await this.run(interaction);
            
        } catch (error) {
            console.error(`[BaseCommand] Command execution error for ${this.name}:`, {
                error: error.message,
                stack: error.stack,
                name: error.name,
                type: typeof error,
                commandName: this.name,
                userId: interaction.user.id,
                guildId: interaction.guild?.id
            });
            
            const errorResponse = this.errorHandler.handle(error, {
                command: this.name,
                userId: interaction.user.id,
                guildId: interaction.guild?.id
            });
            
            console.error(`[BaseCommand] ErrorHandler response:`, {
                type: errorResponse.type,
                message: errorResponse.message,
                details: errorResponse.details
            });
            
            await this.sendError(interaction, errorResponse.message);
        }
    }

    async run(interaction) {
        // Override in subclasses
        await this.sendReply(interaction, 'Command not implemented yet.');
    }

    async sendReply(interaction, content, options = {}) {
        const replyOptions = {
            content: typeof content === 'string' ? content : undefined,
            embeds: content?.embeds || options.embeds,
            components: options.components,
            files: options.files,
            flags: options.ephemeral ? 64 : undefined // MessageFlags.Ephemeral = 64
        };

        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(replyOptions);
        } else {
            return await interaction.reply(replyOptions);
        }
    }

    async sendError(interaction, message, options = {}) {
        const errorEmbed = {
            color: 0xff0000,
            title: '❌ Error',
            description: message,
            timestamp: new Date().toISOString()
        };

        return await this.sendReply(interaction, { embeds: [errorEmbed] }, {
            ephemeral: true,
            ...options
        });
    }

    async sendSuccess(interaction, message, options = {}) {
        const successEmbed = {
            color: 0x00ff00,
            title: '✅ Success',
            description: message,
            timestamp: new Date().toISOString()
        };

        return await this.sendReply(interaction, { embeds: [successEmbed] }, options);
    }

    async sendInfo(interaction, title, description, options = {}) {
        const infoEmbed = {
            color: 0x0099ff,
            title: title || 'ℹ️ Information',
            description,
            timestamp: new Date().toISOString(),
            ...options.embedOptions
        };

        return await this.sendReply(interaction, { embeds: [infoEmbed] }, options);
    }

    async sendWarning(interaction, message, options = {}) {
        const warningEmbed = {
            color: 0xffaa00,
            title: '⚠️ Warning',
            description: message,
            timestamp: new Date().toISOString()
        };

        return await this.sendReply(interaction, { embeds: [warningEmbed] }, options);
    }

    async deferReply(interaction, options = {}) {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferReply(options);
        }
    }

    async editReply(interaction, content, options = {}) {
        const editOptions = {
            content: typeof content === 'string' ? content : undefined,
            embeds: content?.embeds || options.embeds,
            components: options.components,
            files: options.files
        };

        return await interaction.editReply(editOptions);
    }

    hasPermissions(interaction) {
        if (this.permissions.length === 0) {
            return true;
        }

        if (!interaction.guild) {
            return false;
        }

        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!member) {
            return false;
        }

        return this.permissions.every(permission => 
            member.permissions.has(permission)
        );
    }

    isAdmin(userId) {
        const adminUsers = this.configManager.get('discord.adminUsers', []);
        return adminUsers.includes(userId);
    }

    isDisabled() {
        const disabledCommands = this.configManager.get('discord.disabledCommands', []);
        return disabledCommands.includes(this.name);
    }

    getOption(interaction, name, required = false) {
        const option = interaction.options.get(name);
        
        if (required && !option) {
            throw new Error(`Required option '${name}' not provided.`);
        }
        
        return option ? option.value : null;
    }

    getString(interaction, name, required = false) {
        return this.getOption(interaction, name, required);
    }

    getInteger(interaction, name, required = false) {
        const value = this.getOption(interaction, name, required);
        return value !== null ? parseInt(value) : null;
    }

    getNumber(interaction, name, required = false) {
        const value = this.getOption(interaction, name, required);
        return value !== null ? parseFloat(value) : null;
    }

    getBoolean(interaction, name, required = false) {
        const value = this.getOption(interaction, name, required);
        return value !== null ? Boolean(value) : null;
    }

    getUser(interaction, name, required = false) {
        const option = interaction.options.get(name);
        
        if (required && !option) {
            throw new Error(`Required option '${name}' not provided.`);
        }
        
        return option ? option.user : null;
    }

    getChannel(interaction, name, required = false) {
        const option = interaction.options.get(name);
        
        if (required && !option) {
            throw new Error(`Required option '${name}' not provided.`);
        }
        
        return option ? option.channel : null;
    }

    getRole(interaction, name, required = false) {
        const option = interaction.options.get(name);
        
        if (required && !option) {
            throw new Error(`Required option '${name}' not provided.`);
        }
        
        return option ? option.role : null;
    }

    createProgressBar(current, max, length = 20) {
        if (max === 0) return '▫'.repeat(length);
        
        const percentage = Math.max(0, Math.min(1, current / max));
        const filledLength = Math.round(length * percentage);
        const emptyLength = length - filledLength;
        
        return '▰'.repeat(filledLength) + '▱'.repeat(emptyLength);
    }

    formatNumber(number) {
        if (number >= 1000000) {
            return (number / 1000000).toFixed(1) + 'M';
        } else if (number >= 1000) {
            return (number / 1000).toFixed(1) + 'K';
        } else {
            return number.toString();
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${remainingSeconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${remainingSeconds}s`;
        }
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) {
            return text;
        }
        
        return text.substring(0, maxLength - 3) + '...';
    }

    createSelectMenu(customId, placeholder, options, maxValues = 1) {
        return {
            type: 1,
            components: [{
                type: 3,
                customId,
                placeholder,
                maxValues,
                options
            }]
        };
    }

    createButtonRow(buttons) {
        return {
            type: 1,
            components: buttons.map(button => ({
                type: 2,
                style: button.style || 1,
                label: button.label,
                customId: button.customId,
                emoji: button.emoji,
                disabled: button.disabled || false
            }))
        };
    }

    static create(options) {
        return new this(options);
    }
}

module.exports = BaseCommand;