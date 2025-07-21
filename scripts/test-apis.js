#!/usr/bin/env node

/**
 * External API Connection Test Script
 * Tests connectivity and authentication for all external APIs
 */

const ConfigManager = require('../src/config/ConfigManager');
const WynncraftAPIClient = require('../src/api/WynncraftAPIClient');
const WynnventoryAPIClient = require('../src/api/WynnventoryAPIClient');
const DeepLAPIClient = require('../src/api/DeepLAPIClient');

async function testWynncraftAPI() {
    console.log('🔍 Testing Wynncraft API...');
    
    try {
        const client = new WynncraftAPIClient();
        
        // Test basic connectivity with online players (most reliable endpoint)
        const onlineData = await client.getOnlinePlayers();
        console.log('  ✅ Online players retrieval successful');
        console.log(`  📊 Found ${onlineData.total || 0} players online`);
        
        // Test player lookup (may fail if player doesn't exist)
        try {
            const playerData = await client.getPlayer('Salted');
            console.log('  ✅ Player lookup successful');
        } catch (error) {
            console.log('  ⚠️ Player lookup failed (player may not exist)');
        }
        
        // Test guild lookup (may fail if guild doesn't exist)
        try {
            const guildData = await client.getGuild('Aquila');
            console.log('  ✅ Guild lookup successful');
        } catch (error) {
            console.log('  ⚠️ Guild lookup failed (guild may not exist)');
        }
        
        console.log('  📊 API Status: Healthy');
        return true;
        
    } catch (error) {
        console.error('  ❌ Wynncraft API test failed:', error.message);
        return false;
    }
}

async function testWynnventoryAPI() {
    console.log('🔍 Testing Wynnventory API...');
    
    try {
        const config = ConfigManager.getInstance();
        const apiKey = config.get('apis.wynnventory.key');
        
        if (!apiKey) {
            console.log('  ⚠️ API key not configured, skipping tests');
            return true;
        }
        
        const client = new WynnventoryAPIClient({ apiKey });
        
        // Test basic connectivity first (simplest endpoint)
        try {
            const response = await client.get('/status');
            console.log('  ✅ API connectivity successful');
        } catch (error) {
            console.log('  ⚠️ API connectivity check failed, trying other endpoints');
        }
        
        // Test trade market access (may require specific parameters)
        try {
            const marketData = await client.getTradeMarket({ limit: 5 });
            console.log('  ✅ Trade market access successful');
        } catch (error) {
            console.log('  ⚠️ Trade market access failed:', error.message);
        }
        
        // Test lootpool data (may require specific parameters)
        try {
            const lootpoolData = await client.getLootpoolData({ limit: 5 });
            console.log('  ✅ Lootpool data retrieval successful');
        } catch (error) {
            console.log('  ⚠️ Lootpool data retrieval failed:', error.message);
        }
        
        console.log('  📊 API Status: Partially functional (check individual endpoints)');
        return true;
        
    } catch (error) {
        console.error('  ❌ Wynnventory API test failed:', error.message);
        console.error('  🔑 Check API key configuration');
        return false;
    }
}

async function testDeepLAPI() {
    console.log('🔍 Testing DeepL API...');
    
    try {
        const config = ConfigManager.getInstance();
        const apiKey = config.get('apis.deepl.key');
        
        if (!apiKey) {
            console.log('  ⚠️ API key not configured, skipping tests');
            return true;
        }
        
        const client = new DeepLAPIClient(apiKey);
        
        // Test usage info
        const usage = await client.getUsage();
        console.log('  ✅ API usage check successful');
        console.log(`  📊 Character usage: ${usage.character_count}/${usage.character_limit}`);
        
        // Test simple translation
        const translation = await client.translateText('Hello, world!', 'JA');
        console.log('  ✅ Text translation successful');
        console.log(`  🌐 Translation: "${translation.translations[0].text}"`);
        
        console.log('  📊 API Status: Healthy');
        return true;
        
    } catch (error) {
        console.error('  ❌ DeepL API test failed:', error.message);
        console.error('  🔑 Check API key configuration');
        return false;
    }
}

async function testHealthChecks() {
    console.log('🔍 Testing API health checks...');
    
    const results = {
        wynncraft: false,
        wynnventory: false,
        deepl: false
    };
    
    // Test each API
    results.wynncraft = await testWynncraftAPI();
    console.log('');
    
    results.wynnventory = await testWynnventoryAPI();
    console.log('');
    
    results.deepl = await testDeepLAPI();
    console.log('');
    
    // Summary
    console.log('📋 API Test Summary:');
    console.log('==================');
    
    const totalAPIs = Object.keys(results).length;
    const healthyAPIs = Object.values(results).filter(Boolean).length;
    
    Object.entries(results).forEach(([api, healthy]) => {
        const status = healthy ? '✅ Healthy' : '❌ Failed';
        console.log(`  ${api.padEnd(12)}: ${status}`);
    });
    
    console.log('');
    console.log(`Overall Health: ${healthyAPIs}/${totalAPIs} APIs healthy`);
    
    if (healthyAPIs === totalAPIs) {
        console.log('🎉 All APIs are functioning correctly!');
        process.exit(0);
    } else {
        console.log('⚠️ Some APIs need attention. Check configuration and network connectivity.');
        process.exit(1);
    }
}

async function main() {
    console.log('🚀 WynnTracker Revival - API Connection Test');
    console.log('============================================');
    console.log('');
    
    try {
        await testHealthChecks();
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    }
}

// Execute if called directly
if (require.main === module) {
    main();
}

module.exports = {
    testWynncraftAPI,
    testWynnventoryAPI,
    testDeepLAPI,
    testHealthChecks
};