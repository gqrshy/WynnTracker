const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const rateLimiter = require('../utils/rateLimiter');

// データファイルのパス
const GUILD_DATA_PATH = path.join(__dirname, '..', 'data', 'guild_rankings.json');

// ギルド名とタグ
const GUILD_NAME = 'Just Here After Work';
const GUILD_TAG = 'SKJ';

// データを読み込む
async function loadGuildData() {
    try {
        const data = await fs.readFile(GUILD_DATA_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // ファイルが存在しない場合は空のオブジェクトを返す
        return {
            lastRankSet: null,
            members: {},
            weeklyRankings: []
        };
    }
}

// データを保存する
async function saveGuildData(data) {
    await fs.writeFile(GUILD_DATA_PATH, JSON.stringify(data, null, 2));
}

// Wynncraft APIからギルド情報を取得
async function fetchGuildData(fetchFullMemberData = false) {
    try {
        // バッチリクエストで高速化
        const response = await axios.get(`https://api.wynncraft.com/v3/guild/${encodeURIComponent(GUILD_NAME)}`, {
            timeout: 15000,
            headers: {
                'User-Agent': 'WynnTracker-Bot/1.0',
                'Accept-Encoding': 'gzip' // 圧縮を有効化
            }
        });
        
        const guildData = response.data;
        
        // Debug: Log the structure of the guild data
        console.log('[DEBUG] Guild API Response Structure:', {
            hasMembers: !!guildData.members,
            membersType: typeof guildData.members,
            membersIsArray: Array.isArray(guildData.members),
            memberCount: guildData.members ? Object.keys(guildData.members).length : 0,
            sampleMemberKeys: guildData.members ? Object.keys(guildData.members).slice(0, 3) : []
        });
        
        // Debug: Log a sample member structure
        if (guildData.members) {
            const firstMemberKey = Object.keys(guildData.members)[0];
            if (firstMemberKey) {
                console.log('[DEBUG] Sample Member Structure:', {
                    key: firstMemberKey,
                    member: guildData.members[firstMemberKey],
                    memberType: typeof guildData.members[firstMemberKey]
                });
            }
        }
        
        // 完全なメンバーデータを取得する場合
        if (fetchFullMemberData && guildData.members) {
            console.log('[INFO] 各メンバーの詳細データを取得中...');
            const updatedMembers = {};
            
            // Guild API v3では、membersはrank別にグループ化されている
            for (const [rank, rankMembers] of Object.entries(guildData.members)) {
                console.log(`[DEBUG] Processing rank: ${rank}`, {
                    rankMembersType: typeof rankMembers,
                    isObject: typeof rankMembers === 'object' && rankMembers !== null
                });
                
                // rankMembersがオブジェクトで、実際のプレイヤーデータを含む場合
                if (typeof rankMembers === 'object' && rankMembers !== null) {
                    for (const [playerName, playerData] of Object.entries(rankMembers)) {
                        console.log(`[DEBUG] Processing player: ${playerName}`, {
                            uuid: playerData.uuid,
                            contributed: playerData.contributed,
                            online: playerData.online
                        });
                        
                        try {
                            // プレイヤーデータをそのまま使用（Guild APIから十分な情報が得られる）
                            updatedMembers[playerData.uuid] = {
                                uuid: playerData.uuid,
                                username: playerName,
                                contributed: playerData.contributed || 0,
                                contributionRank: playerData.contributionRank || 0,
                                wars: 0, // Guild APIからは取得できないため0
                                raids: { total: 0, list: {} }, // Guild APIからは取得できないため0
                                joined: playerData.joined || null,
                                rank: rank,
                                online: playerData.online || false,
                                server: playerData.server || null
                            };
                            
                            console.log('[DEBUG] Added member data:', {
                                uuid: playerData.uuid,
                                username: playerName,
                                contributed: playerData.contributed
                            });
                            
                        } catch (error) {
                            console.error(`[ERROR] プレイヤー ${playerName} のデータ処理エラー:`, error.message);
                        }
                    }
                }
            }
            
            guildData.members = updatedMembers;
            console.log('[INFO] メンバーデータの取得完了, 処理したメンバー数:', Object.keys(updatedMembers).length);
        }
        
        return guildData;
    } catch (error) {
        console.error('[ERROR] Guild data fetch error:', error.message);
        throw error;
    }
}

// 数値を読みやすい形式にフォーマット
function formatNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toString();
}

