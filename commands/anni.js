const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { HybridPredictionSystem, AnniPredictionEngine } = require('../utils/anniPredictionEngine');

const ANNI_DATA_PATH = path.join(__dirname, '..', 'data', 'annihilation.json');
// Annihilationの間隔: 3日4時間31分（ミリ秒）
const ANNI_INTERVAL = (3 * 24 * 60 * 60 * 1000) + (4 * 60 * 60 * 1000) + (31 * 60 * 1000);

// 画像URL（GitHubから直接）
const ANNI_IMAGES = {
    gray: 'https://raw.githubusercontent.com/gqrshy/wynncraft-bot-assets/main/Anni/anni_gray.png',
    normal: 'https://raw.githubusercontent.com/gqrshy/wynncraft-bot-assets/main/Anni/anni.png',
    coming: 'https://raw.githubusercontent.com/gqrshy/wynncraft-bot-assets/main/Anni/annicoming.png'
};

// データディレクトリがなければ作成
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// 通知タイマーを保存する変数
let notificationTimers = [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anni')
        .setDescription('Annihilationイベント関連のコマンド（管理者限定）')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('timer')
                .setDescription('AI予測に基づくカウントダウンタイマーを開始')
                .addStringOption(option =>
                    option
                        .setName('timezone')
                        .setDescription('表示するタイムゾーン')
                        .setRequired(false)
                        .addChoices(
                            { name: 'JST (日本標準時)', value: 'jst' },
                            { name: 'UTC (協定世界時)', value: 'utc' },
                            { name: '両方 (JST + UTC)', value: 'both' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('predict')
                .setDescription('次のAnnihilationを予測')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('過去のAnnihilationイベント履歴を表示')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('履歴に対する操作')
                        .setRequired(false)
                        .addChoices(
                            { name: 'show (履歴表示)', value: 'show' },
                            { name: 'reset (履歴リセット)', value: 'reset' }
                        )
                )
                .addBooleanOption(option =>
                    option
                        .setName('confirm')
                        .setDescription('リセットを確認します（reset時のみ必須）')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('record')
                .setDescription('Annihilationイベントの発生を記録')
                .addStringOption(option =>
                    option
                        .setName('datetime')
                        .setDescription('発生日時 JST (YYYY-MM-DD HH:MM:SS)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('server')
                        .setDescription('サーバー地域')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Asia Server (アジアサーバー)', value: 'asia' },
                            { name: 'EU Server (ヨーロッパサーバー)', value: 'eu' },
                            { name: 'US Server (アメリカサーバー)', value: 'us' }
                        )
                )
                .addBooleanOption(option =>
                    option
                        .setName('downtime')
                        .setDescription('サーバーダウンタイム中のイベントかどうか')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('debug')
                .setDescription('予測システムのデバッグ情報表示')
        ),
    
    async execute(interaction) {
        // 管理者権限チェック（念のため）
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ このコマンドは管理者権限が必要です',
                flags: 64
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'timer') {
            await handleSmartTimer(interaction);
        } else if (subcommand === 'predict') {
            await handlePredict(interaction);
        } else if (subcommand === 'history') {
            await handleHistory(interaction);
        } else if (subcommand === 'record') {
            await handleRecord(interaction);
        }
    }
};

async function handleSmartTimer(interaction) {
    await interaction.deferReply();
    
    try {
        // タイムゾーンオプションを取得
        const timezone = interaction.options.getString('timezone') || 'jst';
        
        // AI予測システムから次回イベント時刻を取得
        const hybridSystem = new HybridPredictionSystem();
        const prediction = await hybridSystem.getOptimalPrediction();
        
        if (!prediction) {
            return await interaction.editReply({
                content: '❌ AI予測データが取得できませんでした。まず `/anni predict` で予測を確認してください。',
            });
        }
        
        const targetDate = prediction.predictedTime;
        const now = new Date();
        
        // 既に過去の時刻の場合は次の予測を取得
        if (targetDate <= now) {
            console.log('[INFO] 予測時刻が過去のため、次の予測を取得します');
            
            // 履歴に現在の予測を追加（学習データとして）
            const historyPath = path.join(__dirname, '..', 'data', 'anni_history.json');
            if (fs.existsSync(historyPath)) {
                const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                history.events.push({
                    timestamp: prediction.predictedTime.toISOString(),
                    source: 'auto_predicted',
                    confidence: prediction.confidence,
                    addedAt: new Date().toISOString()
                });
                fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
            }
            
            // 新しい予測を取得
            await hybridSystem.clearCache(); // キャッシュをクリア
            prediction = await hybridSystem.getOptimalPrediction();
            
            if (!prediction || prediction.predictedTime <= now) {
                return await interaction.editReply({
                    content: '❌ 有効な予測を取得できませんでした。`/anni history reset confirm:true` で履歴をリセットしてください。',
                });
            }
            
            targetDate = prediction.predictedTime;
        }
        
        // 既存のタイマーをクリア（新しいタイマーが設定されたため）
        clearNotifications();
        
        // 残り時間を計算
        const timeUntil = targetDate.getTime() - now.getTime();
        const days = Math.floor(timeUntil / (24 * 60 * 60 * 1000));
        const hours = Math.floor((timeUntil % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((timeUntil % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeUntil % (60 * 1000)) / 1000);
        
        // タイムゾーンに基づいて時刻表示を生成
        let timeDisplay = '';
        if (timezone === 'jst' || timezone === 'both') {
            const jstTime = targetDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            timeDisplay += `🗾 **JST (日本標準時):** ${jstTime}\n`;
        }
        if (timezone === 'utc' || timezone === 'both') {
            const utcTime = targetDate.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
            timeDisplay += `🌐 **UTC (協定世界時):** ${utcTime}\n`;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🤖 AI Smart Countdown Timer')
            .setDescription(`🔮 **AI予測に基づくスマートタイマー**\n\n` +
                          `⏰ **Time Remaining**\n` +
                          `\`\`\`${days}d ${hours}h ${minutes}m ${seconds}s\`\`\`\n` +
                          `📅 **Predicted Start Time**\n` +
                          `${timeDisplay}` +
                          `<t:${Math.floor(targetDate.getTime() / 1000)}:F>\n` +
                          `<t:${Math.floor(targetDate.getTime() / 1000)}:R>\n\n` +
                          `📊 **Prediction Quality**\n` +
                          `信頼度: ${prediction.confidence}% | 一致度: ${prediction.agreement}%\n` +
                          `データソース: ${prediction.sources.join(', ')}\n\n` +
                          `🧠 *このタイマーはAI学習により自動更新されます*`)
            .setColor('#00ff88')
            .setImage(ANNI_IMAGES.coming)
            .setFooter({ text: 'AI Powered Smart Timer - Auto-updating every 10 seconds' })
            .setTimestamp();
        
        const message = await interaction.editReply({ embeds: [embed] });
        
        // スマートタイマーメッセージをMapに追加
        interaction.client.smartTimerMessages = interaction.client.smartTimerMessages || new Map();
        interaction.client.smartTimerMessages.set(message.id, {
            channelId: interaction.channel.id,
            guildId: interaction.guild.id,
            targetTime: targetDate.getTime(),
            startTime: now.getTime(),
            confidence: prediction.confidence,
            method: prediction.method || 'AI',
            lastPrediction: prediction,
            isSmartTimer: true,
            timezone: timezone
        });
        
        // スマートタイマー情報を保存（bot再起動時の復元用）
        const smartTimerPath = path.join(__dirname, '..', 'data', 'smart_timer.json');
        const timerInfo = {
            messageId: message.id,
            channelId: interaction.channel.id,
            guildId: interaction.guild.id,
            targetTime: targetDate.getTime(),
            confidence: prediction.confidence,
            method: prediction.method || 'AI',
            lastUpdate: now.toISOString(),
            prediction: prediction,
            timezone: timezone
        };
        fs.writeFileSync(smartTimerPath, JSON.stringify(timerInfo, null, 2));
        
        console.log(`[INFO] AI Smart Timer started in ${interaction.guild.name}#${interaction.channel.name}`);
        
    } catch (error) {
        console.error('[ERROR] スマートタイマー設定エラー:', error);
        await interaction.editReply({
            content: '❌ スマートタイマー設定中にエラーが発生しました。',
        });
    }
}


async function handlePredict(interaction) {
    await interaction.deferReply();
    
    try {
        const hybridSystem = new HybridPredictionSystem();
        const prediction = await hybridSystem.getOptimalPrediction();
        
        if (!prediction) {
            return await interaction.editReply({
                content: '❌ 予測データを取得できませんでした。まず手動でイベントを記録してください。'
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🔮 AI Annihilation Prediction')
            .setDescription(`**次回Annihilationの予測**\n\n` +
                          `📅 **予測時刻**\n` +
                          `<t:${Math.floor(prediction.predictedTime.getTime() / 1000)}:F>\n` +
                          `<t:${Math.floor(prediction.predictedTime.getTime() / 1000)}:R>\n\n` +
                          `📊 **予測品質**\n` +
                          `🎯 信頼度: ${prediction.confidence}%\n` +
                          `🤝 一致度: ${prediction.agreement}%\n` +
                          `📈 データソース: ${prediction.sources.join(', ')}\n` +
                          `🔬 予測手法: ${prediction.method}`)
            .setColor('#9400d3')
            .setFooter({ text: 'AI-Powered Annihilation Prediction System' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ERROR] 予測エラー:', error);
        await interaction.editReply({
            content: '❌ 予測の取得中にエラーが発生しました。'
        });
    }
}


async function handleHistory(interaction) {
    const action = interaction.options.getString('action') || 'show';
    
    if (action === 'reset') {
        const confirm = interaction.options.getBoolean('confirm');
        
        if (!confirm) {
            return await interaction.reply({
                content: '❌ 履歴リセットには確認が必要です。`confirm: true`を設定してください。',
                ephemeral: true
            });
        }
        
        await handleHistoryReset(interaction);
    } else {
        await handleHistoryShow(interaction);
    }
}

async function handleHistoryShow(interaction) {
    await interaction.deferReply();
    
    try {
        const engine = new AnniPredictionEngine();
        const events = engine.history.events;
        
        if (events.length === 0) {
            return await interaction.editReply({
                content: '📂 履歴データはありません。`/anni record`でイベントを記録してください。'
            });
        }
        
        // 最新10件を表示
        const recentEvents = events.slice(-10).reverse();
        
        const embed = new EmbedBuilder()
            .setTitle('📚 Annihilation Event History')
            .setDescription(
                `**総イベント数**: ${events.length}件\n` +
                `**表示**: 最新${Math.min(10, events.length)}件\n\n` +
                recentEvents.map((event, index) => {
                    const time = new Date(event.timestamp);
                    const jstTime = time.toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'});
                    const serverIcon = event.server ? 
                        (event.server === 'asia' ? '🌏' : event.server === 'eu' ? '🇪🇺' : '🇺🇸') : '🌍';
                    const downtimeIcon = event.downtime ? '⚠️' : '✅';
                    
                    return `**${recentEvents.length - index}.** ${jstTime} JST ${serverIcon} ${downtimeIcon}\n` +
                           `<t:${Math.floor(time.getTime() / 1000)}:R> (信頼度: ${event.confidence}%)`;
                }).join('\n\n')
            )
            .setColor('#0099ff')
            .setFooter({ text: `Server: 🌏 Asia | 🇪🇺 EU | 🇺🇸 US | Status: ✅ Normal | ⚠️ Downtime` })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ERROR] History show error:', error);
        await interaction.editReply({
            content: '❌ 履歴表示中にエラーが発生しました。'
        });
    }
}

async function handleHistoryReset(interaction) {
    await interaction.deferReply();
    
    try {
        // リセット対象のファイルパス
        const dataDir = path.join(__dirname, '..', 'data');
        const filesToReset = [
            'anni_history.json',
            'prediction_cache.json',
            'smart_timer.json',
            'anni_timer.json',
            'anni_alerts.json',
            'anni_config.json'
        ];
        
        let deletedFiles = [];
        let skippedFiles = [];
        
        // ファイルを削除
        for (const fileName of filesToReset) {
            const filePath = path.join(dataDir, fileName);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    deletedFiles.push(fileName);
                    console.log(`[INFO] Deleted: ${fileName}`);
                } else {
                    skippedFiles.push(fileName);
                }
            } catch (error) {
                console.error(`[ERROR] Failed to delete ${fileName}:`, error);
                skippedFiles.push(fileName);
            }
        }
        
        // 実行中のスマートタイマーをクリア
        if (interaction.client.smartTimerMessages) {
            const timerCount = interaction.client.smartTimerMessages.size;
            interaction.client.smartTimerMessages.clear();
            console.log(`[INFO] Cleared ${timerCount} active smart timers`);
        }
        
        // 通知タイマーをクリア
        clearNotifications();
        
        // 新しい空の履歴ファイルを作成
        const newHistoryPath = path.join(dataDir, 'anni_history.json');
        const emptyHistory = {
            events: [],
            created_at: new Date().toISOString(),
            reset_count: 1
        };
        fs.writeFileSync(newHistoryPath, JSON.stringify(emptyHistory, null, 2));
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 Annihilation History Reset Complete')
            .setDescription(
                `**履歴リセット完了**\n\n` +
                `✅ **削除されたファイル (${deletedFiles.length}件):**\n` +
                `${deletedFiles.map(f => `• ${f}`).join('\n') || '• なし'}\n\n` +
                `⏭️ **スキップ (${skippedFiles.length}件):**\n` +
                `${skippedFiles.map(f => `• ${f} (存在しない)`).join('\n') || '• なし'}\n\n` +
                `🆕 **新規作成:**\n` +
                `• anni_history.json (空の履歴)\n\n` +
                `⚡ **メモリクリア:**\n` +
                `• アクティブなスマートタイマー\n` +
                `• 予測キャッシュ\n` +
                `• 通知設定\n\n` +
                `🎯 **次のステップ:**\n` +
                `1. \`/anni record\` でAnnihilationイベントを記録\n` +
                `2. \`/anni predict\` で予測を確認\n` +
                `3. \`/anni timer\` でタイマーを再開始`
            )
            .setColor('#ff6600')
            .setFooter({ text: 'All Annihilation data has been reset' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
        console.log(`[INFO] Annihilation history reset completed by ${interaction.user.tag}`);
        
    } catch (error) {
        console.error('[ERROR] History reset error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Reset Failed')
            .setDescription(
                `**エラーが発生しました:**\n\`\`\`${error.message}\`\`\`\n\n` +
                `一部のファイルが削除できなかった可能性があります。\n` +
                `手動で削除するか、サーバー管理者に連絡してください。`
            )
            .setColor('#ff0000')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function handleRecord(interaction) {
    await interaction.deferReply();
    
    try {
        const datetime = interaction.options.getString('datetime');
        const server = interaction.options.getString('server');
        const isDowntime = interaction.options.getBoolean('downtime') || false;
        
        // JST日時をパース（常にJST -> UTC変換）
        const eventTime = new Date(datetime + '+09:00');
        
        // 有効な日時かチェック
        if (isNaN(eventTime.getTime())) {
            return await interaction.editReply({
                content: '❌ 無効な日時形式です。YYYY-MM-DD HH:MM:SS形式で入力してください。\n例: `2025-07-12 21:30:00`'
            });
        }
        
        // 未来の時刻はエラー
        const now = new Date();
        if (eventTime > now) {
            return await interaction.editReply({
                content: '❌ 未来の時刻は記録できません。過去に発生したAnnihilationの時刻を入力してください。'
            });
        }
        
        // 予測エンジンに記録（拡張データ付き）
        const engine = new AnniPredictionEngine();
        const confidence = isDowntime ? 80 : 100; // ダウンタイム中は信頼度を下げる
        const source = `manual_${server}${isDowntime ? '_downtime' : ''}`;
        
        const added = engine.addEvent(eventTime, source, confidence, {
            server: server,
            downtime: isDowntime,
            jst_original: datetime
        });
        
        if (!added) {
            return await interaction.editReply({
                content: '⚠️ この時刻は既に記録されています（30分以内の重複）。'
            });
        }
        
        // 記録後の予測を生成
        const prediction = engine.predictNext();
        
        // サーバー名のマッピング
        const serverNames = {
            'asia': 'Asia Server 🌏',
            'eu': 'EU Server 🇪🇺',
            'us': 'US Server 🇺🇸'
        };
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Annihilation Event Recorded')
            .setDescription(
                `**記録完了**\n\n` +
                `📅 **記録された時刻 (JST)**\n` +
                `${datetime} JST\n` +
                `<t:${Math.floor(eventTime.getTime() / 1000)}:F>\n` +
                `<t:${Math.floor(eventTime.getTime() / 1000)}:R>\n\n` +
                `🌐 **サーバー**: ${serverNames[server]}\n` +
                `⚠️ **ダウンタイム**: ${isDowntime ? 'あり (信頼度80%)' : 'なし (信頼度100%)'}\n\n` +
                `📊 **現在の履歴**\n` +
                `総イベント数: ${engine.history.events.length}件\n\n` +
                (prediction ? 
                    `🔮 **次回予測 (${serverNames[server]})**\n` +
                    `予測時刻: <t:${Math.floor(prediction.predictedTime.getTime() / 1000)}:F>\n` +
                    `JST: ${prediction.predictedTime.toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'})}\n` +
                    `予測まで: <t:${Math.floor(prediction.predictedTime.getTime() / 1000)}:R>\n` +
                    `予測信頼度: ${prediction.confidence}%\n` +
                    `基準イベント数: ${prediction.basedOnEvents}件`
                    :
                    `🔮 **次回予測**\n予測には3件以上のイベントが必要です。`
                )
            )
            .setColor(isDowntime ? '#ff9900' : '#00ff00')
            .setFooter({ text: `${serverNames[server]} Event Recording System` })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
        console.log(`[INFO] Manual event recorded: ${eventTime.toISOString()} (JST: ${datetime}) on ${server} server ${isDowntime ? '(downtime)' : ''} by ${interaction.user.tag}`);
        
    } catch (error) {
        console.error('[ERROR] Record command error:', error);
        await interaction.editReply({
            content: '❌ イベント記録中にエラーが発生しました。'
        });
    }
}



// 通知関連の基本関数
function clearNotifications() {
    // 実装準備中
}

// 復元関数（基本実装）
async function restoreNotifications(client) {
    console.log('[INFO] Notification restoration skipped (not implemented)');
}

async function restoreTimerMessage(client) {
    console.log('[INFO] Timer message restoration skipped (not implemented)');
}

async function restoreSmartTimers(client) {
    try {
        const smartTimerPath = path.join(__dirname, '..', 'data', 'smart_timer.json');
        
        if (!fs.existsSync(smartTimerPath)) {
            console.log('[INFO] No smart timer data found to restore');
            return;
        }
        
        const timerData = JSON.parse(fs.readFileSync(smartTimerPath, 'utf8'));
        
        // チャンネルとメッセージが存在するかチェック
        try {
            const channel = await client.channels.fetch(timerData.channelId);
            const message = await channel.messages.fetch(timerData.messageId);
            
            // スマートタイマーをMapに復元
            client.smartTimerMessages = client.smartTimerMessages || new Map();
            client.smartTimerMessages.set(timerData.messageId, {
                channelId: timerData.channelId,
                guildId: timerData.guildId,
                targetTime: timerData.targetTime,
                confidence: timerData.confidence || timerData.prediction?.confidence || 50,
                method: timerData.method || timerData.prediction?.method || 'AI',
                isSmartTimer: true,
                timezone: timerData.timezone || 'jst'
            });
            
            console.log(`[INFO] Smart timer restored: ${timerData.messageId}`);
        } catch (error) {
            console.log('[WARN] Smart timer message not found, removing data file');
            fs.unlinkSync(smartTimerPath);
        }
        
    } catch (error) {
        console.error('[ERROR] Failed to restore smart timers:', error);
    }
}

// エクスポート
module.exports.restoreNotifications = restoreNotifications;
module.exports.clearNotifications = clearNotifications;
module.exports.restoreTimerMessage = restoreTimerMessage;
module.exports.restoreSmartTimers = restoreSmartTimers;