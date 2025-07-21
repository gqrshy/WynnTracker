const BaseCommand = require('./BaseCommand');
const GuildService = require('../services/GuildService');
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class GuildCommand extends BaseCommand {
    constructor() {
        super({
            name: 'guild',
            description: 'ギルド関連のコマンド',
            category: 'Guild',
            permissions: [],
            cooldown: 3000,
            adminOnly: false,
            guildOnly: true
        });
        
        this.guildService = new GuildService();
    }

    async init() {
        await this.guildService.initialize();
    }

    addOptions(command) {
        command.addSubcommand(subcommand =>
            subcommand.setName('rank')
                .setDescription('ランキング管理')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('実行するアクション')
                        .setRequired(true)
                        .addChoices(
                            { name: 'set - 現在のギルドデータを記録（管理者のみ）', value: 'set' }
                        )
                )
        );
        
        command.addSubcommand(subcommand =>
            subcommand.setName('gxp')
                .setDescription('GXPランキング')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('実行するアクション')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ranking - 今週のGXPランキングを表示', value: 'ranking' }
                        )
                )
        );
        
        command.addSubcommand(subcommand =>
            subcommand.setName('raid')
                .setDescription('レイドランキング')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('実行するアクション')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ranking - 今週のレイドランキングを表示', value: 'ranking' }
                        )
                )
        );
    }

    async run(interaction) {
        if (!this.guildService.initialized) {
            await this.init();
        }

        const subcommand = interaction.options.getSubcommand();
        const action = interaction.options.getString('action');
        
        if (subcommand === 'rank' && action === 'set') {
            await this.handleRankSet(interaction);
        } else if (subcommand === 'gxp' && action === 'ranking') {
            await this.handleGxpRanking(interaction);
        } else if (subcommand === 'raid' && action === 'ranking') {
            await this.handleRaidRanking(interaction);
        }
    }

    async handleRankSet(interaction) {
        // 管理者権限チェック
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await this.sendError(interaction, '❌ このコマンドを実行するには管理者権限が必要です。');
            return;
        }

        await this.deferReply(interaction);

        try {
            const result = await this.guildService.setGuildRankings(interaction.user.id);
            
            // 上位10名の情報を準備
            let memberList = '\u200b\n　**━━━ 📊 記録されたメンバー ━━━**\n';
            result.topContributors.forEach((member, index) => {
                const rank = index + 1;
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '　';
                memberList += `　　${medal} **${rank}位. ${member.username}**\n`;
                memberList += `　　　　貢献度: ${this.guildService.formatNumber(member.contributed)}\n`;
                if (index < result.topContributors.length - 1) memberList += '\n';
            });

            if (result.memberCount > 10) {
                memberList += `\n　　...他${result.memberCount - 10}名`;
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ ギルドランキングデータを記録しました')
                .setDescription(
                    `**次回リセット**: ${this.guildService.formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}\n` +
                    `**記録メンバー数**: ${result.memberCount}人\n` +
                    `**週間ランキング**: 1週間後に自動集計されます`
                )
                .addFields({
                    name: `<:lootcamp:1392860439641067692> ${this.guildService.guildName} [${this.guildService.guildTag}]`,
                    value: memberList,
                    inline: false
                })
                .setColor(0x00FF00)
                .setTimestamp();

            await this.editReply(interaction, { embeds: [embed] });

        } catch (error) {
            console.error('Rank set error:', error.message);
            if (error.message && error.message.includes('Invalid request')) {
                await this.editReply(interaction, { 
                    content: '❌ ギルドが見つかりません。\n' +
                           '`.env`ファイルの`GUILD_NAME`と`GUILD_TAG`を正しいギルド名/タグに設定してください。\n' +
                           '例: `GUILD_NAME=Imperial` `GUILD_TAG=Imp`'
                });
            } else {
                await this.editReply(interaction, { content: '❌ ギルドデータの記録中にエラーが発生しました。' });
            }
        }
    }

    async handleGxpRanking(interaction) {
        await this.deferReply(interaction);

        try {
            const result = await this.guildService.getGXPRanking();
            
            const embed = new EmbedBuilder()
                .setTitle(`🏆 ${this.guildService.guildName} [${this.guildService.guildTag}] - 週間GXPランキング`)
                .setDescription(
                    `**集計期間**: ${this.guildService.formatDate(result.period.startDate)} ～ ${this.guildService.formatDate(result.period.endDate)}\n` +
                    `**経過日数**: ${result.period.daysElapsed}日 / **残り日数**: ${result.period.daysRemaining}日`
                )
                .setColor(0x00AE86)
                .setTimestamp();

            // 獲得GXPが0以上のメンバーをフィルタリング
            const activeRankings = result.rankings.filter(member => member.gxpGained >= 0);

            if (activeRankings.length === 0) {
                embed.setDescription(
                    `**集計期間**: ${this.guildService.formatDate(result.period.startDate)} ～ ${this.guildService.formatDate(result.period.endDate)}\n` +
                    `**経過日数**: ${result.period.daysElapsed}日 / **残り日数**: ${result.period.daysRemaining}日\n\n` +
                    '⚠️ **まだGXPを獲得したメンバーがいません**\n\n' +
                    '**現在の状況:**\n' +
                    `• 追跡中メンバー数: ${result.rankings.length}人\n` +
                    '• ギルドメンバーがGXPを獲得次第、ランキングに表示されます'
                );
            } else {
                const avgGxp = Math.floor(result.totalGXP / activeRankings.length);

                embed.setDescription(
                    `**集計期間**: ${this.guildService.formatDate(result.period.startDate)} ～ ${this.guildService.formatDate(result.period.endDate)}\n` +
                    `**経過日数**: ${result.period.daysElapsed}日 / **残り日数**: ${result.period.daysRemaining}日\n\n` +
                    `**今週の成果**: **${this.guildService.formatNumber(result.totalGXP)}** GXP獲得\n` +
                    `**参加メンバー**: **${activeRankings.length}人** / **平均**: ${this.guildService.formatNumber(avgGxp)} GXP`
                );

                // lr.jsスタイルのランキング表示
                let rankingText = '\u200b\n　**━━━ 🏆 週間GXPランキング ━━━**\n';

                const topMembers = activeRankings.slice(0, 10);
                topMembers.forEach((member, index) => {
                    const rank = index + 1;
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '　';

                    rankingText += `　　${medal} **${rank}位. ${member.username}**\n`;
                    rankingText += `　　　　獲得GXP: **${this.guildService.formatNumber(member.gxpGained)}**\n`;
                    rankingText += `　　　　総貢献度: ${this.guildService.formatNumber(member.currentTotal)}\n`;
                    if (index < topMembers.length - 1) rankingText += '\n';
                });

                embed.addFields({
                    name: `<:lootcamp:1392860439641067692> ${this.guildService.guildName} [${this.guildService.guildTag}]`,
                    value: rankingText,
                    inline: false
                });
            }

            await this.editReply(interaction, { embeds: [embed] });

        } catch (error) {
            console.error('GXP ranking error:', error.message);
            if (error.message.includes('ランキングデータが見つかりません')) {
                await this.editReply(interaction, { content: '❌ ランキングデータが設定されていません。先に `/guild rank set` コマンドでデータを記録してください。' });
            } else {
                await this.editReply(interaction, { content: '❌ GXPランキングの取得中にエラーが発生しました。' });
            }
        }
    }

    async handleRaidRanking(interaction) {
        await this.deferReply(interaction);

        try {
            const result = await this.guildService.getRaidRanking();
            
            const embed = new EmbedBuilder()
                .setTitle(`⚔️ ${this.guildService.guildName} [${this.guildService.guildTag}] - 週間レイドランキング`)
                .setDescription(
                    `**集計期間**: ${this.guildService.formatDate(result.period.startDate)} ～ ${this.guildService.formatDate(result.period.endDate)}\n` +
                    `**経過日数**: ${result.period.daysElapsed}日 / **残り日数**: ${result.period.daysRemaining}日`
                )
                .setColor(0xFF6B6B)
                .setTimestamp();

            // レイドを完了したメンバーをフィルタリング
            const activeRankings = result.rankings.filter(member => member.raidsCompleted >= 0);

            if (activeRankings.length === 0) {
                embed.setDescription(
                    `**集計期間**: ${this.guildService.formatDate(result.period.startDate)} ～ ${this.guildService.formatDate(result.period.endDate)}\n` +
                    `**経過日数**: ${result.period.daysElapsed}日 / **残り日数**: ${result.period.daysRemaining}日\n\n` +
                    '⚠️ **まだレイドを完了したメンバーがいません**\n\n' +
                    '**現在の状況:**\n' +
                    `• 追跡中メンバー数: ${result.rankings.length}人\n` +
                    '• ギルドメンバーがレイドを完了次第、ランキングに表示されます'
                );
            } else {
                const avgRaids = Math.floor(result.totalRaids / activeRankings.length * 10) / 10;

                embed.setDescription(
                    `**集計期間**: ${this.guildService.formatDate(result.period.startDate)} ～ ${this.guildService.formatDate(result.period.endDate)}\n` +
                    `**経過日数**: ${result.period.daysElapsed}日 / **残り日数**: ${result.period.daysRemaining}日\n\n` +
                    `**今週の成果**: **${result.totalRaids}回** レイド完了\n` +
                    `**参加メンバー**: **${activeRankings.length}人** / **平均**: ${avgRaids}回`
                );

                // lr.jsスタイルのランキング表示
                let rankingText = '\u200b\n　**━━━ ⚔️ 週間レイドランキング ━━━**\n';

                const topMembers = activeRankings.slice(0, 10);
                topMembers.forEach((member, index) => {
                    const rank = index + 1;
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '　';

                    rankingText += `　　${medal} **${rank}位. ${member.username}**\n`;
                    rankingText += `　　　　完了レイド: **${member.raidsCompleted}回**\n`;
                    rankingText += `　　　　総レイド数: ${member.currentTotal}回\n`;
                    if (index < topMembers.length - 1) rankingText += '\n';
                });

                embed.addFields({
                    name: `<:lootcamp:1392860439641067692> ${this.guildService.guildName} [${this.guildService.guildTag}]`,
                    value: rankingText,
                    inline: false
                });
            }

            await this.editReply(interaction, { embeds: [embed] });

        } catch (error) {
            console.error('Raid ranking error:', error.message);
            if (error.message.includes('ランキングデータが見つかりません')) {
                await this.editReply(interaction, { content: '❌ ランキングデータが設定されていません。先に `/guild rank set` コマンドでデータを記録してください。' });
            } else {
                await this.editReply(interaction, { content: '❌ レイドランキングの取得中にエラーが発生しました。' });
            }
        }
    }


    static create() {
        return new GuildCommand();
    }
}

module.exports = GuildCommand;