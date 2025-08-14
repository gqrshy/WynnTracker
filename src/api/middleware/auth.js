const crypto = require('crypto');
const Logger = require('../../utils/Logger');

class AuthMiddleware {
    constructor() {
        this.logger = new Logger('AuthMiddleware');
        // 設定はConfigManagerから取得
        const ConfigManager = require('../../config/ConfigManager');
        this.config = ConfigManager.getInstance();
        this.validTokens = new Set(this.config.get('api.validTokens', []));
        this.secretKey = this.config.get('api.secretKey', '');
    }
    
    validateToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    error: 'Missing or invalid authorization header',
                    expected: 'Bearer <token>'
                });
            }
            
            const token = authHeader.substring(7);
            
            // トークン検証
            if (!this.isValidToken(token)) {
                this.logger.warn('Invalid API token used', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    token: token.substring(0, 8) + '...'
                });
                
                return res.status(401).json({
                    error: 'Invalid token'
                });
            }
            
            // リクエストオブジェクトに認証情報を追加
            req.auth = {
                token: token,
                tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
                validatedAt: new Date()
            };
            
            next();
            
        } catch (error) {
            this.logger.error('Auth middleware error:', error);
            res.status(500).json({
                error: 'Authentication error'
            });
        }
    }
    
    isValidToken(token) {
        if (!token || typeof token !== 'string') {
            return false;
        }
        
        // 設定されたトークンリストとの照合
        if (this.validTokens.has(token)) {
            return true;
        }
        
        // 動的トークン生成の場合（オプション）
        if (this.secretKey) {
            return this.validateDynamicToken(token);
        }
        
        return false;
    }
    
    validateDynamicToken(token) {
        try {
            // HMAC-SHA256を使用した動的トークン検証
            const [timestamp, signature] = token.split('.');
            
            if (!timestamp || !signature) {
                return false;
            }
            
            // タイムスタンプ検証（24時間以内）
            const tokenTime = parseInt(timestamp, 10);
            const currentTime = Math.floor(Date.now() / 1000);
            
            if (currentTime - tokenTime > 86400) { // 24時間
                return false;
            }
            
            // 署名検証
            const expectedSignature = crypto
                .createHmac('sha256', this.secretKey)
                .update(timestamp)
                .digest('hex');
            
            return signature === expectedSignature;
            
        } catch (error) {
            this.logger.error('Dynamic token validation error:', error);
            return false;
        }
    }
    
    generateToken() {
        if (!this.secretKey) {
            throw new Error('Secret key not configured');
        }
        
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = crypto
            .createHmac('sha256', this.secretKey)
            .update(timestamp)
            .digest('hex');
        
        return `${timestamp}.${signature}`;
    }
}

const authMiddleware = new AuthMiddleware();
module.exports = {
    validateToken: authMiddleware.validateToken.bind(authMiddleware),
    generateToken: authMiddleware.generateToken.bind(authMiddleware)
};