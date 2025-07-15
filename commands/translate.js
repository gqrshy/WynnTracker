const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const TranslationService = require('../lib/translation/TranslationService');
const path = require('path');
const fs = require('fs');

// 設定ファイル
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'translation.json');
const DEFAULT_CONFIG = {
    engine: {
        apiKey: process.env.DEEPL_API_KEY || '0af03f84-0746-4618-810c-a66c015ba2fe:fx',
        rateLimit: 100,
        timeout: 5000
    },
    cache: {
        maxSize: 1000,
        defaultTTL: 1800000, // 30分
        cleanupInterval: 300000 // 5分
    },
    batch: {
        delay: 100,
        timeout: 30000,
        workerCount: 2
    },
    metrics: {
        logMetrics: true,
        logInterval: 300000
    }
};

// 翻訳サービスの初期化
let translationService;
let settings = {};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
            return { ...DEFAULT_CONFIG, ...JSON.parse(configData) };
        }
    } catch (error) {
        console.error('[Translation] Config load error:', error);
    }
    return DEFAULT_CONFIG;
}

function loadSettings() {
    const settingsPath = path.join(__dirname, '..', 'data', 'translate_settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Translation] Settings load error:', error);
    }
    return {};
}

function saveSettings(newSettings) {
    const settingsPath = path.join(__dirname, '..', 'data', 'translate_settings.json');
    try {
        const dataDir = path.dirname(settingsPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));
        settings = newSettings;
    } catch (error) {
        console.error('[Translation] Settings save error:', error);
    }
}

// 初期化
function initialize() {
    try {
        const config = loadConfig();
        settings = loadSettings();
        
        translationService = new TranslationService(config);
        
        // サービスイベントリスナー
        translationService.on('serviceReady', () => {
            console.log('[Translation] Service ready');
        });
        
        translationService.on('batchProcessed', (data) => {
            console.log(`[Translation] Batch processed: ${data.successful}/${data.successful + data.failed} messages`);
        });
        
        console.log('[Translation] Service initialized');
    } catch (error) {
        console.error('[Translation] Initialization error:', error);
    }
}

