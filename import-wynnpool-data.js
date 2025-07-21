const AnnihilationService = require('./src/services/AnnihilationService');

async function importWynnpoolData() {
    console.log('🔧 Importing actual Wynnpool Annihilation data...');
    
    // 実際のWynnpoolデータ（2024-09-06から2025-07-18まで）
    const wynnpoolData = [
        '2024-09-06 14:02', '2024-09-09 16:37', '2024-09-13 02:08', '2024-09-16 12:14',
        '2024-09-19 14:44', '2024-09-23 02:03', '2024-09-26 04:33', '2024-09-29 05:57',
        '2024-10-02 10:44', '2024-10-05 15:04', '2024-10-08 18:21', '2024-10-11 19:01',
        '2024-10-14 23:50', '2024-10-18 06:38', '2024-10-21 11:48', '2024-10-24 18:15',
        '2024-10-27 19:07', '2024-10-31 00:52', '2024-11-03 08:26', '2024-11-06 08:25',
        '2024-11-09 09:04', '2024-11-12 13:51', '2024-11-15 20:07', '2024-11-18 20:30',
        '2024-11-21 22:35', '2024-11-24 23:51', '2024-11-28 08:50', '2024-12-01 15:40',
        '2024-12-04 16:23', '2024-12-07 20:32', '2024-12-11 04:58', '2024-12-14 09:50',
        '2024-12-17 13:02', '2024-12-20 20:06', '2024-12-24 05:30', '2024-12-27 07:29',
        '2024-12-30 12:24', '2025-01-02 14:29', '2025-01-05 23:06', '2025-01-09 04:05',
        '2025-01-12 07:03', '2025-01-15 09:59', '2025-01-18 15:22', '2025-01-21 19:29',
        '2025-01-24 21:53', '2025-01-28 05:32', '2025-01-31 13:46', '2025-02-03 23:03',
        '2025-02-07 00:13', '2025-02-10 05:52', '2025-02-13 10:22', '2025-02-16 16:58',
        '2025-02-19 19:12', '2025-02-23 02:42', '2025-02-26 07:21', '2025-03-01 09:00',
        '2025-03-04 13:11', '2025-03-07 22:20', '2025-03-11 04:25', '2025-03-14 09:37',
        '2025-03-17 10:43', '2025-03-20 14:36', '2025-03-23 15:10', '2025-03-26 19:32',
        '2025-03-29 19:35', '2025-04-02 03:15', '2025-04-05 10:18', '2025-04-08 17:12',
        '2025-04-12 01:54', '2025-04-15 03:16', '2025-04-18 04:48', '2025-04-21 07:15',
        '2025-04-24 07:23', '2025-04-27 15:30', '2025-04-30 15:07', '2025-05-03 17:38',
        '2025-05-06 21:59', '2025-05-10 00:33', '2025-05-13 01:45', '2025-05-16 11:14',
        '2025-05-19 16:42', '2025-05-22 21:57', '2025-05-26 06:50', '2025-05-29 15:27',
        '2025-06-02 01:25', '2025-06-05 07:05', '2025-06-08 12:11', '2025-06-11 12:28',
        '2025-06-14 17:09', '2025-06-17 19:49', '2025-06-20 21:41', '2025-06-24 05:54',
        '2025-06-27 11:29', '2025-06-30 12:39', '2025-07-03 14:37', '2025-07-06 16:36',
        '2025-07-09 16:01', '2025-07-12 19:37', '2025-07-15 21:28', '2025-07-18 23:26'
    ];
    
    const service = new AnnihilationService();
    await service.initialize();
    
    // 既存データをクリア
    service.eventHistory = [];
    
    console.log(`📊 Processing ${wynnpoolData.length} events from Wynnpool...`);
    
    // データの変換とインポート
    for (let i = 0; i < wynnpoolData.length; i++) {
        const dateStr = wynnpoolData[i];
        
        // YYYY-MM-DD HH:MM 形式をISO形式に変換（UTC想定）
        const timestamp = new Date(dateStr + ':00.000Z').getTime();
        
        try {
            await service.addEvent(timestamp, 'wynnpool_verified', {
                verified: true,
                confidence: 1.0,
                index: i + 1
            });
            
            if ((i + 1) % 20 === 0) {
                console.log(`  ✅ Imported ${i + 1}/${wynnpoolData.length} events`);
            }
        } catch (error) {
            console.error(`  ❌ Failed to import event ${i + 1}: ${dateStr} - ${error.message}`);
        }
    }
    
    console.log(`✅ Import completed! Total events: ${service.eventHistory.length}`);
    
    // データの検証
    console.log('\n📊 Data verification:');
    if (service.eventHistory.length > 0) {
        const sortedEvents = service.eventHistory.sort((a, b) => a.datetime_utc - b.datetime_utc);
        const firstEvent = new Date(sortedEvents[0].datetime_utc);
        const lastEvent = new Date(sortedEvents[sortedEvents.length - 1].datetime_utc);
        
        console.log(`  📅 First event: ${firstEvent.toISOString()}`);
        console.log(`  📅 Last event: ${lastEvent.toISOString()}`);
        console.log(`  📈 Total events: ${sortedEvents.length}`);
        
        // 間隔統計
        const intervals = [];
        for (let i = 1; i < sortedEvents.length; i++) {
            const interval = (sortedEvents[i].datetime_utc - sortedEvents[i-1].datetime_utc) / (1000 * 60 * 60);
            intervals.push(interval);
        }
        
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const medianInterval = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
        
        console.log(`  ⏱️ Average interval: ${avgInterval.toFixed(2)} hours (${(avgInterval/24).toFixed(2)} days)`);
        console.log(`  ⏱️ Median interval: ${medianInterval.toFixed(2)} hours (${(medianInterval/24).toFixed(2)} days)`);
    }
    
    // 予測テスト
    console.log('\n🔮 Testing predictions with real data...');
    try {
        const nextPrediction = await service.getNextPrediction();
        
        if (nextPrediction) {
            const now = Date.now();
            const timeUntil = nextPrediction.datetime_utc - now;
            const hoursUntil = timeUntil / (1000 * 60 * 60);
            const daysUntil = hoursUntil / 24;
            
            console.log('📈 Next Prediction Results:');
            console.log(`   🕐 Predicted time: ${new Date(nextPrediction.datetime_utc).toISOString()}`);
            console.log(`   ⏳ Hours until: ${hoursUntil.toFixed(2)}`);
            console.log(`   📅 Days until: ${daysUntil.toFixed(3)}`);
            console.log(`   📊 Confidence: ${(nextPrediction.confidence * 100).toFixed(1)}%`);
            console.log(`   🔬 Method: ${nextPrediction.method}`);
            
            // 妥当性チェック
            const isReasonable = daysUntil >= 0 && daysUntil <= 5;
            const isInFuture = timeUntil > 0;
            
            console.log(`   ✅ In future: ${isInFuture ? 'YES' : 'NO'}`);
            console.log(`   ✅ Reasonable range: ${isReasonable ? 'YES' : 'NO'}`);
            
            if (nextPrediction.model_info) {
                console.log(`   📋 Data points: ${nextPrediction.model_info.data_points}`);
                console.log(`   🎯 Algorithm: ${nextPrediction.model_info.prediction_method}`);
            }
        } else {
            console.log('❌ No prediction generated');
        }
        
    } catch (error) {
        console.log(`❌ Prediction failed: ${error.message}`);
    }
    
    // 精度評価
    console.log('\n🎯 Accuracy evaluation with Wynnpool data...');
    try {
        const accuracy = await service.evaluatePredictionAccuracy();
        
        if (accuracy.average_error_hours !== undefined) {
            console.log(`   ⏱️ Average error: ${accuracy.average_error_hours.toFixed(2)} hours`);
            console.log(`   📈 Accuracy score: ${accuracy.accuracy_score.toFixed(1)}%`);
            
            // Wynnpool目標と比較
            const wynnpoolCompliant = accuracy.average_error_hours <= 1.0;
            console.log(`   🎯 Wynnpool-level accuracy (≤1h): ${wynnpoolCompliant ? '✅ YES' : '❌ NO'}`);
            
            if (accuracy.max_error_hours !== undefined) {
                console.log(`   🔴 Max error: ${accuracy.max_error_hours.toFixed(2)} hours`);
                console.log(`   🟢 Min error: ${accuracy.min_error_hours.toFixed(2)} hours`);
            }
        } else {
            console.log(`   ❌ Accuracy evaluation failed: ${accuracy.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.log(`   ❌ Accuracy test failed: ${error.message}`);
    }
    
    console.log('\n🏁 Wynnpool data import and validation completed!');
    
    await service.onCleanup();
}

importWynnpoolData().catch(error => {
    console.error('Import failed:', error);
    process.exit(1);
});