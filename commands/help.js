const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// 一般ユーザー用ヘルプページ
const USER_HELP_PAGES = [
    {
        title: '📋 コマンド一覧 - 基本情報',
        description: '**WynnTrackerボット**へようこそ！\n\nこのボットはWynncraftの様々な情報を提供します。\n下のボタンで各ページを切り替えできます。',
        fields: [
            {
                name: '📖 利用可能なコマンド',
                value: '• ``/lr`` - ルートラン関連コマンド\n• ``/raid`` - レイド関連コマンド\n• ``/tm`` - Trade Market検索\n• ``/wynn`` - プレイヤー統計情報\n• ``/guild`` - ギルド関連コマンド\n• ``/help`` - このヘルプ画面',
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
                name: '📊 ``/lr lootpool``',
                value: '各キャンプのルートプールを表示\n' +
                       '**オプション:** ``page`` (1-10) | ``camp`` (キャンプ選択)',
                inline: false
            },
            {
                name: '💰 ``/lr mythranking``',
                value: 'Mythicアイテムの相場ランキング表示\n' +
                       'Unidentified価格での比較・平均価格計算',
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
                name: '⚡ ``/raid aspectpool``',
                value: '今週の各レイドのアスペクトを表示\n' +
                       '**オプション:** ``rarity`` (mythic/fabled/legendary)\n' +
                       '**オプション:** ``language`` (日本語/英語)',
                inline: false
            },
            {
                name: '🏛️ 対応レイド',
                value: '``TNA`` The Nameless Anomaly\n' +
                       '``TCC`` The Canyon Colossus\n' +
                       '``NOL`` Orphion\'s Nexus of Light\n' +
                       '``NOTG`` Nest of the Grootslangs',
                inline: false
            },
            {
                name: '🎲 Gambit情報',
                value: 'アスペクト情報と合わせて今週のGambitも表示されます。\n' +
                       '各Gambitの効果は言語設定に応じて表示されます。',
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
                name: '📈 ``/wynn stats``',
                value: '指定プレイヤーの統計情報を表示\n' +
                       '**必須:** ``mcid`` (プレイヤー名)\n' +
                       '総プレイ時間・各クラスレベル・ギルド情報',
                inline: false
            },
            {
                name: '📊 統計情報の詳細',
                value: 'プログレスバー付きレベル表示\n' +
                       '全5クラスの詳細データ\n' +
                       'Wynncraft公式APIから最新データ取得',
                inline: false
            }
        ],
        color: 0x3498DB
    },
    {
        title: '💰 /tm コマンド - Trade Market',
        description: 'Trade Market（取引市場）の検索と価格情報を取得します。',
        fields: [
            {
                name: '🔍 ``/tm search``',
                value: 'アイテムの最新出品情報を検索\n' +
                       '**必須:** ``item`` (アイテム名)\n' +
                       '**オプション:** ``unidentified`` (Unidのみ表示)',
                inline: false
            },
            {
                name: '📊 表示される情報',
                value: '• 最新5件の出品情報\n' +
                       '• 過去7日間の平均価格\n' +
                       '• Identified/Unidentified別の価格\n' +
                       '• 出品時刻と数量',
                inline: false
            },
            {
                name: '⏱️ 使用制限',
                value: '30秒に1回まで使用可能\n' +
                       'API負荷軽減のための制限',
                inline: false
            }
        ],
        color: 0xFFD700
    },
    {
        title: '🏰 /guild コマンド - ギルド関連',
        description: 'ギルド「Just Here After Work (SKJ)」の管理機能。',
        fields: [
            {
                name: '📊 ``/guild ranking``',
                value: 'ギルドメンバーの貢献度ランキング\n' +
                       '週次履歴・自動データ収集',
                inline: false
            },
            {
                name: '⚙️ 自動機能',
                value: '定期的な自動データ更新\n' +
                       'ランキング履歴の永続保存\n' +
                       'メンバー変更の自動検出',
                inline: false
            }
        ],
        color: 0xE74C3C
    }
];

