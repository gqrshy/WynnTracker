const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];

// Load all commands from the commands directory
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') && !file.startsWith('Base'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Create command instance to get data
    const commandInstance = command.create ? command.create() : new command();
    
    if (commandInstance.data) {
        commands.push(commandInstance.data.toJSON());
        console.log(`✅ Loaded command: ${commandInstance.data.name}`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();