const { EmbedBuilder } = require('discord.js');

/**
 * 統一されたエラーハンドリングシステム
 */
class ErrorHandler {
    /**
     * APIエラーを処理
     * @param {Error} error - エラーオブジェクト
     * @param {string} apiName - API名
     * @returns {string} ユーザー向けエラーメッセージ
     */
    static handleAPIError(error, apiName) {
        const errorCode = error.response?.status;
        
        console.error(`[ERROR] ${apiName} API Error:`, {
            status: errorCode,
            message: error.message,
            url: error.config?.url
        });

        switch (errorCode) {
            case 401:
                return `❌ ${apiName} API認証エラー：APIキーが無効です。`;
            case 403:
                return `❌ ${apiName} API制限エラー：アクセス権限がありません。`;
            case 404:
                return `❌ ${apiName} APIエラー：データが見つかりません。`;
            case 429:
                return `❌ ${apiName} API制限エラー：レート制限に達しました。しばらくお待ちください。`;
            case 500:
            case 502:
            case 503:
                return `❌ ${apiName} APIサーバーエラー：しばらくしてからお試しください。`;
            default:
                return `❌ ${apiName} APIエラー：データの取得に失敗しました。`;
        }
    }

    /**
     * コマンド実行エラーを処理
     * @param {Error} error - エラーオブジェクト
     * @param {string} commandName - コマンド名
     * @param {Object} interaction - Discord interaction
     */
    static async handleCommandError(error, commandName, interaction) {
        console.error(`[ERROR] Command ${commandName} failed:`, error);

        const errorMessage = {
            content: `❌ ${commandName}コマンドの実行中にエラーが発生しました。`,
            ephemeral: true
        };

        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (replyError) {
            console.error(`[ERROR] Failed to send error message:`, replyError);
        }
    }

    /**
     * データ取得エラーを処理
     * @param {Error} error - エラーオブジェクト
     * @param {string} dataType - データタイプ
     * @returns {string} ユーザー向けエラーメッセージ
     */
    static handleDataError(error, dataType) {
        console.error(`[ERROR] Data loading failed for ${dataType}:`, error);

        if (error.code === 'ENOENT') {
            return `❌ ${dataType}データファイルが見つかりません。`;
        }

        if (error instanceof SyntaxError) {
            return `❌ ${dataType}データの形式が正しくありません。`;
        }

        return `❌ ${dataType}データの読み込みに失敗しました。`;
    }

    /**
     * エラー用のEmbedを作成
     * @param {string} title - タイトル
     * @param {string} description - 説明
     * @param {string} color - 色（デフォルト: 赤）
     * @returns {EmbedBuilder} エラーEmbed
     */
    static createErrorEmbed(title, description, color = '#FF0000') {
        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp()
            .setFooter({
                text: 'エラーが続く場合は管理者にお知らせください',
                iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png'
            });
    }

    /**
     * レート制限エラーを処理
     * @param {number} waitTime - 待機時間（秒）
     * @param {string} commandName - コマンド名
     * @returns {Object} レート制限エラーレスポンス
     */
    static handleRateLimitError(waitTime, commandName) {
        const minutes = Math.floor(waitTime / 60);
        const seconds = waitTime % 60;
        
        let timeString = '';
        if (minutes > 0) {
            timeString = `${minutes}分${seconds}秒`;
        } else {
            timeString = `${seconds}秒`;
        }

        return {
            content: `⏳ ${commandName}コマンドは制限中です。\nあと **${timeString}** お待ちください。`,
            ephemeral: true
        };
    }

    /**
     * 成功メッセージを作成
     * @param {string} message - メッセージ
     * @param {string} color - 色（デフォルト: 緑）
     * @returns {EmbedBuilder} 成功Embed
     */
    static createSuccessEmbed(message, color = '#00FF00') {
        return new EmbedBuilder()
            .setDescription(`✅ ${message}`)
            .setColor(color)
            .setTimestamp();
    }

    /**
     * 警告メッセージを作成
     * @param {string} message - メッセージ
     * @param {string} color - 色（デフォルト: 黄）
     * @returns {EmbedBuilder} 警告Embed
     */
    static createWarningEmbed(message, color = '#FFD700') {
        return new EmbedBuilder()
            .setDescription(`⚠️ ${message}`)
            .setColor(color)
            .setTimestamp();
    }
}

module.exports = ErrorHandler;