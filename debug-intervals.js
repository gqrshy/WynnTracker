const AnniService = require('./src/services/AnniService');

async function debugIntervals() {
    console.log('🔧 Debugging interval calculations...');
    
    const anniService = new AnniService();
    await anniService.initialize();
    
    // Get events for Asia server
    const events = await anniService.getEvents('asia');
    console.log(`🌏 Asia server events: ${events.length}`);
    
    // Sort events by timestamp (oldest first)
    const sortedEvents = events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    console.log('\n📅 Event Timeline:');
    sortedEvents.forEach((event, index) => {
        const eventDate = new Date(event.timestamp);
        console.log(`  ${index + 1}. ${eventDate.toISOString()} (${event.source})`);
    });
    
    // Calculate intervals
    console.log('\n📊 Interval Analysis:');
    const intervals = [];
    
    for (let i = 1; i < sortedEvents.length; i++) {
        const previousEvent = sortedEvents[i-1];
        const currentEvent = sortedEvents[i];
        
        const interval = new Date(currentEvent.timestamp) - new Date(previousEvent.timestamp);
        const intervalDays = interval / (24 * 60 * 60 * 1000);
        
        intervals.push(interval);
        
        console.log(`  ${i}. ${new Date(previousEvent.timestamp).toISOString()} → ${new Date(currentEvent.timestamp).toISOString()}`);
        console.log(`     Interval: ${intervalDays.toFixed(3)} days`);
    }
    
    // Calculate statistics
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const avgIntervalDays = avgInterval / (24 * 60 * 60 * 1000);
    
    console.log(`\n📈 Statistics:`);
    console.log(`  Average interval: ${avgIntervalDays.toFixed(3)} days`);
    console.log(`  Expected interval: 3.0927 days`);
    console.log(`  Deviation: ${Math.abs(avgIntervalDays - 3.0927).toFixed(3)} days`);
    
    // Check most recent event
    const mostRecentEvent = sortedEvents[sortedEvents.length - 1];
    const now = new Date();
    const timeSinceLastEvent = now - new Date(mostRecentEvent.timestamp);
    const daysSinceLastEvent = timeSinceLastEvent / (24 * 60 * 60 * 1000);
    
    console.log(`\n⏰ Most recent event: ${mostRecentEvent.timestamp}`);
    console.log(`   Time since: ${daysSinceLastEvent.toFixed(3)} days`);
    console.log(`   Should predict: ${new Date(new Date(mostRecentEvent.timestamp).getTime() + avgInterval).toISOString()}`);
    
    // Check if this is reasonable
    const predictedTime = new Date(new Date(mostRecentEvent.timestamp).getTime() + avgInterval);
    const timeUntilPrediction = predictedTime - now;
    const daysUntilPrediction = timeUntilPrediction / (24 * 60 * 60 * 1000);
    
    console.log(`   Time until prediction: ${daysUntilPrediction.toFixed(3)} days`);
    console.log(`   Is reasonable: ${daysUntilPrediction >= 0 && daysUntilPrediction <= 5 ? '✅ YES' : '❌ NO'}`);
}

debugIntervals().catch(console.error);