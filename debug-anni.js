const AnniService = require('./src/services/AnniService');

async function debugAnniService() {
    console.log('🔍 AnniService Debug...');
    
    const anniService = new AnniService();
    await anniService.initialize();
    
    // イベント数を確認
    console.log('\n📊 Event History:');
    console.log(`EventHistory Map size: ${anniService.eventHistory.size}`);
    
    // Asiaサーバーのイベントを確認
    const asiaEvents = await anniService.getEvents('asia');
    console.log(`Asia events: ${asiaEvents.length}`);
    
    if (asiaEvents.length > 0) {
        console.log('\n📅 Recent Asia events:');
        asiaEvents.slice(0, 5).forEach((event, index) => {
            console.log(`  ${index + 1}. ${event.timestamp} (${event.source})`);
        });
        
        // 統計予測を手動で生成してみる
        console.log('\n🔮 Manual prediction generation:');
        try {
            const prediction = await anniService.generateStatisticalPrediction('asia', asiaEvents);
            console.log('Statistical prediction result:', prediction);
        } catch (error) {
            console.error('Statistical prediction error:', error);
        }
    }
    
    // 予測を確認
    console.log('\n📋 Predictions:');
    console.log(`Predictions Map size: ${anniService.predictions.size}`);
    
    const predictions = await anniService.getPredictions('asia');
    console.log(`Retrieved predictions: ${predictions.length}`);
    
    // 手動で予測を更新
    console.log('\n🔄 Manual prediction update:');
    try {
        const updatedPredictions = await anniService.updatePredictions('asia');
        console.log(`Updated predictions: ${updatedPredictions.length}`);
        
        updatedPredictions.forEach((pred, index) => {
            console.log(`  ${index + 1}. ${pred.method}: ${pred.predictedTime} (${pred.confidence}%)`);
        });
    } catch (error) {
        console.error('Manual prediction update error:', error);
    }
}

debugAnniService().catch(console.error);