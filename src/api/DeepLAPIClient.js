const BaseAPIClient = require('./BaseAPIClient');
const { ErrorTypes } = require('../utils/ErrorHandler');

class DeepLAPIClient extends BaseAPIClient {
    constructor(apiKey, options = {}) {
        const baseURL = options.baseURL || 'https://api-free.deepl.com/v2';
        super(baseURL, {
            timeout: 30000,
            headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/json'
            },
            ...options
        });
        
        this.apiKey = apiKey;
        this.customRateLimiter = new Map();
    }

    async translateText(text, targetLang, options = {}) {
        if (!text || text.trim().length === 0) {
            throw this.errorHandler.createUserFriendlyError(
                ErrorTypes.VALIDATION_ERROR,
                'Text to translate cannot be empty.'
            );
        }

        if (!targetLang) {
            throw this.errorHandler.createUserFriendlyError(
                ErrorTypes.VALIDATION_ERROR,
                'Target language must be specified.'
            );
        }

        const endpoint = '/translate';
        const data = {
            text: Array.isArray(text) ? text : [text],
            target_lang: targetLang.toUpperCase(),
            source_lang: options.sourceLang?.toUpperCase(),
            formality: options.formality || 'default',
            preserve_formatting: options.preserveFormatting !== false,
            tag_handling: options.tagHandling || 'xml'
        };

        try {
            const response = await this.post(endpoint, data, {
                cacheTtl: 3600000, // 1 hour cache
                ...options
            });

            return this.normalizeTranslationData(response.data);
        } catch (error) {
            if (error.response?.status === 400) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.VALIDATION_ERROR,
                    'Invalid translation request. Please check your input.'
                );
            }
            if (error.response?.status === 456) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.RATE_LIMIT_ERROR,
                    'Translation quota exceeded. Please try again later.'
                );
            }
            throw error;
        }
    }

    async detectLanguage(text, options = {}) {
        if (!text || text.trim().length === 0) {
            throw this.errorHandler.createUserFriendlyError(
                ErrorTypes.VALIDATION_ERROR,
                'Text for language detection cannot be empty.'
            );
        }

        const endpoint = '/detect';
        const data = {
            text: Array.isArray(text) ? text : [text]
        };

        try {
            const response = await this.post(endpoint, data, {
                cacheTtl: 3600000, // 1 hour cache
                ...options
            });

            return this.normalizeDetectionData(response.data);
        } catch (error) {
            if (error.response?.status === 400) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.VALIDATION_ERROR,
                    'Invalid language detection request.'
                );
            }
            throw error;
        }
    }

    async getSupportedLanguages(options = {}) {
        const endpoint = '/languages';
        const params = {
            type: options.type || 'target'
        };

        try {
            const response = await this.get(endpoint, params, {
                cacheTtl: 86400000, // 24 hours cache
                ...options
            });

            return this.normalizeLanguagesData(response.data);
        } catch (error) {
            throw error;
        }
    }

    async getUsage(options = {}) {
        const endpoint = '/usage';

        try {
            const response = await this.get(endpoint, {}, {
                cache: false,
                ...options
            });

            return this.normalizeUsageData(response.data);
        } catch (error) {
            throw error;
        }
    }

    async translateBatch(texts, targetLang, options = {}) {
        if (!Array.isArray(texts) || texts.length === 0) {
            throw this.errorHandler.createUserFriendlyError(
                ErrorTypes.VALIDATION_ERROR,
                'Batch translation requires an array of texts.'
            );
        }

        const maxBatchSize = options.maxBatchSize || 50;
        const results = [];

        for (let i = 0; i < texts.length; i += maxBatchSize) {
            const batch = texts.slice(i, i + maxBatchSize);
            const batchResult = await this.translateText(batch, targetLang, options);
            results.push(...batchResult.translations);
        }

        return {
            translations: results,
            totalCount: results.length
        };
    }

    async smartTranslate(text, targetLang, options = {}) {
        // First detect the language
        const detection = await this.detectLanguage(text, options);
        const sourceLang = detection.detections[0]?.language;

        // Skip translation if source and target are the same
        if (sourceLang === targetLang.toLowerCase()) {
            return {
                translations: [{
                    text: text,
                    detected_source_language: sourceLang
                }],
                skipped: true,
                reason: 'Source and target languages are the same'
            };
        }

        // Proceed with translation
        return await this.translateText(text, targetLang, {
            ...options,
            sourceLang: sourceLang
        });
    }

    normalizeTranslationData(data) {
        if (!data || !Array.isArray(data.translations)) {
            return { translations: [] };
        }

        return {
            translations: data.translations.map(translation => ({
                text: translation.text,
                detected_source_language: translation.detected_source_language?.toLowerCase(),
                confidence: translation.confidence
            })),
            totalCount: data.translations.length
        };
    }

    normalizeDetectionData(data) {
        if (!data || !Array.isArray(data.detections)) {
            return { detections: [] };
        }

        return {
            detections: data.detections.map(detection => ({
                language: detection.language.toLowerCase(),
                confidence: detection.confidence
            })),
            totalCount: data.detections.length
        };
    }

    normalizeLanguagesData(data) {
        if (!data || !Array.isArray(data)) {
            return { languages: [] };
        }

        return {
            languages: data.map(lang => ({
                language: lang.language.toLowerCase(),
                name: lang.name,
                supportsFormality: lang.supports_formality
            })),
            totalCount: data.length
        };
    }

    normalizeUsageData(data) {
        if (!data) return null;

        return {
            characterCount: data.character_count,
            characterLimit: data.character_limit,
            documentCount: data.document_count,
            documentLimit: data.document_limit,
            teamDocumentCount: data.team_document_count,
            teamDocumentLimit: data.team_document_limit,
            usagePercentage: data.character_limit > 0 ? 
                (data.character_count / data.character_limit) * 100 : 0
        };
    }

    isLanguageSupported(language) {
        const supportedLanguages = [
            'ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 
            'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'nb', 'nl', 'pl', 'pt', 
            'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'zh'
        ];
        return supportedLanguages.includes(language.toLowerCase());
    }

    async healthCheck() {
        try {
            const usage = await this.getUsage({ cache: false });
            return {
                healthy: true,
                usagePercentage: usage.usagePercentage,
                charactersRemaining: usage.characterLimit - usage.characterCount,
                responseTime: usage.metadata?.duration
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                responseTime: error.metadata?.duration
            };
        }
    }

    static create(apiKey, options = {}) {
        return new DeepLAPIClient(apiKey, options);
    }
}

module.exports = DeepLAPIClient;