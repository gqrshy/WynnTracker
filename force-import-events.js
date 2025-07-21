const AnniService = require('./src/services/AnniService');
const AnniEvent = require('./src/models/AnniEvent');

// イベントデータ（簡略版）
const eventData = [
    { timestamp: '2025-04-27T06:30:28.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-04-30T06:07:48.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-05-03T08:38:00.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-05-06T12:59:29.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-05-09T15:33:06.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-05-12T16:45:14.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-05-16T02:14:11.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-05-19T07:42:10.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-05-22T12:57:16.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-05-25T21:50:30.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-05-29T06:27:00.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-06-01T16:25:10.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-06-04T22:05:08.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-06-08T03:11:30.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-06-11T03:28:04.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-06-14T08:09:00.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-06-17T10:49:00.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-06-20T12:41:53.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-06-23T20:54:07.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-06-27T02:29:58.000Z', server: 'asia', source: 'manual_asia' },
    { timestamp: '2025-07-15T12:28:15.000Z', server: 'asia', source: 'manual_asia' }
];

async function forceImportEvents() {
    console.log('🔧 Force importing events...');
    
    const anniService = new AnniService();
    await anniService.initialize();
    
    console.log('📊 Adding events directly to eventHistory...');
    
    // イベントを直接eventHistoryに追加
    eventData.forEach(data => {
        const event = new AnniEvent({
            server: data.server,
            timestamp: new Date(data.timestamp),
            source: data.source,
            confidence: 100,
            downtime: false
        });
        
        anniService.eventHistory.set(event.id, event);
        console.log(`Added: ${event.id}`);
    });
    
    console.log(`\n📈 Total events in memory: ${anniService.eventHistory.size}`);
    
    // イベント履歴を保存
    await anniService.saveEventHistory();
    console.log('✅ Event history saved');
    
    // 予測を生成
    console.log('\n🔮 Generating predictions...');
    const predictions = await anniService.updatePredictions('asia');
    console.log(`✅ Generated ${predictions.length} predictions`);
    
    predictions.forEach((pred, index) => {
        console.log(`  ${index + 1}. ${pred.method}: ${pred.predictedTime.toISOString()} (${pred.confidence}%)`);
    });
    
    // 検証
    console.log('\n🔍 Verification:');
    const retrievedEvents = await anniService.getEvents('asia');
    console.log(`Retrieved events: ${retrievedEvents.length}`);
    
    const retrievedPredictions = await anniService.getPredictions('asia');
    console.log(`Retrieved predictions: ${retrievedPredictions.length}`);
}

forceImportEvents().catch(console.error);