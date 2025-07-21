const AnniService = require('./src/services/AnniService');

async function testPredictions() {
    console.log('🔮 Testing prediction system...');
    
    const anniService = new AnniService();
    await anniService.initialize();
    
    // Get events for asia server
    const events = await anniService.getEvents('asia');
    console.log(`📊 Found ${events.length} events for Asia server`);
    
    if (events.length > 0) {
        console.log('📅 Recent events:');
        events.slice(0, 5).forEach((event, index) => {
            console.log(`  ${index + 1}. ${event.timestamp.toISOString()} (${event.source})`);
        });
    }
    
    // Update predictions
    console.log('\n🔄 Updating predictions...');
    const predictions = await anniService.updatePredictions('asia');
    console.log(`✅ Generated ${predictions.length} predictions`);
    
    predictions.forEach((pred, index) => {
        console.log(`  ${index + 1}. ${pred.method}: ${pred.predictedTime.toISOString()} (${pred.confidence}%)`);
    });
    
    // Test getPredictions
    console.log('\n📋 Getting predictions...');
    const savedPredictions = await anniService.getPredictions('asia');
    console.log(`📊 Retrieved ${savedPredictions.length} saved predictions`);
    
    savedPredictions.forEach((pred, index) => {
        console.log(`  ${index + 1}. ${pred.method}: ${pred.predictedTime.toISOString()} (${pred.confidence}%)`);
    });
}

testPredictions().catch(console.error);