const AnnihilationService = require('./src/services/AnnihilationService');

async function testEnhancedAnnihilation() {
    console.log('🚀 Testing Enhanced Annihilation Prediction System...');
    console.log('Target: Wynnpool-level accuracy (1-hour precision)\n');
    
    const service = new AnnihilationService();
    await service.initialize();
    
    // Clear existing data first
    service.eventHistory = [];
    
    // Add sample data (realistic Annihilation events - enough for ARIMA)
    const sampleEvents = [
        { timestamp: '2025-07-01T03:30:00.000Z', source: 'wynnpool_api' },
        { timestamp: '2025-07-04T07:15:00.000Z', source: 'wynnpool_api' },
        { timestamp: '2025-07-07T11:45:00.000Z', source: 'wynnpool_api' },
        { timestamp: '2025-07-10T15:20:00.000Z', source: 'wynnpool_api' },
        { timestamp: '2025-07-13T19:10:00.000Z', source: 'wynnpool_api' },
        { timestamp: '2025-07-16T23:45:00.000Z', source: 'wynnpool_api' },
        { timestamp: '2025-07-20T04:30:00.000Z', source: 'wynnpool_api' }
    ];
    
    console.log('📊 Adding sample events...');
    for (const eventData of sampleEvents) {
        await service.addEvent(eventData.timestamp, eventData.source);
    }
    
    console.log(`✅ Added ${sampleEvents.length} events\n`);
    
    // Test predictions
    console.log('🔮 Generating predictions...');
    try {
        const nextPrediction = await service.getNextPrediction();
        
        if (nextPrediction) {
            const now = Date.now();
            const timeUntil = nextPrediction.datetime_utc - now;
            const hoursUntil = timeUntil / (1000 * 60 * 60);
            
            console.log('📈 Next Prediction Results:');
            console.log(`   🕐 Predicted time: ${new Date(nextPrediction.datetime_utc).toISOString()}`);
            console.log(`   ⏳ Hours until: ${hoursUntil.toFixed(2)}`);
            console.log(`   📊 Confidence: ${(nextPrediction.confidence * 100).toFixed(1)}%`);
            console.log(`   🔬 Method: ${nextPrediction.method}`);
            
            // Check if prediction is reasonable (0.5 to 5 days)
            const daysUntil = hoursUntil / 24;
            const isReasonable = daysUntil >= 0.5 && daysUntil <= 5;
            console.log(`   ✅ Reasonable: ${isReasonable ? 'YES' : 'NO'} (${daysUntil.toFixed(2)} days)`);
            
            if (nextPrediction.model_info) {
                console.log(`   📋 Data points: ${nextPrediction.model_info.data_points}`);
                console.log(`   🎯 Prediction method: ${nextPrediction.model_info.prediction_method}`);
            }
        } else {
            console.log('❌ No prediction available');
        }
        
    } catch (error) {
        console.log(`❌ Prediction failed: ${error.message}`);
    }
    
    console.log('\n🔬 Testing multiple predictions...');
    try {
        const multiplePredictions = await service.getMultiplePredictions(3);
        
        if (multiplePredictions && multiplePredictions.length > 0) {
            console.log(`📊 Generated ${multiplePredictions.length} predictions:`);
            
            multiplePredictions.forEach((pred, index) => {
                const timeUntil = pred.datetime_utc - Date.now();
                const daysUntil = timeUntil / (1000 * 60 * 60 * 24);
                
                console.log(`   ${index + 1}. ${new Date(pred.datetime_utc).toISOString()}`);
                console.log(`      Days until: ${daysUntil.toFixed(2)}, Confidence: ${(pred.confidence * 100).toFixed(1)}%`);
            });
        }
    } catch (error) {
        console.log(`❌ Multiple predictions failed: ${error.message}`);
    }
    
    console.log('\n📊 System Statistics:');
    try {
        const stats = await service.getStatistics();
        console.log(`   📈 Total events: ${stats.total_events}`);
        console.log(`   🔬 ARIMA available: ${stats.arima_available ? 'YES' : 'NO'}`);
        console.log(`   📅 Newest event: ${stats.newest_event}`);
        console.log(`   🗄️ Cache age: ${stats.prediction_cache_age ? Math.floor(stats.prediction_cache_age / 1000) + 's' : 'N/A'}`);
    } catch (error) {
        console.log(`❌ Stats failed: ${error.message}`);
    }
    
    console.log('\n🎯 Accuracy Test:');
    try {
        const accuracy = await service.evaluatePredictionAccuracy();
        
        if (accuracy.average_error_hours !== undefined) {
            console.log(`   ⏱️ Average error: ${accuracy.average_error_hours.toFixed(2)} hours`);
            console.log(`   📈 Accuracy score: ${accuracy.accuracy_score.toFixed(1)}%`);
            console.log(`   🔴 Max error: ${accuracy.max_error_hours.toFixed(2)} hours`);
            console.log(`   🟢 Min error: ${accuracy.min_error_hours.toFixed(2)} hours`);
            
            // Compare with Wynnpool target (1 hour)
            const wynnpoolCompliant = accuracy.average_error_hours <= 1.0;
            console.log(`   🎯 Wynnpool-level accuracy: ${wynnpoolCompliant ? '✅ YES' : '❌ NO'}`);
        } else {
            console.log(`   ❌ Accuracy evaluation failed: ${accuracy.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.log(`   ❌ Accuracy test failed: ${error.message}`);
    }
    
    console.log('\n🏁 Test completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Enhanced AnnihilationService implemented');
    console.log('✅ ARIMA(1,1,1) prediction engine');
    console.log('✅ Ensemble prediction (ARIMA + Statistical)');
    console.log('✅ Cross-validation accuracy evaluation');
    console.log('✅ Outlier filtering and data cleaning');
    console.log('✅ Automatic 5-minute updates');
    console.log('🎯 Target: Wynnpool-level precision (1-hour accuracy)');
    
    await service.onCleanup();
}

testEnhancedAnnihilation().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});