// 日付をフォーマット
function formatDate(date) {
    const options = { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Asia/Tokyo',
        hour12: false
    };
    return new Date(date).toLocaleString('ja-JP', options);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guild')
        .setDescription('ギルド関連のコマンド')
        .addSubcommand(subcommand =>
            subcommand
                .setName('rank')
                .setDescription('ランキング管理')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('実行するアクション')
                        .setRequired(true)
                        .addChoices(
                            { name: 'set - 現在のギルドデータを記録（管理者のみ）', value: 'set' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('gxp')
                .setDescription('GXPランキング')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('実行するアクション')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ranking - 今週のGXPランキングを表示', value: 'ranking' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('raid')
                .setDescription('レイドランキング')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('実行するアクション')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ranking - 今週のレイドランキングを表示', value: 'ranking' }
                        )
                )
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const action = interaction.options.getString('action');
        
        if (subcommand === 'rank' && action === 'set') {
            await handleRankSet(interaction);
        } else if (subcommand === 'gxp' && action === 'ranking') {
            await handleGxpRanking(interaction);
        } else if (subcommand === 'raid' && action === 'ranking') {
            await handleRaidRanking(interaction);
        }
    },
    
    // 週次リセット用の関数をエクスポート
    weeklyReset: async (client) => {
        await performWeeklyReset(client);
    }
};

// /guild rank set の処理
async function handleRankSet(interaction) {
    // 管理者権限チェック
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
            content: '❌ このコマンドを実行するには管理者権限が必要です。',
            ephemeral: true
        });
        return;
    }
    
    // レート制限チェック
    const rateLimitCheck = rateLimiter.canUseCommand(interaction.user.id, 'guild_setrank');
    if (!rateLimitCheck.allowed) {
        await interaction.reply({
            content: `⏳ このコマンドは5分に1回しか使用できます。\nあと **${rateLimitCheck.waitTime}秒** お待ちください。`,
            ephemeral: true
        });
        return;
    }
    
    await interaction.deferReply();
    
    try {
        // ギルドデータを取得（完全なメンバーデータを取得）
        const guildData = await fetchGuildData(true);
        const currentData = await loadGuildData();
        
        // 新しいメンバーデータを作成
        const newMemberData = {};
        const timestamp = new Date().toISOString();
        
        // 各メンバーのデータを保存
        console.log('[DEBUG] Saving member data, total members:', Object.keys(guildData.members).length);
        
        for (const [uuid, member] of Object.entries(guildData.members)) {
            console.log('[DEBUG] Saving member:', {
                uuid: uuid,
                hasUsername: !!member?.username,
                username: member?.username,
                memberType: typeof member
            });
            
            // メンバーデータが完全なメンバーデータ取得後の形式であることを確認
            const memberUsername = member?.username || `Unknown_${uuid.substring(0, 8)}`;
            
            newMemberData[memberUsername] = {
                uuid: member?.uuid || uuid,
                username: memberUsername,
                contributed: member?.contributed || 0,
                contributionRank: member?.contributionRank || 0,
                wars: member?.wars || 0,
                raids: member?.raids || { total: 0, list: {} },
                joined: member?.joined || null
            };
        }
        
        console.log('[DEBUG] Saved member data count:', Object.keys(newMemberData).length);
        
        // データを保存
        currentData.lastRankSet = timestamp;
        currentData.members = newMemberData;
        await saveGuildData(currentData);
        
        // 上位10名のcontributed情報を表示用に準備
        const topContributors = Object.values(newMemberData)
            .sort((a, b) => b.contributed - a.contributed)
            .slice(0, 10);
        
        let memberList = '\u200b\n　**━━━ 📊 記録されたメンバー ━━━**\n';
        topContributors.forEach((member, index) => {
            const rank = index + 1;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '　';
            memberList += `　　${medal} **${rank}位. ${member.username}**\n`;
            memberList += `　　　　貢献度: ${formatNumber(member.contributed)}\n`;
            if (index < topContributors.length - 1) memberList += '\n';
        });
        
        if (Object.keys(newMemberData).length > 10) {
            memberList += `\n　　...他${Object.keys(newMemberData).length - 10}名`;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('✅ ギルドランキングデータを記録しました')
            .setDescription(
                `**次回リセット**: ${formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}\n` +
                `**記録メンバー数**: ${Object.keys(newMemberData).length}人\n` +
                `**週間ランキング**: 1週間後に自動集計されます`
            )
            .addFields({
                name: `<:lootcamp:1392860439641067692> ${GUILD_NAME} [${GUILD_TAG}]`,
                value: memberList,
                inline: false
            })
            .setColor(0x00FF00)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ERROR] Rank set error:', error);
        await interaction.editReply('❌ ギルドデータの記録中にエラーが発生しました。');
    }
}

