class AnniEvent {
    constructor(data) {
        this.timestamp = data.timestamp ? new Date(data.timestamp) : null;
        this.server = data.server;
        this.downtime = data.downtime || false;
        this.confidence = data.confidence || 100;
        this.source = data.source;
        this.addedAt = data.addedAt ? new Date(data.addedAt) : new Date();
        this.verified = data.verified || false;
        this.actualTime = data.actualTime ? new Date(data.actualTime) : null;
        this.metadata = data.metadata || {};
        this.id = data.id || this.generateId();
    }

    generateId() {
        return `${this.server}_${this.timestamp ? this.timestamp.getTime() : Date.now()}`;
    }

    getFormattedTime(timezone = 'UTC') {
        if (!this.timestamp) {
            return 'Unknown';
        }

        const options = {
            timeZone: timezone === 'JST' ? 'Asia/Tokyo' : 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };

        return this.timestamp.toLocaleString('en-US', options);
    }

    getTimeUntil() {
        if (!this.timestamp) {
            return null;
        }

        const now = new Date();
        const diff = this.timestamp - now;
        
        if (diff <= 0) {
            return {
                isPast: true,
                totalMilliseconds: Math.abs(diff),
                totalSeconds: Math.abs(Math.floor(diff / 1000)),
                totalMinutes: Math.abs(Math.floor(diff / (1000 * 60))),
                totalHours: Math.abs(Math.floor(diff / (1000 * 60 * 60))),
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0
            };
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return {
            isPast: false,
            totalMilliseconds: diff,
            totalSeconds: Math.floor(diff / 1000),
            totalMinutes: Math.floor(diff / (1000 * 60)),
            totalHours: Math.floor(diff / (1000 * 60 * 60)),
            days,
            hours,
            minutes,
            seconds
        };
    }

    getFormattedTimeUntil() {
        const timeUntil = this.getTimeUntil();
        
        if (!timeUntil) {
            return 'Unknown';
        }

        if (timeUntil.isPast) {
            if (timeUntil.totalMinutes < 1) {
                return 'Just now';
            } else if (timeUntil.totalMinutes < 60) {
                return `${timeUntil.totalMinutes} minute${timeUntil.totalMinutes !== 1 ? 's' : ''} ago`;
            } else if (timeUntil.totalHours < 24) {
                return `${timeUntil.totalHours} hour${timeUntil.totalHours !== 1 ? 's' : ''} ago`;
            } else {
                const days = Math.floor(timeUntil.totalHours / 24);
                return `${days} day${days !== 1 ? 's' : ''} ago`;
            }
        }

        const parts = [];
        
        if (timeUntil.days > 0) {
            parts.push(`${timeUntil.days} day${timeUntil.days !== 1 ? 's' : ''}`);
        }
        
        if (timeUntil.hours > 0) {
            parts.push(`${timeUntil.hours} hour${timeUntil.hours !== 1 ? 's' : ''}`);
        }
        
        if (timeUntil.minutes > 0) {
            parts.push(`${timeUntil.minutes} minute${timeUntil.minutes !== 1 ? 's' : ''}`);
        }
        
        if (parts.length === 0) {
            parts.push(`${timeUntil.seconds} second${timeUntil.seconds !== 1 ? 's' : ''}`);
        }

        return parts.join(', ');
    }

    getAccuracy() {
        if (!this.actualTime || !this.timestamp) {
            return null;
        }

        const predictedTime = this.timestamp.getTime();
        const actualTime = this.actualTime.getTime();
        const diff = Math.abs(predictedTime - actualTime);
        
        return {
            differenceMs: diff,
            differenceMinutes: Math.floor(diff / (1000 * 60)),
            accuracyPercentage: Math.max(0, 100 - (diff / (1000 * 60 * 60)) * 10) // 10% penalty per hour off
        };
    }

    isRecent(hours = 24) {
        if (!this.addedAt) {
            return false;
        }

        const now = new Date();
        const diff = now - this.addedAt;
        const diffHours = diff / (1000 * 60 * 60);
        
        return diffHours <= hours;
    }

    isUpcoming(hours = 24) {
        if (!this.timestamp) {
            return false;
        }

        const now = new Date();
        const diff = this.timestamp - now;
        const diffHours = diff / (1000 * 60 * 60);
        
        return diffHours > 0 && diffHours <= hours;
    }

    isPast() {
        if (!this.timestamp) {
            return false;
        }

        return this.timestamp < new Date();
    }

    isWithinHours(hours) {
        if (!this.timestamp) {
            return false;
        }

        const now = new Date();
        const diff = Math.abs(this.timestamp - now);
        const diffHours = diff / (1000 * 60 * 60);
        
        return diffHours <= hours;
    }

    getConfidenceLevel() {
        if (this.confidence >= 90) {
            return 'Very High';
        } else if (this.confidence >= 70) {
            return 'High';
        } else if (this.confidence >= 50) {
            return 'Medium';
        } else if (this.confidence >= 30) {
            return 'Low';
        } else {
            return 'Very Low';
        }
    }

    getConfidenceColor() {
        if (this.confidence >= 90) {
            return '#00ff00'; // Green
        } else if (this.confidence >= 70) {
            return '#7fff00'; // Yellow-green
        } else if (this.confidence >= 50) {
            return '#ffff00'; // Yellow
        } else if (this.confidence >= 30) {
            return '#ff7f00'; // Orange
        } else {
            return '#ff0000'; // Red
        }
    }

    getSourceIcon() {
        switch (this.source?.toLowerCase()) {
            case 'arima':
                return '🤖';
            case 'community':
                return '👥';
            case 'wynncraft':
                return '🎮';
            case 'manual':
                return '👤';
            case 'hybrid':
                return '🔄';
            default:
                return '❓';
        }
    }

    verify(actualTime) {
        this.verified = true;
        this.actualTime = actualTime ? new Date(actualTime) : new Date();
        return this.getAccuracy();
    }

    updateConfidence(newConfidence) {
        this.confidence = Math.max(0, Math.min(100, newConfidence));
    }

    addMetadata(key, value) {
        this.metadata[key] = value;
    }

    getMetadata(key) {
        return this.metadata[key];
    }

    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            server: this.server,
            downtime: this.downtime,
            confidence: this.confidence,
            source: this.source,
            addedAt: this.addedAt,
            verified: this.verified,
            actualTime: this.actualTime,
            metadata: this.metadata,
            timeUntil: this.getTimeUntil(),
            accuracy: this.getAccuracy(),
            confidenceLevel: this.getConfidenceLevel(),
            isRecent: this.isRecent(),
            isUpcoming: this.isUpcoming(),
            isPast: this.isPast()
        };
    }

    static fromPrediction(prediction) {
        return new AnniEvent({
            timestamp: prediction.predictedTime,
            server: prediction.server,
            downtime: prediction.downtime,
            confidence: prediction.confidence,
            source: prediction.method,
            metadata: {
                basedOnEvents: prediction.basedOnEvents,
                sources: prediction.sources,
                agreement: prediction.agreement
            }
        });
    }

    static compare(a, b) {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return a.timestamp - b.timestamp;
    }
}

module.exports = AnniEvent;