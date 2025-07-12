const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// コマンドデータを収集
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`[INFO] コマンドを登録準備: ${command.data.name}`);
    }
}

// RESTインスタンスを作成してトークンをセット
const rest = new REST().setToken(config.token);

// コマンドをデプロイ
(async () => {
    try {
        console.log(`[INFO] ${commands.length} 個のアプリケーションコマンドを登録開始...`);

        // ギルドコマンドとして登録（即座に反映）
        const data = await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands },
        );

        console.log(`[SUCCESS] ${data.length} 個のギルドコマンドを正常に登録しました`);

        // グローバルコマンドの登録を無効化（重複を防ぐため）
        // const globalData = await rest.put(
        //     Routes.applicationCommands(config.clientId),
        //     { body: commands },
        // );

        // console.log(`[SUCCESS] ${globalData.length} 個のグローバルコマンドを正常に登録しました（反映まで最大1時間）`);

    } catch (error) {
        console.error('[ERROR] コマンド登録中にエラーが発生しました:', error);
    }
})();