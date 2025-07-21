const BaseService = require('./BaseService');
const DeepLAPIClient = require('../api/DeepLAPIClient');
const Translation = require('../models/Translation');
const { ErrorTypes } = require('../utils/ErrorHandler');

class TranslationService extends BaseService {
    constructor(options = {}) {
        super(options);
        this.deepLApi = null;
        this.supportedLanguages = ['en', 'ja', 'en-us'];
        this.autoTranslateChannels = new Map();
        this.translationQueue = [];
        this.processing = false;
        this.batchSize = 10;
        this.processingInterval = null;
        this.webhookCache = new Map();
        this.messageMapping = new Map(); // originalMessageId -> translatedMessageId
    }

    async onInitialize() {
        const apiKey = this.getConfig('apis.deepl.key');
        
        if (!apiKey) {
            this.warn('DeepL API key not configured - translation features will be limited');
            // Set a flag to indicate limited mode
            this.limitedMode = true;
            await this.loadAutoTranslateSettings();
            this.info('TranslationService initialized in limited mode (no API key)');
            return;
        }

        try {
            const DeepLAPIClient = require('../api/DeepLAPIClient');
            this.deepLApi = new DeepLAPIClient(apiKey);
            await this.loadAutoTranslateSettings();
            this.startBatchProcessor();
            this.limitedMode = false;
            this.info('TranslationService initialized with DeepL API');
        } catch (error) {
            this.error('Failed to initialize DeepL API client', { error: error.message });
            this.limitedMode = true;
            await this.loadAutoTranslateSettings();
            this.info('TranslationService initialized in limited mode (API client error)');
        }
    }

    async loadAutoTranslateSettings() {
        try {
            console.log('[TranslationService] Loading auto-translate settings from cache...');
            let settings = await this.cache.get('auto_translate_settings', { useFile: true });
            
            // If cache is empty, try loading from backup file
            if (!settings) {
                console.log('[TranslationService] Cache empty, trying backup file...');
                try {
                    const fs = require('fs').promises;
                    const path = require('path');
                    const backupPath = path.join(process.cwd(), 'data', 'auto_translate_settings.json');
                    const backupData = await fs.readFile(backupPath, 'utf8');
                    settings = JSON.parse(backupData);
                    console.log('[TranslationService] Loaded settings from backup file:', settings);
                } catch (backupError) {
                    console.log('[TranslationService] No backup file found:', backupError.message);
                }
            }
            
            console.log('[TranslationService] Loaded settings:', {
                hasSettings: !!settings,
                settingsCount: settings ? Object.keys(settings).length : 0,
                channelIds: settings ? Object.keys(settings) : [],
                settings: settings
            });
            
            if (settings) {
                this.autoTranslateChannels = new Map(Object.entries(settings));
                console.log('[TranslationService] Auto-translate channels map updated:', {
                    mapSize: this.autoTranslateChannels.size,
                    channels: Array.from(this.autoTranslateChannels.keys())
                });
            } else {
                console.log('[TranslationService] No auto-translate settings found');
            }
        } catch (error) {
            console.error('[TranslationService] Failed to load auto-translate settings:', error);
            this.warn('Failed to load auto-translate settings', { error: error.message });
        }
    }

    async saveAutoTranslateSettings() {
        try {
            const settings = Object.fromEntries(this.autoTranslateChannels);
            console.log('[TranslationService] Saving auto-translate settings:', {
                settingsCount: Object.keys(settings).length,
                channelIds: Object.keys(settings),
                settings: settings
            });
            
            // Use a very long TTL for persistent settings (24 hours)
            await this.cache.set('auto_translate_settings', settings, { 
                useFile: true, 
                ttl: 24 * 60 * 60 * 1000 // 24 hours
            });
            
            // Also save as a backup JSON file
            const fs = require('fs').promises;
            const path = require('path');
            const backupPath = path.join(process.cwd(), 'data', 'auto_translate_settings.json');
            await fs.writeFile(backupPath, JSON.stringify(settings, null, 2));
            
            console.log('[TranslationService] Auto-translate settings saved successfully');
        } catch (error) {
            console.error('[TranslationService] Failed to save auto-translate settings:', error);
            this.error('Failed to save auto-translate settings', { error: error.message });
        }
    }

