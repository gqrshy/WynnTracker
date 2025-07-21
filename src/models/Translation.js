class Translation {
    constructor(data) {
        this.originalText = data.text || data.originalText;
        this.translatedText = data.translatedText;
        this.sourceLang = data.detected_source_language || data.sourceLang;
        this.targetLang = data.targetLang;
        this.confidence = data.confidence || 100;
        this.timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
        this.service = data.service || 'DeepL';
        this.cached = data.cached || false;
        this.id = data.id || this.generateId();
        this.metadata = data.metadata || {};
    }

    generateId() {
        const textHash = this.hashText(this.originalText);
        return `${textHash}_${this.sourceLang}_${this.targetLang}`;
    }

    hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    isRecentlyTranslated(minutes = 5) {
        if (!this.timestamp) {
            return false;
        }

        const now = new Date();
        const diff = now - this.timestamp;
        const diffMinutes = diff / (1000 * 60);
        
        return diffMinutes <= minutes;
    }

    getAge() {
        if (!this.timestamp) {
            return null;
        }

        const now = new Date();
        const diff = now - this.timestamp;
        
        return {
            milliseconds: diff,
            seconds: Math.floor(diff / 1000),
            minutes: Math.floor(diff / (1000 * 60)),
            hours: Math.floor(diff / (1000 * 60 * 60)),
            days: Math.floor(diff / (1000 * 60 * 60 * 24))
        };
    }

    getFormattedAge() {
        const age = this.getAge();
        
        if (!age) {
            return 'Unknown';
        }

        if (age.seconds < 60) {
            return `${age.seconds} second${age.seconds !== 1 ? 's' : ''} ago`;
        } else if (age.minutes < 60) {
            return `${age.minutes} minute${age.minutes !== 1 ? 's' : ''} ago`;
        } else if (age.hours < 24) {
            return `${age.hours} hour${age.hours !== 1 ? 's' : ''} ago`;
        } else {
            return `${age.days} day${age.days !== 1 ? 's' : ''} ago`;
        }
    }

    getConfidenceLevel() {
        if (this.confidence >= 95) {
            return 'Excellent';
        } else if (this.confidence >= 85) {
            return 'Very Good';
        } else if (this.confidence >= 75) {
            return 'Good';
        } else if (this.confidence >= 65) {
            return 'Fair';
        } else {
            return 'Poor';
        }
    }

    getConfidenceColor() {
        if (this.confidence >= 95) {
            return '#00ff00'; // Green
        } else if (this.confidence >= 85) {
            return '#7fff00'; // Yellow-green
        } else if (this.confidence >= 75) {
            return '#ffff00'; // Yellow
        } else if (this.confidence >= 65) {
            return '#ff7f00'; // Orange
        } else {
            return '#ff0000'; // Red
        }
    }

    getLanguageName(langCode) {
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
            'ko': 'Korean',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'th': 'Thai',
            'vi': 'Vietnamese',
            'nl': 'Dutch',
            'sv': 'Swedish',
            'da': 'Danish',
            'no': 'Norwegian',
            'fi': 'Finnish',
            'pl': 'Polish',
            'cs': 'Czech',
            'sk': 'Slovak',
            'hu': 'Hungarian',
            'ro': 'Romanian',
            'bg': 'Bulgarian',
            'hr': 'Croatian',
            'sr': 'Serbian',
            'sl': 'Slovenian',
            'et': 'Estonian',
            'lv': 'Latvian',
            'lt': 'Lithuanian',
            'mt': 'Maltese',
            'el': 'Greek',
            'tr': 'Turkish',
            'uk': 'Ukrainian',
            'be': 'Belarusian',
            'mk': 'Macedonian',
            'sq': 'Albanian',
            'eu': 'Basque',
            'ca': 'Catalan',
            'gl': 'Galician',
            'is': 'Icelandic',
            'ga': 'Irish',
            'cy': 'Welsh',
            'mt': 'Maltese'
        };

        return languages[langCode?.toLowerCase()] || langCode?.toUpperCase() || 'Unknown';
    }

    getSourceLanguageName() {
        return this.getLanguageName(this.sourceLang);
    }

    getTargetLanguageName() {
        return this.getLanguageName(this.targetLang);
    }

    getLanguageFlag(langCode) {
        const flags = {
            'en': '🇺🇸',
            'ja': '🇯🇵',
            'de': '🇩🇪',
            'fr': '🇫🇷',
            'es': '🇪🇸',
            'it': '🇮🇹',
            'pt': '🇵🇹',
            'ru': '🇷🇺',
            'zh': '🇨🇳',
            'ko': '🇰🇷',
            'ar': '🇸🇦',
            'hi': '🇮🇳',
            'th': '🇹🇭',
            'vi': '🇻🇳',
            'nl': '🇳🇱',
            'sv': '🇸🇪',
            'da': '🇩🇰',
            'no': '🇳🇴',
            'fi': '🇫🇮',
            'pl': '🇵🇱',
            'cs': '🇨🇿',
            'sk': '🇸🇰',
            'hu': '🇭🇺',
            'ro': '🇷🇴',
            'bg': '🇧🇬',
            'hr': '🇭🇷',
            'sr': '🇷🇸',
            'sl': '🇸🇮',
            'et': '🇪🇪',
            'lv': '🇱🇻',
            'lt': '🇱🇹',
            'mt': '🇲🇹',
            'el': '🇬🇷',
            'tr': '🇹🇷',
            'uk': '🇺🇦'
        };

        return flags[langCode?.toLowerCase()] || '🌐';
    }

    getSourceLanguageFlag() {
        return this.getLanguageFlag(this.sourceLang);
    }

    getTargetLanguageFlag() {
        return this.getLanguageFlag(this.targetLang);
    }

    getCharacterCount() {
        return this.originalText ? this.originalText.length : 0;
    }

    getWordCount() {
        if (!this.originalText) {
            return 0;
        }

        // Handle different languages
        if (this.sourceLang === 'ja' || this.sourceLang === 'zh') {
            // For Japanese and Chinese, count characters instead of words
            return this.originalText.length;
        }

        // For other languages, count words
        return this.originalText.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    isLongText(threshold = 500) {
        return this.getCharacterCount() > threshold;
    }

    isShortText(threshold = 10) {
        return this.getCharacterCount() < threshold;
    }

    getSimilarityScore(other) {
        if (!other || !other.originalText) {
            return 0;
        }

        const text1 = this.originalText.toLowerCase();
        const text2 = other.originalText.toLowerCase();

        if (text1 === text2) {
            return 100;
        }

        // Simple similarity based on common words
        const words1 = text1.split(/\s+/);
        const words2 = text2.split(/\s+/);
        const commonWords = words1.filter(word => words2.includes(word));
        const totalWords = new Set([...words1, ...words2]).size;

        return Math.round((commonWords.length / totalWords) * 100);
    }

    addMetadata(key, value) {
        this.metadata[key] = value;
    }

    getMetadata(key) {
        return this.metadata[key];
    }

    updateConfidence(newConfidence) {
        this.confidence = Math.max(0, Math.min(100, newConfidence));
    }

    markAsCached() {
        this.cached = true;
    }

    markAsUncached() {
        this.cached = false;
    }

    isCached() {
        return this.cached === true;
    }

    getTranslationDirection() {
        return `${this.getSourceLanguageName()} → ${this.getTargetLanguageName()}`;
    }

    getTranslationDirectionWithFlags() {
        return `${this.getSourceLanguageFlag()} ${this.getSourceLanguageName()} → ${this.getTargetLanguageFlag()} ${this.getTargetLanguageName()}`;
    }

    toJSON() {
        return {
            id: this.id,
            originalText: this.originalText,
            translatedText: this.translatedText,
            sourceLang: this.sourceLang,
            targetLang: this.targetLang,
            confidence: this.confidence,
            timestamp: this.timestamp,
            service: this.service,
            cached: this.cached,
            metadata: this.metadata,
            age: this.getAge(),
            characterCount: this.getCharacterCount(),
            wordCount: this.getWordCount(),
            confidenceLevel: this.getConfidenceLevel(),
            sourceLanguageName: this.getSourceLanguageName(),
            targetLanguageName: this.getTargetLanguageName(),
            translationDirection: this.getTranslationDirection(),
            isLongText: this.isLongText(),
            isShortText: this.isShortText(),
            isRecentlyTranslated: this.isRecentlyTranslated()
        };
    }

    static fromDeepL(data) {
        return new Translation({
            originalText: data.text,
            translatedText: data.translatedText,
            detected_source_language: data.detected_source_language,
            targetLang: data.targetLang,
            confidence: data.confidence,
            service: 'DeepL',
            cached: false
        });
    }

    static fromCache(data) {
        return new Translation({
            ...data,
            cached: true
        });
    }

    static compare(a, b) {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return b.timestamp - a.timestamp; // Most recent first
    }
}

module.exports = Translation;