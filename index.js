const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const config = require('./config'); // .json を削除
const cron = require('node-cron');
const { AutoSyncSystem } = require('./utils/autoSyncSystem');
const dataCache = require('./utils/dataCache');

// Clientインスタンスの作成
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// コマンドを格納するコレクション
client.commands = new Collection();

// コマンドファイルの読み込み
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[INFO] コマンドを読み込みました: ${command.data.name}`);
        
        // translateコマンドの場合はclientを設定
        if (command.data.name === 'translate' && command.setClient) {
            command.setClient(client);
        }
    } else {
        console.log(`[WARNING] ${filePath} に必要な "data" または "execute" プロパティがありません`);
    }
}

// Bot準備完了時
client.once('ready', async () => {
    console.log(`[SUCCESS] ${client.user.tag} としてログインしました！`);
    client.user.setActivity('Wynncraft', { type: 'PLAYING' });
    
    // 静的データをプリロード
    dataCache.preloadStaticData();
    
    // スラッシュコマンドを自動更新
    try {
        const { REST, Routes } = require('discord.js');
        const rest = new REST().setToken(config.token);
        
        const commands = [];
        for (const command of client.commands.values()) {
            commands.push(command.data.toJSON());
        }
        
        console.log('[INFO] スラッシュコマンドを自動更新中...');
        
        // ギルドコマンドとして登録（即座に反映）
        if (config.guildId) {
            await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commands }
            );
            console.log('[SUCCESS] ギルドコマンドを更新しました');
        }
        
        // グローバルコマンドの登録を無効化（重複を防ぐため）
        // await rest.put(
        //     Routes.applicationCommands(config.clientId),
        //     { body: commands }
        // );
        // console.log('[SUCCESS] グローバルコマンドを更新しました');
        
    } catch (error) {
        console.error('[ERROR] コマンドの自動更新に失敗しました:', error);
    }
    
    // Annihilation通知を復元
    const anniCommand = require('./commands/anni');
    if (anniCommand.restoreNotifications) {
        anniCommand.restoreNotifications(client);
    }
    // タイマーメッセージを復元
    if (anniCommand.restoreTimerMessage) {
        anniCommand.restoreTimerMessage(client);
    }
    // スマートタイマーを復元
    if (anniCommand.restoreSmartTimers) {
        anniCommand.restoreSmartTimers(client);
    }
    
    // ギルドランキングの週次リセットをセットアップ
    // 毎週月曜日の午前0時（JST）に実行
    cron.schedule('0 0 * * 1', async () => {
        console.log('[INFO] ギルドランキングの週次リセットを開始します...');
        const guildCommand = require('./commands/guild');
        if (guildCommand.weeklyReset) {
            await guildCommand.weeklyReset(client);
        }
    }, {
        timezone: 'Asia/Tokyo'
    });
    
    // 起動時に週次リセットが必要かチェック
    const guildCommand = require('./commands/guild');
    if (guildCommand.weeklyReset) {
        await guildCommand.weeklyReset(client);
    }
    
    // Annihilation予測自動同期システムを開始
    try {
        const autoSync = new AutoSyncSystem(client);
        autoSync.start();
        client.autoSync = autoSync; // クライアントに参照を保存
        console.log('[INFO] Annihilation予測自動同期システムを開始しました');
    } catch (error) {
        console.error('[ERROR] 自動同期システムの起動に失敗しました:', error);
    }
});

// メッセージ処理（翻訳機能用）
client.on('messageCreate', async message => {
    // 翻訳コマンドのメッセージハンドラーを呼び出し
    const translateCommand = client.commands.get('translate');
    if (translateCommand && translateCommand.handleMessage) {
        await translateCommand.handleMessage(message);
    }
});

// インタラクション（スラッシュコマンド）処理
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`[ERROR] ${interaction.commandName} というコマンドは見つかりませんでした`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[ERROR] コマンド実行中にエラーが発生しました:`, error);
        
        const errorMessage = {
            content: 'コマンドの実行中にエラーが発生しました',
            flags: 64
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Annihilation タイマー更新用（10秒ごと）
client.timerMessages = new Map();
client.smartTimerMessages = new Map();

setInterval(async () => {
    // 従来のタイマー更新
    await updateTraditionalTimers(client);
    
    // スマートタイマー更新
    await updateSmartTimers(client);
}, 10000); // 10秒ごと

async function updateTraditionalTimers(client) {
    for (const [messageId, timerData] of client.timerMessages) {
        try {
            const channel = await client.channels.fetch(timerData.channelId).catch(() => null);
            if (!channel) {
                console.log(`[INFO] タイマーのチャンネルが見つかりません: ${timerData.channelId}`);
                client.timerMessages.delete(messageId);
                continue;
            }
            
            const message = await channel.messages.fetch(messageId);
            
            const now = Date.now();
            const timeLeft = timerData.targetTime - now;
            
            if (timeLeft <= 0) {
                // 次のAnnihilationまでの時間を計算（3日4時間31分）
                const ANNI_INTERVAL = (3 * 24 * 60 * 60 * 1000) + (4 * 60 * 60 * 1000) + (31 * 60 * 1000);
                const newTargetTime = timerData.targetTime + ANNI_INTERVAL;
                
                // timerDataを更新
                timerData.targetTime = newTargetTime;
                
                // JSONファイルを更新
                const fs = require('fs');
                const path = require('path');
                const ANNI_DATA_PATH = path.join(__dirname, 'data', 'annihilation.json');
                
                const anniData = {
                    startTime: new Date(newTargetTime).toISOString(),
                    setBy: 'auto-renewal',
                    setAt: new Date().toISOString(),
                    serverId: channel.guild.id
                };
                
                fs.writeFileSync(ANNI_DATA_PATH, JSON.stringify(anniData, null, 2));
                console.log('[INFO] Annihilationタイマーを自動更新しました');
                
                // 通知もリセット
                const anniCommand = require('./commands/anni');
                if (anniCommand.clearNotifications) {
                    anniCommand.clearNotifications();
                }
                
                // すぐに次のカウントダウンを開始（次のループで更新される）
            } else {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle('🔥 Next Annihilation Event 🔥')
                    .setDescription(`⏰ **Time Remaining**\n` +
                                  `\`\`\`${days}d ${hours}h ${minutes}m ${seconds}s\`\`\`\n` +
                                  `📅 **Start Time**\n` +
                                  `<t:${Math.floor(timerData.targetTime / 1000)}:F>\n` +
                                  `<t:${Math.floor(timerData.targetTime / 1000)}:R>\n\n` +
                                  `⚠️ *日時は計算での予測にすぎないため、余裕をもって参加することをお勧めいたします。*`)
                    .setColor('#ff4444')
                    .setFooter({ text: 'Prelude to Annihilation - Wynncraft World Event' })
                    .setTimestamp();
                
                // 既存のembedを取得して画像を保持
                if (message.embeds[0] && message.embeds[0].image) {
                    embed.setImage(message.embeds[0].image.url);
                }
                
                await message.edit({ embeds: [embed] });
            }
        } catch (error) {
            if (error.code === 10008) { // Unknown Message
                console.log(`[INFO] タイマーメッセージが削除されました: ${messageId}`);
                client.timerMessages.delete(messageId);
                
                // annihilation.jsonファイルも削除
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const ANNI_DATA_PATH = path.join(__dirname, 'data', 'annihilation.json');
                    if (fs.existsSync(ANNI_DATA_PATH)) {
                        fs.unlinkSync(ANNI_DATA_PATH);
                        console.log('[INFO] Annihilationタイマーデータファイルを削除しました');
                    }
                } catch (fileError) {
                    console.error('[ERROR] タイマーファイル削除エラー:', fileError);
                }
            } else {
                console.error(`[ERROR] タイマー更新エラー:`, error);
                client.timerMessages.delete(messageId);
            }
        }
    }
}

