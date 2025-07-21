const AnniService = require('./src/services/AnniService');

async function testPredictions() {
    console.log('🔧 Testing fixed prediction algorithms...');
    
    const anniService = new AnniService();
    await anniService.initialize();
    
    console.log(`📊 Events loaded: ${anniService.eventHistory.size}`);
    
    // Get events for Asia server
    const events = await anniService.getEvents('asia');
    console.log(`🌏 Asia server events: ${events.length}`);
    
    if (events.length > 0) {
        const lastEvent = events[0]; // Most recent
        const lastEventDate = new Date(lastEvent.timestamp);
        const now = new Date();
        const timeSinceLastEvent = now - lastEventDate;
        const daysSinceLastEvent = timeSinceLastEvent / (24 * 60 * 60 * 1000);
        
        console.log(`\n📅 Last event: ${lastEventDate.toISOString()}`);
        console.log(`⏰ Time since last event: ${daysSinceLastEvent.toFixed(2)} days`);
        console.log(`🕐 Current time: ${now.toISOString()}`);
    }
    
    // Generate predictions
    console.log('\n🔮 Generating predictions...');
    const predictions = await anniService.updatePredictions('asia');
    console.log(`✅ Generated ${predictions.length} predictions`);
    
    predictions.forEach((pred, index) => {
        const now = new Date();
        const timeUntilPrediction = pred.predictedTime - now;
        const daysUntilPrediction = timeUntilPrediction / (24 * 60 * 60 * 1000);
        const hoursUntilPrediction = timeUntilPrediction / (60 * 60 * 1000);
        
        console.log(`\n  ${index + 1}. ${pred.method} Prediction:`);
        console.log(`     🕐 Predicted time: ${pred.predictedTime.toISOString()}`);
        console.log(`     📊 Confidence: ${pred.confidence}%`);
        console.log(`     ⏳ Days until: ${daysUntilPrediction.toFixed(3)} days`);
        console.log(`     🕒 Hours until: ${hoursUntilPrediction.toFixed(1)} hours`);
        
        if (pred.metadata) {
            console.log(`     📋 Method: ${pred.metadata.method}`);
            if (pred.metadata.avgIntervalDays) {
                console.log(`     📈 Avg interval: ${pred.metadata.avgIntervalDays.toFixed(3)} days`);
            }
            if (pred.metadata.expectedIntervalDays) {
                console.log(`     🎯 Expected interval: ${pred.metadata.expectedIntervalDays.toFixed(3)} days`);
            }
            if (pred.metadata.standardDeviationHours) {
                console.log(`     📊 Std dev: ${pred.metadata.standardDeviationHours.toFixed(2)} hours`);
            }
        }
    });
    
    // Check if predictions are reasonable (within 0.5 to 5 days)
    console.log('\n📋 Prediction Analysis:');
    predictions.forEach((pred, index) => {
        const now = new Date();
        const timeUntilPrediction = pred.predictedTime - now;
        const daysUntilPrediction = timeUntilPrediction / (24 * 60 * 60 * 1000);
        
        const isReasonable = daysUntilPrediction >= 0.5 && daysUntilPrediction <= 5;
        const status = isReasonable ? '✅ REASONABLE' : '❌ UNREASONABLE';
        
        console.log(`  ${pred.method}: ${daysUntilPrediction.toFixed(3)} days - ${status}`);
    });
    
    console.log('\n🎉 Test completed!');
}

testPredictions().catch(console.error);