// /guild gxp ranking の処理
async function handleGxpRanking(interaction) {
    // レート制限チェック
    const rateLimitCheck = rateLimiter.canUseCommand(interaction.user.id, 'guild_ranking');
    if (!rateLimitCheck.allowed) {
        await interaction.reply({
            content: `⏳ このコマンドは1分に1回しか使用できます。\nあと **${rateLimitCheck.waitTime}秒** お待ちください。`,
            ephemeral: true
        });
        return;
    }
    
    await interaction.deferReply();
    
    try {
        const currentData = await loadGuildData();
        
        if (!currentData.lastRankSet) {
            await interaction.editReply('❌ ランキングデータがありません。先に `/guild rank set` を実行してください。');
            return;
        }
        
        // キャッシュチェック
        const cacheKey = 'gxp_ranking';
        const cachedData = rateLimiter.getCache('guild_ranking', cacheKey);
        
        let guildData;
        if (cachedData) {
            console.log('[INFO] Using cached guild data for ranking');
            guildData = cachedData;
        } else {
            // 現在のギルドデータを取得（完全なメンバーデータを取得）
            guildData = await fetchGuildData(true);
            if (guildData) {
                rateLimiter.setCache('guild_ranking', cacheKey, guildData);
            }
        }
        
        if (!guildData || !guildData.members) {
            await interaction.editReply('❌ ギルドデータの取得に失敗しました。');
            return;
        }
        
        const rankings = [];
        
        // 各メンバーの差分を計算
        for (const [uuid, currentMember] of Object.entries(guildData.members)) {
            const savedMember = Object.values(currentData.members).find(m => m.uuid === uuid);
            
            let gxpGained = 0;
            let username = 'Unknown';
            const currentContributed = currentMember.contributed || 0;
            
            if (savedMember) {
                // 既存メンバーの場合は差分を計算
                const savedContributed = savedMember.contributed || 0;
                gxpGained = currentContributed - savedContributed;
                username = currentMember.username || savedMember.username || 'Unknown';
            } else {
                // 新しいメンバーの場合は全ての貢献度が今週の獲得量
                gxpGained = currentContributed;
                username = currentMember.username || 'Unknown';
                console.log(`[DEBUG] New member detected: ${username}, contributed: ${currentContributed}`);
            }
            
            // 0以上の差分があれば追加
            if (gxpGained >= 0) {
                rankings.push({
                    username: username,
                    gxpGained: gxpGained,
                    currentTotal: currentContributed
                });
            }
        }
        
        // GXP獲得量でソート（降順）
        rankings.sort((a, b) => b.gxpGained - a.gxpGained);
        
        // 集計期間を計算
        const startDate = new Date(currentData.lastRankSet);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7); // 1週間後
        const now = new Date();
        const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, Math.floor((endDate - now) / (1000 * 60 * 60 * 24)));
        
        const embed = new EmbedBuilder()
            .setTitle(`🏆 ${GUILD_NAME} [${GUILD_TAG}] - 週間GXPランキング`)
            .setDescription(
                `**集計期間**: ${formatDate(startDate)} ～ ${formatDate(endDate)}\n` +
                `**経過日数**: ${daysElapsed}日 / **残り日数**: ${daysRemaining}日`
            )
            .setColor(0x00AE86)
            .setTimestamp();
        
        // 獲得GXPが0以上のメンバーをフィルタリング（0の場合も表示）
        const activeRankings = rankings.filter(member => member.gxpGained >= 0);
        
        if (activeRankings.length === 0) {
            embed.setDescription(
                `**集計期間**: ${formatDate(startDate)} ～ ${formatDate(endDate)}\n` +
                `**経過日数**: ${daysElapsed}日 / **残り日数**: ${daysRemaining}日\n\n` +
                '⚠️ **まだGXPを獲得したメンバーがいません**\n\n' +
                '**現在の状況:**\n' +
                `• 追跡中メンバー数: ${rankings.length}人\n` +
                `• 保存済みデータ: ${Object.keys(currentData.members).length}人\n` +
                '• ギルドメンバーがGXPを獲得次第、ランキングに表示されます'
            );
        } else {
            // 総獲得GXPを計算
            const totalGxp = activeRankings.reduce((sum, member) => sum + member.gxpGained, 0);
            const avgGxp = Math.floor(totalGxp / activeRankings.length);
            
            embed.setDescription(
                `**集計期間**: ${formatDate(startDate)} ～ ${formatDate(endDate)}\n` +
                `**経過日数**: ${daysElapsed}日 / **残り日数**: ${daysRemaining}日\n\n` +
                `**今週の成果**: **${formatNumber(totalGxp)}** GXP獲得\n` +
                `**参加メンバー**: **${activeRankings.length}人** / **平均**: ${formatNumber(avgGxp)} GXP`
            );
            
            // lr.jsスタイルのランキング表示
            let rankingText = '\u200b\n　**━━━ 🏆 週間GXPランキング ━━━**\n';
            
            const topMembers = activeRankings.slice(0, 10);
            topMembers.forEach((member, index) => {
                const rank = index + 1;
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '　';
                
                rankingText += `　　${medal} **${rank}位. ${member.username}**\n`;
                rankingText += `　　　　獲得GXP: **${formatNumber(member.gxpGained)}**\n`;
                rankingText += `　　　　総貢献度: ${formatNumber(member.currentTotal)}\n`;
                if (index < topMembers.length - 1) rankingText += '\n';
            });
            
            embed.addFields({
                name: `<:lootcamp:1392860439641067692> ${GUILD_NAME} [${GUILD_TAG}]`,
                value: rankingText,
                inline: false
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ERROR] GXP ranking error:', error);
        await interaction.editReply('❌ GXPランキングの取得中にエラーが発生しました。');
    }
}

