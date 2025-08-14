const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Logger = require('../utils/Logger');
const routes = require('./routes');

class APIServer {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.app = express();
        this.server = null;
        this.logger = new Logger('APIServer');
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    
    setupMiddleware() {
        // セキュリティ
        this.app.use(helmet());
        
        // CORS設定（SKJmod専用）
        this.app.use(cors({
            origin: ['http://localhost:25565', 'minecraft://localhost', 'http://localhost:3000'],
            methods: ['POST', 'GET'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
        
        // レート制限
        const limiter = rateLimit({
            windowMs: 1 * 60 * 1000, // 1分
            max: 100, // リクエスト数
            message: {
                error: 'Too many requests',
                retryAfter: '1 minute'
            },
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api', limiter);
        
        // ボディパーサー
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // ログミドルウェア
        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
        
        // クライアントと設定をリクエストに追加
        this.app.use((req, res, next) => {
            req.client = this.client;
            req.config = this.config;
            next();
        });
    }
    
    setupRoutes() {
        // ヘルスチェック
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                discord: this.client.isReady()
            });
        });
        
        // API routes
        this.app.use('/api', routes);
        
        // 404ハンドリング
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                availableEndpoints: ['/health', '/api/skjmod/bombbell']
            });
        });
    }
    
    setupErrorHandling() {
        this.app.use((error, req, res, next) => {
            this.logger.error('API Error:', error);
            
            if (error.type === 'entity.parse.failed') {
                return res.status(400).json({
                    error: 'Invalid JSON payload'
                });
            }
            
            res.status(500).json({
                error: 'Internal server error',
                requestId: req.id
            });
        });
    }
    
    start(port = 3000) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, (error) => {
                if (error) {
                    this.logger.error('Failed to start API server:', error);
                    reject(error);
                } else {
                    this.logger.info(`API server started on port ${port}`);
                    resolve(port);
                }
            });
        });
    }
    
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.logger.info('API server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = APIServer;