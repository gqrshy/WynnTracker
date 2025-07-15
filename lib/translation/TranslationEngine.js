const deepl = require('deepl-node');
const EventEmitter = require('events');

class TranslationEngine extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.translator = new deepl.Translator(config.apiKey);
        this.rateLimiter = new Map();
        this.circuitBreaker = {
            failures: 0,
            lastFailure: null,
            state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
        };
    }

    async translate(text, sourceLang, targetLang, options = {}) {
        const { timeout = 5000, retries = 3 } = options;
        
        // サーキットブレーカーチェック
        if (this.circuitBreaker.state === 'OPEN') {
            const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure;
            if (timeSinceLastFailure < 30000) { // 30秒間は開放
                throw new Error('Circuit breaker is OPEN');
            }
            this.circuitBreaker.state = 'HALF_OPEN';
        }

        // レート制限チェック
        if (this.isRateLimited(targetLang)) {
            throw new Error('Rate limit exceeded');
        }

        let lastError;
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const result = await this.performTranslation(text, sourceLang, targetLang, timeout);
                
                // 成功時の処理
                this.resetCircuitBreaker();
                this.updateRateLimit(targetLang);
                this.emit('translationSuccess', { text, result, attempt });
                
                return result;
            } catch (error) {
                lastError = error;
                this.handleTranslationError(error, attempt);
                
                if (attempt < retries - 1) {
                    await this.exponentialBackoff(attempt);
                }
            }
        }

        this.updateCircuitBreaker();
        throw lastError;
    }

    async performTranslation(text, sourceLang, targetLang, timeout) {
        return Promise.race([
            this.translator.translateText(text, sourceLang, targetLang),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Translation timeout')), timeout)
            )
        ]);
    }

    isRateLimited(targetLang) {
        const key = `rate_${targetLang}`;
        const limit = this.rateLimiter.get(key);
        if (!limit) return false;
        
        const { count, resetTime } = limit;
        if (Date.now() > resetTime) {
            this.rateLimiter.delete(key);
            return false;
        }
        
        return count >= this.config.rateLimit;
    }

    updateRateLimit(targetLang) {
        const key = `rate_${targetLang}`;
        const now = Date.now();
        const resetTime = now + (60 * 1000); // 1分間
        
        const current = this.rateLimiter.get(key);
        if (current && now < current.resetTime) {
            current.count++;
        } else {
            this.rateLimiter.set(key, { count: 1, resetTime });
        }
    }

    resetCircuitBreaker() {
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.state = 'CLOSED';
    }

    updateCircuitBreaker() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();
        
        if (this.circuitBreaker.failures >= 5) {
            this.circuitBreaker.state = 'OPEN';
        }
    }

    handleTranslationError(error, attempt) {
        this.emit('translationError', { error, attempt });
        console.error(`[Translation Error] Attempt ${attempt + 1}:`, error.message);
    }

    async exponentialBackoff(attempt) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    getStats() {
        return {
            circuitBreaker: this.circuitBreaker,
            rateLimiter: Object.fromEntries(this.rateLimiter),
            isHealthy: this.circuitBreaker.state === 'CLOSED'
        };
    }
}

module.exports = TranslationEngine;