// /guild raid ranking の処理
async function handleRaidRanking(interaction) {
    await interaction.deferReply();
    
    try {
        const currentData = await loadGuildData();
        
        if (!currentData.lastRankSet) {
            await interaction.editReply('❌ ランキングデータがありません。先に `/guild rank set` を実行してください。');
            return;
        }
        
        // 現在のギルドデータを取得（完全なメンバーデータを取得）
        const guildData = await fetchGuildData(true);
        const rankings = [];
        
        // 各メンバーの差分を計算
        for (const [uuid, currentMember] of Object.entries(guildData.members)) {
            const savedMember = Object.values(currentData.members).find(m => m.uuid === uuid);
            
            let raidsCompleted = 0;
            let username = 'Unknown';
            const currentTotal = currentMember.raids?.total || 0;
            
            if (savedMember) {
                // 既存メンバーの場合は差分を計算
                const savedRaids = savedMember.raids?.total || 0;
                raidsCompleted = currentTotal - savedRaids;
                username = currentMember.username || savedMember.username || 'Unknown';
            } else {
                // 新しいメンバーの場合は全てのレイド数が今週の完了数
                raidsCompleted = currentTotal;
                username = currentMember.username || 'Unknown';
                console.log(`[DEBUG] New member detected for raids: ${username}, raids: ${currentTotal}`);
            }
            
            if (raidsCompleted >= 0) {
                rankings.push({
                    username: username,
                    raidsCompleted: raidsCompleted,
                    currentTotal: currentTotal
                });
            }
        }
        
        // レイド完了数でソート（降順）
        rankings.sort((a, b) => b.raidsCompleted - a.raidsCompleted);
        
        // 集計期間を計算
        const startDate = new Date(currentData.lastRankSet);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7); // 1週間後
        const now = new Date();
        const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, Math.floor((endDate - now) / (1000 * 60 * 60 * 24)));
        
        const embed = new EmbedBuilder()
            .setTitle(`⚔️ ${GUILD_NAME} [${GUILD_TAG}] - 週間レイドランキング`)
            .setDescription(
                `**集計期間**: ${formatDate(startDate)} ～ ${formatDate(endDate)}\n` +
                `**経過日数**: ${daysElapsed}日 / **残り日数**: ${daysRemaining}日`
            )
            .setColor(0xFF6B6B)
            .setTimestamp();
        
        // レイドを完了したメンバーをフィルタリング（0の場合も表示）
        const activeRankings = rankings.filter(member => member.raidsCompleted >= 0);
        
        if (activeRankings.length === 0) {
            embed.setDescription(
                `**集計期間**: ${formatDate(startDate)} ～ ${formatDate(endDate)}\n` +
                `**経過日数**: ${daysElapsed}日 / **残り日数**: ${daysRemaining}日\n\n` +
                '⚠️ **まだレイドを完了したメンバーがいません**\n\n' +
                '**現在の状況:**\n' +
                `• 追跡中メンバー数: ${rankings.length}人\n` +
                `• 保存済みデータ: ${Object.keys(currentData.members).length}人\n` +
                '• ギルドメンバーがレイドを完了次第、ランキングに表示されます'
            );
        } else {
            // 総レイド数を計算
            const totalRaids = activeRankings.reduce((sum, member) => sum + member.raidsCompleted, 0);
            const avgRaids = Math.floor(totalRaids / activeRankings.length * 10) / 10;
            
            embed.setDescription(
                `**集計期間**: ${formatDate(startDate)} ～ ${formatDate(endDate)}\n` +
                `**経過日数**: ${daysElapsed}日 / **残り日数**: ${daysRemaining}日\n\n` +
                `**今週の成果**: **${totalRaids}回** レイド完了\n` +
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
                name: `<:lootcamp:1392860439641067692> ${GUILD_NAME} [${GUILD_TAG}]`,
                value: rankingText,
                inline: false
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ERROR] Raid ranking error:', error);
        await interaction.editReply('❌ レイドランキングの取得中にエラーが発生しました。');
    }
}

