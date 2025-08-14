const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const BombBellService = require('../../services/bombbell/BombBellService');
const Logger = require('../../utils/Logger');

const router = express.Router();
const logger = new Logger('BombBellRouter');

/**
 * SKJmodからのボムベル通知受信
 * POST /api/skjmod/bombbell
 */
router.post('/bombbell', [
    // 認証
    auth.validateToken,
    
    // バリデーション
    body('bombType').isString().notEmpty(),
    body('bombDisplayName').isString().notEmpty(),
    body('world').isString().notEmpty(),
    body('timestamp').isNumeric(),
    body('metadata').isObject(),
    body('source').isIn(['GAME', 'CHAT']),
    body('detectionPattern').isString().notEmpty(),
    
    // オプションフィールド
    body('playerName').optional().isString(),
    body('originalMessage').optional().isString()
    
], async (req, res) => {
    try {
        // バリデーションエラーチェック
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }
        
        const bombData = req.body;
        
        // BombBellServiceで処理
        const bombBellService = new BombBellService(req.client, req.config);
        const result = await bombBellService.processBombNotification(bombData);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Bomb notification processed successfully',
                data: {
                    messageId: result.messageId,
                    channelId: result.channelId,
                    region: result.region
                }
            });
        } else {
            res.status(422).json({
                success: false,
                error: result.error,
                code: result.errorCode
            });
        }
        
    } catch (error) {
        logger.error('Bomb notification processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            requestId: req.id
        });
    }
});

/**
 * アクティブな爆弾一覧取得
 * GET /api/skjmod/bombs/active
 */
router.get('/bombs/active', [
    auth.validateToken
], async (req, res) => {
    try {
        const bombBellService = new BombBellService(req.client, req.config);
        const activeBombs = await bombBellService.getActiveBombs();
        
        res.json({
            success: true,
            data: activeBombs,
            count: activeBombs.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Active bombs fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active bombs'
        });
    }
});

/**
 * ボムベル統計取得
 * GET /api/skjmod/stats
 */
router.get('/stats', [
    auth.validateToken
], async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        
        const bombBellService = new BombBellService(req.client, req.config);
        const stats = await bombBellService.getStatistics(timeframe);
        
        res.json({
            success: true,
            data: stats,
            timeframe: timeframe,
            generatedAt: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Stats fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

/**
 * 接続テスト
 * POST /api/skjmod/test
 */
router.post('/test', [
    auth.validateToken
], async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Connection test successful',
            timestamp: new Date().toISOString(),
            botStatus: req.client.isReady(),
            receivedData: req.body
        });
        
    } catch (error) {
        logger.error('Connection test error:', error);
        res.status(500).json({
            success: false,
            error: 'Connection test failed'
        });
    }
});

module.exports = router;