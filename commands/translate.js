const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TRANSLATE_DATA_PATH = path.join(__dirname, '..', 'data', 'translate_settings.json');

// データディレクトリがなければ作成
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// 翻訳設定を読み込み
function loadTranslateSettings() {
    if (fs.existsSync(TRANSLATE_DATA_PATH)) {
        try {
            const data = fs.readFileSync(TRANSLATE_DATA_PATH, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('[ERROR] 翻訳設定の読み込みに失敗:', error);
            return {};
        }
    }
    return {};
}

// 翻訳設定を保存
function saveTranslateSettings(settings) {
    try {
        fs.writeFileSync(TRANSLATE_DATA_PATH, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('[ERROR] 翻訳設定の保存に失敗:', error);
    }
}

// 日本語検出の簡易関数
function containsJapanese(text) {
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseRegex.test(text);
}

// シンプル翻訳機能（辞書ベース）
function simpleTranslate(text) {
    const translations = {
        // 基本的な挨拶
        'こんにちは': 'Hello',
        'おはよう': 'Good morning', 
        'こんばんは': 'Good evening',
        'お疲れ様': 'Good work',
        'さようなら': 'Goodbye',
        
        // 感謝・謝罪
        'ありがとう': 'Thank you',
        'ありがとうございます': 'Thank you very much',
        'すみません': 'Excuse me',
        'ごめんなさい': 'Sorry',
        
        // 基本的な応答
        'はい': 'Yes',
        'いいえ': 'No',
        'わかりました': 'I understand',
        'そうです': 'That\'s right',
        'いいですね': 'That\'s good',
        
        // ゲーム関連用語
        'レベル': 'level',
        'スキル': 'skill',
        'クエスト': 'quest',
        'ダンジョン': 'dungeon',
        'ボス': 'boss',
        'アイテム': 'item',
        'ギルド': 'guild',
        'パーティー': 'party',
        'レイド': 'raid',
        'ワインクラフト': 'Wynncraft',
        
        // 一般的な表現
        'がんばって': 'Good luck',
        'また今度': 'See you later',
        'お願いします': 'Please',
        'おめでとう': 'Congratulations',
        '大丈夫': 'It\'s okay',
        '問題ない': 'No problem',
        
        // 時間
        '今': 'now',
        '今日': 'today',
        '明日': 'tomorrow',
        '昨日': 'yesterday',
        
        // 感情表現
        '楽しい': 'fun',
        '嬉しい': 'happy',
        '悲しい': 'sad',
        '面白い': 'interesting'
    };
    
    let translated = text;
    
    // 辞書を使って翻訳
    for (const [japanese, english] of Object.entries(translations)) {
        const regex = new RegExp(japanese, 'gi');
        translated = translated.replace(regex, english);
    }
    
    // 基本的な文構造の変換
    translated = translated
        .replace(/です$/, '') 
        .replace(/ます$/, '') 
        .replace(/だ$/, '')   
        .replace(/私は/, 'I am') 
        .replace(/あなたは/, 'you are') 
        .replace(/これは/, 'this is') 
        .replace(/それは/, 'that is');
    
    return translated.trim() || `[Translation needed] ${text}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('日本語チャットの自動英語翻訳機能（管理者限定）')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('指定チャンネルの翻訳機能を切り替え')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('翻訳機能を有効にするか')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('対象チャンネル（省略時は現在のチャンネル）')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('翻訳機能の状態を確認')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('翻訳機能をテスト')
                .addStringOption(option =>
                    option
                        .setName('text')
                        .setDescription('翻訳するテキスト')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        // 管理者権限チェック
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ このコマンドは管理者権限が必要です',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'toggle') {
            await handleToggle(interaction);
        } else if (subcommand === 'status') {
            await handleStatus(interaction);
        } else if (subcommand === 'test') {
            await handleTest(interaction);
        }
    },

    // メッセージ監視用の関数
    async handleMessage(message) {
        // ボット自身のメッセージは無視
        if (message.author.bot) return;

        const settings = loadTranslateSettings();
        const channelId = message.channel.id;

        // このチャンネルで翻訳が有効かチェック
        if (!settings[channelId] || !settings[channelId].enabled) return;

        // 日本語が含まれているかチェック
        if (!containsJapanese(message.content)) return;

        try {
            // 翻訳実行
            const translatedText = simpleTranslate(message.content);

            const embed = new EmbedBuilder()
                .setColor('#4285F4')
                .setAuthor({
                    name: message.author.displayName || message.author.username,
                    iconURL: message.author.displayAvatarURL()
                })
                .setDescription(`**原文 (日本語):**\n${message.content}\n\n**翻訳 (English):**\n${translatedText}`)
                .setFooter({ text: '🔤 簡易翻訳 | Simple Translation' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERROR] 翻訳処理エラー:', error);
        }
    }
};

async function handleToggle(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const enabled = interaction.options.getBoolean('enabled');

    const settings = loadTranslateSettings();
    
    if (!settings[channel.id]) {
        settings[channel.id] = {};
    }
    
    settings[channel.id].enabled = enabled;
    settings[channel.id].setBy = interaction.user.id;
    settings[channel.id].setAt = new Date().toISOString();

    saveTranslateSettings(settings);

    const statusText = enabled ? '有効' : '無効';
    const statusEmoji = enabled ? '✅' : '❌';

    const embed = new EmbedBuilder()
        .setTitle(`${statusEmoji} 翻訳機能設定完了`)
        .setDescription(`<#${channel.id}> の翻訳機能を **${statusText}** にしました`)
        .setColor(enabled ? '#00FF00' : '#FF0000')
        .addFields(
            { name: '📍 対象チャンネル', value: `<#${channel.id}>`, inline: true },
            { name: '🔧 設定状態', value: statusText, inline: true },
            { name: '👤 設定者', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({ text: '🌐 翻訳機能管理システム' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleStatus(interaction) {
    const settings = loadTranslateSettings();
    
    const embed = new EmbedBuilder()
        .setTitle('🌐 翻訳機能状態')
        .setColor('#4285F4')
        .setTimestamp();

    if (Object.keys(settings).length === 0) {
        embed.setDescription('現在、翻訳機能が有効なチャンネルはありません。');
    } else {
        let description = '**翻訳機能が設定されているチャンネル:**\n\n';
        
        for (const [channelId, config] of Object.entries(settings)) {
            const status = config.enabled ? '✅ 有効' : '❌ 無効';
            const setAt = config.setAt ? new Date(config.setAt).toLocaleString('ja-JP') : '不明';
            description += `<#${channelId}> - ${status}\n`;
            description += `　設定日時: ${setAt}\n\n`;
        }
        
        embed.setDescription(description);
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleTest(interaction) {
    const text = interaction.options.getString('text');
    
    if (!containsJapanese(text)) {
        return await interaction.reply({
            content: '⚠️ 指定されたテキストに日本語が含まれていません。'
        });
    }

    const translatedText = simpleTranslate(text);

    const embed = new EmbedBuilder()
        .setTitle('🔬 翻訳テスト結果')
        .setColor('#4285F4')
        .addFields(
            { name: '🇯🇵 原文 (日本語)', value: text },
            { name: '🇺🇸 翻訳 (English)', value: translatedText }
        )
        .setFooter({ text: '🔤 簡易翻訳テスト機能' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}