// 管理者用ヘルプページ（全ページ）
const ADMIN_HELP_PAGES = [
    {
        title: '📋 コマンド一覧 - 基本情報',
        description: '**WynnTrackerボット**へようこそ！\n\nこのボットはWynncraftの様々な情報を提供します。\n下のボタンで各ページを切り替えできます。',
        fields: [
            {
                name: '📖 利用可能なコマンド',
                value: '• ``/lr`` - ルートラン関連コマンド\n• ``/raid`` - レイド関連コマンド\n• ``/tm`` - Trade Market検索\n• ``/wynn`` - プレイヤー統計情報\n• ``/guild`` - ギルド関連コマンド\n• ``/anni`` - AI予測Annihilationタイマー（管理者限定）\n• ``/help`` - このヘルプ画面',
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
                name: '📊 ``/lr lootpool``',
                value: '各キャンプのルートプールを表示\n' +
                       '**オプション:** ``page`` (1-10) | ``camp`` (キャンプ選択)',
                inline: false
            },
            {
                name: '💰 ``/lr mythranking``',
                value: 'Mythicアイテムの相場ランキング表示\n' +
                       'Unidentified価格での比較・平均価格計算',
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
                name: '⚡ ``/raid aspectpool``',
                value: '今週の各レイドのアスペクトを表示\n' +
                       '**オプション:** ``rarity`` (mythic/fabled/legendary)',
                inline: false
            },
            {
                name: '🏛️ 対応レイド',
                value: '``TNA`` The Nameless Anomaly\n' +
                       '``TCC`` The Canyon Colossus\n' +
                       '``NOL`` Orphion\'s Nexus of Light\n' +
                       '``NOTG`` Nest of the Grootslangs',
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
                name: '📈 ``/wynn stats``',
                value: '指定プレイヤーの統計情報を表示\n' +
                       '**必須:** ``mcid`` (プレイヤー名)\n' +
                       '総プレイ時間・各クラスレベル・ギルド情報',
                inline: false
            },
            {
                name: '📊 統計情報の詳細',
                value: 'プログレスバー付きレベル表示\n' +
                       '全5クラスの詳細データ\n' +
                       'Wynncraft公式APIから最新データ取得',
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
                name: '📊 ``/guild ranking``',
                value: 'ギルドメンバーの貢献度ランキング\n' +
                       '週次履歴・自動データ収集',
                inline: false
            },
            {
                name: '🔄 ``/guild setrank``',
                value: 'ギルドデータを手動更新（管理者権限必要）\n' +
                       'APIからデータ取得・強制更新',
                inline: false
            },
            {
                name: '⚙️ 自動機能',
                value: '定期的な自動データ更新\n' +
                       'ランキング履歴の永続保存\n' +
                       'メンバー変更の自動検出',
                inline: false
            }
        ],
        color: 0xE74C3C
    },
    {
        title: '🤖 /anni - AI予測Annihilationタイマー（管理者限定）',
        description: 'Annihilationイベントの高精度AI予測システム。Wynnpool並みの精度を実現。',
        fields: [
            {
                name: '🎯 ``/anni timer``',
                value: 'AI予測による自動更新タイマー\n' +
                       '10秒ごと更新・信頼度表示\n' +
                       '🎯高精度 🤖中精度 ⚠️低精度\n' +
                       '**オプション:** ``timezone`` (jst/utc/both)',
                inline: false
            },
            {
                name: '📊 ``/anni predict``',
                value: '次回Annihilationの詳細予測\n' +
                       '予測時刻・信頼度・手法表示',
                inline: false
            },
            {
                name: '⚙️ ``/anni timer-manual``',
                value: '従来の固定間隔タイマー\n' +
                       '``datetime`` ``timezone`` 指定',
                inline: false
            }
        ],
        color: 0x00FF88
    },
    {
        title: '🧠 AI予測システム - 詳細機能',
        description: 'ARIMA時系列解析とハイブリッド予測により高精度を実現。',
        fields: [
            {
                name: '📝 データ管理コマンド',
                value: '``/anni record`` イベント発生記録\n' +
                       '``/anni history`` 履歴表示\n' +
                       '``/anni import`` データ取込\n' +
                       '``/anni analyze`` 統計分析\n' +
                       '``/anni compare`` 予測比較',
                inline: false
            },
            {
                name: '🔧 システム管理（管理者用）',
                value: '``/anni reset`` キャッシュリセット\n' +
                       '``/anni clear-history`` 履歴削除\n' +
                       '``/anni debug`` デバッグ情報\n' +
                       '``/anni alert`` 通知設定\n' +
                       '``/anni mention`` ロール設定',
                inline: false
            },
            {
                name: '🎯 予測システムの特徴',
                value: '統計予測・ARIMA機械学習モデル\n' +
                       'ハイブリッド統合判定\n' +
                       '自動学習による精度向上',
                inline: false
            }
        ],
        color: 0x9932CC
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('ボットの使い方とコマンド一覧を表示'),
    
    async execute(interaction) {
        let currentPage = 0;
        
        // 管理者権限の確認
        const isAdmin = interaction.member?.permissions?.has('Administrator') || false;
        const HELP_PAGES = isAdmin ? ADMIN_HELP_PAGES : USER_HELP_PAGES;
        
        // 初期ページの表示
        const { embed, row } = createHelpPage(currentPage, HELP_PAGES);
        const reply = await interaction.reply({
            embeds: [embed],
            components: [row]
        });
        
        // リアクション収集
        const collector = reply.createMessageComponentCollector({
            time: 300000 // 5分間
        });
        
        // 1分間の非活性でメッセージ削除用タイマー
        let deleteTimer = setTimeout(async () => {
            try {
                await reply.delete();
                console.log('[INFO] Help message auto-deleted due to inactivity');
            } catch (error) {
                // メッセージが既に削除されている場合は何もしない
                console.log('[INFO] Help message was already deleted');
            }
        }, 60000); // 1分間
        
        collector.on('collect', async (buttonInteraction) => {
            // 操作者チェック
            if (buttonInteraction.user.id !== interaction.user.id) {
                await buttonInteraction.reply({
                    content: '❌ このボタンは元のコマンド実行者のみ操作できます。',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            
            // タイマーをリセット（ユーザーが操作したため）
            clearTimeout(deleteTimer);
            deleteTimer = setTimeout(async () => {
                try {
                    await reply.delete();
                    console.log('[INFO] Help message auto-deleted due to inactivity');
                } catch (error) {
                    console.log('[INFO] Help message was already deleted');
                }
            }, 60000); // 1分間
            
            // ページ切り替え処理
            if (buttonInteraction.customId === 'help_prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (buttonInteraction.customId === 'help_next') {
                currentPage = Math.min(HELP_PAGES.length - 1, currentPage + 1);
            }
            
            // ページ更新
            const { embed: newEmbed, row: newRow } = createHelpPage(currentPage, HELP_PAGES);
            await buttonInteraction.update({
                embeds: [newEmbed],
                components: [newRow]
            });
        });
        
        collector.on('end', async () => {
            // コレクター終了時にタイマーもクリア
            clearTimeout(deleteTimer);
            
            // タイムアウト時にボタンを無効化
            const { embed, row } = createHelpPage(currentPage, HELP_PAGES, true);
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
function createHelpPage(pageIndex, helpPages, disabled = false) {
    const page = helpPages[pageIndex];
    
    const embed = new EmbedBuilder()
        .setTitle(page.title)
        .setDescription(page.description)
        .setColor(page.color)
        .setTimestamp()
        .setFooter({
            text: `ページ ${pageIndex + 1}/${helpPages.length} | WynnTracker Help`,
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
                .setDisabled(disabled || pageIndex === helpPages.length - 1)
        );
    
    return { embed, row };
}