async function updateSmartTimers(client) {
    for (const [messageId, timerData] of client.smartTimerMessages) {
        try {
            const channel = await client.channels.fetch(timerData.channelId).catch(() => null);
            if (!channel) {
                console.log(`[INFO] スマートタイマーのチャンネルが見つかりません: ${timerData.channelId}`);
                client.smartTimerMessages.delete(messageId);
                continue;
            }
            
            const message = await channel.messages.fetch(messageId);
            
            const now = Date.now();
            const timeLeft = timerData.targetTime - now;
            
            if (timeLeft <= 0) {
                // AI予測で新しい時間を取得
                try {
                    const { HybridPredictionSystem } = require('./utils/anniPredictionEngine');
                    const hybridSystem = new HybridPredictionSystem();
                    const prediction = await hybridSystem.getOptimalPrediction();
                    
                    if (prediction && prediction.predictedTime) {
                        // 新しいAI予測時間に更新
                        timerData.targetTime = new Date(prediction.predictedTime).getTime();
                        timerData.confidence = prediction.confidence || 50;
                        timerData.method = prediction.method || 'AI';
                        
                        console.log(`[INFO] スマートタイマーをAI予測で更新しました: ${prediction.predictedTime} (信頼度: ${prediction.confidence}%)`);
                    } else {
                        // AI予測が失敗した場合は従来の間隔を使用
                        const ANNI_INTERVAL = (3 * 24 * 60 * 60 * 1000) + (4 * 60 * 60 * 1000) + (31 * 60 * 1000);
                        timerData.targetTime = timerData.targetTime + ANNI_INTERVAL;
                        timerData.confidence = 30;
                        timerData.method = 'fallback';
                        
                        console.log('[WARN] AI予測が失敗したため、固定間隔を使用しています');
                    }
                } catch (error) {
                    console.error('[ERROR] AI予測の取得に失敗:', error);
                    // フォールバック: 固定間隔
                    const ANNI_INTERVAL = (3 * 24 * 60 * 60 * 1000) + (4 * 60 * 60 * 1000) + (31 * 60 * 1000);
                    timerData.targetTime = timerData.targetTime + ANNI_INTERVAL;
                    timerData.confidence = 30;
                    timerData.method = 'fallback';
                }
            }
            
            // カウントダウン表示を更新
            const timeLeft2 = timerData.targetTime - now;
            const days = Math.floor(timeLeft2 / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft2 % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft2 % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft2 % (1000 * 60)) / 1000);
            
            // 信頼度に基づく色とアイコンを設定
            let color = '#ff4444';
            let icon = '🔥';
            let confidenceText = '';
            
            const confidence = timerData.confidence || 50;
            const method = timerData.method || 'AI';
            
            if (confidence >= 80) {
                color = '#00ff00';
                icon = '🎯';
                confidenceText = '**高精度AI予測**';
            } else if (confidence >= 60) {
                color = '#ffaa00';
                icon = '🤖';
                confidenceText = '**AI予測**';
            } else {
                color = '#ff4444';
                icon = '⚠️';
                confidenceText = '**推定値**';
            }
            
            // タイムゾーン設定を取得
            const timezone = timerData.timezone || 'jst';
            const targetDate = new Date(timerData.targetTime);
            
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
            
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle(`${icon} Next Annihilation Event (AI Powered)`)
                .setDescription(`⏰ **Time Remaining**\n` +
                              `\`\`\`${days}d ${hours}h ${minutes}m ${seconds}s\`\`\`\n` +
                              `📅 **Start Time**\n` +
                              `${timeDisplay}` +
                              `<t:${Math.floor(timerData.targetTime / 1000)}:F>\n` +
                              `<t:${Math.floor(timerData.targetTime / 1000)}:R>\n\n` +
                              `🎯 **Prediction Info**\n` +
                              `${confidenceText} - 信頼度: ${confidence}%\n` +
                              `予測方式: ${method}\n\n` +
                              `⚠️ *AI予測による推定時刻です。実際の時間と異なる場合があります。*`)
                .setColor(color)
                .setFooter({ text: 'AI-Powered Annihilation Prediction System' })
                .setTimestamp();
            
            // 既存のembedを取得して画像を保持
            if (message.embeds[0] && message.embeds[0].image) {
                embed.setImage(message.embeds[0].image.url);
            }
            
            await message.edit({ embeds: [embed] });
            
        } catch (error) {
            if (error.code === 10008) { // Unknown Message
                console.log(`[INFO] スマートタイマーメッセージが削除されました: ${messageId}`);
                client.smartTimerMessages.delete(messageId);
                
                // smart_timer.jsonファイルも削除
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const smartTimerPath = path.join(__dirname, 'data', 'smart_timer.json');
                    if (fs.existsSync(smartTimerPath)) {
                        fs.unlinkSync(smartTimerPath);
                        console.log('[INFO] スマートタイマーデータファイルを削除しました');
                    }
                } catch (fileError) {
                    console.error('[ERROR] スマートタイマーファイル削除エラー:', fileError);
                }
            } else {
                console.error(`[ERROR] スマートタイマー更新エラー:`, error);
                client.smartTimerMessages.delete(messageId);
            }
        }
    }
}

// Botログイン
client.login(config.token);