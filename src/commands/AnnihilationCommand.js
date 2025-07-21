const BaseCommand = require('./BaseCommand');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * 高精度Annihilation予測コマンド
 * Wynnpoolと同等以上の精度を目指す
 */
class AnnihilationCommand extends BaseCommand {
    constructor() {
        super();
        this.annihilationService = null;
    }

    async initialize(services) {
        this.annihilationService = services.annihilation;
    }

    getSlashCommandData() {
        return new SlashCommandBuilder()
            .setName('annihilation')
            .setDescription('高精度Annihilation予測システム (Wynnpool級の精度)')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('next')
                    .setDescription('次のAnnihilation予測を表示'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('multiple')
                    .setDescription('複数のAnnihilation予測を表示')
                    .addIntegerOption(option =>
                        option.setName('count')
                            .setDescription('予測数 (1-10)')
                            .setMinValue(1)
                            .setMaxValue(10)
                            .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('accuracy')
                    .setDescription('予測精度を評価・表示'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('history')
                    .setDescription('過去のAnnihilation履歴を表示')
                    .addIntegerOption(option =>
                        option.setName('count')
                            .setDescription('表示数 (1-20)')
                            .setMinValue(1)
                            .setMaxValue(20)
                            .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Annihilationイベントを手動追加（管理者のみ）')
                    .addStringOption(option =>
                        option.setName('time')
                            .setDescription('イベント時刻 (ISO形式またはタイムスタンプ)')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('source')
                            .setDescription('データソース')
                            .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('stats')
                    .setDescription('システム統計情報を表示'));
    }

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        console.log(`[DEBUG] AnnihilationCommand executed: ${subcommand}`);

        switch (subcommand) {
            case 'next':
                await this.handleNext(interaction);
                break;
            case 'multiple':
                await this.handleMultiple(interaction);
                break;
            case 'accuracy':
                await this.handleAccuracy(interaction);
                break;
            case 'history':
                await this.handleHistory(interaction);
                break;
            case 'add':
                await this.handleAdd(interaction);
                break;
            case 'stats':
                await this.handleStats(interaction);
                break;
            default:
                await interaction.reply({
                    content: '❌ 無効なサブコマンドです。',
                    ephemeral: true
                });
        }
    }

    async handleNext(interaction) {
        try {
            await interaction.deferReply();

            const prediction = await this.annihilationService.getNextPrediction();
            
            if (!prediction) {
                await interaction.editReply('❌ 予測データが利用できません。十分な履歴データがない可能性があります。');
                return;
            }

            const embed = this.createNextPredictionEmbed(prediction);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERROR] Next prediction command failed:', error);
            await interaction.editReply(`❌ 予測の取得中にエラーが発生しました: ${error.message}`);
        }
    }

    async handleMultiple(interaction) {
        try {
            await interaction.deferReply();

            const count = interaction.options.getInteger('count') || 5;
            const predictions = await this.annihilationService.getMultiplePredictions(count);
            
            if (!predictions || predictions.length === 0) {
                await interaction.editReply('❌ 複数予測データが利用できません。');
                return;
            }

            const embed = this.createMultiplePredictionsEmbed(predictions);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERROR] Multiple predictions command failed:', error);
            await interaction.editReply(`❌ 複数予測の取得中にエラーが発生しました: ${error.message}`);
        }
    }

    async handleAccuracy(interaction) {
        try {
            await interaction.deferReply();

            const accuracy = await this.annihilationService.evaluatePredictionAccuracy();
            
            if (!accuracy) {
                await interaction.editReply('❌ 精度評価データが利用できません。');
                return;
            }

            const embed = this.createAccuracyEmbed(accuracy);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERROR] Accuracy evaluation command failed:', error);
            await interaction.editReply(`❌ 精度評価中にエラーが発生しました: ${error.message}`);
        }
    }

