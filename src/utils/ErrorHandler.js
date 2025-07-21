const { EmbedBuilder } = require('discord.js');

const ErrorTypes = {
    API_ERROR: 'API_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    DATA_ERROR: 'DATA_ERROR',
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    PERMISSION_ERROR: 'PERMISSION_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    COMMAND_ERROR: 'COMMAND_ERROR',
    TRANSLATION_ERROR: 'TRANSLATION_ERROR',
    PREDICTION_ERROR: 'PREDICTION_ERROR'
};

class ErrorResponse {
    constructor(type, message, details = null, metadata = {}) {
        this.type = type;
        this.message = message;
        this.details = details;
        this.metadata = metadata;
        this.timestamp = new Date();
    }

    toDiscordEmbed() {
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(this.message)
            .setColor('#ff0000')
            .setTimestamp(this.timestamp);

        if (this.details && typeof this.details === 'string') {
            embed.addFields({
                name: 'Details',
                value: this.details.substring(0, 1024),
                inline: false
            });
        }

        if (this.metadata.retryAfter) {
            embed.addFields({
                name: 'Retry After',
                value: `${this.metadata.retryAfter} seconds`,
                inline: true
            });
        }

        if (this.metadata.code) {
            embed.addFields({
                name: 'Error Code',
                value: this.metadata.code,
                inline: true
            });
        }

        return embed;
    }

    toJSON() {
        return {
            type: this.type,
            message: this.message,
            details: this.details,
            metadata: this.metadata,
            timestamp: this.timestamp.toISOString()
        };
    }
}

class ErrorHandler {
    constructor(logger = null) {
        this.logger = logger;
        this.errorCounts = new Map();
        this.lastErrors = new Map();
    }

    handle(error, context = {}) {
        const errorResponse = this.processError(error, context);
        
        this.logError(errorResponse, context);
        this.updateErrorStats(errorResponse);
        
        return errorResponse;
    }

    processError(error, context) {
        if (error instanceof ErrorResponse) {
            return error;
        }

        const errorInfo = this.categorizeError(error);
        
        return new ErrorResponse(
            errorInfo.type,
            errorInfo.message,
            errorInfo.details,
            {
                ...errorInfo.metadata,
                context: context.command || context.service || 'unknown',
                userId: context.userId,
                guildId: context.guildId
            }
        );
    }

    categorizeError(error) {
        if (error.code) {
            switch (error.code) {
                case 'ENOTFOUND':
                case 'ECONNREFUSED':
                case 'ETIMEDOUT':
                    return {
                        type: ErrorTypes.NETWORK_ERROR,
                        message: 'Network connection failed. Please try again later.',
                        details: error.message,
                        metadata: { code: error.code }
                    };
                
                case 'ENOENT':
                    return {
                        type: ErrorTypes.DATA_ERROR,
                        message: 'Required data file not found.',
                        details: error.message,
                        metadata: { code: error.code }
                    };
            }
        }

        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            switch (status) {
                case 400:
                    return {
                        type: ErrorTypes.VALIDATION_ERROR,
                        message: 'Invalid request. Please check your input and try again.',
                        details: data?.message || error.message,
                        metadata: { status, code: data?.code }
                    };
                
                case 401:
                    return {
                        type: ErrorTypes.AUTHENTICATION_ERROR,
                        message: 'Authentication failed. Please check API credentials.',
                        details: data?.message || error.message,
                        metadata: { status }
                    };
                
                case 403:
                    return {
                        type: ErrorTypes.PERMISSION_ERROR,
                        message: 'Permission denied. You don\'t have access to this resource.',
                        details: data?.message || error.message,
                        metadata: { status }
                    };
                
                case 404:
                    return {
                        type: ErrorTypes.DATA_ERROR,
                        message: 'Requested data not found.',
                        details: data?.message || error.message,
                        metadata: { status }
                    };
                
                case 429:
                    const retryAfter = error.response.headers['retry-after'] || 
                                     error.response.headers['x-ratelimit-reset-after'];
                    return {
                        type: ErrorTypes.RATE_LIMIT_ERROR,
                        message: 'Rate limit exceeded. Please wait before trying again.',
                        details: data?.message || error.message,
                        metadata: { 
                            status, 
                            retryAfter: retryAfter ? parseInt(retryAfter) : null
                        }
                    };
                
                case 500:
                case 502:
                case 503:
                case 504:
                    return {
                        type: ErrorTypes.API_ERROR,
                        message: 'External service is temporarily unavailable. Please try again later.',
                        details: data?.message || error.message,
                        metadata: { status }
                    };
                
                default:
                    return {
                        type: ErrorTypes.API_ERROR,
                        message: 'An API error occurred. Please try again.',
                        details: data?.message || error.message,
                        metadata: { status }
                    };
            }
        }

        if (error.name === 'ValidationError') {
            return {
                type: ErrorTypes.VALIDATION_ERROR,
                message: 'Invalid input provided.',
                details: error.message,
                metadata: { name: error.name }
            };
        }

        if (error.name === 'TimeoutError') {
            return {
                type: ErrorTypes.TIMEOUT_ERROR,
                message: 'Request timed out. Please try again.',
                details: error.message,
                metadata: { name: error.name }
            };
        }

        return {
            type: ErrorTypes.SYSTEM_ERROR,
            message: 'An unexpected error occurred.',
            details: error.message || 'Unknown error',
            metadata: { 
                name: error.name,
                stack: error.stack?.substring(0, 500)
            }
        };
    }

    logError(errorResponse, context) {
        if (this.logger) {
            this.logger.error('Error handled', {
                type: errorResponse.type,
                message: errorResponse.message,
                details: errorResponse.details,
                metadata: errorResponse.metadata,
                context
            });
        } else {
            console.error('Error handled:', {
                type: errorResponse.type,
                message: errorResponse.message,
                context: context.command || context.service || 'unknown'
            });
        }
    }

    updateErrorStats(errorResponse) {
        const key = `${errorResponse.type}:${errorResponse.metadata.context}`;
        
        const currentCount = this.errorCounts.get(key) || 0;
        this.errorCounts.set(key, currentCount + 1);
        
        this.lastErrors.set(key, errorResponse);
    }

    getErrorStats() {
        const stats = {};
        
        for (const [key, count] of this.errorCounts) {
            const [type, context] = key.split(':');
            if (!stats[type]) {
                stats[type] = {};
            }
            stats[type][context] = count;
        }
        
        return stats;
    }

    getRecentErrors(limit = 10) {
        return Array.from(this.lastErrors.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    clearStats() {
        this.errorCounts.clear();
        this.lastErrors.clear();
    }

    createUserFriendlyError(type, message, details = null) {
        return new ErrorResponse(type, message, details);
    }

    static createApiError(message, status = null, details = null) {
        return new ErrorResponse(
            ErrorTypes.API_ERROR,
            message,
            details,
            { status }
        );
    }

    static createValidationError(message, field = null) {
        return new ErrorResponse(
            ErrorTypes.VALIDATION_ERROR,
            message,
            null,
            { field }
        );
    }

    static createRateLimitError(message, retryAfter = null) {
        return new ErrorResponse(
            ErrorTypes.RATE_LIMIT_ERROR,
            message,
            null,
            { retryAfter }
        );
    }

    static createPermissionError(message, required = null) {
        return new ErrorResponse(
            ErrorTypes.PERMISSION_ERROR,
            message,
            null,
            { required }
        );
    }
}

module.exports = {
    ErrorHandler,
    ErrorResponse,
    ErrorTypes
};