// 週次リセット処理
async function performWeeklyReset(client) {
    try {
        const currentData = await loadGuildData();
        
        if (!currentData.lastRankSet) {
            return;
        }
        
        // 1週間経過したかチェック
        const lastSetDate = new Date(currentData.lastRankSet);
        const now = new Date();
        const daysSinceLastSet = (now - lastSetDate) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastSet < 7) {
            return;
        }
        
        // 最終ランキングを生成して送信
        // ここでは特定のチャンネルに送信する必要があるため、
        // チャンネルIDを設定ファイルから取得するか、環境変数で設定する必要があります
        const RANKING_CHANNEL_ID = process.env.GUILD_RANKING_CHANNEL_ID;
        
        if (RANKING_CHANNEL_ID) {
            const channel = client.channels.cache.get(RANKING_CHANNEL_ID);
            
            if (channel) {
                // 最終GXPランキングを作成（完全なメンバーデータを取得）
                const guildData = await fetchGuildData(true);
                const gxpRankings = [];
                const raidRankings = [];
                
                // 各メンバーの差分を計算
                for (const [uuid, currentMember] of Object.entries(guildData.members)) {
                    const savedMember = Object.values(currentData.members).find(m => m.uuid === uuid);
                    
                    let gxpGained = 0;
                    let raidsCompleted = 0;
                    const username = currentMember.username || 'Unknown';
                    
                    if (savedMember) {
                        // 既存メンバーの場合は差分を計算
                        gxpGained = (currentMember.contributed || 0) - (savedMember.contributed || 0);
                        raidsCompleted = (currentMember.raids?.total || 0) - (savedMember.raids?.total || 0);
                    } else {
                        // 新しいメンバーの場合は全ての値が今週の獲得量
                        gxpGained = currentMember.contributed || 0;
                        raidsCompleted = currentMember.raids?.total || 0;
                        console.log(`[DEBUG] New member in weekly reset: ${username}, contributed: ${gxpGained}, raids: ${raidsCompleted}`);
                    }
                    
                    if (gxpGained >= 0) {
                        gxpRankings.push({
                            username: username,
                            gxpGained: gxpGained
                        });
                    }
                    
                    if (raidsCompleted >= 0) {
                        raidRankings.push({
                            username: username,
                            raidsCompleted: raidsCompleted
                        });
                    }
                }
                
                // ソート
                gxpRankings.sort((a, b) => b.gxpGained - a.gxpGained);
                raidRankings.sort((a, b) => b.raidsCompleted - a.raidsCompleted);
                
                // 最終ランキングのEmbed作成
                const finalEmbed = new EmbedBuilder()
                    .setTitle(`🏆 ${GUILD_NAME} [${GUILD_TAG}] - 週間最終ランキング`)
                    .setDescription(
                        `**集計期間**: ${formatDate(lastSetDate)} ～ ${formatDate(now)}\n` +
                        `**集計完了**: 新しい週のランキングを開始します！`
                    )
                    .setColor(0xFFD700)
                    .setTimestamp();
                
                // GXPトップ3
                if (gxpRankings.length > 0) {
                    const gxpTop3 = gxpRankings.slice(0, 3);
                    let gxpText = '';
                    gxpTop3.forEach((member, index) => {
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                        gxpText += `${medal} ${member.username} - ${formatNumber(member.gxpGained)} GXP\n`;
                    });
                    finalEmbed.addFields({
                        name: '🌟 GXP獲得 TOP 3',
                        value: gxpText,
                        inline: true
                    });
                }
                
                // レイドトップ3
                if (raidRankings.length > 0) {
                    const raidTop3 = raidRankings.slice(0, 3);
                    let raidText = '';
                    raidTop3.forEach((member, index) => {
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                        raidText += `${medal} ${member.username} - ${member.raidsCompleted}回\n`;
                    });
                    finalEmbed.addFields({
                        name: '⚔️ レイド完了 TOP 3',
                        value: raidText,
                        inline: true
                    });
                }
                
                await channel.send({ embeds: [finalEmbed] });
                
                // 週間ランキングを履歴に保存
                currentData.weeklyRankings.push({
                    week: {
                        start: lastSetDate,
                        end: now
                    },
                    gxpRankings: gxpRankings.slice(0, 10),
                    raidRankings: raidRankings.slice(0, 10)
                });
                
                // 最新10週間分のみ保持
                if (currentData.weeklyRankings.length > 10) {
                    currentData.weeklyRankings = currentData.weeklyRankings.slice(-10);
                }
            }
        }
        
        // 新しい週のデータをセット
        await handleRankSetInternal();
        
    } catch (error) {
        console.error('[ERROR] Weekly reset error:', error);
    }
}

