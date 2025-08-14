const BaseCommand = require('./BaseCommand');
const AnniTrackerService = require('../services/AnniTrackerService');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Annihilationイベントトラッキングコマンド
 * AiverAiva/anni-predリポジトリのデータを使用した高精度予測システム
 */
class AnniCommand extends BaseCommand {
    constructor() {
        super();
        this.anniTrackerService = null;
    }

    async initialize(services) {
        this.anniTrackerService = new AnniTrackerService();
        this.anniTrackerService.client = this.client; // Discord client reference
        await this.anniTrackerService.initialize();
    }

    getSlashCommandData() {
        return new SlashCommandBuilder()
            .setName('anni')
            .setDescription('Annihilationイベントの予測とカウントダウン')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('start')
                    .setDescription('カウントダウンタイマーを開始')
                    .addRoleOption(option =>
                        option.setName('notify_role')
                            .setDescription('通知するロール（12時間前・45分前）')
                            .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('stop')
                    .setDescription('カウントダウンタイマーを停止'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('next')
                    .setDescription('次のAnnihilation予測を表示'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('accuracy')
                    .setDescription('予測精度を評価'));
    }

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'start':
                await this.handleStart(interaction);
                break;
            case 'stop':
                await this.handleStop(interaction);
                break;
            case 'next':
                await this.handleNext(interaction);
                break;
            case 'accuracy':
                await this.handleAccuracy(interaction);
                break;
            default:
                await interaction.reply({
                    content: '❌ 無効なサブコマンドです。',
                    ephemeral: true
                });
        }
    }

    async handleStart(interaction) {
        try {
            // 先にdeferReplyで応答時間を確保
            await interaction.deferReply({ flags: 64 }); // 64 = MessageFlags.Ephemeral
            
            // サービスが未初期化の場合は初期化
            if (!this.anniTrackerService) {
                this.anniTrackerService = new AnniTrackerService();
                await this.anniTrackerService.initialize();
            }
            
            const notifyRole = interaction.options.getRole('notify_role');
            const message = await this.anniTrackerService.startCounter(
                interaction.channel,
                notifyRole?.id
            );
            
            await interaction.editReply({
                content: '✅ Annihilationカウンターを開始しました。3分ごとに自動更新されます。'
            });
        } catch (error) {
            console.error('[ERROR] Failed to start counter:', error);
            try {
                await interaction.editReply({
                    content: `❌ カウンターの開始に失敗しました: ${error.message}`
                });
            } catch (editError) {
                console.error('[ERROR] Failed to edit reply:', editError);
                // インタラクションが失敗した場合のフォールバック
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ カウンターの開始に失敗しました。',
                        flags: 64
                    });
                }
            }
        }
    }

    async handleStop(interaction) {
        try {
            // サービスが初期化されていない場合
            if (!this.anniTrackerService) {
                await interaction.reply({
                    content: '❌ カウンターが開始されていません。',
                    flags: 64
                });
                return;
            }
            
            await this.anniTrackerService.stopCounter(interaction.channel.id);
            
            await interaction.reply({
                content: '⏹️ Annihilationカウンターを停止しました。',
                flags: 64
            });
        } catch (error) {
            console.error('[ERROR] Failed to stop counter:', error);
            await interaction.reply({
                content: `❌ カウンターの停止に失敗しました: ${error.message}`,
                flags: 64
            });
        }
    }

    async handleNext(interaction) {
        try {
            await interaction.deferReply();
            
            // サービスが未初期化の場合は初期化
            if (!this.anniTrackerService) {
                this.anniTrackerService = new AnniTrackerService();
                await this.anniTrackerService.initialize();
            }
            
            const embed = await this.anniTrackerService.createCounterEmbed();
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[ERROR] Failed to get next prediction:', error);
            await interaction.editReply({
                content: `❌ 予測の取得に失敗しました: ${error.message}`
            });
        }
    }

    async handleAccuracy(interaction) {
        try {
            await interaction.deferReply();
            
            // サービスが未初期化の場合は初期化
            if (!this.anniTrackerService) {
                this.anniTrackerService = new AnniTrackerService();
                await this.anniTrackerService.initialize();
            }
            
            const accuracy = await this.anniTrackerService.evaluateAccuracy();
            
            const embed = {
                color: 0x3498db,
                title: '📊 予測精度評価',
                fields: [
                    {
                        name: '評価結果',
                        value: accuracy.accuracy ? 
                            `精度: ${accuracy.accuracy.toFixed(1)}%\n平均間隔: ${accuracy.avgIntervalHours.toFixed(1)}時間\nデータ数: ${accuracy.dataCount}件` :
                            accuracy.message,
                        inline: false
                    }
                ],
                footer: {
                    text: 'GitHub: AiverAiva/anni-pred',
                    iconURL: 'https://github.githubassets.com/favicons/favicon.png'
                },
                timestamp: new Date()
            };
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[ERROR] Failed to evaluate accuracy:', error);
            await interaction.editReply({
                content: `❌ 精度評価に失敗しました: ${error.message}`
            });
        }
    }
    static create() {
        return new AnniCommand();
    }
}

module.exports = AnniCommand;