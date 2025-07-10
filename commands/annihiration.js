const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const ANNI_DATA_PATH = path.join(__dirname, '..', 'data', 'annihilation.json');
// Annihilationの間隔: 3日4時間31分（ミリ秒）
const ANNI_INTERVAL = (3 * 24 * 60 * 60 * 1000) + (4 * 60 * 60 * 1000) + (31 * 60 * 1000);

// 画像URL（GitHubから直接）
const ANNI_IMAGES = {
    gray: 'https://raw.githubusercontent.com/gqrshy/wynncraft-bot-assets/main/Anni/anni_gray.png',
    normal: 'https://raw.githubusercontent.com/gqrshy/wynncraft-bot-assets/main/Anni/anni.png',
    coming: 'https://raw.githubusercontent.com/gqrshy/wynncraft-bot-assets/main/Anni/annicoming.png'
};

// データディレクトリがなければ作成
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// 通知タイマーを保存する変数
let notificationTimers = [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('annihilation')
        .setDescription('Annihilationイベント関連のコマンド（管理者限定）')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('timer')
                .setDescription('Annihilationのカウントダウンタイマーを設定')
                .addStringOption(option =>
                    option
                        .setName('datetime')
                        .setDescription('開始日時 (YYYY-MM-DD HH:MM:SS 24時間形式)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('timezone')
                        .setDescription('タイムゾーン')
                        .setRequired(true)
                        .addChoices(
                            { name: 'JST (日本標準時)', value: 'JST' },
                            { name: 'UTC (協定世界時)', value: 'UTC' }
                        )
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
        // 管理者権限チェック（念のため）
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ このコマンドは管理者権限が必要です',
                flags: 64
            });
        }
        
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
        flags: 64
    });
}

async function handleTimer(interaction) {
    const datetimeStr = interaction.options.getString('datetime');
    const timezone = interaction.options.getString('timezone');
    
    try {
        // タイムゾーンに応じて日時をパース
        let targetDate;
        if (timezone === 'JST') {
            targetDate = new Date(datetimeStr + ' GMT+9');
        } else {
            targetDate = new Date(datetimeStr + ' UTC');
        }
        
        if (isNaN(targetDate.getTime())) {
            return await interaction.reply({
                content: '❌ 無効な日時形式です。YYYY-MM-DD HH:MM:SS 形式（24時間表記）で入力してください。\n例: 2025-07-12 20:13:00 (午後8時13分)',
                flags: 64
            });
        }
        
        // 現在時刻と比較
        const now = new Date();
        if (targetDate <= now) {
            return await interaction.reply({
                content: '❌ 未来の日時を指定してください。',
                flags: 64
            });
        }
        
        // データを保存
        const anniData = {
            startTime: targetDate.toISOString(),
            setBy: interaction.user.id,
            setAt: now.toISOString(),
            serverId: interaction.guild.id
        };
        
        fs.writeFileSync(ANNI_DATA_PATH, JSON.stringify(anniData, null, 2));
        
        // 既存の通知をクリア（新しいタイマーが設定されたため）
        clearNotifications();
        
        // 残り時間を計算
        const timeUntil = targetDate.getTime() - now.getTime();
        const days = Math.floor(timeUntil / (24 * 60 * 60 * 1000));
        const hours = Math.floor((timeUntil % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((timeUntil % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeUntil % (60 * 1000)) / 1000);
        
        // JSTで表示するための日時フォーマット（既にJSTなのでそのまま使用）
        const jstDate = targetDate;
        const jstFormatted = jstDate.toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tokyo'
        }).replace(/(\d+日)\s+(\(.+?\))/, '$1$2');
        
        const embed = new EmbedBuilder()
            .setTitle('🔥 Next Annihilation Event 🔥')
            .setDescription(`⏰ **Time Remaining**\n` +
                          `\`\`\`${days}d ${hours}h ${minutes}m ${seconds}s\`\`\`\n` +
                          `📅 **Start Time**\n` +
                          `<t:${Math.floor(targetDate.getTime() / 1000)}:F>\n` +
                          `<t:${Math.floor(targetDate.getTime() / 1000)}:R>\n\n` +
                          `⚠️ *日時は計算での予測にすぎないため、余裕をもって参加することをお勧めいたします。*`)
            .setColor('#ff4444')
            .setImage(ANNI_IMAGES.coming)
            .setFooter({ text: 'Prelude to Annihilation - Wynncraft World Event' })
            .setTimestamp();
        
        const message = await interaction.reply({ embeds: [embed], fetchReply: true });
        
        // タイマーメッセージをMapに追加（10秒ごとに更新）
        interaction.client.timerMessages.set(message.id, {
            channelId: interaction.channel.id,
            targetTime: targetDate.getTime(),
            startTime: now.getTime()
        });
        
        // タイマーメッセージ情報を保存（bot再起動時の復元用）
        const timerPath = path.join(__dirname, '..', 'data', 'anni_timer.json');
        const timerInfo = {
            messageId: message.id,
            channelId: interaction.channel.id,
            targetTime: targetDate.getTime()
        };
        fs.writeFileSync(timerPath, JSON.stringify(timerInfo, null, 2));
        
    } catch (error) {
        console.error('[ERROR] タイマー設定エラー:', error);
        await interaction.reply({
            content: '❌ タイマー設定中にエラーが発生しました。',
            flags: 64
        });
    }
}

