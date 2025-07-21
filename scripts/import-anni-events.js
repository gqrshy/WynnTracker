#!/usr/bin/env node

const AnniService = require('../src/services/AnniService');
const path = require('path');

// イベントデータ
const eventData = {
  "events": [
    {
      "timestamp": "2025-04-27T06:30:28.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:42:05.731Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-04-27 15:30:28"
    },
    {
      "timestamp": "2025-04-30T06:07:48.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:42:14.591Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-04-30 15:07:48"
    },
    {
      "timestamp": "2025-05-03T08:38:00.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:42:23.957Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-05-03 17:38:00"
    },
    {
      "timestamp": "2025-05-06T12:59:29.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:42:36.629Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-05-06 21:59:29"
    },
    {
      "timestamp": "2025-05-09T15:33:06.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:42:49.977Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-05-10 00:33:06"
    },
    {
      "timestamp": "2025-05-12T16:45:14.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:43:05.998Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-05-13 01:45:14"
    },
    {
      "timestamp": "2025-05-16T02:14:11.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:45:12.483Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-05-16 11:14:11"
    },
    {
      "timestamp": "2025-05-19T07:42:10.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:45:32.414Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-05-19 16:42:10"
    },
    {
      "timestamp": "2025-05-22T12:57:16.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:46:05.520Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-05-22 21:57:16"
    },
    {
      "timestamp": "2025-05-25T21:50:30.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:46:22.422Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-05-26 06:50:30"
    },
    {
      "timestamp": "2025-05-29T06:27:00.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:46:43.236Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-05-29 15:27:00"
    },
    {
      "timestamp": "2025-06-01T16:25:10.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:46:50.631Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-06-02 01:25:10"
    },
    {
      "timestamp": "2025-06-04T22:05:08.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:46:59.377Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-06-05 07:05:08"
    },
    {
      "timestamp": "2025-06-08T03:11:30.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:47:09.864Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-06-08 12:11:30"
    },
    {
      "timestamp": "2025-06-11T03:28:04.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:47:17.632Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-06-11 12:28:04"
    },
    {
      "timestamp": "2025-06-14T08:09:00.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:47:25.453Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-06-14 17:09:00"
    },
    {
      "timestamp": "2025-06-17T10:49:00.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:47:55.582Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-06-17 19:49:00"
    },
    {
      "timestamp": "2025-06-20T12:41:53.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T13:48:03.119Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-06-20 21:41:53"
    },
    {
      "timestamp": "2025-06-23T20:54:07.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T10:25:03.015Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-06-24 05:54:07"
    },
    {
      "timestamp": "2025-06-27T02:29:58.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T10:24:53.156Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-06-27 11:29:58"
    },
    {
      "timestamp": "2025-06-30T03:39:00.000Z",
      "source": "manual",
      "confidence": 100,
      "addedAt": "2025-07-12T12:17:00.000Z"
    },
    {
      "timestamp": "2025-07-03T05:37:00.000Z",
      "source": "manual",
      "confidence": 100,
      "addedAt": "2025-07-12T12:17:00.000Z"
    },
    {
      "timestamp": "2025-07-06T07:36:00.000Z",
      "source": "manual",
      "confidence": 100,
      "addedAt": "2025-07-12T12:17:00.000Z"
    },
    {
      "timestamp": "2025-07-09T07:01:00.000Z",
      "source": "manual",
      "confidence": 100,
      "addedAt": "2025-07-12T12:17:00.000Z"
    },
    {
      "timestamp": "2025-07-12T10:37:00.000Z",
      "source": "manual",
      "confidence": 100,
      "addedAt": "2025-07-12T12:17:00.000Z"
    },
    {
      "timestamp": "2025-07-15T12:28:15.000Z",
      "source": "manual_asia",
      "confidence": 100,
      "addedAt": "2025-07-16T10:24:36.241Z",
      "server": "asia",
      "downtime": false,
      "jst_original": "2025-07-15 21:28:15"
    }
  ],
  "created_at": "2025-07-12T12:14:02.006Z",
  "reset_count": 1
};

async function importEvents() {
  console.log('🚀 Starting event import...');
  
  try {
    // AnniServiceの初期化
    const anniService = new AnniService();
    await anniService.initialize();
    
    console.log(`📊 Found ${eventData.events.length} events to import`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // 各イベントを処理
    for (const [index, event] of eventData.events.entries()) {
      try {
        const eventToAdd = {
          server: event.server || 'unknown',
          timestamp: new Date(event.timestamp),
          confidence: event.confidence || 100,
          source: event.source || 'manual',
          downtime: event.downtime || false
        };
        
        console.log(`\n📝 Processing event ${index + 1}/${eventData.events.length}`);
        console.log(`   Server: ${eventToAdd.server}`);
        console.log(`   Time: ${eventToAdd.timestamp.toISOString()}`);
        console.log(`   JST Original: ${event.jst_original || 'N/A'}`);
        
        // イベントを追加
        const addedEvent = await anniService.addEvent(eventToAdd);
        
        // 手動で予測を更新 (検証済みイベントではないため)
        if (index === eventData.events.length - 1) {
            // 最後のイベントの後に予測を更新
            await anniService.updatePredictions(eventToAdd.server);
        }
        
        console.log(`   ✅ Added event ID: ${addedEvent.id}`);
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Error processing event ${index + 1}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📈 Import Summary:`);
    console.log(`   ✅ Successfully imported: ${successCount} events`);
    console.log(`   ❌ Failed to import: ${errorCount} events`);
    console.log(`   📊 Total processed: ${eventData.events.length} events`);
    
    // 統計情報を表示
    const stats = await anniService.getEventStatistics(null, 365);
    console.log(`\n📊 Current Database Statistics:`);
    console.log(`   Total events: ${stats.totalEvents}`);
    console.log(`   Verified events: ${stats.verifiedEvents}`);
    console.log(`   Average interval: ${stats.averageInterval?.toFixed(1)} minutes`);
    
    if (Object.keys(stats.sources).length > 0) {
      console.log(`\n📋 Source Distribution:`);
      Object.entries(stats.sources).forEach(([source, count]) => {
        console.log(`   ${source}: ${count} events`);
      });
    }
    
    console.log('\n🎉 Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  importEvents().catch(console.error);
}

module.exports = { importEvents };