    async translateText(text, targetLang, options = {}) {
        console.log('[TranslationService] translateText called:', {
            textLength: text?.length,
            targetLang,
            limitedMode: this.limitedMode,
            hasDeepLApi: !!this.deepLApi
        });
        
        try {
            await this.ensureInitialized();
            console.log('[TranslationService] Service initialized, proceeding with translation');
            
            // Input validation
            if (!text || text.trim().length === 0) {
                console.log('[TranslationService] Validation error: empty text');
                throw new Error('Text to translate cannot be empty.');
            }

            if (!this.isLanguageSupported(targetLang)) {
                console.log('[TranslationService] Validation error: unsupported language:', targetLang);
                throw new Error(`Target language '${targetLang}' is not supported.`);
            }
            
            console.log('[TranslationService] Input validation passed');

            // Check if in limited mode
            if (this.limitedMode || !this.deepLApi) {
                // Return mock translation for development/testing
                this.warn('Translation service in limited mode, returning mock translation');
                const Translation = require('../models/Translation');
                return new Translation({
                    originalText: text,
                    translatedText: `[${targetLang.toUpperCase()}] ${text}`,
                    detected_source_language: 'EN',
                    targetLang: targetLang,
                    confidence: 50,
                    service: 'Mock',
                    cached: false
                });
            }

            const cacheKey = `translate:${this.hashText(text)}:${targetLang}`;
            
            // Try cache first
            try {
                const cached = await this.cache.get(cacheKey);
                if (cached) {
                    console.log('[TranslationService] Returning cached translation');
                    return cached;
                }
            } catch (cacheError) {
                console.warn('[TranslationService] Cache read error:', cacheError.message);
            }
            
            try {
                console.log('[TranslationService] Attempting API translation...');
                const result = await this.deepLApi.translateText(text, targetLang, options);
                const Translation = require('../models/Translation');
                
                const translation = new Translation({
                    originalText: text,
                    translatedText: result.translations[0].text,
                    detected_source_language: result.translations[0].detected_source_language,
                    targetLang: targetLang,
                    confidence: result.translations[0].confidence || 100,
                    service: 'DeepL',
                    cached: false
                });
                
                // Cache the result
                try {
                    await this.cache.set(cacheKey, translation, { ttl: 3600000 });
                } catch (cacheError) {
                    console.warn('[TranslationService] Cache write error:', cacheError.message);
                }
                
                this.info('Text translated', {
                    sourceLang: translation.sourceLang,
                    targetLang: translation.targetLang,
                    length: text.length
                });
                
                return translation;
            } catch (apiError) {
                console.log('[TranslationService] API translation failed, using fallback');
                this.error('DeepL API translation failed', { 
                    error: apiError.message,
                    text: text.substring(0, 50) + '...',
                    targetLang 
                });
                
                // Fallback to mock translation
                const Translation = require('../models/Translation');
                return new Translation({
                    originalText: text,
                    translatedText: `[API Error] ${text}`,
                    detected_source_language: 'EN',
                    targetLang: targetLang,
                    confidence: 25,
                    service: 'Fallback',
                    cached: false
                });
            }
        } catch (error) {
            console.error('[TranslationService] translateText error:', {
                error: error.message,
                stack: error.stack,
                name: error.name
            });
            
            // Handle the error directly
            throw error;
        }
    }

