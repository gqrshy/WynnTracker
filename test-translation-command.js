#!/usr/bin/env node

console.log('Testing command loading...');

try {
    const cmd = require('./src/commands/TranslationCommand');
    console.log('Command loaded:', !!cmd);
    
    const instance = cmd.create();
    console.log('Instance created:', !!instance);
    console.log('Has handleMessage:', typeof instance.handleMessage === 'function');
    console.log('Data property:', !!instance.data);
    console.log('Command name:', instance.data?.name);
    
    console.log('Testing command registration compatibility...');
    console.log('Has create method:', typeof cmd.create === 'function');
    console.log('Data structure:', {
        name: instance.data?.name,
        description: instance.data?.description,
        hasSlashCommandData: typeof instance.getSlashCommandData === 'function'
    });
    
} catch (error) {
    console.error('Error testing command:', error.message);
    console.error('Stack:', error.stack);
}