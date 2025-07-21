const BaseCommand = require('./BaseCommand');
const AnniService = require('../services/AnniService');
const { SlashCommandBuilder } = require('discord.js');

class AnniCommand extends BaseCommand {
    constructor() {
        super({
            name: 'anni',
            description: 'Annihilation event tracking and prediction',
            category: 'Wynncraft',
            cooldown: 3000, // 3 seconds
            adminOnly: true // Admin only for prediction management
        });
        
        this.anniService = null;
    }

    async init() {
        this.anniService = new AnniService();
        await this.anniService.initialize();
    }

    addOptions(command) {
        command.addSubcommand(subcommand =>
            subcommand.setName('timer')
                .setDescription('Show current Annihilation countdown timers')
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('Filter by server')
                        .addChoices(
                            { name: 'Asia', value: 'asia' },
                            { name: 'North America', value: 'na' },
                            { name: 'Europe', value: 'eu' }
                        )
                )
                .addStringOption(option =>
                    option.setName('timezone')
                        .setDescription('Display timezone')
                        .addChoices(
                            { name: 'UTC', value: 'UTC' },
                            { name: 'JST', value: 'JST' },
                            { name: 'Both', value: 'both' }
                        )
                )
        );
        
        command.addSubcommand(subcommand =>
            subcommand.setName('predict')
                .setDescription('Generate new Annihilation predictions')
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('Server to predict for')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Asia', value: 'asia' },
                            { name: 'North America', value: 'na' },
                            { name: 'Europe', value: 'eu' }
                        )
                )
                .addStringOption(option =>
                    option.setName('method')
                        .setDescription('Prediction method')
                        .addChoices(
                            { name: 'ARIMA', value: 'arima' },
                            { name: 'Statistical', value: 'statistical' },
                            { name: 'Hybrid', value: 'hybrid' }
                        )
                )
        );
        
        command.addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add a new Annihilation event')
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('Server name')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Asia', value: 'asia' },
                            { name: 'North America', value: 'na' },
                            { name: 'Europe', value: 'eu' }
                        )
                )
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('Event time (YYYY-MM-DD HH:MM or relative like "2h 30m")')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('confidence')
                        .setDescription('Confidence level (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                )
                .addStringOption(option =>
                    option.setName('source')
                        .setDescription('Source of information')
                        .addChoices(
                            { name: 'Manual', value: 'manual' },
                            { name: 'Community', value: 'community' },
                            { name: 'Prediction', value: 'prediction' }
                        )
                )
                .addBooleanOption(option =>
                    option.setName('downtime')
                        .setDescription('Is this a downtime event?')
                )
        );
        
        command.addSubcommand(subcommand =>
            subcommand.setName('verify')
                .setDescription('Verify an Annihilation event occurred')
                .addStringOption(option =>
                    option.setName('event_id')
                        .setDescription('Event ID to verify')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('actual_time')
                        .setDescription('Actual event time (YYYY-MM-DD HH:MM)')
                )
        );
        
        command.addSubcommand(subcommand =>
            subcommand.setName('history')
                .setDescription('Show recent Annihilation events')
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('Filter by server')
                        .addChoices(
                            { name: 'Asia', value: 'asia' },
                            { name: 'North America', value: 'na' },
                            { name: 'Europe', value: 'eu' }
                        )
                )
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Number of days to look back (default: 7)')
                        .setMinValue(1)
                        .setMaxValue(30)
                )
                .addBooleanOption(option =>
                    option.setName('verified_only')
                        .setDescription('Show only verified events')
                )
        );
        
        command.addSubcommand(subcommand =>
            subcommand.setName('stats')
                .setDescription('Show Annihilation event statistics')
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('Filter by server')
                        .addChoices(
                            { name: 'Asia', value: 'asia' },
                            { name: 'North America', value: 'na' },
                            { name: 'Europe', value: 'eu' }
                        )
                )
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Number of days to analyze (default: 30)')
                        .setMinValue(7)
                        .setMaxValue(90)
                )
        );
        
        command.addSubcommand(subcommand =>
            subcommand.setName('create_timer')
                .setDescription('Create a countdown timer for an event')
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('Server name')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Asia', value: 'asia' },
                            { name: 'North America', value: 'na' },
                            { name: 'Europe', value: 'eu' }
                        )
                )
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('Event time (YYYY-MM-DD HH:MM)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('notify_roles')
                        .setDescription('Role IDs to notify (comma-separated)')
                )
                .addStringOption(option =>
                    option.setName('notify_times')
                        .setDescription('Minutes before event to notify (comma-separated, default: 60,30,15,5,1)')
                )
        );
    }

    async run(interaction) {
        if (!this.anniService) {
            await this.init();
        }

        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'timer':
                return await this.handleTimer(interaction);
            case 'predict':
                return await this.handlePredict(interaction);
            case 'add':
                return await this.handleAdd(interaction);
            case 'verify':
                return await this.handleVerify(interaction);
            case 'history':
                return await this.handleHistory(interaction);
            case 'stats':
                return await this.handleStats(interaction);
            case 'create_timer':
                return await this.handleCreateTimer(interaction);
            default:
                return await this.sendError(interaction, 'Unknown subcommand.');
        }
    }

    async handleTimer(interaction) {
        const server = this.getString(interaction, 'server');
        const timezone = this.getString(interaction, 'timezone') || 'UTC';
        
        await this.deferReply(interaction);

        try {
            const predictions = await this.anniService.getPredictions(server, {
                onlyUpcoming: true,
                limit: 10
            });
            
            const embed = await this.createTimerEmbed(predictions, timezone);
            await this.editReply(interaction, { embeds: [embed] });
            
        } catch (error) {
            await this.editReply(interaction, 
                `Failed to fetch timers: ${error.message}`
            );
        }
    }

    async handlePredict(interaction) {
        const server = this.getString(interaction, 'server', true);
        const method = this.getString(interaction, 'method') || 'hybrid';
        
        await this.deferReply(interaction);

        try {
            // 予測を更新
            const predictions = await this.anniService.updatePredictions(server);
            
            // 予測を取得
            const allPredictions = await this.anniService.getPredictions(server);
            
            console.log(`[DEBUG] Generated predictions: ${predictions.length}, Retrieved predictions: ${allPredictions.length}`);
            
            // 関連する予測をフィルタリング
            const relevantPredictions = allPredictions.filter(p => 
                !method || method === 'hybrid' || p.method.toLowerCase() === method.toLowerCase()
            );
            
            if (relevantPredictions.length === 0) {
                await this.editReply(interaction, 
                    `No predictions available for ${server}. Need at least 3 events to generate predictions.`
                );
                return;
            }
            
            const embed = await this.createPredictionEmbed(relevantPredictions, server);
            await this.editReply(interaction, { embeds: [embed] });
            
        } catch (error) {
            console.error('Prediction error:', error);
            await this.editReply(interaction, 
                `Failed to generate predictions: ${error.message}`
            );
        }
    }

    async handleAdd(interaction) {
        const server = this.getString(interaction, 'server', true);
        const timeStr = this.getString(interaction, 'time', true);
        const confidence = this.getInteger(interaction, 'confidence') || 100;
        const source = this.getString(interaction, 'source') || 'manual';
        const downtime = this.getBoolean(interaction, 'downtime') || false;
        
        await this.deferReply(interaction);

        try {
            const timestamp = this.parseTimeString(timeStr);
            
            const eventData = {
                server,
                timestamp,
                confidence,
                source,
                downtime
            };
            
            const event = await this.anniService.addEvent(eventData);
            
            const embed = {
                color: 0x00ff00,
                title: '✅ Event Added',
                description: `Added new Annihilation event for **${server}**`,
                fields: [
                    {
                        name: 'Event Details',
                        value: [
                            `**Time:** ${event.getFormattedTime('UTC')} UTC`,
                            `**Confidence:** ${event.confidence}%`,
                            `**Source:** ${event.source}`,
                            `**Downtime:** ${event.downtime ? 'Yes' : 'No'}`
                        ].join('\n'),
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: `Event ID: ${event.id}`
                }
            };
            
            await this.editReply(interaction, { embeds: [embed] });
            
        } catch (error) {
            await this.editReply(interaction, 
                `Failed to add event: ${error.message}`
            );
        }
    }

    async handleVerify(interaction) {
        const eventId = this.getString(interaction, 'event_id', true);
        const actualTimeStr = this.getString(interaction, 'actual_time');
        
        await this.deferReply(interaction);

        try {
            const actualTime = actualTimeStr ? this.parseTimeString(actualTimeStr) : new Date();
            const { event, accuracy } = await this.anniService.verifyEvent(eventId, actualTime);
            
            const embed = {
                color: 0x00ff00,
                title: '✅ Event Verified',
                description: `Event **${event.id}** has been verified`,
                fields: [
                    {
                        name: 'Verification Details',
                        value: [
                            `**Server:** ${event.server}`,
                            `**Predicted Time:** ${event.getFormattedTime('UTC')} UTC`,
                            `**Actual Time:** ${event.actualTime.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
                            `**Accuracy:** ${accuracy ? `${accuracy.accuracyPercentage.toFixed(1)}%` : 'N/A'}`,
                            `**Difference:** ${accuracy ? `${accuracy.differenceMinutes} minutes` : 'N/A'}`
                        ].join('\n'),
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString()
            };
            
            await this.editReply(interaction, { embeds: [embed] });
            
        } catch (error) {
            await this.editReply(interaction, 
                `Failed to verify event: ${error.message}`
            );
        }
    }

    async handleHistory(interaction) {
        const server = this.getString(interaction, 'server');
        const days = this.getInteger(interaction, 'days') || 7;
        const verifiedOnly = this.getBoolean(interaction, 'verified_only') || false;
        
        await this.deferReply(interaction);

        try {
            const events = await this.anniService.getEvents(server, {
                since: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)),
                verified: verifiedOnly ? true : undefined,
                limit: 20
            });
            
            const embed = await this.createHistoryEmbed(events, server, days);
            await this.editReply(interaction, { embeds: [embed] });
            
        } catch (error) {
            await this.editReply(interaction, 
                `Failed to fetch event history: ${error.message}`
            );
        }
    }

    async handleStats(interaction) {
        const server = this.getString(interaction, 'server');
        const days = this.getInteger(interaction, 'days') || 30;
        
        await this.deferReply(interaction);

        try {
            const stats = await this.anniService.getEventStatistics(server, days);
            const embed = await this.createStatsEmbed(stats, server, days);
            
            await this.editReply(interaction, { embeds: [embed] });
            
        } catch (error) {
            await this.editReply(interaction, 
                `Failed to fetch statistics: ${error.message}`
            );
        }
    }

    async handleCreateTimer(interaction) {
        const server = this.getString(interaction, 'server', true);
        const timeStr = this.getString(interaction, 'time', true);
        const notifyRoles = this.getString(interaction, 'notify_roles');
        const notifyTimes = this.getString(interaction, 'notify_times');
        
        await this.deferReply(interaction);

        try {
            const eventTime = this.parseTimeString(timeStr);
            
            const timerOptions = {
                channelId: interaction.channel.id,
                notifyRoles: notifyRoles ? notifyRoles.split(',').map(id => id.trim()) : [],
                notifyMinutes: notifyTimes ? 
                    notifyTimes.split(',').map(time => parseInt(time.trim())) : 
                    [60, 30, 15, 5, 1]
            };
            
            const timer = await this.anniService.createTimer(server, eventTime, timerOptions);
            
            const embed = {
                color: 0x00ff00,
                title: '⏰ Timer Created',
                description: `Created countdown timer for **${server}**`,
                fields: [
                    {
                        name: 'Timer Details',
                        value: [
                            `**Event Time:** ${eventTime.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
                            `**Time Until:** ${this.formatTimeUntil(eventTime)}`,
                            `**Notifications:** ${timerOptions.notifyMinutes.join(', ')} minutes before`,
                            `**Notify Roles:** ${timerOptions.notifyRoles.length > 0 ? timerOptions.notifyRoles.length : 'None'}`
                        ].join('\n'),
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: `Timer ID: ${timer.id}`
                }
            };
            
            await this.editReply(interaction, { embeds: [embed] });
            
        } catch (error) {
            await this.editReply(interaction, 
                `Failed to create timer: ${error.message}`
            );
        }
    }

    async createTimerEmbed(predictions, timezone) {
        const embed = {
            color: 0xff6600,
            title: '⏰ Annihilation Countdown Timers',
            description: predictions.length === 0 ? 
                'No upcoming events found.' : 
                `${predictions.length} upcoming events`,
            fields: [],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'WynnTracker Revival'
            }
        };

        predictions.forEach(prediction => {
            const timeUntil = prediction.getTimeUntil();
            const formattedTime = prediction.getFormattedPredictedTime(timezone);
            
            embed.fields.push({
                name: `${prediction.getMethodIcon()} ${prediction.server}`,
                value: [
                    `**Time:** ${formattedTime} ${timezone}`,
                    `**Countdown:** ${prediction.getFormattedTimeUntil()}`,
                    `**Confidence:** ${prediction.confidence}% (${prediction.getConfidenceLevel()})`,
                    `**Method:** ${prediction.method}`
                ].join('\n'),
                inline: true
            });
        });

        return embed;
    }

    async createPredictionEmbed(predictions, server) {
        const embed = {
            color: 0x9932cc,
            title: `🔮 Annihilation Predictions - ${server}`,
            description: predictions.length === 0 ? 
                'No predictions available.' : 
                `${predictions.length} predictions generated`,
            fields: [],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'WynnTracker Revival'
            }
        };

        predictions.forEach(prediction => {
            embed.fields.push({
                name: `${prediction.getMethodIcon()} ${prediction.method}`,
                value: [
                    `**Time:** ${prediction.getFormattedPredictedTime('UTC')} UTC`,
                    `**Countdown:** ${prediction.getFormattedTimeUntil()}`,
                    `**Confidence:** ${prediction.confidence}% (${prediction.getConfidenceLevel()})`,
                    `**Agreement:** ${prediction.agreement}% (${prediction.getAgreementLevel()})`
                ].join('\n'),
                inline: true
            });
        });

        return embed;
    }

    async createHistoryEmbed(events, server, days) {
        const embed = {
            color: 0x0099ff,
            title: `📜 Annihilation History${server ? ` - ${server}` : ''}`,
            description: `${events.length} events in the last ${days} days`,
            fields: [],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'WynnTracker Revival'
            }
        };

        events.slice(0, 10).forEach(event => {
            const timeAgo = this.formatTimeAgo(event.timestamp);
            
            embed.fields.push({
                name: `${event.getSourceIcon()} ${event.server}`,
                value: [
                    `**Time:** ${event.getFormattedTime('UTC')} UTC`,
                    `**Age:** ${timeAgo}`,
                    `**Confidence:** ${event.confidence}%`,
                    `**Verified:** ${event.verified ? '✅' : '❌'}`,
                    `**Source:** ${event.source}`
                ].join('\n'),
                inline: true
            });
        });

        return embed;
    }

    async createStatsEmbed(stats, server, days) {
        const embed = {
            color: 0xff9900,
            title: `📊 Annihilation Statistics${server ? ` - ${server}` : ''}`,
            description: `Analysis of ${stats.totalEvents} events over ${days} days`,
            fields: [
                {
                    name: '📈 Event Statistics',
                    value: [
                        `**Total Events:** ${stats.totalEvents}`,
                        `**Verified Events:** ${stats.verifiedEvents}`,
                        `**Average Interval:** ${stats.averageInterval.toFixed(1)} minutes`,
                        `**Min Interval:** ${stats.minInterval.toFixed(1)} minutes`,
                        `**Max Interval:** ${stats.maxInterval.toFixed(1)} minutes`
                    ].join('\n'),
                    inline: false
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'WynnTracker Revival'
            }
        };

        // Add source distribution
        if (Object.keys(stats.sources).length > 0) {
            const sourceText = Object.entries(stats.sources)
                .map(([source, count]) => `${source}: ${count}`)
                .join('\n');
            
            embed.fields.push({
                name: '📊 Sources',
                value: sourceText,
                inline: true
            });
        }

        // Add confidence distribution
        if (Object.keys(stats.confidenceLevels).length > 0) {
            const confidenceText = Object.entries(stats.confidenceLevels)
                .map(([level, count]) => `${level}: ${count}`)
                .join('\n');
            
            embed.fields.push({
                name: '🎯 Confidence Levels',
                value: confidenceText,
                inline: true
            });
        }

        return embed;
    }

    parseTimeString(timeStr) {
        // Handle relative time like "2h 30m"
        if (timeStr.includes('h') || timeStr.includes('m')) {
            const now = new Date();
            let totalMinutes = 0;
            
            const hours = timeStr.match(/(\d+)h/);
            if (hours) {
                totalMinutes += parseInt(hours[1]) * 60;
            }
            
            const minutes = timeStr.match(/(\d+)m/);
            if (minutes) {
                totalMinutes += parseInt(minutes[1]);
            }
            
            return new Date(now.getTime() + (totalMinutes * 60 * 1000));
        }
        
        // Handle absolute time
        const timestamp = new Date(timeStr);
        if (isNaN(timestamp.getTime())) {
            throw new Error('Invalid time format. Use YYYY-MM-DD HH:MM or relative time like "2h 30m"');
        }
        
        return timestamp;
    }

    formatTimeUntil(eventTime) {
        const now = new Date();
        const diff = eventTime - now;
        
        if (diff <= 0) {
            return 'Event has passed';
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        
        return parts.join(' ') || 'Less than a minute';
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return `${days} day${days !== 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }

    static create() {
        return new AnniCommand();
    }
}

module.exports = AnniCommand;