const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('./BaseCommand');
const fs = require('fs').promises;
const path = require('path');

/**
 * WynnTracker設定管理コマンド
 * BOTの通知設定を管理
 */
class TrackerCommand extends BaseCommand {
    constructor() {
        super({
            name: 'tracker',
            description: 'WynnTrackerの通知設定を管理',
            category: 'Settings',
            adminOnly: true,
            guildOnly: true,
            permissions: [PermissionFlagsBits.ManageChannels]
        });
        
        this.configPath = path.join(__dirname, '../../data/tracker_config.json');
    }

    getSlashCommandData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('set-bomb-channel')
                    .setDescription('Bomb通知チャンネルを設定')
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('通知先チャンネル')
                            .setRequired(true)
                            .addChannelTypes(ChannelType.GuildText)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('get-config')
                    .setDescription('現在の設定を確認')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('test-bomb')
                    .setDescription('Bomb通知のテストメッセージを送信')
            );
    }

    async run(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'set-bomb-channel':
                await this.setBombChannel(interaction);
                break;
            case 'get-config':
                await this.getConfig(interaction);
                break;
            case 'test-bomb':
                await this.testBomb(interaction);
                break;
            default:
                await this.sendError(interaction, '無効なサブコマンドです。');
        }
    }

    async setBombChannel(interaction) {
        await this.deferReply(interaction);

        try {
            const channel = this.getChannel(interaction, 'channel', true);

            // チャンネルの権限確認
            const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
            const channelPermissions = channel.permissionsFor(botMember);

            if (!channelPermissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                return await this.sendError(interaction, 
                    `❌ BOTに ${channel} への送信権限がありません。\n` +
                    'チャンネル設定で「メッセージを送信」と「埋め込みリンク」の権限を付与してください。'
                );
            }

            // 設定を保存
            const config = await this.loadConfig();
            config.bombNotificationChannelId = channel.id;
            config.lastUpdated = new Date().toISOString();
            config.updatedBy = {
                id: interaction.user.id,
                username: interaction.user.username
            };

            await this.saveConfig(config);

            // 環境変数も更新（実行時用）
            process.env.BOMB_NOTIFICATION_CHANNEL_ID = channel.id;

            await this.sendSuccess(interaction, 
                `✅ Bomb通知チャンネルを ${channel} に設定しました！\n` +
                `設定者: ${interaction.user.username}\n` +
                `設定日時: <t:${Math.floor(Date.now() / 1000)}:F>`
            );

            // テスト通知送信
            try {
                const testEmbed = {
                    color: 0x00ff00,
                    title: '🔔 通知チャンネル設定完了',
                    description: 'このチャンネルでBomb通知を受信します',
                    fields: [
                        { name: '設定者', value: interaction.user.username, inline: true },
                        { name: '設定日時', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                    ],
                    footer: { text: 'WynnTracker BOT' },
                    timestamp: new Date().toISOString()
                };

                await channel.send({ embeds: [testEmbed] });
            } catch (testError) {
                console.error('Test notification failed:', testError);
            }

        } catch (error) {
            console.error('Set bomb channel error:', error);
            await this.sendError(interaction, 
                '❌ チャンネル設定中にエラーが発生しました。\n' +
                'BOTの権限とチャンネルの設定を確認してください。'
            );
        }
    }

    async getConfig(interaction) {
        await this.deferReply(interaction);

        try {
            const config = await this.loadConfig();
            const channelId = config.bombNotificationChannelId || process.env.BOMB_NOTIFICATION_CHANNEL_ID;

            if (!channelId) {
                return await this.sendWarning(interaction, 
                    '⚠️ Bomb通知チャンネルが設定されていません。\n' +
                    '`/tracker set-bomb-channel` で設定してください。'
                );
            }

            const channel = interaction.guild.channels.cache.get(channelId);
            const channelInfo = channel ? `${channel} (${channel.name})` : `❌ チャンネルが見つかりません (ID: ${channelId})`;

            const embed = {
                color: 0x0099ff,
                title: '📊 WynnTracker 設定情報',
                fields: [
                    { name: 'Bomb通知チャンネル', value: channelInfo, inline: false },
                    { name: '最終更新', value: config.lastUpdated ? `<t:${Math.floor(new Date(config.lastUpdated).getTime() / 1000)}:F>` : '不明', inline: true },
                    { name: '更新者', value: config.updatedBy?.username || '不明', inline: true }
                ],
                footer: { text: 'WynnTracker BOT設定' },
                timestamp: new Date().toISOString()
            };

            await this.sendReply(interaction, { embeds: [embed] });

        } catch (error) {
            console.error('Get config error:', error);
            await this.sendError(interaction, '❌ 設定の取得中にエラーが発生しました。');
        }
    }

    async testBomb(interaction) {
        await this.deferReply(interaction);

        try {
            const config = await this.loadConfig();
            const channelId = config.bombNotificationChannelId || process.env.BOMB_NOTIFICATION_CHANNEL_ID;

            if (!channelId) {
                return await this.sendError(interaction, 
                    '❌ Bomb通知チャンネルが設定されていません。\n' +
                    '`/tracker set-bomb-channel` で設定してください。'
                );
            }

            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel) {
                return await this.sendError(interaction, 
                    '❌ 設定されたチャンネルが見つかりません。\n' +
                    'チャンネルを再設定してください。'
                );
            }

            // テスト通知を送信
            const testEmbed = {
                color: 0xffff00,
                title: '🔔 Bomb Detected (テスト)',
                description: '**Combat XP** が検知されました！',
                fields: [
                    { name: 'プレイヤー', value: 'TestPlayer', inline: true },
                    { name: 'サーバー', value: 'WC1', inline: true },
                    { name: '時刻', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                ],
                footer: { text: 'WynnTracker MOD - TEST' },
                timestamp: new Date().toISOString()
            };

            await channel.send({ embeds: [testEmbed] });

            await this.sendSuccess(interaction, 
                `✅ テスト通知を ${channel} に送信しました！\n` +
                '通知が正常に表示されることを確認してください。'
            );

        } catch (error) {
            console.error('Test bomb error:', error);
            await this.sendError(interaction, 
                '❌ テスト通知の送信中にエラーが発生しました。\n' +
                'チャンネルの権限を確認してください。'
            );
        }
    }

    async loadConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // ファイルが存在しない場合はデフォルト設定を返す
            return {
                bombNotificationChannelId: null,
                lastUpdated: null,
                updatedBy: null
            };
        }
    }

    async saveConfig(config) {
        try {
            // dataディレクトリが存在しない場合は作成
            const dataDir = path.dirname(this.configPath);
            await fs.mkdir(dataDir, { recursive: true });

            await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Save config error:', error);
            throw new Error('設定の保存に失敗しました');
        }
    }
}

module.exports = TrackerCommand;