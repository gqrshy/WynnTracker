const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('./BaseCommand');
const TranslationService = require('../services/TranslationService');

class TranslationCommand extends BaseCommand {
    constructor() {
        console.log('[TranslationCommand] Constructor starting...');
        
        super({
            name: 'translate',
            description: '翻訳機能の管理と実行（日英翻訳のみ対応）',
            category: 'Translation',
            cooldown: 2000
        });
        
        console.log('[TranslationCommand] BaseCommand constructor completed');
        
        // Initialize service lazily to avoid constructor issues
        this.translationService = null;
        
        console.log('[TranslationCommand] Constructor completed');
    }

    async getTranslationService() {
        // Always use the global service instance to ensure consistency
        if (global.wynnTrackerBot && global.wynnTrackerBot.getService) {
            const globalService = global.wynnTrackerBot.getService('translation');
            if (globalService) {
                console.log('[TranslationCommand] Using global TranslationService instance');
                return globalService;
            }
        }
        
        // Fallback to creating new instance only if global not available
        if (!this.translationService) {
            console.log('[TranslationCommand] Creating new TranslationService instance...');
            const TranslationService = require('../services/TranslationService');
            this.translationService = new TranslationService();
            await this.translationService.ensureInitialized();
            console.log('[TranslationCommand] TranslationService initialized');
        }
        return this.translationService;
    }

    getSlashCommandData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('text')
                    .setDescription('テキストを翻訳します（日英のみ対応）')
                    .addStringOption(option =>
                        option
                            .setName('text')
                            .setDescription('翻訳したいテキスト')
                            .setRequired(true)
                    )
                    .addStringOption(option =>
                        option
                            .setName('to')
                            .setDescription('翻訳先の言語（DeepL API制限により日英のみ対応）')
                            .setRequired(true)
                            .addChoices(
                                { name: '英語 (EN-US)', value: 'EN-US' },
                                { name: '日本語 (JA)', value: 'JA' }
                            )
                    )
                    .addStringOption(option =>
                        option
                            .setName('from')
                            .setDescription('翻訳元の言語（省略時は自動検出、日英のみ対応）')
                            .setRequired(false)
                            .addChoices(
                                { name: '自動検出', value: 'auto' },
                                { name: '英語 (EN)', value: 'EN' },
                                { name: '日本語 (JA)', value: 'JA' }
                            )
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('auto')
                    .setDescription('自動翻訳を設定します（管理者のみ、日英のみ対応）')
                    .addBooleanOption(option =>
                        option
                            .setName('enabled')
                            .setDescription('自動翻訳を有効にするか')
                            .setRequired(true)
                    )
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('対象チャンネル（省略時は現在のチャンネル）')
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option
                            .setName('from')
                            .setDescription('翻訳元の言語（DeepL API制限により日英のみ対応）')
                            .setRequired(false)
                            .addChoices(
                                { name: '日本語 (JA)', value: 'JA' },
                                { name: '英語 (EN)', value: 'EN' }
                            )
                    )
                    .addStringOption(option =>
                        option
                            .setName('to')
                            .setDescription('翻訳先の言語（DeepL API制限により日英のみ対応）')
                            .setRequired(false)
                            .addChoices(
                                { name: '英語 (EN-US)', value: 'EN-US' },
                                { name: '日本語 (JA)', value: 'JA' }
                            )
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('status')
                    .setDescription('翻訳システムの状態を表示します')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('metrics')
                    .setDescription('翻訳システムの詳細メトリクスを表示します（管理者のみ）')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('health')
                    .setDescription('翻訳システムのヘルスチェックを実行します')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('cache')
                    .setDescription('翻訳キャッシュを管理します（管理者のみ）')
                    .addStringOption(option =>
                        option
                            .setName('action')
                            .setDescription('実行するアクション')
                            .setRequired(true)
                            .addChoices(
                                { name: 'クリア', value: 'clear' },
                                { name: '統計表示', value: 'stats' }
                            )
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('reload')
                    .setDescription('翻訳システムの設定を再読み込みします（管理者のみ）')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('設定されている自動翻訳の一覧を表示します')
            );
    }

