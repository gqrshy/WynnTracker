const EventEmitter = require('events');
const { Worker } = require('worker_threads');
const path = require('path');

class BatchProcessor extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.queues = new Map();
        this.workers = [];
        this.activeJobs = new Map();
        this.statistics = {
            processed: 0,
            failed: 0,
            avgProcessingTime: 0,
            queueSizes: new Map()
        };
        
        this.initializeWorkers();
    }

    initializeWorkers() {
        const workerCount = this.config.workerCount || 2;
        const workerScript = path.join(__dirname, 'TranslationWorker.js');
        
        for (let i = 0; i < workerCount; i++) {
            const worker = new Worker(workerScript, {
                workerData: { config: this.config }
            });
            
            worker.on('message', (result) => this.handleWorkerMessage(result));
            worker.on('error', (error) => this.handleWorkerError(error));
            
            this.workers.push({
                worker,
                busy: false,
                processedCount: 0
            });
        }
    }

    async addToBatch(channelId, message, options = {}) {
        const batchDelay = options.delay || this.config.batchDelay || 100;
        
        if (!this.queues.has(channelId)) {
            this.queues.set(channelId, {
                messages: [],
                timer: null,
                options: options
            });
        }

        const queue = this.queues.get(channelId);
        queue.messages.push(message);
        
        // 既存タイマーをクリア
        if (queue.timer) {
            clearTimeout(queue.timer);
        }

        // 新しいタイマーを設定
        queue.timer = setTimeout(() => {
            this.processBatch(channelId);
        }, batchDelay);

        // 統計更新
        this.statistics.queueSizes.set(channelId, queue.messages.length);
        this.emit('messageQueued', { channelId, queueSize: queue.messages.length });
    }

    async processBatch(channelId) {
        const queue = this.queues.get(channelId);
        if (!queue || queue.messages.length === 0) return;

        const messages = queue.messages.splice(0);
        this.queues.delete(channelId);
        
        const batchId = this.generateBatchId();
        const startTime = Date.now();
        
        this.emit('batchStart', { batchId, channelId, messageCount: messages.length });

        try {
            // ワーカーに処理を分散
            const chunks = this.chunkMessages(messages, this.workers.length);
            const promises = chunks.map((chunk, index) => {
                return this.processChunk(chunk, channelId, index, queue.options);
            });

            const results = await Promise.allSettled(promises);
            const successfulResults = results
                .filter(r => r.status === 'fulfilled')
                .flatMap(r => r.value || []);
            const failed = results.filter(r => r.status === 'rejected').length;

            const processingTime = Date.now() - startTime;
            this.updateStatistics(successfulResults.length, failed, processingTime);

            this.emit('batchComplete', {
                batchId,
                channelId,
                successful: successfulResults.length,
                failed,
                processingTime,
                results: successfulResults
            });

        } catch (error) {
            this.emit('batchError', { batchId, channelId, error });
            console.error(`[BatchProcessor] Error processing batch ${batchId}:`, error);
        }
    }

    chunkMessages(messages, chunkCount) {
        const chunks = Array.from({ length: chunkCount }, () => []);
        messages.forEach((message, index) => {
            chunks[index % chunkCount].push(message);
        });
        return chunks.filter(chunk => chunk.length > 0);
    }

    async processChunk(messages, channelId, workerIndex, options) {
        const worker = this.getAvailableWorker();
        if (!worker) {
            throw new Error('No available workers');
        }

        worker.busy = true;
        const jobId = this.generateJobId();
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                worker.busy = false;
                reject(new Error('Worker timeout'));
            }, options.timeout || 30000);

            this.activeJobs.set(jobId, {
                resolve,
                reject,
                timeout,
                worker,
                startTime: Date.now()
            });

            worker.worker.postMessage({
                jobId,
                messages,
                channelId,
                options
            });
        });
    }

    getAvailableWorker() {
        return this.workers.find(w => !w.busy) || null;
    }

    handleWorkerMessage(result) {
        const { jobId, success, data, error } = result;
        const job = this.activeJobs.get(jobId);
        
        if (!job) return;

        clearTimeout(job.timeout);
        job.worker.busy = false;
        job.worker.processedCount++;
        
        this.activeJobs.delete(jobId);

        if (success) {
            job.resolve(data);
        } else {
            job.reject(new Error(error));
        }
    }

    handleWorkerError(error) {
        console.error('[BatchProcessor] Worker error:', error);
        this.emit('workerError', { error });
    }

    updateStatistics(successful, failed, processingTime) {
        this.statistics.processed += successful;
        this.statistics.failed += failed;
        
        // 移動平均でprocessingTimeを更新
        const alpha = 0.1; // 平滑化係数
        if (this.statistics.avgProcessingTime === 0) {
            this.statistics.avgProcessingTime = processingTime;
        } else {
            this.statistics.avgProcessingTime = 
                (alpha * processingTime) + ((1 - alpha) * this.statistics.avgProcessingTime);
        }
    }

    generateBatchId() {
        return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getStats() {
        return {
            activeQueues: this.queues.size,
            totalQueuedMessages: Array.from(this.queues.values()).reduce((sum, q) => sum + q.messages.length, 0),
            activeJobs: this.activeJobs.size,
            workerStats: this.workers.map((w, i) => ({
                index: i,
                busy: w.busy,
                processedCount: w.processedCount
            })),
            statistics: { ...this.statistics }
        };
    }

    async destroy() {
        // 全てのキューをクリア
        for (const [channelId, queue] of this.queues) {
            if (queue.timer) {
                clearTimeout(queue.timer);
            }
        }
        this.queues.clear();

        // 全てのワーカーを終了
        await Promise.all(this.workers.map(w => w.worker.terminate()));
        this.workers.length = 0;

        // アクティブなジョブをクリア
        this.activeJobs.clear();
    }
}

module.exports = BatchProcessor;