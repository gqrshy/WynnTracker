const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const ANNI_DATA_PATH = path.join(__dirname, '..', 'data', 'annihilation.json');
// Annihilationの間隔: 3日4時間31分（ミリ秒）
const ANNI_INTERVAL = (3 * 24 * 60 * 60 * 1000) + (4 * 60 * 60 * 1000) + (31 * 60 * 1000);

// 画像URL（GitHubから直接）
const ANNI_IMAGES = {
    gray: 'https://raw.githubusercontent.com/gqrshy/wynncraft-bot-assets/main/anni/anni_gray.png',
    normal: 'https://raw.githubusercontent.com/gqrshy/wynncraft-bot-assets/main/anni/anni.png'
};

// データディレクトリがなければ作成
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('annihilation')
        .setDescription('Annihilationイベント関連のコマンド')
        .addSubcommand(subcommand =>
            subcommand
                .setName('timer')
                .setDescription('Annihilationのカウントダウンタイマーを設定（管理者のみ）')
                .addStringOption(option =>
                    option
                        .setName('datetime')
                        .setDescription('開始日時 (YYYY-MM-DD HH:MM:SS UTC形式)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('alert')
                .setDescription('Annihilation通知を設定')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('mention')
                .setDescription('メンションするロールを設定（管理者のみ）')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('メンションするロール')
                        .setRequired(true)
                )
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'timer') {
            await handleTimer(interaction);
        } else if (subcommand === 'alert') {
            await handleAlert(interaction);
        } else if (subcommand === 'mention') {
            await handleMentionSet(interaction);
        }
    }
};

async function handleMentionSet(interaction) {
    // 管理者権限チェック
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
            content: '❌ このコマンドは管理者権限が必要です',
            ephemeral: true
        });
    }
    
    const role = interaction.options.getRole('role');
    
    // 設定データを保存
    const configPath = path.join(__dirname, '..', 'data', 'anni_config.json');
    let config = {};
    
    try {
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (error) {
        console.error('[ERROR] 設定読み込みエラー:', error);
    }
    
    config.mentionRoleId = role.id;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    await interaction.reply({
        content: `✅ Annihilationアラートのメンション先を <@&${role.id}> に設定しました。`,
        ephemeral: true
    });
}

// ... (以下、残りの関数は変更なし)git push