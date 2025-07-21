const AnnihilationService = require('./src/services/AnnihilationService');

async function testWynnpoolPrediction() {
    console.log('🔮 Testing Annihilation prediction with Wynnpool data...');
    
    const service = new AnnihilationService();
    await service.initialize();
    
    console.log(`📊 Total events loaded: ${service.eventHistory.length}`);
    
    if (service.eventHistory.length === 0) {
        console.log('❌ No events found. Please run import-wynnpool-data.js first');
        return;
    }
    
    // Test next prediction
    console.log('\n🔮 Testing next prediction...');
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
            
            // Validation checks
            const isInFuture = timeUntil > 0;
            const isReasonable = daysUntil >= 0.5 && daysUntil <= 5;
            
            console.log(`   ✅ In future: ${isInFuture ? 'YES' : 'NO'}`);
            console.log(`   ✅ Reasonable range: ${isReasonable ? 'YES' : 'NO'}`);
            
            if (!isInFuture) {
                console.log('   ❌ ERROR: Prediction is in the past!');
            }
            
            if (nextPrediction.model_info) {
                console.log(`   📋 Data points: ${nextPrediction.model_info.data_points}`);
                console.log(`   🎯 Algorithm: ${nextPrediction.model_info.prediction_method}`);
            }
        } else {
            console.log('❌ No prediction available');
        }
        
    } catch (error) {
        console.log(`❌ Prediction failed: ${error.message}`);
    }
    
    // Test multiple predictions
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
    
    // Statistics
    console.log('\n📊 System Statistics:');
    try {
        const stats = await service.getStatistics();
        console.log(`   📈 Total events: ${stats.total_events}`);
        console.log(`   🔬 ARIMA available: ${stats.arima_available ? 'YES' : 'NO'}`);
        console.log(`   📅 Newest event: ${stats.newest_event}`);
        console.log(`   ⏰ Cache age: ${stats.prediction_cache_age ? Math.floor(stats.prediction_cache_age / 1000) + 's' : 'N/A'}`);
    } catch (error) {
        console.log(`❌ Stats failed: ${error.message}`);
    }
    
    console.log('\n🏁 Test completed!');
    await service.onCleanup();
}

testWynnpoolPrediction().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});