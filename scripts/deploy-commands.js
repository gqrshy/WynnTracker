const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ConfigManager = require('../src/config/ConfigManager');

async function deployCommands() {
    const config = ConfigManager.getInstance();
    
    const token = config.get('discord.token');
    const clientId = config.get('discord.clientId');
    const guildId = config.get('discord.guildId');
    
    if (!token || !clientId) {
        console.error('❌ Missing required Discord configuration');
        process.exit(1);
    }
    
    console.log('📋 Loading commands...');
    
    const commands = [];
    const commandsPath = path.join(__dirname, '../src/commands');
    const commandFiles = fs.readdirSync(commandsPath)
        .filter(file => file.endsWith('.js') && !file.startsWith('Base'));
    
    for (const file of commandFiles) {
        try {
            const filePath = path.join(commandsPath, file);
            const CommandClass = require(filePath);
            
            if (typeof CommandClass.create === 'function') {
                const command = CommandClass.create();
                commands.push(command.data.toJSON());
                console.log(`  ✅ Loaded command: ${command.data.name}`);
            } else {
                console.warn(`  ⚠️ Command ${file} does not export a create function`);
            }
        } catch (error) {
            console.error(`  ❌ Failed to load command ${file}:`, error.message);
        }
    }
    
    console.log(`📦 Loaded ${commands.length} commands`);
    
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
        console.log('🚀 Started refreshing application (/) commands...');
        
        let route;
        let scope;
        
        if (guildId) {
            route = Routes.applicationGuildCommands(clientId, guildId);
            scope = `guild ${guildId}`;
        } else {
            route = Routes.applicationCommands(clientId);
            scope = 'globally';
        }
        
        const data = await rest.put(route, { body: commands });
        
        console.log(`✅ Successfully reloaded ${data.length} application (/) commands ${scope}`);
        
    } catch (error) {
        console.error('❌ Failed to deploy commands:', error);
        process.exit(1);
    }
}

// Clear commands function
async function clearCommands() {
    const config = ConfigManager.getInstance();
    
    const token = config.get('discord.token');
    const clientId = config.get('discord.clientId');
    const guildId = config.get('discord.guildId');
    
    if (!token || !clientId) {
        console.error('❌ Missing required Discord configuration');
        process.exit(1);
    }
    
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
        console.log('🧹 Clearing application (/) commands...');
        
        if (guildId) {
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            console.log(`✅ Successfully cleared guild commands for ${guildId}`);
        } else {
            await rest.put(Routes.applicationCommands(clientId), { body: [] });
            console.log('✅ Successfully cleared global commands');
        }
        
    } catch (error) {
        console.error('❌ Failed to clear commands:', error);
        process.exit(1);
    }
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes('--clear')) {
    clearCommands();
} else {
    deployCommands();
}