async function handleAlert(interaction) {
    try {
        // Annihilationデータを読み込み
        if (!fs.existsSync(ANNI_DATA_PATH)) {
            return await interaction.reply({
                content: '❌ Annihilationタイマーが設定されていません。まず `/annihilation timer` でタイマーを設定してください。',
                flags: 64
            });
        }
        
        const anniData = JSON.parse(fs.readFileSync(ANNI_DATA_PATH, 'utf8'));
        const targetDate = new Date(anniData.startTime);
        const now = new Date();
        
        // 既に開始時刻を過ぎている場合
        if (targetDate <= now) {
            return await interaction.reply({
                content: '❌ 設定されたAnnihilationイベントは既に開始されています。新しいタイマーを設定してください。',
                flags: 64
            });
        }
        
        // 既存の通知をクリア
        clearNotifications();
        
        // 通知をセットアップ
        const channelId = interaction.channel.id;
        const guildId = interaction.guild.id;
        
        // 設定を読み込み（メンションロール取得）
        const configPath = path.join(__dirname, '..', 'data', 'anni_config.json');
        let config = {};
        try {
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (error) {
            console.error('[ERROR] 設定読み込みエラー:', error);
        }
        
        const mentionRoleId = config.mentionRoleId || 'wynnsoldier';
        
        // 通知データを保存
        const alertData = {
            channelId: channelId,
            guildId: guildId,
            targetDate: targetDate.toISOString(),
            mentionRoleId: mentionRoleId,
            setAt: now.toISOString()
        };
        
        const alertPath = path.join(__dirname, '..', 'data', 'anni_alerts.json');
        fs.writeFileSync(alertPath, JSON.stringify(alertData, null, 2));
        
        // 通知スケジュールを設定
        setupNotifications(interaction.client, alertData);
        
        const embed = new EmbedBuilder()
            .setTitle('🔔 Annihilation Alert Setup Complete')
            .setDescription(`✅ **通知設定が完了しました**\n\n` +
                          `📍 **通知チャンネル:** <#${channelId}>\n` +
                          `👥 **メンション:** <@&${mentionRoleId}>\n` +
                          `⏰ **通知タイミング:** 12時間前、30分前\n\n` +
                          `🎯 **開始時間:** <t:${Math.floor(targetDate.getTime() / 1000)}:F>\n` +
                          `📅 **開始まで:** <t:${Math.floor(targetDate.getTime() / 1000)}:R>`)
            .setColor('#00ff00')
            .setThumbnail(ANNI_IMAGES.normal)
            .setFooter({ text: 'Prelude to Annihilation - Wynncraft World Event' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ERROR] アラート設定エラー:', error);
        await interaction.reply({
            content: '❌ アラート設定中にエラーが発生しました。',
            flags: 64
        });
    }
}

// 通知をクリアする関数
function clearNotifications() {
    notificationTimers.forEach(timer => {
        clearTimeout(timer);
    });
    notificationTimers = [];
}

// 通知をセットアップする関数
function setupNotifications(client, alertData) {
    const targetDate = new Date(alertData.targetDate);
    const now = new Date();
    
    // 12時間前の通知
    const twelveHoursBeforeTime = targetDate.getTime() - (12 * 60 * 60 * 1000);
    if (twelveHoursBeforeTime > now.getTime()) {
        const delay = twelveHoursBeforeTime - now.getTime();
        const timer = setTimeout(() => {
            send12HourNotification(client, alertData);
        }, delay);
        notificationTimers.push(timer);
        console.log(`[INFO] 12時間前通知を設定しました: ${new Date(twelveHoursBeforeTime).toLocaleString()}`);
    }
    
    // 30分前の通知
    const thirtyMinutesBeforeTime = targetDate.getTime() - (30 * 60 * 1000);
    if (thirtyMinutesBeforeTime > now.getTime()) {
        const delay = thirtyMinutesBeforeTime - now.getTime();
        const timer = setTimeout(() => {
            send30MinuteNotification(client, alertData);
        }, delay);
        notificationTimers.push(timer);
        console.log(`[INFO] 30分前通知を設定しました: ${new Date(thirtyMinutesBeforeTime).toLocaleString()}`);
    }
}

// 12時間前の通知を送信
async function send12HourNotification(client, alertData) {
    try {
        const channel = await client.channels.fetch(alertData.channelId);
        if (!channel) return;
        
        const embed = new EmbedBuilder()
            .setTitle('🚨 ANNIHILATION ALERT 🚨')
            .setDescription(`<@&${alertData.mentionRoleId}>\n` +
                          `**Anniがあと12時間（目安）で始まります！**\n` +
                          `参加可能な方はリアクションいただけると助かります。\n\n` +
                          `📍 **Location:** Roots of Corruption`)
            .setColor('#ff8800')
            .setThumbnail(ANNI_IMAGES.gray)
            .setFooter({ text: 'Prelude to Annihilation - Wynncraft World Event' })
            .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        console.log('[INFO] 12時間前通知を送信しました');
    } catch (error) {
        console.error('[ERROR] 12時間前通知送信エラー:', error);
    }
}

// 30分前の通知を送信
async function send30MinuteNotification(client, alertData) {
    try {
        const channel = await client.channels.fetch(alertData.channelId);
        if (!channel) return;
        
        const embed = new EmbedBuilder()
            .setTitle('🚨 ANNIHILATION ALERT 🚨')
            .setDescription(`<@&${alertData.mentionRoleId}>\n` +
                          `**Anniがあと30分で始まります！**\n\n` +
                          `📍 **Location:** Roots of Corruption`)
            .setColor('#ff0000')
            .setThumbnail(ANNI_IMAGES.normal)
            .setFooter({ text: 'Prelude to Annihilation - Wynncraft World Event' })
            .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        console.log('[INFO] 30分前通知を送信しました');
    } catch (error) {
        console.error('[ERROR] 30分前通知送信エラー:', error);
    }
}

// bot起動時に通知を復元する関数
function restoreNotifications(client) {
    const alertPath = path.join(__dirname, '..', 'data', 'anni_alerts.json');
    try {
        if (fs.existsSync(alertPath)) {
            const alertData = JSON.parse(fs.readFileSync(alertPath, 'utf8'));
            setupNotifications(client, alertData);
            console.log('[INFO] 通知スケジュールを復元しました');
        }
    } catch (error) {
        console.error('[ERROR] 通知復元エラー:', error);
    }
}

// タイマーメッセージを復元する関数
function restoreTimerMessage(client) {
    const timerPath = path.join(__dirname, '..', 'data', 'anni_timer.json');
    const anniPath = path.join(__dirname, '..', 'data', 'annihilation.json');
    
    try {
        if (fs.existsSync(timerPath) && fs.existsSync(anniPath)) {
            const timerInfo = JSON.parse(fs.readFileSync(timerPath, 'utf8'));
            const anniData = JSON.parse(fs.readFileSync(anniPath, 'utf8'));
            
            // タイマーをMapに復元
            client.timerMessages.set(timerInfo.messageId, {
                channelId: timerInfo.channelId,
                targetTime: new Date(anniData.startTime).getTime()
            });
            
            console.log('[INFO] タイマーメッセージを復元しました');
        }
    } catch (error) {
        console.error('[ERROR] タイマーメッセージ復元エラー:', error);
    }
}

// モジュール外部からアクセスできるようにエクスポート
module.exports.restoreNotifications = restoreNotifications;
module.exports.clearNotifications = clearNotifications;
module.exports.restoreTimerMessage = restoreTimerMessage;