    async handleHistory(interaction) {
        try {
            await interaction.deferReply();

            const count = interaction.options.getInteger('count') || 10;
            
            if (!this.annihilationService.eventHistory) {
                await interaction.editReply('❌ 履歴データが見つかりません。');
                return;
            }

            const events = this.annihilationService.eventHistory.slice(-count).reverse();
            
            if (events.length === 0) {
                await interaction.editReply('❌ 履歴データが見つかりません。');
                return;
            }

            const embed = this.createHistoryEmbed(events);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERROR] History command failed:', error);
            await interaction.editReply(`❌ 履歴の取得中にエラーが発生しました: ${error.message}`);
        }
    }

    async handleAdd(interaction) {
        try {
            // 管理者権限チェック
            if (!this.config.isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ このコマンドは管理者のみ使用できます。',
                    ephemeral: true
                });
                return;
            }

            await interaction.deferReply();

            const timeString = interaction.options.getString('time');
            const source = interaction.options.getString('source') || `manual_${interaction.user.username}`;
            
            // 時刻の解析
            let timestamp;
            if (/^\d{13}$/.test(timeString)) {
                // 13桁のタイムスタンプ（ミリ秒）
                timestamp = parseInt(timeString);
            } else if (/^\d{10}$/.test(timeString)) {
                // 10桁のタイムスタンプ（秒）
                timestamp = parseInt(timeString) * 1000;
            } else {
                // ISO形式の日時文字列
                timestamp = new Date(timeString).getTime();
            }

            if (isNaN(timestamp)) {
                await interaction.editReply('❌ 無効な時刻形式です。ISO形式またはタイムスタンプを使用してください。');
                return;
            }

            // イベントの追加
            const event = await this.annihilationService.addEvent(timestamp, source, {
                added_by: interaction.user.id,
                added_by_username: interaction.user.username
            });

            if (event) {
                const embed = new EmbedBuilder()
                    .setTitle('✅ Annihilationイベントが追加されました')
                    .setColor('#00ff00')
                    .addFields(
                        { name: '時刻', value: `<t:${Math.floor(timestamp / 1000)}:F>`, inline: true },
                        { name: 'ソース', value: source, inline: true },
                        { name: '追加者', value: interaction.user.username, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply('❌ イベントの追加に失敗しました（重複の可能性があります）。');
            }

        } catch (error) {
            console.error('[ERROR] Add command failed:', error);
            await interaction.editReply(`❌ イベントの追加中にエラーが発生しました: ${error.message}`);
        }
    }

    async handleStats(interaction) {
        try {
            await interaction.deferReply();

            const stats = await this.annihilationService.getStatistics();
            const embed = this.createStatsEmbed(stats);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERROR] Stats command failed:', error);
            await interaction.editReply(`❌ 統計情報の取得中にエラーが発生しました: ${error.message}`);
        }
    }

    createNextPredictionEmbed(prediction) {
        const now = Date.now();
        const predictedTime = prediction.datetime_utc;
        const timeUntil = predictedTime - now;

        const embed = new EmbedBuilder()
            .setTitle('🔥 次のAnnihilation予測')
            .setColor(prediction.method === 'emergency_fallback' ? '#ff9900' : '#ff6b6b')
            .setDescription(prediction.warning ? 
                `**⚠️ ${prediction.warning}**` : 
                `**Wynnpool級の高精度予測システム**`)
            .addFields(
                {
                    name: '⏰ 予測時刻',
                    value: `<t:${Math.floor(predictedTime / 1000)}:F>`,
                    inline: false
                },
                {
                    name: '⏳ カウントダウン',
                    value: this.formatCountdown(timeUntil),
                    inline: true
                },
                {
                    name: '📊 信頼度',
                    value: `${Math.round(prediction.confidence * 100)}%`,
                    inline: true
                },
                {
                    name: '🔬 予測方法',
                    value: prediction.method || 'ensemble',
                    inline: true
                }
            );

        if (prediction.model_info) {
            let infoText = '';
            if (prediction.model_info.data_points) {
                infoText += `📈 データ数: ${prediction.model_info.data_points}\n`;
            }
            if (prediction.model_info.predicted_interval_hours) {
                infoText += `⏱️ 予測間隔: ${prediction.model_info.predicted_interval_hours.toFixed(1)}時間\n`;
            }
            if (prediction.model_info.prediction_method) {
                infoText += `🧠 アルゴリズム: ${prediction.model_info.prediction_method}`;
            }
            
            if (infoText) {
                embed.addFields({ name: '🔬 技術情報', value: infoText, inline: false });
            }
        }

        embed.setFooter({ text: 'WynnTracker Revival - ARIMA Enhanced Prediction System' })
             .setTimestamp();

        return embed;
    }

    createMultiplePredictionsEmbed(predictions) {
        const embed = new EmbedBuilder()
            .setTitle('🔮 複数Annihilation予測')
            .setColor('#9b59b6')
            .setDescription(`**ARIMA時系列モデル** による次の${predictions.length}回の予測`);

        let predictionsText = '';
        predictions.forEach((prediction, index) => {
            const time = `<t:${Math.floor(prediction.datetime_utc / 1000)}:R>`;
            const confidence = Math.round(prediction.confidence * 100);
            predictionsText += `${index + 1}. ${time} (信頼度: ${confidence}%)\n`;
        });

        embed.addFields({
            name: '📅 予測一覧',
            value: predictionsText || 'データがありません',
            inline: false
        });

        embed.setFooter({ text: 'ARIMA(1,1,1)予測モデル使用 - Wynnpool準拠' })
             .setTimestamp();

        return embed;
    }

    createAccuracyEmbed(accuracy) {
        const embed = new EmbedBuilder()
            .setTitle('📊 予測精度評価')
            .setColor('#e74c3c')
            .setDescription('**交差検証**によるARIMA予測モデルの精度統計');

        embed.addFields(
            {
                name: '⏱️ 平均誤差',
                value: `${accuracy.average_error_hours?.toFixed(2) || 'N/A'}時間`,
                inline: true
            },
            {
                name: '📈 精度スコア',
                value: `${accuracy.accuracy_score?.toFixed(1) || 'N/A'}%`,
                inline: true
            },
            {
                name: '📊 評価方法',
                value: accuracy.method || 'arima_cross_validation',
                inline: true
            }
        );

        if (accuracy.max_error_hours !== undefined) {
            embed.addFields(
                {
                    name: '🔴 最大誤差',
                    value: `${accuracy.max_error_hours.toFixed(2)}時間`,
                    inline: true
                },
                {
                    name: '🟢 最小誤差', 
                    value: `${accuracy.min_error_hours.toFixed(2)}時間`,
                    inline: true
                }
            );
        }

        if (accuracy.evaluated_at) {
            embed.addFields({
                name: '📅 評価日時',
                value: `<t:${Math.floor(accuracy.evaluated_at / 1000)}:R>`,
                inline: false
            });
        }

        // Wynnpoolとの比較
        embed.addFields({
            name: '🎯 目標精度',
            value: '**1時間以内の誤差** (Wynnpool級)',
            inline: false
        });

        embed.setFooter({ text: '5-fold交差検証による精度評価実施' })
             .setTimestamp();

        return embed;
    }

    createHistoryEmbed(events) {
        const embed = new EmbedBuilder()
            .setTitle('📚 Annihilation履歴')
            .setColor('#3498db')
            .setDescription(`**履歴データベース** - 最新の${events.length}件のイベント`);

        let historyText = '';
        events.forEach((event, index) => {
            const eventTime = event.datetime_utc;
            const timeString = `<t:${Math.floor(eventTime / 1000)}:R>`;
            const source = event.source || 'unknown';
            historyText += `${index + 1}. ${timeString} (${source})\n`;
        });

        embed.addFields({
            name: '📅 イベント履歴',
            value: historyText || 'データがありません',
            inline: false
        });

        // 間隔統計
        if (events.length > 1) {
            const intervals = [];
            for (let i = 1; i < events.length; i++) {
                const interval = (events[i-1].datetime_utc - events[i].datetime_utc) / (1000 * 60 * 60);
                intervals.push(interval);
            }
            
            const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
            const stdDev = Math.sqrt(intervals.reduce((sum, interval) => 
                sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length);
            
            embed.addFields({
                name: '📊 間隔統計',
                value: `平均間隔: ${avgInterval.toFixed(1)}時間\n標準偏差: ${stdDev.toFixed(1)}時間`,
                inline: false
            });
        }

        embed.setFooter({ text: 'クリーンアップ済み履歴データ（異常値除去済み）' })
             .setTimestamp();

        return embed;
    }

    createStatsEmbed(stats) {
        const embed = new EmbedBuilder()
            .setTitle('📊 システム統計')
            .setColor('#f39c12')
            .setDescription('**高精度予測システム**の統計情報');

        embed.addFields(
            {
                name: '📈 総イベント数',
                value: stats.total_events?.toString() || '0',
                inline: true
            },
            {
                name: '🔬 ARIMA利用可能',
                value: stats.arima_available ? '✅ はい' : '❌ いいえ',
                inline: true
            }
        );

        if (stats.oldest_event) {
            embed.addFields({
                name: '📅 最古のイベント',
                value: `<t:${Math.floor(new Date(stats.oldest_event).getTime() / 1000)}:D>`,
                inline: true
            });
        }

        if (stats.newest_event) {
            embed.addFields({
                name: '🆕 最新のイベント',
                value: `<t:${Math.floor(new Date(stats.newest_event).getTime() / 1000)}:R>`,
                inline: true
            });
        }

        if (stats.prediction_cache_age !== null) {
            const cacheAgeMinutes = Math.floor(stats.prediction_cache_age / (1000 * 60));
            embed.addFields({
                name: '🗄️ キャッシュ年齢',
                value: `${cacheAgeMinutes}分前`,
                inline: true
            });
        }

        if (stats.accuracy_metrics && stats.accuracy_metrics.accuracy_score) {
            embed.addFields({
                name: '🎯 最新精度スコア',
                value: `${stats.accuracy_metrics.accuracy_score.toFixed(1)}%`,
                inline: true
            });
        }

        // システム情報
        embed.addFields({
            name: '⚙️ システム情報',
            value: [
                '🔬 **ARIMA(1,1,1)モデル**',
                '📊 **交差検証による精度評価**',
                '🔄 **5分間隔自動更新**',
                '🎯 **Wynnpool級の精度目標**'
            ].join('\n'),
            inline: false
        });

        embed.setFooter({ text: 'WynnTracker Revival - Enhanced Prediction System v2.0' })
             .setTimestamp();

        return embed;
    }

    formatCountdown(milliseconds) {
        if (milliseconds < 0) {
            const absMs = Math.abs(milliseconds);
            const seconds = Math.floor(absMs / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) {
                return `⚠️ **${days}日 ${hours % 24}時間前に期限切れ**`;
            } else if (hours > 0) {
                return `⚠️ **${hours}時間 ${minutes % 60}分前に期限切れ**`;
            } else {
                return `⚠️ **${minutes}分前に期限切れ**`;
            }
        }

        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `**${days}日 ${hours % 24}時間 ${minutes % 60}分 ${seconds % 60}秒**`;
        } else if (hours > 0) {
            return `**${hours}時間 ${minutes % 60}分 ${seconds % 60}秒**`;
        } else if (minutes > 0) {
            return `**${minutes}分 ${seconds % 60}秒**`;
        } else {
            return `**${seconds}秒**`;
        }
    }
}

module.exports = AnnihilationCommand;