#!/usr/bin/env node

/**
 * Wynncraft API Test - Simple connectivity test
 */

const axios = require('axios');

async function testWynncraftDirectly() {
    console.log('🔍 Testing Wynncraft API directly...');
    
    try {
        // Test the simplest possible endpoint
        const response = await axios.get('https://api.wynncraft.com/v3/guild/list', {
            timeout: 10000,
            headers: {
                'User-Agent': 'WynnTracker-Revival/2.0.0'
            }
        });
        
        console.log('  ✅ API Response Status:', response.status);
        console.log('  ✅ API Response Headers:', response.headers['content-type']);
        
        if (response.data) {
            console.log('  ✅ Data received, sample:');
            
            // Log first few items if it's an array
            if (Array.isArray(response.data)) {
                console.log(`  📊 Array length: ${response.data.length}`);
                console.log(`  📊 First item:`, response.data[0]);
            } else {
                console.log(`  📊 Data type: ${typeof response.data}`);
                console.log(`  📊 Data sample:`, Object.keys(response.data).slice(0, 5));
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('  ❌ Direct API test failed:');
        console.error('    Status:', error.response?.status);
        console.error('    Message:', error.message);
        console.error('    Data:', error.response?.data);
        return false;
    }
}

async function testPlayerEndpoint() {
    console.log('🔍 Testing Player endpoint...');
    
    try {
        const response = await axios.get('https://api.wynncraft.com/v3/player/Salted', {
            timeout: 10000,
            headers: {
                'User-Agent': 'WynnTracker-Revival/2.0.0'
            }
        });
        
        console.log('  ✅ Player endpoint successful');
        console.log('  📊 Player data keys:', Object.keys(response.data));
        
        return true;
        
    } catch (error) {
        console.error('  ❌ Player endpoint failed:');
        console.error('    Status:', error.response?.status);
        console.error('    Message:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Direct Wynncraft API Test');
    console.log('============================');
    
    const test1 = await testWynncraftDirectly();
    console.log('');
    
    const test2 = await testPlayerEndpoint();
    console.log('');
    
    if (test1 || test2) {
        console.log('✅ At least one endpoint is working');
    } else {
        console.log('❌ All endpoints failed');
    }
}

main();