#!/usr/bin/env node

const axios = require('axios');
const readline = require('readline');

// Configuration
const API_URL = 'http://localhost:3000/api/skjmod';
const API_TOKEN = 'skjmod_token_1234567890abcdef'; // From .env

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Sample bomb data for testing
const sampleBombs = [
    {
        bombType: 'COMBAT_XP',
        bombDisplayName: 'Combat Experience',
        world: 'WC1',
        playerName: 'TestPlayer1',
        metadata: { duration: 20 },
        source: 'GAME',
        detectionPattern: 'Test Pattern',
        originalMessage: 'TestPlayer1 has thrown a Combat Experience Bomb!'
    },
    {
        bombType: 'PROFESSION_XP',
        bombDisplayName: 'Profession Experience',
        world: 'EU2',
        playerName: 'TestPlayer2',
        metadata: { duration: 20 },
        source: 'CHAT',
        detectionPattern: 'Chat Detection',
        originalMessage: 'TestPlayer2 used profession xp bomb'
    },
    {
        bombType: 'LOOT',
        bombDisplayName: 'Loot',
        world: 'AS3',
        playerName: 'TestPlayer3',
        metadata: { duration: 15 },
        source: 'GAME',
        detectionPattern: 'Loot Pattern',
        originalMessage: 'TestPlayer3 activated loot bomb'
    }
];

class SKJModTester {
    constructor() {
        this.headers = {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json'
        };
    }

    async testConnection() {
        console.log('🔗 Testing API connection...');
        try {
            const response = await axios.post(`${API_URL}/test`, {
                message: 'Connection test from SKJmod simulator'
            }, { headers: this.headers });
            
            console.log('✅ Connection test successful!');
            console.log('Response:', response.data);
            return true;
        } catch (error) {
            console.error('❌ Connection test failed:', error.response?.data || error.message);
            return false;
        }
    }

    async sendBombNotification(bombData) {
        console.log(`💣 Sending ${bombData.bombType} bomb notification...`);
        
        const payload = {
            ...bombData,
            timestamp: Date.now()
        };

        try {
            const response = await axios.post(`${API_URL}/bombbell`, payload, {
                headers: this.headers
            });
            
            console.log('✅ Bomb notification sent successfully!');
            console.log('Response:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Failed to send bomb notification:', error.response?.data || error.message);
            return null;
        }
    }

    async getActiveBombs() {
        console.log('📊 Fetching active bombs...');
        try {
            const response = await axios.get(`${API_URL}/bombs/active`, {
                headers: this.headers
            });
            
            console.log('✅ Active bombs fetched successfully!');
            console.log(`Found ${response.data.count} active bombs:`);
            response.data.data.forEach(bomb => {
                console.log(`  - ${bomb.emoji} ${bomb.displayName} on ${bomb.world} (${bomb.remainingMinutes}min left)`);
            });
            return response.data;
        } catch (error) {
            console.error('❌ Failed to fetch active bombs:', error.response?.data || error.message);
            return null;
        }
    }

    async getStats(timeframe = '24h') {
        console.log(`📈 Fetching statistics for ${timeframe}...`);
        try {
            const response = await axios.get(`${API_URL}/stats?timeframe=${timeframe}`, {
                headers: this.headers
            });
            
            console.log('✅ Statistics fetched successfully!');
            const stats = response.data.data;
            console.log(`Total bombs: ${stats.totalBombs}`);
            console.log(`Unique servers: ${stats.uniqueServers}`);
            console.log(`Average per hour: ${stats.averagePerHour}`);
            
            if (Object.keys(stats.bombTypes).length > 0) {
                console.log('Bomb types:');
                Object.entries(stats.bombTypes).forEach(([type, count]) => {
                    console.log(`  - ${type}: ${count}`);
                });
            }
            
            return response.data;
        } catch (error) {
            console.error('❌ Failed to fetch statistics:', error.response?.data || error.message);
            return null;
        }
    }

    async runInteractiveMenu() {
        console.log('\n=== SKJmod Integration Tester ===');
        console.log('1. Test connection');
        console.log('2. Send random bomb notification');
        console.log('3. Send all sample bombs');
        console.log('4. Get active bombs');
        console.log('5. Get statistics');
        console.log('6. Custom bomb test');
        console.log('0. Exit');
        
        rl.question('\nSelect option: ', async (choice) => {
            switch (choice) {
                case '1':
                    await this.testConnection();
                    break;
                case '2':
                    const randomBomb = sampleBombs[Math.floor(Math.random() * sampleBombs.length)];
                    await this.sendBombNotification(randomBomb);
                    break;
                case '3':
                    for (const bomb of sampleBombs) {
                        await this.sendBombNotification(bomb);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
                    }
                    break;
                case '4':
                    await this.getActiveBombs();
                    break;
                case '5':
                    rl.question('Enter timeframe (1h, 6h, 24h, 3d, 1w): ', async (timeframe) => {
                        await this.getStats(timeframe || '24h');
                        this.runInteractiveMenu();
                    });
                    return;
                case '6':
                    await this.customBombTest();
                    break;
                case '0':
                    console.log('👋 Goodbye!');
                    rl.close();
                    return;
                default:
                    console.log('❌ Invalid option');
                    break;
            }
            
            setTimeout(() => this.runInteractiveMenu(), 1000);
        });
    }

    async customBombTest() {
        console.log('\n--- Custom Bomb Test ---');
        
        rl.question('Bomb type (COMBAT_XP, PROFESSION_XP, LOOT, etc.): ', (bombType) => {
            rl.question('World (WC1, EU2, AS3, etc.): ', (world) => {
                rl.question('Player name: ', (playerName) => {
                    rl.question('Duration (minutes): ', (duration) => {
                        const customBomb = {
                            bombType: bombType || 'COMBAT_XP',
                            bombDisplayName: bombType.replace('_', ' ') + ' Bomb',
                            world: world || 'WC1',
                            playerName: playerName || 'TestPlayer',
                            metadata: { duration: parseInt(duration) || 20 },
                            source: 'GAME',
                            detectionPattern: 'Custom Test',
                            originalMessage: `${playerName || 'TestPlayer'} has thrown a ${bombType || 'COMBAT_XP'} bomb!`
                        };
                        
                        this.sendBombNotification(customBomb).then(() => {
                            this.runInteractiveMenu();
                        });
                    });
                });
            });
        });
    }

    async runAutomatedTest() {
        console.log('🤖 Running automated test suite...\n');
        
        // Test 1: Connection
        const connectionOk = await this.testConnection();
        if (!connectionOk) {
            console.log('❌ Stopping tests due to connection failure');
            return false;
        }
        
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Test 2: Send sample bombs
        console.log('📤 Sending sample bomb notifications...');
        for (let i = 0; i < sampleBombs.length; i++) {
            await this.sendBombNotification(sampleBombs[i]);
            if (i < sampleBombs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
            }
        }
        
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Test 3: Get active bombs
        await this.getActiveBombs();
        
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Test 4: Get statistics
        await this.getStats('24h');
        
        console.log('\n✅ All tests completed!');
        return true;
    }
}

// Main execution
async function main() {
    const tester = new SKJModTester();
    
    if (process.argv.includes('--auto')) {
        await tester.runAutomatedTest();
        process.exit(0);
    } else {
        tester.runInteractiveMenu();
    }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n👋 Test interrupted by user');
    rl.close();
    process.exit(0);
});

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Test runner error:', error);
        process.exit(1);
    });
}