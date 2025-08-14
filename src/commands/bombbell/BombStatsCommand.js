const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const BombBellService = require('../../services/bombbell/BombBellService');
const NotificationFormatter = require('../../services/bombbell/NotificationFormatter');

class BombStatsCommand extends BaseCommand {
    constructor() {
        super({
            name: 'bombstats',
            description: 'ボムベルの統計情報を表示します',
            category: 'Bomb Bell',
            cooldown: 30
        });
        
        this.bombBellService = null;
        this.formatter = new NotificationFormatter();
    }

    getSlashCommandData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('timeframe')
                    .setDescription('統計期間')
                    .setRequired(false)
                    .addChoices(
                        { name: '過去1時間', value: '1h' },
                        { name: '過去6時間', value: '6h' },
                        { name: '過去12時間', value: '12h' },
                        { name: '過去24時間', value: '24h' },
                        { name: '過去3日', value: '3d' },
                        { name: '過去1週間', value: '1w' }
                    ));
    }

    async run(interaction) {
        try {
            await interaction.deferReply();
            
            // Initialize service if not already done
            if (!this.bombBellService) {
                const config = global.wynnTrackerBot?.config;
                if (!config) {
                    throw new Error('Configuration not available');
                }
                this.bombBellService = new BombBellService(interaction.client, config);
            }
            
            const timeframe = interaction.options.getString('timeframe') || '24h';
            
            const stats = await this.bombBellService.getStatistics(timeframe);
            
            if (!stats || stats.totalBombs === 0) {
                await this.editReply(interaction, {
                    content: `📊 指定された期間 (${timeframe}) にはボムベルのデータがありません。`
                });
                return;
            }
            
            const embed = this.formatter.createStatsEmbed(stats, timeframe);
            
            await this.editReply(interaction, { embeds: [embed] });
            
        } catch (error) {
            this.logger.error('Bomb stats command error:', error);
            await this.editReply(interaction, {
                content: '❌ ボム統計の取得に失敗しました。',
                ephemeral: true
            });
        }
    }

    static create() {
        return new BombStatsCommand();
    }
}

module.exports = BombStatsCommand;