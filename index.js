const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const config = require('./config'); // .json を削除

// Clientインスタンスの作成
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
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
    } else {
        console.log(`[WARNING] ${filePath} に必要な "data" または "execute" プロパティがありません`);
    }
}

// Bot準備完了時
client.once('ready', async () => {
    console.log(`[SUCCESS] ${client.user.tag} としてログインしました！`);
    client.user.setActivity('Wynncraft', { type: 'PLAYING' });
    
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
        
        // グローバルコマンドとして登録
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands }
        );
        console.log('[SUCCESS] グローバルコマンドを更新しました');
        
    } catch (error) {
        console.error('[ERROR] コマンドの自動更新に失敗しました:', error);
    }
    
    // Annihilation通知を復元
    const annihilationCommand = require('./commands/annihiration');
    if (annihilationCommand.restoreNotifications) {
        annihilationCommand.restoreNotifications(client);
    }
    // タイマーメッセージを復元
    if (annihilationCommand.restoreTimerMessage) {
        annihilationCommand.restoreTimerMessage(client);
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
            ephemeral: true
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

setInterval(async () => {
    for (const [messageId, timerData] of client.timerMessages) {
        try {
            const channel = await client.channels.fetch(timerData.channelId);
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
                const annihilationCommand = require('./commands/annihiration');
                if (annihilationCommand.clearNotifications) {
                    annihilationCommand.clearNotifications();
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
            console.error(`[ERROR] タイマー更新エラー:`, error);
            client.timerMessages.delete(messageId);
        }
    }
}, 10000); // 10秒ごと

// Botログイン
client.login(config.token);