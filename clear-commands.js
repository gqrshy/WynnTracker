const { REST, Routes } = require('discord.js');
const config = require('./config');

const rest = new REST().setToken(config.token);

(async () => {
    try {
        console.log('既存のコマンドをクリア中...');

        // ギルドコマンドをクリア
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: [] },
        );
        console.log('ギルドコマンドをクリアしました');

        // グローバルコマンドをクリア
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: [] },
        );
        console.log('グローバルコマンドをクリアしました');

    } catch (error) {
        console.error(error);
    }
})();