    async run(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            console.log(`[TranslationCommand] Executing subcommand: ${subcommand}`);
            
            switch (subcommand) {
                case 'text':
                    await this.handleTextTranslation(interaction);
                    break;
                case 'auto':
                    await this.handleAutoTranslation(interaction);
                    break;
                case 'status':
                    await this.handleStatus(interaction);
                    break;
                case 'metrics':
                    await this.handleMetrics(interaction);
                    break;
                case 'health':
                    await this.handleHealth(interaction);
                    break;
                case 'cache':
                    await this.handleCache(interaction);
                    break;
                case 'reload':
                    await this.handleReload(interaction);
                    break;
                case 'list':
                    await this.handleList(interaction);
                    break;
                default:
                    console.error(`[TranslationCommand] Unknown subcommand: ${subcommand}`);
                    await this.sendError(interaction, '不明なサブコマンドです。');
            }
        } catch (error) {
            console.error('[TranslationCommand] Command execution error:', {
                subcommand,
                error: error.message,
                stack: error.stack,
                name: error.name,
                type: typeof error
            });
            
            // Send more detailed error information
            const errorMessage = error.message 
                ? `翻訳コマンドエラー: ${error.message}`
                : '翻訳コマンドの実行中に予期しないエラーが発生しました。';
                
            await this.sendError(interaction, errorMessage);
        }
    }

    async handleTextTranslation(interaction) {
        console.log('[TranslationCommand] Starting text translation');
        await this.deferReply(interaction);

        const text = this.getString(interaction, 'text', true);
        const targetLang = this.getString(interaction, 'to', true);
        
        console.log('[TranslationCommand] Parameters:', {
            textLength: text?.length,
            targetLang,
            userId: interaction.user.id
        });

        try {
            console.log('[TranslationCommand] Getting translation service...');
            const translationService = await this.getTranslationService();
            
            console.log('[TranslationCommand] Calling translateText...');
            const result = await translationService.translateText(text, targetLang);
            
            console.log('[TranslationCommand] Translation successful:', {
                service: result.service,
                confidence: result.confidence,
                hasTranslatedText: !!result.translatedText
            });
            
            // Determine color based on service and confidence
            let embedColor = 0x0099ff;
            let serviceInfo = 'Powered by DeepL API';
            
            if (result.service === 'Mock') {
                embedColor = 0xffaa00;
                serviceInfo = 'Demo mode (API not configured)';
            } else if (result.service === 'Fallback') {
                embedColor = 0xff6600;
                serviceInfo = 'Fallback mode (API error)';
            }
            
            const embed = {
                color: embedColor,
                title: '🌐 翻訳結果',
                fields: [
                    {
                        name: '元のテキスト',
                        value: `\`\`\`${text}\`\`\``,
                        inline: false
                    },
                    {
                        name: '翻訳結果',
                        value: `\`\`\`${result.translatedText}\`\`\``,
                        inline: false
                    },
                    {
                        name: '言語',
                        value: `${result.detected_source_language || 'auto'} → ${targetLang}`,
                        inline: true
                    },
                    {
                        name: '信頼度',
                        value: `${result.confidence}%`,
                        inline: true
                    },
                    {
                        name: 'サービス',
                        value: result.service,
                        inline: true
                    }
                ],
                footer: {
                    text: serviceInfo,
                    icon_url: interaction.client.user.displayAvatarURL()
                },
                timestamp: new Date().toISOString()
            };

            console.log('[TranslationCommand] Sending response embed...');
            await this.editReply(interaction, { embeds: [embed] });
            console.log('[TranslationCommand] Text translation completed successfully');
        } catch (error) {
            console.error('[TranslationCommand] Translation error:', {
                error: error.message,
                stack: error.stack,
                name: error.name,
                type: error.type || 'Unknown',
                text: text?.substring(0, 50) + '...',
                targetLang
            });
            
            const errorMessage = error.message 
                ? `翻訳に失敗しました：${error.message}`
                : '翻訳中に予期しないエラーが発生しました。';
                
            await this.editReply(interaction, `❌ ${errorMessage}`);
        }
    }

    async handleAutoTranslation(interaction) {
        // 管理者権限チェック
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await this.sendError(interaction, '❌ この機能は管理者のみが使用できます。');
        }

        const enabled = this.getBoolean(interaction, 'enabled', true);
        const sourceLang = this.getString(interaction, 'from') || 'JA';
        const targetLang = this.getString(interaction, 'to') || 'EN-US';
        const targetChannel = this.getChannel(interaction, 'channel');
        const channelId = targetChannel ? targetChannel.id : interaction.channel.id;

        try {
            const translationService = await this.getTranslationService();
            
            if (enabled) {
                // Ensure source and target languages are different
                const normalizedSourceLang = sourceLang.toLowerCase();
                const normalizedTargetLang = targetLang.toLowerCase();
                
                // Check if both languages are the same
                if (normalizedSourceLang === normalizedTargetLang ||
                    (normalizedSourceLang === 'ja' && normalizedTargetLang === 'ja') ||
                    (normalizedSourceLang === 'en' && (normalizedTargetLang === 'en' || normalizedTargetLang === 'en-us'))) {
                    return await this.sendError(interaction, 
                        '❌ 翻訳元と翻訳先の言語が同じです。異なる言語を選択してください。');
                }
                
                await translationService.enableAutoTranslate(
                    channelId, 
                    sourceLang.toLowerCase(), 
                    targetLang, 
                    {
                        userId: interaction.user.id,
                        bidirectional: true
                    }
                );
                const channelMention = targetChannel ? `<#${channelId}>` : 'このチャンネル';
                await this.sendSuccess(interaction, `✅ ${channelMention}の自動翻訳を有効にしました。\n翻訳設定: ${sourceLang} → ${targetLang}`);
            } else {
                await translationService.disableAutoTranslate(channelId);
                const channelMention = targetChannel ? `<#${channelId}>` : 'このチャンネル';
                await this.sendSuccess(interaction, `✅ ${channelMention}の自動翻訳を無効にしました。`);
            }
        } catch (error) {
            console.error('Auto translation setup error:', error);
            await this.sendError(interaction, `❌ 自動翻訳の設定に失敗しました：${error.message}`);
        }
    }

    async handleStatus(interaction) {
        try {
            const translationService = await this.getTranslationService();
            const health = await translationService.checkServiceHealth();
            const stats = translationService.getStats();
            
            const embed = {
                color: health.deepLApi?.healthy !== false ? 0x00ff00 : 0xff0000,
                title: '📊 翻訳システム状態',
                fields: [
                    {
                        name: 'API状態',
                        value: health.deepLApi?.healthy !== false ? '🟢 正常' : '🔴 異常',
                        inline: true
                    },
                    {
                        name: '自動翻訳チャンネル数',
                        value: health.autoTranslateChannels.toString(),
                        inline: true
                    },
                    {
                        name: '翻訳キュー',
                        value: `${health.queueSize}件`,
                        inline: true
                    },
                    {
                        name: '処理状態',
                        value: health.processing ? '🔄 処理中' : '⏸️ 待機中',
                        inline: true
                    },
                    {
                        name: 'サービス状態',
                        value: stats.initialized ? '🟢 初期化済み' : '🔴 未初期化',
                        inline: true
                    },
                    {
                        name: 'キャッシュ',
                        value: `ヒット: ${stats.cache.hits || 0}, ミス: ${stats.cache.misses || 0}`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString()
            };

            await this.sendReply(interaction, { embeds: [embed] });
        } catch (error) {
            console.error('Status check error:', error);
            await this.sendError(interaction, '❌ ステータスの取得に失敗しました。');
        }
    }

    async handleMetrics(interaction) {
        // 管理者権限チェック
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await this.sendError(interaction, '❌ この機能は管理者のみが使用できます。');
        }

        try {
            const translationService = await this.getTranslationService();
            const usage = await translationService.getUsageStats();
            const stats = translationService.getStats();
            const health = await translationService.checkServiceHealth();
            
            const embed = {
                color: 0x0099ff,
                title: '📈 翻訳システムメトリクス',
                fields: [
                    {
                        name: 'API使用量',
                        value: usage ? `${usage.characterCount} / ${usage.characterLimit} 文字` : 'データなし',
                        inline: true
                    },
                    {
                        name: '使用率',
                        value: usage ? `${usage.usagePercentage.toFixed(1)}%` : 'データなし',
                        inline: true
                    },
                    {
                        name: 'キャッシュ統計',
                        value: `ヒット: ${stats.cache.hits || 0}\nミス: ${stats.cache.misses || 0}`,
                        inline: true
                    },
                    {
                        name: '自動翻訳チャンネル',
                        value: health.autoTranslateChannels.toString(),
                        inline: true
                    },
                    {
                        name: 'キュー状態',
                        value: `${health.queueSize}件${health.processing ? ' (処理中)' : ''}`,
                        inline: true
                    },
                    {
                        name: 'エラー数',
                        value: stats.errors?.total?.toString() || '0',
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString()
            };

            await this.sendReply(interaction, { embeds: [embed] });
        } catch (error) {
            console.error('Metrics error:', error);
            await this.sendError(interaction, '❌ メトリクスの取得に失敗しました。');
        }
    }

    async handleHealth(interaction) {
        await this.deferReply(interaction);

        try {
            const translationService = await this.getTranslationService();
            const health = await translationService.healthCheck();
            const serviceHealth = await translationService.checkServiceHealth();
            
            const embed = {
                color: health.healthy ? 0x00ff00 : 0xff0000,
                title: '🏥 翻訳システムヘルスチェック',
                fields: [
                    {
                        name: '総合評価',
                        value: health.healthy ? '✅ 良好' : '❌ 問題あり',
                        inline: false
                    },
                    {
                        name: 'サービス状態',
                        value: health.initialized ? '✅ 初期化済み' : '❌ 未初期化',
                        inline: true
                    },
                    {
                        name: 'API接続',
                        value: serviceHealth.deepLApi?.healthy !== false ? '✅ 正常' : '❌ 異常',
                        inline: true
                    },
                    {
                        name: '処理状態',
                        value: serviceHealth.processing ? '🔄 処理中' : '⏸️ 待機中',
                        inline: true
                    },
                    {
                        name: 'キュー状態',
                        value: `${serviceHealth.queueSize}件`,
                        inline: true
                    },
                    {
                        name: '自動翻訳設定',
                        value: `${serviceHealth.autoTranslateChannels}チャンネル`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString()
            };

            if (health.error) {
                embed.fields.push({
                    name: '⚠️ エラー',
                    value: health.error,
                    inline: false
                });
            }

            await this.editReply(interaction, { embeds: [embed] });
        } catch (error) {
            console.error('Health check error:', error);
            await this.editReply(interaction, '❌ ヘルスチェックの実行に失敗しました。');
        }
    }

    async handleCache(interaction) {
        // 管理者権限チェック
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await this.sendError(interaction, '❌ この機能は管理者のみが使用できます。');
        }

        const action = this.getString(interaction, 'action', true);

        try {
            const translationService = await this.getTranslationService();
            
            if (action === 'clear') {
                await translationService.clearCache();
                await this.sendSuccess(interaction, '✅ 翻訳キャッシュをクリアしました。');
            } else if (action === 'stats') {
                const stats = translationService.getStats();
                
                const embed = {
                    color: 0x0099ff,
                    title: '📊 キャッシュ統計',
                    fields: [
                        {
                            name: 'サービス状態',
                            value: stats.initialized ? '初期化済み' : '未初期化',
                            inline: true
                        },
                        {
                            name: 'キャッシュヒット',
                            value: (stats.cache.hits || 0).toString(),
                            inline: true
                        },
                        {
                            name: 'キャッシュミス',
                            value: (stats.cache.misses || 0).toString(),
                            inline: true
                        },
                        {
                            name: 'ヒット率',
                            value: stats.cache.hits && stats.cache.misses 
                                ? `${((stats.cache.hits / (stats.cache.hits + stats.cache.misses)) * 100).toFixed(1)}%`
                                : 'データなし',
                            inline: true
                        },
                        {
                            name: 'エラー数',
                            value: (stats.errors?.total || 0).toString(),
                            inline: true
                        }
                    ],
                    timestamp: new Date().toISOString()
                };

                await this.sendReply(interaction, { embeds: [embed] });
            }
        } catch (error) {
            console.error('Cache management error:', error);
            await this.sendError(interaction, '❌ キャッシュ操作に失敗しました。');
        }
    }

    async handleReload(interaction) {
        // 管理者権限チェック
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await this.sendError(interaction, '❌ この機能は管理者のみが使用できます。');
        }

        try {
            // Reset the service to force re-initialization
            this.translationService = null;
            const translationService = await this.getTranslationService();
            await this.sendSuccess(interaction, '✅ 翻訳システムの設定を再読み込みしました。');
        } catch (error) {
            console.error('Configuration reload error:', error);
            await this.sendError(interaction, '❌ 設定の再読み込みに失敗しました。');
        }
    }

    async handleList(interaction) {
        try {
            const translationService = await this.getTranslationService();
            const allSettings = await translationService.getAllAutoTranslateSettings();
            
            if (!allSettings || Object.keys(allSettings).length === 0) {
                const embed = {
                    color: 0xffaa00,
                    title: '📋 自動翻訳設定一覧',
                    description: '現在設定されている自動翻訳はありません。\n`/translate auto enabled:true` で設定できます。',
                    timestamp: new Date().toISOString()
                };
                
                return await this.sendReply(interaction, { embeds: [embed] });
            }

            const fields = [];
            
            for (const [channelId, settings] of Object.entries(allSettings)) {
                const channelMention = `<#${channelId}>`;
                const enabledBy = settings.enabledBy ? `<@${settings.enabledBy}>` : '不明';
                const enabledAt = settings.enabledAt ? 
                    new Date(settings.enabledAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : 
                    '不明';
                
                let statusText = settings.enabled ? '🟢 有効' : '🔴 無効';
                let languageInfo = `${settings.sourceLang?.toUpperCase() || '不明'} → ${settings.targetLang?.toUpperCase() || '不明'}`;
                
                if (settings.options?.bidirectional) {
                    languageInfo += ' (双方向)';
                }
                
                const fieldValue = [
                    `**状態**: ${statusText}`,
                    `**言語**: ${languageInfo}`,
                    `**設定者**: ${enabledBy}`,
                    `**設定日時**: ${enabledAt}`,
                    `**最小文字数**: ${settings.options?.minLength || 3}文字`
                ].join('\n');
                
                fields.push({
                    name: channelMention,
                    value: fieldValue,
                    inline: false
                });
            }
            
            // Discord埋め込みの制限（25フィールド）に対応
            const maxFields = 25;
            if (fields.length > maxFields) {
                fields.splice(maxFields - 1);
                fields.push({
                    name: '⚠️ 表示制限',
                    value: `設定が多すぎるため、最初の${maxFields - 1}件のみ表示しています。`,
                    inline: false
                });
            }
            
            const embed = {
                color: 0x0099ff,
                title: '📋 自動翻訳設定一覧',
                description: `設定されている自動翻訳: **${Object.keys(allSettings).length}件**`,
                fields: fields,
                footer: {
                    text: `設定変更: /translate auto | 無効化: /translate auto enabled:false`
                },
                timestamp: new Date().toISOString()
            };
            
            await this.sendReply(interaction, { embeds: [embed] });
            
        } catch (error) {
            console.error('Translation list error:', error);
            await this.sendError(interaction, '❌ 翻訳設定一覧の取得に失敗しました。');
        }
    }

    async handleMessage(message) {
        if (!message || message.author.bot) return;
        
        try {
            const translationService = await this.getTranslationService();
            await translationService.handleMessageAutoTranslate(message);
        } catch (error) {
            console.error('[TranslationCommand] Message handling error:', error.message);
        }
    }

    static create() {
        return new TranslationCommand();
    }
}

module.exports = TranslationCommand;