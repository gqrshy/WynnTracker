const { parentPort, workerData } = require('worker_threads');
const deepl = require('deepl-node');

class TranslationWorker {
    constructor(config) {
        this.config = config;
        this.translator = new deepl.Translator(config.apiKey);
        this.isReady = true;
    }

    async processMessages(messages, channelId, options) {
        const results = [];
        const settings = options.settings || {};
        const targetLang = settings.targetLang || 'EN-US';

        for (const message of messages) {
            try {
                const result = await this.translateMessage(message, targetLang, options);
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                console.error(`[TranslationWorker] Error processing message ${message.id}:`, error);
                // 個別のメッセージエラーは無視して続行
            }
        }

        return results;
    }

    async translateMessage(message, targetLang, options) {
        const timeout = options.timeout || 5000;
        
        // Validate message structure
        if (!message || !message.content) {
            console.warn(`[TranslationWorker] Skipping message with missing content:`, message);
            return null;
        }
        
        try {
            const translationResult = await Promise.race([
                this.translator.translateText(message.content, null, targetLang),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Translation timeout')), timeout)
                )
            ]);

            // 元のテキストと翻訳が同じ場合はスキップ
            if (translationResult.text === message.content) {
                return null;
            }

            return {
                message,
                translatedText: translationResult.text,
                targetLang,
                detectedLang: translationResult.detected_source_language,
                processingTime: Date.now() - message.timestamp
            };

        } catch (error) {
            throw new Error(`Translation failed for message ${message.id}: ${error.message}`);
        }
    }

    async handleJob(jobData) {
        const { jobId, messages, channelId, options } = jobData;
        
        try {
            const results = await this.processMessages(messages, channelId, options);
            
            parentPort.postMessage({
                jobId,
                success: true,
                data: results
            });
            
        } catch (error) {
            parentPort.postMessage({
                jobId,
                success: false,
                error: error.message
            });
        }
    }
}

// ワーカーの初期化
const worker = new TranslationWorker(workerData.config);

// メッセージハンドラー
parentPort.on('message', (jobData) => {
    worker.handleJob(jobData);
});

// ワーカーの準備完了を通知
parentPort.postMessage({
    type: 'ready',
    workerId: process.pid
});