// 内部用のrank set処理
async function handleRankSetInternal() {
    try {
        const guildData = await fetchGuildData(true);
        const currentData = await loadGuildData();
        
        const newMemberData = {};
        const timestamp = new Date().toISOString();
        
        console.log('[DEBUG] Internal rank set - Saving member data, total members:', Object.keys(guildData.members).length);
        
        for (const [uuid, member] of Object.entries(guildData.members)) {
            console.log('[DEBUG] Internal rank set - Saving member:', {
                uuid: uuid,
                hasUsername: !!member?.username,
                username: member?.username,
                memberType: typeof member
            });
            
            // メンバーデータが完全なメンバーデータ取得後の形式であることを確認
            const memberUsername = member?.username || `Unknown_${uuid.substring(0, 8)}`;
            
            newMemberData[memberUsername] = {
                uuid: member?.uuid || uuid,
                username: memberUsername,
                contributed: member?.contributed || 0,
                contributionRank: member?.contributionRank || 0,
                wars: member?.wars || 0,
                raids: member?.raids || { total: 0, list: {} },
                joined: member?.joined || null
            };
        }
        
        currentData.lastRankSet = timestamp;
        currentData.members = newMemberData;
        await saveGuildData(currentData);
        
        console.log(`[INFO] Weekly guild data reset completed at ${timestamp}`);
        
    } catch (error) {
        console.error('[ERROR] Internal rank set error:', error);
    }
}