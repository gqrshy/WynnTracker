#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Loading commands from directory...');
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js') && !file.startsWith('Base'));

console.log('Found command files:', commandFiles);

for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        const CommandClass = require(filePath);
        
        console.log(`${file}: has create method = ${typeof CommandClass.create === 'function'}`);
        
        if (typeof CommandClass.create === 'function') {
            console.log(`${file}: command should load successfully`);
        } else {
            console.log(`${file}: missing create function - this command won't load`);
        }
    } catch (error) {
        console.error(`Error with ${file}:`, error.message);
    }
}

// Test specific issue with the index.js loading mechanism
console.log('\n--- Testing index.js command loading logic ---');

const commands = new Map();
let successCount = 0;
let errorCount = 0;

for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        const CommandClass = require(filePath);
        
        if (typeof CommandClass.create === 'function') {
            // This is where the timeout might happen
            console.log(`${file}: Would create command instance here (skipping for test)`);
            successCount++;
        } else {
            console.warn(`${file}: Command does not export a create function`);
            errorCount++;
        }
    } catch (error) {
        console.error(`${file}: Failed to load command:`, error.message);
        errorCount++;
    }
}

console.log(`\nResults: ${successCount} successful, ${errorCount} errors`);