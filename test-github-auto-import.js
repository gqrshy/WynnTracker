const AnnihilationService = require('./src/services/AnnihilationService');
const fs = require('fs');
const path = require('path');

async function testGitHubAutoImport() {
    console.log('🔄 Testing GitHub Auto-Import Feature...');
    console.log('Source: https://github.com/AiverAiva/anni-pred/blob/main/data/history.json\n');
    
    // まず既存のキャッシュをクリア
    const dataDir = path.join(__dirname, 'data');
    const files = [
        'annihilation_history.json',
        'github_cache_info.json',
        'annihilation_predictions.json'
    ];
    
    console.log('🧹 Clearing existing cache...');
    files.forEach(file => {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`   ✅ Removed ${file}`);
        }
    });
    
    console.log('\n🚀 Initializing AnnihilationService with GitHub auto-import...');
    
    const service = new AnnihilationService();
    await service.initialize();
    
    console.log(`\n📊 Import Results:`);
    console.log(`   📈 Total events loaded: ${service.eventHistory.length}`);
    
    if (service.eventHistory.length > 0) {
        // データの検証
        const sortedEvents = service.eventHistory.sort((a, b) => a.datetime_utc - b.datetime_utc);
        const firstEvent = new Date(sortedEvents[0].datetime_utc);
        const lastEvent = new Date(sortedEvents[sortedEvents.length - 1].datetime_utc);
        
        console.log(`   📅 First event: ${firstEvent.toISOString()}`);
        console.log(`   📅 Last event: ${lastEvent.toISOString()}`);
        console.log(`   🔗 Source: ${sortedEvents[0].source}`);
        console.log(`   ✅ Verified: ${sortedEvents[0].verified}`);
        
        // 間隔統計
        const intervals = [];
        for (let i = 1; i < sortedEvents.length; i++) {
            const interval = (sortedEvents[i].datetime_utc - sortedEvents[i-1].datetime_utc) / (1000 * 60 * 60);
            intervals.push(interval);
        }
        
        if (intervals.length > 0) {
            const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
            const medianInterval = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
            
            console.log(`   ⏱️ Average interval: ${avgInterval.toFixed(2)} hours`);
            console.log(`   ⏱️ Median interval: ${medianInterval.toFixed(2)} hours`);
        }
        
        // 予測テスト
        console.log('\n🔮 Testing prediction with GitHub data...');
        try {
            const nextPrediction = await service.getNextPrediction();
            
            if (nextPrediction) {
                const now = Date.now();
                const timeUntil = nextPrediction.datetime_utc - now;
                const hoursUntil = timeUntil / (1000 * 60 * 60);
                const daysUntil = hoursUntil / 24;
                
                console.log('📈 Prediction Results:');
                console.log(`   🕐 Predicted time: ${new Date(nextPrediction.datetime_utc).toISOString()}`);
                console.log(`   ⏳ Hours until: ${hoursUntil.toFixed(2)}`);
                console.log(`   📅 Days until: ${daysUntil.toFixed(3)}`);
                console.log(`   📊 Confidence: ${(nextPrediction.confidence * 100).toFixed(1)}%`);
                console.log(`   🔬 Method: ${nextPrediction.method}`);
                
                // 妥当性チェック
                const isInFuture = timeUntil > 0;
                const isReasonable = daysUntil >= 0.5 && daysUntil <= 5;
                
                console.log(`   ✅ In future: ${isInFuture ? 'YES' : 'NO'}`);
                console.log(`   ✅ Reasonable: ${isReasonable ? 'YES' : 'NO'}`);
                
                if (nextPrediction.model_info) {
                    console.log(`   📋 Data points: ${nextPrediction.model_info.data_points}`);
                }
            } else {
                console.log('❌ No prediction available');
            }
        } catch (error) {
            console.log(`❌ Prediction failed: ${error.message}`);
        }
        
        // キャッシュ情報の確認
        console.log('\n📁 Cache Information:');
        const cacheFile = path.join(dataDir, 'github_cache_info.json');
        if (fs.existsSync(cacheFile)) {
            const cacheInfo = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            console.log(`   🕐 Last GitHub update: ${new Date(cacheInfo.last_github_update).toISOString()}`);
            console.log(`   📊 Events cached: ${cacheInfo.events_count}`);
            console.log(`   🔗 Source repo: ${cacheInfo.source}`);
        }
        
    } else {
        console.log('❌ No events loaded from GitHub');
    }
    
    console.log('\n⚙️ Auto-Update Schedule:');
    console.log('   🔮 Predictions: Every 5 minutes');
    console.log('   📥 GitHub data: Every 6 hours');
    console.log('   🎯 Manual add commands: Emergency use only');
    
    console.log('\n🏁 GitHub Auto-Import test completed!');
    
    // システム統計
    console.log('\n📊 System Statistics:');
    try {
        const stats = await service.getStatistics();
        console.log(`   📈 Total events: ${stats.total_events}`);
        console.log(`   🔬 ARIMA available: ${stats.arima_available ? 'YES' : 'NO'}`);
        console.log(`   📅 Newest event: ${stats.newest_event}`);
        console.log(`   ⏰ Prediction cache age: ${stats.prediction_cache_age ? Math.floor(stats.prediction_cache_age / 1000) + 's' : 'N/A'}`);
    } catch (error) {
        console.log(`   ❌ Stats failed: ${error.message}`);
    }
    
    await service.onCleanup();
}

testGitHubAutoImport().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});