    async detectLanguage(text, options = {}) {
        return this.withErrorHandling(async () => {
            if (!text || text.trim().length === 0) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.VALIDATION_ERROR,
                    'Text for language detection cannot be empty.'
                );
            }

            // Check if in limited mode
            if (this.limitedMode || !this.deepLApi) {
                console.log('[TranslationService] Language detection in limited mode');
                this.warn('Language detection in limited mode, returning mock result');
                
                // Simple heuristic for Japanese detection in limited mode
                const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
                const mockResult = {
                    detections: [{
                        language: hasJapanese ? 'JA' : 'EN',
                        confidence: hasJapanese ? 0.8 : 0.7
                    }]
                };
                
                console.log('[TranslationService] Mock language detection result:', mockResult);
                return mockResult;
            }

            const cacheKey = `detect:${this.hashText(text)}`;
            
            return this.withCache(cacheKey, async () => {
                try {
                    const result = await this.deepLApi.detectLanguage(text, options);
                    
                    console.log('[TranslationService] API language detection result:', result);
                    
                    this.info('Language detected', {
                        detectedLang: result.detections[0]?.language,
                        confidence: result.detections[0]?.confidence
                    });
                    
                    return result;
                } catch (apiError) {
                    console.log('[TranslationService] API language detection failed, using fallback');
                    this.warn('Language detection API failed, returning fallback', { error: apiError.message });
                    
                    // Simple fallback detection
                    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
                    const fallbackResult = {
                        detections: [{
                            language: hasJapanese ? 'JA' : 'EN',
                            confidence: hasJapanese ? 0.6 : 0.4
                        }]
                    };
                    
                    console.log('[TranslationService] Fallback language detection result:', fallbackResult);
                    return fallbackResult;
                }
            }, {
                ttl: 3600000, // 1 hour cache
                ...options
            });
        }, {
            method: 'detectLanguage',
            textLength: text ? text.length : 0
        });
    }

    async smartTranslate(text, targetLang, options = {}) {
        return this.withErrorHandling(async () => {
            if (!this.deepLApi) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.CONFIGURATION_ERROR,
                    'Translation service not configured. Please check API key.'
                );
            }

            const result = await this.deepLApi.smartTranslate(text, targetLang, options);
            
            if (result.skipped) {
                return {
                    translation: new Translation({
                        originalText: text,
                        translatedText: text,
                        detected_source_language: result.translations[0].detected_source_language,
                        targetLang: targetLang,
                        confidence: 100,
                        service: 'DeepL',
                        cached: false
                    }),
                    skipped: true,
                    reason: result.reason
                };
            }
            
            const translation = new Translation({
                originalText: text,
                translatedText: result.translations[0].text,
                detected_source_language: result.translations[0].detected_source_language,
                targetLang: targetLang,
                confidence: result.translations[0].confidence || 100,
                service: 'DeepL',
                cached: false
            });
            
            this.info('Smart translation completed', {
                sourceLang: translation.sourceLang,
                targetLang: translation.targetLang,
                skipped: false
            });
            
            return { translation, skipped: false };
        }, {
            method: 'smartTranslate',
            targetLang,
            textLength: text ? text.length : 0
        });
    }

    async batchTranslate(texts, targetLang, options = {}) {
        return this.withErrorHandling(async () => {
            if (!this.deepLApi) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.CONFIGURATION_ERROR,
                    'Translation service not configured. Please check API key.'
                );
            }

            if (!Array.isArray(texts) || texts.length === 0) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.VALIDATION_ERROR,
                    'Batch translation requires an array of texts.'
                );
            }

            const result = await this.deepLApi.translateBatch(texts, targetLang, options);
            
            const translations = result.translations.map((translation, index) => {
                return new Translation({
                    originalText: texts[index],
                    translatedText: translation.text,
                    detected_source_language: translation.detected_source_language,
                    targetLang: targetLang,
                    confidence: translation.confidence || 100,
                    service: 'DeepL',
                    cached: false
                });
            });
            
            this.info('Batch translation completed', {
                count: translations.length,
                targetLang
            });
            
            return translations;
        }, {
            method: 'batchTranslate',
            targetLang,
            count: texts ? texts.length : 0
        });
    }

    async queueTranslation(text, targetLang, options = {}) {
        return this.withErrorHandling(async () => {
            const translationRequest = {
                id: this.generateRequestId(),
                text,
                targetLang,
                options,
                timestamp: new Date(),
                status: 'queued'
            };
            
            this.translationQueue.push(translationRequest);
            
            this.info('Translation queued', {
                id: translationRequest.id,
                queueSize: this.translationQueue.length
            });
            
            return translationRequest.id;
        }, {
            method: 'queueTranslation',
            targetLang
        });
    }

    async getTranslationStatus(requestId) {
        const request = this.translationQueue.find(req => req.id === requestId);
        return request ? request.status : null;
    }

    async enableAutoTranslate(channelId, sourceLang, targetLang, options = {}) {
        return this.withErrorHandling(async () => {
            if (!this.isLanguageSupported(sourceLang) || !this.isLanguageSupported(targetLang)) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.VALIDATION_ERROR,
                    'One or more languages are not supported.'
                );
            }

            const settings = {
                enabled: true,
                sourceLang,
                targetLang,
                enabledAt: new Date(),
                enabledBy: options.userId,
                webhookUrl: options.webhookUrl,
                options: {
                    bidirectional: options.bidirectional || false,
                    reactions: options.reactions !== false,
                    minLength: options.minLength || 3
                }
            };
            
            this.autoTranslateChannels.set(channelId, settings);
            console.log('[TranslationService] Channel settings added to map:', {
                channelId,
                settings,
                mapSize: this.autoTranslateChannels.size,
                allChannels: Array.from(this.autoTranslateChannels.keys())
            });
            
            await this.saveAutoTranslateSettings();
            
            this.info('Auto-translate enabled', {
                channelId,
                sourceLang,
                targetLang
            });
            
            return settings;
        }, {
            method: 'enableAutoTranslate',
            channelId,
            sourceLang,
            targetLang
        });
    }

    async disableAutoTranslate(channelId, options = {}) {
        return this.withErrorHandling(async () => {
            const settings = this.autoTranslateChannels.get(channelId);
            
            if (!settings) {
                throw this.errorHandler.createUserFriendlyError(
                    ErrorTypes.DATA_ERROR,
                    'Auto-translate is not enabled for this channel.'
                );
            }

            this.autoTranslateChannels.delete(channelId);
            await this.saveAutoTranslateSettings();
            
            this.info('Auto-translate disabled', { channelId });
            
            return true;
        }, {
            method: 'disableAutoTranslate',
            channelId
        });
    }

    async getAutoTranslateSettings(channelId) {
        return this.autoTranslateChannels.get(channelId) || null;
    }

    async getAllAutoTranslateSettings() {
        return Object.fromEntries(this.autoTranslateChannels);
    }

    async processAutoTranslate(channelId, text, options = {}) {
        return this.withErrorHandling(async () => {
            const settings = this.autoTranslateChannels.get(channelId);
            
            if (!settings || !settings.enabled) {
                return null;
            }

            if (text.length < settings.options.minLength) {
                return null;
            }

            // Check if text needs translation
            const detection = await this.detectLanguage(text);
            const detectedLang = detection.detections[0]?.language;
            
            if (!detectedLang) {
                return null;
            }

            // Translate if detected language matches source language
            if (detectedLang === settings.sourceLang.toLowerCase()) {
                const translation = await this.translateText(text, settings.targetLang, options);
                return {
                    translation,
                    direction: 'forward',
                    settings
                };
            }

            // Bidirectional translation
            if (settings.options.bidirectional && detectedLang === settings.targetLang.toLowerCase()) {
                const translation = await this.translateText(text, settings.sourceLang, options);
                return {
                    translation,
                    direction: 'reverse',
                    settings
                };
            }

            return null;
        }, {
            method: 'processAutoTranslate',
            channelId,
            textLength: text ? text.length : 0
        });
    }

    async handleMessageAutoTranslate(message) {
        if (message.author.bot) return null;

        const channelId = message.channel.id;
        const settings = this.autoTranslateChannels.get(channelId);
        
        console.log('[TranslationService] handleMessageAutoTranslate:', {
            channelId,
            hasSettings: !!settings,
            settingsEnabled: settings?.enabled,
            messageContent: message.content?.substring(0, 50) + '...',
            messageLength: message.content?.length,
            mapSize: this.autoTranslateChannels.size,
            allChannels: Array.from(this.autoTranslateChannels.keys()),
            requestedChannel: channelId
        });
        
        if (!settings || !settings.enabled) {
            console.log('[TranslationService] Auto-translation not enabled for channel:', channelId);
            return null;
        }

        if (message.content.length < (settings.options.minLength || 3)) {
            console.log('[TranslationService] Message too short for translation:', message.content.length);
            return null;
        }

        try {
            console.log('[TranslationService] Starting auto-translation process...');
            
            // Check if text needs translation
            const detection = await this.detectLanguage(message.content);
            const detectedLang = detection.detections[0]?.language?.toLowerCase();
            
            console.log('[TranslationService] Language detection result:', {
                detectedLang,
                settingsSourceLang: settings.sourceLang,
                settingsTargetLang: settings.targetLang,
                bidirectional: settings.options.bidirectional
            });
            
            if (!detectedLang) {
                console.log('[TranslationService] No language detected');
                return null;
            }

            let targetLang = null;
            let direction = null;

            // Translate if detected language matches source language
            if (detectedLang === settings.sourceLang.toLowerCase()) {
                targetLang = settings.targetLang;
                direction = 'forward';
                console.log('[TranslationService] Forward translation:', detectedLang, '->', targetLang);
            }
            // Bidirectional translation
            else if (settings.options.bidirectional && detectedLang === settings.targetLang.toLowerCase()) {
                targetLang = settings.sourceLang;
                direction = 'reverse';
                console.log('[TranslationService] Reverse translation:', detectedLang, '->', targetLang);
            }

            if (!targetLang) {
                console.log('[TranslationService] No translation target found for language:', detectedLang);
                return null;
            }

            console.log('[TranslationService] Translating text to:', targetLang);
            
            // Translate the text
            const translation = await this.translateText(message.content, targetLang);
            
            console.log('[TranslationService] Translation result:', {
                originalText: message.content?.substring(0, 50) + '...',
                translatedText: translation.translatedText?.substring(0, 50) + '...',
                service: translation.service
            });
            
            // Send via webhook
            const webhook = await this.getOrCreateWebhook(message.channel);
            if (webhook) {
                const avatarURL = message.author.displayAvatarURL({ format: 'png', size: 128 });
                const formattedText = `\`${targetLang}\` ${translation.translatedText}`;
                
                console.log('[TranslationService] Sending translation via webhook...');
                
                const translationMessage = await webhook.send({
                    content: formattedText,
                    username: message.author.username,
                    avatarURL: avatarURL
                });

                // Store message mapping for reaction sync
                this.messageMapping.set(message.id, {
                    translatedMessageId: translationMessage.id,
                    channelId: channelId,
                    direction: direction
                });

                this.info('Auto-translation sent via webhook', {
                    channelId,
                    direction,
                    targetLang,
                    messageId: translationMessage.id
                });

                console.log('[TranslationService] Auto-translation completed successfully');
                return translationMessage;
            } else {
                console.error('[TranslationService] Failed to get or create webhook');
            }
        } catch (error) {
            console.error('[TranslationService] Auto-translation failed:', {
                channelId,
                error: error.message,
                stack: error.stack,
                messageId: message.id
            });
            this.error('Auto-translation failed', {
                channelId,
                error: error.message,
                messageId: message.id
            });
            return null;
        }
    }

    async getOrCreateWebhook(channel) {
        const channelId = channel.id;
        const cacheKey = channelId;
        const cached = this.webhookCache.get(cacheKey);

        // Cache valid for 1 hour
        if (cached && Date.now() - cached.timestamp < 3600000) {
            return cached.webhook;
        }

        try {
            const webhooks = await channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.name === 'WynnTracker Translator');
            
            if (!webhook) {
                webhook = await channel.createWebhook({
                    name: 'WynnTracker Translator',
                    avatar: null
                });
                this.info('Created new webhook for auto-translation', { channelId });
            }
            
            // Cache the webhook
            this.webhookCache.set(cacheKey, {
                webhook,
                timestamp: Date.now()
            });

            return webhook;
        } catch (error) {
            this.error('Failed to get or create webhook', {
                channelId,
                error: error.message
            });
            return null;
        }
    }

    async handleReactionAdd(reaction, user) {
        if (user.bot) return;

        const messageMapping = this.messageMapping.get(reaction.message.id);
        if (!messageMapping) return;

        try {
            const channel = reaction.message.guild.channels.cache.get(messageMapping.channelId);
            if (!channel) return;

            const translatedMessage = await channel.messages.fetch(messageMapping.translatedMessageId);
            if (translatedMessage) {
                await translatedMessage.react(reaction.emoji);
            }
        } catch (error) {
            this.warn('Failed to sync reaction add', {
                originalMessageId: reaction.message.id,
                translatedMessageId: messageMapping.translatedMessageId,
                error: error.message
            });
        }
    }

    async handleReactionRemove(reaction, user) {
        if (user.bot) return;

        const messageMapping = this.messageMapping.get(reaction.message.id);
        if (!messageMapping) return;

        try {
            const channel = reaction.message.guild.channels.cache.get(messageMapping.channelId);
            if (!channel) return;

            const translatedMessage = await channel.messages.fetch(messageMapping.translatedMessageId);
            if (translatedMessage) {
                const userReaction = translatedMessage.reactions.cache.get(reaction.emoji.id || reaction.emoji.name);
                if (userReaction) {
                    await userReaction.users.remove(user.id);
                }
            }
        } catch (error) {
            this.warn('Failed to sync reaction remove', {
                originalMessageId: reaction.message.id,
                translatedMessageId: messageMapping.translatedMessageId,
                error: error.message
            });
        }
    }

    async getSupportedLanguages() {
        if (!this.deepLApi) {
            return this.supportedLanguages.map(lang => ({
                code: lang,
                name: this.getLanguageName(lang)
            }));
        }

        const cacheKey = 'supported_languages';
        
        return this.withCache(cacheKey, async () => {
            const result = await this.deepLApi.getSupportedLanguages();
            return result.languages;
        }, {
            ttl: 86400000 // 24 hours cache
        });
    }

    async getUsageStats() {
        if (!this.deepLApi || this.limitedMode) {
            return {
                characterCount: 0,
                characterLimit: 500000,
                usagePercentage: 0
            };
        }

        return this.withErrorHandling(async () => {
            try {
                const usage = await this.deepLApi.getUsage();
                
                this.info('Usage stats fetched', {
                    characterCount: usage.characterCount,
                    usagePercentage: usage.usagePercentage
                });
                
                return usage;
            } catch (error) {
                this.warn('Failed to fetch usage stats', { error: error.message });
                return {
                    characterCount: 0,
                    characterLimit: 500000,
                    usagePercentage: 0
                };
            }
        }, {
            method: 'getUsageStats'
        });
    }

    startBatchProcessor() {
        this.processingInterval = setInterval(async () => {
            await this.processBatch();
        }, 5000); // Process every 5 seconds
    }

    async processBatch() {
        if (this.processing || this.translationQueue.length === 0) {
            return;
        }

        this.processing = true;
        
        try {
            const batch = this.translationQueue.splice(0, this.batchSize);
            
            for (const request of batch) {
                try {
                    request.status = 'processing';
                    const translation = await this.translateText(
                        request.text,
                        request.targetLang,
                        request.options
                    );
                    
                    request.status = 'completed';
                    request.result = translation;
                    request.completedAt = new Date();
                } catch (error) {
                    request.status = 'failed';
                    request.error = error.message;
                    request.completedAt = new Date();
                }
            }
            
            this.info('Batch processed', {
                count: batch.length,
                remaining: this.translationQueue.length
            });
        } catch (error) {
            this.error('Batch processing failed', { error: error.message });
        } finally {
            this.processing = false;
        }
    }

    isLanguageSupported(language) {
        return this.supportedLanguages.includes(language.toLowerCase());
    }

    getLanguageName(code) {
        const languages = {
            'en': 'English',
            'ja': 'Japanese',
            'de': 'German',
            'fr': 'French',
            'es': 'Spanish',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'zh': 'Chinese',
            'ko': 'Korean'
        };
        
        return languages[code.toLowerCase()] || code.toUpperCase();
    }

    hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    generateRequestId() {
        return `tr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async checkServiceHealth() {
        try {
            let deepLApiHealth = { healthy: false, error: 'Not configured' };
            
            if (!this.limitedMode && this.deepLApi) {
                try {
                    deepLApiHealth = await this.deepLApi.healthCheck();
                } catch (error) {
                    deepLApiHealth = {
                        healthy: false,
                        error: error.message
                    };
                }
            } else if (this.limitedMode) {
                deepLApiHealth = {
                    healthy: true,
                    mode: 'limited',
                    note: 'Running in mock mode'
                };
            }
            
            return {
                deepLApi: deepLApiHealth,
                limitedMode: this.limitedMode,
                autoTranslateChannels: this.autoTranslateChannels.size,
                queueSize: this.translationQueue.length,
                processing: this.processing
            };
        } catch (error) {
            return {
                deepLApi: {
                    healthy: false,
                    error: error.message
                },
                limitedMode: this.limitedMode,
                autoTranslateChannels: this.autoTranslateChannels.size,
                queueSize: this.translationQueue.length,
                processing: this.processing
            };
        }
    }

    async onCleanup() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        
        await this.saveAutoTranslateSettings();
    }

    static create(options = {}) {
        return new TranslationService(options);
    }
}

module.exports = TranslationService;