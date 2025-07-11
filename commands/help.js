const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// ヘルプページのデータ
const HELP_PAGES = [
    {
        title: '📋 コマンド一覧 - 基本情報',
        description: '**WynnTrackerボット**へようこそ！\n\nこのボットはWynncraftの様々な情報を提供します。\n下のボタンで各ページを切り替えできます。',
        fields: [
            {
                name: '📖 利用可能なコマンド',
                value: '• `/lr` - ルートラン関連コマンド\n• `/raid` - レイド関連コマンド\n• `/wynn` - プレイヤー統計情報\n• `/guild` - ギルド関連コマンド\n• `/help` - このヘルプ画面',
                inline: false
            },
            {
                name: '🔄 ページ切り替え',
                value: '⬅️ **前のページ** | ➡️ **次のページ**',
                inline: false
            }
        ],
        color: 0x00AE86
    },
    {
        title: '🏃 /lr コマンド - Lootrun関連',
        description: 'ルートラン（Lootrun）に関する情報を取得します。',
        fields: [
            {
                name: '📊 `/lr lootpool [page] [camp]`',
                value: '**説明:** 各キャンプのルートプールを表示\n' +
                       '**オプション:**\n' +
                       '• `page` (1-10): ページ番号 (1=最新、2=1週前)\n' +
                       '• `camp`: 特定キャンプを選択\n' +
                       '　- Canyon of the Lost - Thesead\n' +
                       '　- Corkus Province - Corkus City\n' +
                       '　- Molten Heights - Rodoroc\n' +
                       '　- Sky Islands - Ahmsord\n' +
                       '　- Silent Expanse - Lutho',
                inline: false
            },
            {
                name: '💰 `/lr mythranking`',
                value: '**説明:** Mythicアイテムの相場ランキングを表示\n' +
                       '**機能:**\n' +
                       '• 各キャンプのMythicアイテム価格比較\n' +
                       '• Unidentified価格での並び替え\n' +
                       '• 平均価格の自動計算',
                inline: false
            }
        ],
        color: 0x00AE86
    },
    {
        title: '🏛️ /raid コマンド - レイド関連',
        description: 'レイド（Raid）に関する情報を取得します。',
        fields: [
            {
                name: '⚡ `/raid aspectpool [rarity]`',
                value: '**説明:** 今週の各レイドのアスペクトを表示\n' +
                       '**オプション:**\n' +
                       '• `rarity`: 表示するレアリティを選択\n' +
                       '　- `mythic`: Mythicアスペクトのみ\n' +
                       '　- `fabled`: Fabledアスペクトのみ\n' +
                       '　- `legendary`: Legendaryアスペクトのみ\n' +
                       '　- 指定なし: 全レアリティ表示',
                inline: false
            },
            {
                name: '🏛️ 対応レイド',
                value: '• **TNA** - The Nameless Anomaly\n' +
                       '• **TCC** - The Canyon Colossus\n' +
                       '• **NOL** - Orphion\'s Nexus of Light\n' +
                       '• **NOTG** - Nest of the Grootslangs',
                inline: false
            },
            {
                name: '🎲 Gambit情報',
                value: 'アスペクト情報と合わせて今週のGambitも表示されます。\n' +
                       '各Gambitの効果は日本語で説明されます。',
                inline: false
            }
        ],
        color: 0x9D4EDD
    },
    {
        title: '👤 /wynn コマンド - プレイヤー統計',
        description: 'プレイヤーのWynncraft統計情報を取得します。',
        fields: [
            {
                name: '📈 `/wynn stats <mcid>`',
                value: '**説明:** 指定したプレイヤーの統計情報を表示\n' +
                       '**必須パラメータ:**\n' +
                       '• `mcid`: Minecraft ID（プレイヤー名）\n\n' +
                       '**表示される情報:**\n' +
                       '• 総プレイ時間・ランク情報\n' +
                       '• 各クラスのレベルと経験値\n' +
                       '• プログレスバー付きレベル表示\n' +
                       '• ギルド情報（所属している場合）',
                inline: false
            },
            {
                name: '📊 統計情報の詳細',
                value: '• **レベル表示:** プログレスバーで進行状況を視覚化\n' +
                       '• **プレイ時間:** 時間・分単位で詳細表示\n' +
                       '• **クラス情報:** 全5クラスの詳細データ\n' +
                       '• **リアルタイム:** Wynncraft公式APIから最新データ取得',
                inline: false
            }
        ],
        color: 0x3498DB
    },
    {
        title: '🏰 /guild コマンド - ギルド関連',
        description: 'ギルド「Just Here After Work (SKJ)」の管理機能。',
        fields: [
            {
                name: '📊 `/guild ranking`',
                value: '**説明:** ギルドメンバーのランキングを表示\n' +
                       '**機能:**\n' +
                       '• メンバーの貢献度ランキング\n' +
                       '• 週次ランキング履歴\n' +
                       '• 自動データ収集・保存',
                inline: false
            },
            {
                name: '🔄 `/guild setrank`',
                value: '**説明:** ギルドランキングデータを手動更新\n' +
                       '**権限:** 管理者権限が必要\n' +
                       '**機能:**\n' +
                       '• Wynncraft APIからデータ取得\n' +
                       '• ランキングデータの強制更新\n' +
                       '• データベースへの保存',
                inline: false
            },
            {
                name: '⚙️ 自動機能',
                value: '• **定期更新:** 自動的にギルドデータを取得\n' +
                       '• **データ保存:** ランキング履歴を永続保存\n' +
                       '• **メンバー管理:** 脱退・参加の自動検出',
                inline: false
            }
        ],
        color: 0xE74C3C
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('ボットの使い方とコマンド一覧を表示'),
    
    async execute(interaction) {
        let currentPage = 0;
        
        // 初期ページの表示
        const { embed, row } = createHelpPage(currentPage);
        const reply = await interaction.reply({
            embeds: [embed],
            components: [row]
        });
        
        // リアクション収集
        const collector = reply.createMessageComponentCollector({
            time: 300000 // 5分間
        });
        
        collector.on('collect', async (buttonInteraction) => {
            // 操作者チェック
            if (buttonInteraction.user.id !== interaction.user.id) {
                await buttonInteraction.reply({
                    content: '❌ このボタンは元のコマンド実行者のみ操作できます。',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            
            // ページ切り替え処理
            if (buttonInteraction.customId === 'help_prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (buttonInteraction.customId === 'help_next') {
                currentPage = Math.min(HELP_PAGES.length - 1, currentPage + 1);
            }
            
            // ページ更新
            const { embed: newEmbed, row: newRow } = createHelpPage(currentPage);
            await buttonInteraction.update({
                embeds: [newEmbed],
                components: [newRow]
            });
        });
        
        collector.on('end', async () => {
            // タイムアウト時にボタンを無効化
            const { embed, row } = createHelpPage(currentPage, true);
            try {
                await reply.edit({
                    embeds: [embed],
                    components: [row]
                });
            } catch (error) {
                // メッセージが削除されている場合は何もしない
                console.log('[INFO] Help message was deleted before timeout');
            }
        });
    }
};

// ヘルプページを作成する関数
function createHelpPage(pageIndex, disabled = false) {
    const page = HELP_PAGES[pageIndex];
    
    const embed = new EmbedBuilder()
        .setTitle(page.title)
        .setDescription(page.description)
        .setColor(page.color)
        .setTimestamp()
        .setFooter({
            text: `ページ ${pageIndex + 1}/${HELP_PAGES.length} | WynnTracker Help`,
            iconURL: 'https://cdn.wynncraft.com/nextgen/wynncraft_icon_32x32.png'
        });
    
    // フィールドを追加
    for (const field of page.fields) {
        embed.addFields(field);
    }
    
    // ボタン作成
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('help_prev')
                .setLabel('前のページ')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⬅️')
                .setDisabled(disabled || pageIndex === 0),
            new ButtonBuilder()
                .setCustomId('help_next')
                .setLabel('次のページ')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➡️')
                .setDisabled(disabled || pageIndex === HELP_PAGES.length - 1)
        );
    
    return { embed, row };
}