// 日本語検出
function containsJapanese(text) {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

// 言語コードマッピング
const LANGUAGE_CODES = {
    'EN-US': 'English',
    'JA': '日本語',
    'ES': 'Español',
    'FR': 'Français',
    'DE': 'Deutsch',
    'IT': 'Italiano',
    'PT-BR': 'Português',
    'RU': 'Русский',
    'ZH': '中文',
    'KO': '한국어'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('高性能翻訳システム - DeepL API使用')
        .addSubcommand(subcommand =>
            subcommand
                .setName('text')
                .setDescription('テキストを翻訳')
                .addStringOption(option =>
                    option
                        .setName('text')
                        .setDescription('翻訳するテキスト')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('to')
                        .setDescription('翻訳先言語')
                        .setRequired(false)
                        .addChoices(
                            { name: 'English', value: 'EN-US' },
                            { name: '日本語', value: 'JA' },
                            { name: 'Español', value: 'ES' },
                            { name: 'Français', value: 'FR' },
                            { name: 'Deutsch', value: 'DE' },
                            { name: 'Italiano', value: 'IT' },
                            { name: 'Português', value: 'PT-BR' },
                            { name: 'Русский', value: 'RU' },
                            { name: '中文', value: 'ZH' },
                            { name: '한국어', value: 'KO' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('from')
                        .setDescription('翻訳元言語（自動検出）')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('auto')
                .setDescription('自動翻訳設定（管理者限定）')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('自動翻訳を有効にする')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('対象チャンネル')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('target')
                        .setDescription('翻訳先言語')
                        .setRequired(false)
                        .addChoices(
                            { name: 'English', value: 'EN-US' },
                            { name: '日本語', value: 'JA' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('翻訳システムの状態確認')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('metrics')
                .setDescription('詳細なメトリクス表示')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('health')
                .setDescription('システムヘルスチェック')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('cache')
                .setDescription('キャッシュ管理（管理者限定）')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('実行するアクション')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Clear', value: 'clear' },
                            { name: 'Stats', value: 'stats' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reload')
                .setDescription('設定リロード（管理者限定）')
        ),

    async execute(interaction) {
        if (!translationService) {
            return await interaction.reply({
                content: '❌ 翻訳サービスが初期化されていません。',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'text':
                    await handleTextTranslation(interaction);
                    break;
                case 'auto':
                    await handleAutoTranslation(interaction);
                    break;
                case 'status':
                    await handleStatus(interaction);
                    break;
                case 'metrics':
                    await handleMetrics(interaction);
                    break;
                case 'health':
                    await handleHealth(interaction);
                    break;
                case 'cache':
                    await handleCache(interaction);
                    break;
                case 'reload':
                    await handleReload(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ 不明なサブコマンドです。',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('[Translation] Command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ エラーが発生しました')
                .setDescription(`\`\`\`${error.message}\`\`\``)
                .setColor('#FF0000')
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    // メッセージ自動翻訳
    async handleMessage(message) {
        if (!translationService || message.author.bot) return;

        const channelId = message.channel.id;
        const channelSettings = settings[channelId];
        
        if (!channelSettings || !channelSettings.enabled) return;

        try {
            await translationService.processMessageBatch(channelId, [message], channelSettings);
        } catch (error) {
            console.error('[Translation] Message processing error:', error);
        }
    },

    // 統計情報取得
    async getChannelStats(channelId) {
        if (!translationService) return null;
        return await translationService.getChannelStats(channelId);
    },

    // サービス終了
    async shutdown() {
        if (translationService) {
            await translationService.shutdown();
        }
    }
};

// ハンドラー関数
async function handleTextTranslation(interaction) {
    await interaction.deferReply();

    const text = interaction.options.getString('text');
    const targetLang = interaction.options.getString('to') || 'EN-US';
    const sourceLang = interaction.options.getString('from') || null;

    try {
        const result = await translationService.translateText(text, sourceLang, targetLang);
        
        const embed = new EmbedBuilder()
            .setTitle('🌐 翻訳結果')
            .setColor('#006CAC')
            .addFields(
                { name: '📝 原文', value: text.length > 1024 ? text.substring(0, 1021) + '...' : text },
                { name: '🔄 翻訳', value: result.text.length > 1024 ? result.text.substring(0, 1021) + '...' : result.text }
            )
            .setFooter({ text: `Powered by DeepL | 検出言語: ${result.detected_source_language || 'AUTO'}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        throw new Error(`翻訳処理に失敗しました: ${error.message}`);
    }
}

async function handleAutoTranslation(interaction) {
    // 管理者権限チェック
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
            content: '❌ この機能は管理者権限が必要です。',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const enabled = interaction.options.getBoolean('enabled');
    const targetLang = interaction.options.getString('target') || 'EN-US';

    // 設定更新
    if (!settings[channel.id]) {
        settings[channel.id] = {};
    }
    
    settings[channel.id].enabled = enabled;
    settings[channel.id].targetLang = targetLang;
    settings[channel.id].setBy = interaction.user.id;
    settings[channel.id].setAt = new Date().toISOString();

    saveSettings(settings);

    const embed = new EmbedBuilder()
        .setTitle(`${enabled ? '✅' : '❌'} 自動翻訳設定更新`)
        .setDescription(`<#${channel.id}> の自動翻訳を **${enabled ? '有効' : '無効'}** にしました`)
        .setColor(enabled ? '#00FF00' : '#FF0000')
        .addFields(
            { name: 'チャンネル', value: `<#${channel.id}>`, inline: true },
            { name: '状態', value: enabled ? '有効' : '無効', inline: true },
            { name: '翻訳先', value: LANGUAGE_CODES[targetLang] || targetLang, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleStatus(interaction) {
    const health = await translationService.getSystemHealth();
    
    const embed = new EmbedBuilder()
        .setTitle('📊 翻訳システム状態')
        .setColor(health.status === 'healthy' ? '#00FF00' : '#FF0000')
        .addFields(
            { name: 'システム状態', value: health.status === 'healthy' ? '✅ 正常' : '❌ 異常', inline: true },
            { name: '稼働時間', value: `${Math.round(health.uptime / 60)}分`, inline: true },
            { name: '平均応答時間', value: `${Math.round(health.performance.avgResponseTime)}ms`, inline: true },
            { name: 'キャッシュヒット率', value: `${health.performance.cacheHitRate}%`, inline: true },
            { name: '成功率', value: `${health.performance.successRate}%`, inline: true }
        )
        .setTimestamp();

    // アクティブチャンネル情報
    const activeChannels = Object.entries(settings).filter(([_, config]) => config.enabled);
    if (activeChannels.length > 0) {
        const channelList = activeChannels.map(([id, config]) => 
            `<#${id}> → ${LANGUAGE_CODES[config.targetLang] || config.targetLang}`
        ).join('\n');
        embed.addFields({ name: 'アクティブチャンネル', value: channelList });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleMetrics(interaction) {
    await interaction.deferReply();
    
    const metrics = await translationService.getDetailedMetrics();
    
    const embed = new EmbedBuilder()
        .setTitle('📈 詳細メトリクス')
        .setColor('#006CAC')
        .addFields(
            { name: '翻訳リクエスト総数', value: metrics.system.components.metrics.translation.totalRequests.toString(), inline: true },
            { name: '成功率', value: `${metrics.system.components.metrics.translation.successRate.toFixed(1)}%`, inline: true },
            { name: '平均応答時間', value: `${metrics.system.components.metrics.translation.avgResponseTime}ms`, inline: true },
            { name: 'メモリ使用量', value: `${metrics.system.components.metrics.system.memoryUsage}MB`, inline: true },
            { name: 'キャッシュサイズ', value: `${metrics.system.components.cache.size}/${metrics.system.components.cache.maxSize}`, inline: true },
            { name: 'アクティブな言語', value: metrics.system.components.metrics.translation.activeLanguages.toString(), inline: true }
        )
        .setTimestamp();

    // 言語別統計
    if (metrics.languages.length > 0) {
        const languageStats = metrics.languages.slice(0, 5).map(lang => 
            `${lang.language}: ${lang.count}回`
        ).join('\n');
        embed.addFields({ name: 'トップ言語', value: languageStats });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleHealth(interaction) {
    const health = await translationService.getSystemHealth();
    
    const embed = new EmbedBuilder()
        .setTitle('🏥 システムヘルスチェック')
        .setColor(health.status === 'healthy' ? '#00FF00' : '#FF0000')
        .setDescription(`**全体状態**: ${health.status === 'healthy' ? '✅ 正常' : '❌ 異常'}`)
        .addFields(
            { name: '翻訳エンジン', value: health.components.engine.isHealthy ? '✅ 正常' : '❌ 異常', inline: true },
            { name: 'キャッシュ', value: '✅ 正常', inline: true },
            { name: 'バッチ処理', value: '✅ 正常', inline: true },
            { name: 'サーキットブレーカー', value: health.components.engine.circuitBreaker.state, inline: true },
            { name: 'アクティブキュー', value: health.components.batch.activeQueues.toString(), inline: true },
            { name: 'ワーカー状態', value: `${health.components.batch.workerStats.filter(w => !w.busy).length}/${health.components.batch.workerStats.length} 利用可能`, inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleCache(interaction) {
    // 管理者権限チェック
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
            content: '❌ この機能は管理者権限が必要です。',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    const action = interaction.options.getString('action');
    
    if (action === 'clear') {
        await translationService.clearCache();
        
        const embed = new EmbedBuilder()
            .setTitle('🧹 キャッシュクリア完了')
            .setDescription('翻訳キャッシュが正常にクリアされました。')
            .setColor('#00FF00')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        
    } else if (action === 'stats') {
        const health = await translationService.getSystemHealth();
        const cacheStats = health.components.cache;
        
        const embed = new EmbedBuilder()
            .setTitle('📊 キャッシュ統計')
            .setColor('#006CAC')
            .addFields(
                { name: 'キャッシュサイズ', value: `${cacheStats.size}/${cacheStats.maxSize}`, inline: true },
                { name: 'ヒット率', value: `${cacheStats.hitRate}%`, inline: true },
                { name: '総メモリ使用量', value: `${Math.round(cacheStats.totalBytes / 1024)}KB`, inline: true },
                { name: 'ヒット数', value: cacheStats.statistics.hits.toString(), inline: true },
                { name: 'ミス数', value: cacheStats.statistics.misses.toString(), inline: true },
                { name: 'エビクション数', value: cacheStats.statistics.evictions.toString(), inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleReload(interaction) {
    // 管理者権限チェック
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
            content: '❌ この機能は管理者権限が必要です。',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    try {
        const newConfig = loadConfig();
        await translationService.reloadConfig(newConfig);
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 設定リロード完了')
            .setDescription('翻訳システムの設定が正常にリロードされました。')
            .setColor('#00FF00')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        throw new Error(`設定リロードに失敗しました: ${error.message}`);
    }
}

// サービス初期化
initialize();