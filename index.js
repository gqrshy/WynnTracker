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
client.once('ready', () => {
    console.log(`[SUCCESS] ${client.user.tag} としてログインしました！`);
    client.user.setActivity('Wynncraft', { type: 'PLAYING' });
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

// Annihilation タイマー更新用（1分ごと）
client.timerMessages = new Map();

setInterval(async () => {
    for (const [messageId, timerData] of client.timerMessages) {
        try {
            const channel = await client.channels.fetch(timerData.channelId);
            const message = await channel.messages.fetch(messageId);
            
            const now = Date.now();
            const timeLeft = timerData.targetTime - now;
            
            if (timeLeft <= 0) {
                await message.edit('🎉 **Annihilation has started!** 🎉');
                client.timerMessages.delete(messageId);
            } else {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                
                await message.edit(`⏰ **Annihilation Countdown**\n\`${days}d ${hours}h ${minutes}m\` remaining`);
            }
        } catch (error) {
            console.error(`[ERROR] タイマー更新エラー:`, error);
            client.timerMessages.delete(messageId);
        }
    }
}, 60000); // 1分ごと

// Botログイン
client.login(config.token);