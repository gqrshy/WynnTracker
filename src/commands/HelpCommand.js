const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const BaseCommand = require('./BaseCommand');

class HelpCommand extends BaseCommand {
    constructor() {
        super({
            name: 'help',
            description: 'ボットの使い方とコマンド一覧を表示',
            category: 'General',
            cooldown: 5000
        });
        this.helpPages = this.initializeHelpPages();
    }


    async run(interaction) {
        let currentPage = 0;
        
        // 管理者権限の確認
        const isAdmin = interaction.member?.permissions?.has('Administrator') || false;
        const pages = isAdmin ? this.helpPages.admin : this.helpPages.user;
        
        // 初期ページの表示
        const { embed, row } = this.createHelpPage(currentPage, pages);
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
                currentPage = Math.min(pages.length - 1, currentPage + 1);
            }
            
            // ページ更新
            const { embed: newEmbed, row: newRow } = this.createHelpPage(currentPage, pages);
            await buttonInteraction.update({
                embeds: [newEmbed],
                components: [newRow]
            });
        });
        
        collector.on('end', async () => {
            // コレクター終了時にタイマーもクリア
            clearTimeout(deleteTimer);
            
            // タイムアウト時にボタンを無効化
            const { embed, row } = this.createHelpPage(currentPage, pages, true);
            try {
                await reply.edit({
                    embeds: [embed],
                    components: [row]
                });
            } catch (error) {
                console.log('[INFO] Help message was deleted before timeout');
            }
        });
    }

    createHelpPage(pageIndex, helpPages, disabled = false) {
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

    initializeHelpPages() {
        // 一般ユーザー用ヘルプページ
        const userPages = [
            {
                title: '📋 コマンド一覧 - 基本情報',
                description: '**WynnTracker Revival**へようこそ！\n\nこのボットはWynncraftの様々な情報を提供します。\n下のボタンで各ページを切り替えできます。',
                fields: [
                    {
                        name: '📖 利用可能なコマンド',
                        value: '• `/lr` - ルートラン関連コマンド\n• `/raid` - レイド関連コマンド\n• `/tm` - Trade Market検索\n• `/wynn` - プレイヤー統計情報\n• `/guild` - ギルド関連コマンド\n• `/anni` - Annihilationカウントダウン\n• `/translate` - 翻訳機能\n• `/help` - このヘルプ画面',
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
                        name: '📊 `/lr lootpool`',
                        value: '各キャンプのルートプールを表示\n**オプション:** `page` (1-10) | `camp` (キャンプ選択)',
                        inline: false
                    },
                    {
                        name: '💰 `/lr mythranking`',
                        value: 'Mythicアイテムの相場ランキング表示\nUnidentified価格での比較・平均価格計算',
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
                        name: '⚡ `/raid aspectpool`',
                        value: '今週の各レイドのアスペクトを表示\n**オプション:** `rarity` (mythic/fabled/legendary)\n**オプション:** `language` (日本語/英語)',
                        inline: false
                    },
                    {
                        name: '🏛️ 対応レイド',
                        value: '`TNA` The Nameless Anomaly\n`TCC` The Canyon Colossus\n`NOL` Orphion\'s Nexus of Light\n`NOTG` Nest of the Grootslangs',
                        inline: false
                    },
                    {
                        name: '🎲 Gambit情報',
                        value: 'アスペクト情報と合わせて今週のGambitも表示されます。\n各Gambitの効果は言語設定に応じて表示されます。',
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
                        name: '📈 `/wynn stats`',
                        value: '指定プレイヤーの統計情報を表示\n**必須:** `mcid` (プレイヤー名)\n総プレイ時間・各クラスレベル・ギルド情報',
                        inline: false
                    },
                    {
                        name: '📊 統計情報の詳細',
                        value: 'プログレスバー付きレベル表示\n全5クラスの詳細データ\nWynncraft公式APIから最新データ取得',
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
                        name: '🔍 `/tm search`',
                        value: 'アイテムの最新出品情報を検索\n**必須:** `item` (アイテム名)\n**オプション:** `unidentified` (Unidのみ表示)',
                        inline: false
                    },
                    {
                        name: '📊 表示される情報',
                        value: '• 最新5件の出品情報\n• 過去7日間の平均価格\n• Identified/Unidentified別の価格\n• 出品時刻と数量',
                        inline: false
                    },
                    {
                        name: '⏱️ 使用制限',
                        value: '30秒に1回まで使用可能\nAPI負荷軽減のための制限',
                        inline: false
                    }
                ],
                color: 0xFFD700
            },
            {
                title: '🏰 /guild コマンド - ギルド関連',
                description: 'ギルドの管理機能を提供します。',
                fields: [
                    {
                        name: '📊 `/guild ranking`',
                        value: 'ギルドメンバーの貢献度ランキング\n週次履歴・自動データ収集',
                        inline: false
                    },
                    {
                        name: '⚙️ 自動機能',
                        value: '定期的な自動データ更新\nランキング履歴の永続保存\nメンバー変更の自動検出',
                        inline: false
                    }
                ],
                color: 0xE74C3C
            },
            {
                title: '🌐 /translate コマンド - 翻訳機能',
                description: 'DeepL APIを使用した高精度翻訳機能を提供します。',
                fields: [
                    {
                        name: '📝 `/translate text`',
                        value: 'テキストを指定した言語に翻訳\n**必須:** `text` (翻訳したいテキスト), `to` (翻訳先言語)\n**オプション:** `from` (翻訳元言語)',
                        inline: false
                    },
                    {
                        name: '🔄 `/translate auto`',
                        value: 'チャンネルの自動翻訳設定（管理者のみ）\n**必須:** `enabled` (有効/無効)\n**オプション:** `target` (翻訳先言語)',
                        inline: false
                    },
                    {
                        name: '📊 `/translate status`',
                        value: '翻訳システムの状態を表示\nAPI状態・キャッシュ・処理状況を確認',
                        inline: false
                    },
                    {
                        name: '🔧 管理者機能',
                        value: '• `/translate metrics` - 詳細メトリクス\n• `/translate health` - ヘルスチェック\n• `/translate cache` - キャッシュ管理\n• `/translate reload` - 設定再読み込み',
                        inline: false
                    },
                    {
                        name: '🌍 対応言語',
                        value: '英語・日本語・スペイン語・フランス語・ドイツ語・イタリア語・ポルトガル語・ロシア語・中国語・韓国語',
                        inline: false
                    }
                ],
                color: 0x0099ff
            },
            {
                title: '🔥 /anni コマンド - Annihilationイベント',
                description: 'Annihilationワールドイベントのカウントダウンと予測を提供します。',
                fields: [
                    {
                        name: '▶️ `/anni start`',
                        value: 'カウントダウンタイマーを開始\n3分ごとに自動更新されるリアルタイム表示\n**オプション:** `notify_role` (通知ロール)',
                        inline: false
                    },
                    {
                        name: '🕒 `/anni next`',
                        value: '次のAnnihilation予測を一度だけ表示\n確定/予測中/推定の状態表示',
                        inline: false
                    },
                    {
                        name: '📅 データソース',
                        value: 'GitHub: AiverAiva/anni-pred\n12時間前確定データ + AI予測\n30分ごとの確定データチェック',
                        inline: false
                    }
                ],
                color: 0xff6600
            }
        ];

        // 管理者用ヘルプページ
        const adminPages = [
            ...userPages.slice(0, 1), // 基本情報ページを更新
            {
                title: '📋 コマンド一覧 - 基本情報',
                description: '**WynnTracker Revival**へようこそ！\n\nこのボットはWynncraftの様々な情報を提供します。\n下のボタンで各ページを切り替えできます。',
                fields: [
                    {
                        name: '📖 利用可能なコマンド',
                        value: '• `/lr` - ルートラン関連コマンド\n• `/raid` - レイド関連コマンド\n• `/tm` - Trade Market検索\n• `/wynn` - プレイヤー統計情報\n• `/guild` - ギルド関連コマンド\n• `/anni` - Annihilationカウントダウン\n• `/translate` - 翻詳機能\n• `/help` - このヘルプ画面',
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
            ...userPages.slice(1), // 残りのページ
            {
                title: '🔥 /anni - Annihilationカウントダウン',
                description: 'Annihilationイベントのカウントダウン機能（AiverAiva/anni-predデータ使用）',
                fields: [
                    {
                        name: '▶️ `/anni start`',
                        value: 'カウントダウンタイマーを開始\n3分ごとに自動更新\n**オプション:** `notify_role` (通知ロール)\n✨ 確定/🔮 予測中/❓ 推定',
                        inline: false
                    },
                    {
                        name: '⏹️ `/anni stop`',
                        value: 'カウントダウンタイマーを停止',
                        inline: false
                    },
                    {
                        name: '🕒 `/anni next`',
                        value: '次のAnnihilation予測を表示\n一回限りの予測情報',
                        inline: false
                    },
                    {
                        name: '📊 `/anni accuracy`',
                        value: '予測精度を評価\n過去データの統計分析',
                        inline: false
                    },
                    {
                        name: '🔔 通知機能',
                        value: '12時間前・45分前にロールメンション\n再通知ボタン付き',
                        inline: false
                    }
                ],
                color: 0x00FF88
            }
        ];

        // 管理者用の最初のページを修正
        adminPages[0] = adminPages[1];
        adminPages.splice(1, 1);

        return {
            user: userPages,
            admin: adminPages
        };
    }

    static create() {
        return new HelpCommand();
    }
}

module.exports = HelpCommand;