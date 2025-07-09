const axios = require('axios');

const WYNNCRAFT_API_BASE = 'https://api.wynncraft.com/v3';

async function getPlayerStats(username) {
    try {
        // fullResult=True パラメータで完全なデータを取得
        console.log(`[DEBUG] Fetching player data for: ${username}`);
        const response = await axios.get(`${WYNNCRAFT_API_BASE}/player/${username}?fullResult=True`, {
            headers: {
                'User-Agent': 'WynncraftDiscordBot/2.0'
            }
        });
        
        if (!response.data) {
            return null;
        }
        
        // マルチセレクタのチェック（複数のプレイヤーが見つかった場合）
        if (response.data.kind === 'multi-selector') {
            console.log('[DEBUG] Multiple players found, using first result');
            const firstUuid = Object.keys(response.data)[0];
            if (firstUuid && firstUuid !== 'kind') {
                // 最初のUUIDで再度リクエスト
                const playerResponse = await axios.get(`${WYNNCRAFT_API_BASE}/player/${firstUuid}?fullResult=True`, {
                    headers: {
                        'User-Agent': 'WynncraftDiscordBot/2.0'
                    }
                });
                return playerResponse.data;
            }
        }
        
        console.log('[DEBUG] Player data received successfully');
        return response.data;
        
    } catch (error) {
        console.error('[ERROR] Wynncraft API エラー:', error.message);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            if (error.response.status === 404) {
                return null;
            }
        }
        
        throw error;
    }
}

module.exports = {
    getPlayerStats
};