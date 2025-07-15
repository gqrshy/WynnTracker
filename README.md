# WynnTracker

WynncraftのプレイヤーステータスやAnnihilationイベントを管理する高機能Discord Bot

## 概要

WynnTrackerは、Wynncraftプレイヤー向けの包括的なDiscord Botです。ゲームイベントの追跡、プレイヤー統計の表示、ギルド管理、マーケット検索など、Wynncraftコミュニティに必要な様々な機能を提供します。

## 主な機能

### 🎯 Annihilationイベント管理 (`/anni`)
- **AI予測システム**: ARIMAモデルを使用した次回イベント時刻の予測
- **スマートカウントダウン**: 信頼度評価付きの自動タイマー
- **手動タイマー設定**: 従来の追跡方法もサポート
- **アラート通知**: ロールメンション付きの通知機能
- **履歴分析**: 過去のイベントデータの追跡と分析
- **タイムゾーン対応**: JST/UTC両対応

### 👥 ギルド管理 (`/guild`)
- ギルドメンバーのランキングと統計情報の追跡
- 週次ランキングシステム（自動リセット機能付き）
- 経験値追跡とリーダーボード
- Wynncraft API v3統合
- "Just Here After Work" ギルド（SKJタグ）に特化

### 📊 プレイヤー統計 (`/wynn`)
- 包括的なプレイヤー統計の表示
- レベル進行状況の視覚的プログレスバー
- プレイ時間追跡
- キャラクタークラス情報
- Wynncraft Player API統合

### 💰 トレードマーケット検索 (`/tm`)
- Wyncraftのトレードマーケット検索
- Wynncraft通貨での価格表示（Emeralds, EB, LE, STX）
- カスタムDiscord絵文字でのアイテムレアリティ表示
- Wynnventory APIからのリアルタイムマーケットデータ

### 🎲 Lootrun情報 (`/lr`)
- 各キャンプのルートプール情報
- Mythicアイテムの価格ランキング
- マーケット価値分析

### ⚔️ レイド情報 (`/raid`)
- 週次レイドアスペクトプール
- 異なるレアリティ対応（Mythic, Fabled, Legendary）
- バイリンガルサポート（日本語/英語）

### 🌐 翻訳機能 (`/translate`)
- メッセージ翻訳機能
- 言語設定管理

### ❓ ヘルプシステム (`/help`)
- インタラクティブなページ分割されたヘルプメニュー
- 詳細なコマンドドキュメント
- 管理者専用コマンドセクション

## 技術仕様

### 使用技術
- **Node.js** - メインランタイム
- **Discord.js v14** - Discord Bot フレームワーク
- **Python** - AI/ML予測エンジン
- **Axios** - APIリクエスト
- **Puppeteer** - Webスクレイピング
- **Node-cron** - スケジュールタスク

### プロジェクト構造
```
WynnTracker/
├── index.js              # メインBotエントリーポイント
├── config.js             # 設定管理
├── commands/             # スラッシュコマンドモジュール
│   ├── anni.js          # Annihilation追跡
│   ├── guild.js         # ギルド管理
│   ├── help.js          # ヘルプシステム
│   ├── lr.js            # Lootrunコマンド
│   ├── raid.js          # レイド情報
│   ├── tm.js            # トレードマーケット検索
│   ├── translate.js     # 翻訳機能
│   └── wynn.js          # プレイヤー統計
├── data/                # 永続データストレージ
│   ├── anni_history.json
│   ├── annihilation.json
│   ├── aspects.json
│   ├── gambits.json
│   ├── guild_rankings.json
│   ├── prediction_cache.json
│   └── translate_settings.json
├── python/              # Python ML統合
│   └── arima_predictor.py
└── utils/               # ユーティリティモジュール
    ├── anniPredictionEngine.js
    ├── autoSyncSystem.js
    ├── configManager.js
    ├── dataCache.js
    ├── errorHandler.js
    ├── pythonBridge.js
    ├── rateLimiter.js
    └── wynncraft-api.js
```

## セットアップ

### 必要条件
- Node.js v16.9.0以上
- Python 3.8以上
- Discord Bot トークン

### インストール手順

1. リポジトリをクローン
```bash
git clone https://github.com/yourusername/WynnTracker.git
cd WynnTracker
```

2. Node.js依存関係をインストール
```bash
npm install
```

3. Python依存関係をインストール
```bash
./install_python_deps.sh
# または
pip install -r requirements.txt
```

4. 環境変数を設定
```bash
# .envファイルを作成
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id
```

5. Botを起動
```bash
npm start
```

## 設定

`config.js`ファイルで以下の設定が可能です：
- API エンドポイント
- 更新間隔
- デフォルト設定
- 権限設定

## API統合

- **Wynncraft Official API v3** - プレイヤーとギルドデータ
- **Wynnventory API** - マーケットデータ
- **カスタム予測エンドポイント** - AI予測データ
- **GitHub-hosted静的アセット** - 画像とリソース

## 機能の詳細

### 自動同期システム
- 予測データの自動同期
- 10秒間隔でのリアルタイムタイマー更新
- Bot再起動後のデータ永続性

### セキュリティ機能
- 管理者専用コマンド
- APIレート制限
- エラー分離とハンドリング
- 環境変数による設定管理

### パフォーマンス最適化
- データキャッシング
- 効率的なAPI呼び出し
- 非同期処理

## 貢献

プルリクエストを歓迎します。大きな変更を行う場合は、まずイシューを開いて変更内容について議論してください。

## ライセンス

[MITライセンス](LICENSE)

## クレジット

- [Wynncraft Official API](https://docs.wynncraft.com/docs/) - プレイヤー統計コマンドで使用
- [nori.fish](https://nori.fish/) - インスピレーション
- [wynnpool.com](https://www.wynnpool.com/annihilation) - インスピレーション

## サポート

問題や質問がある場合は、[イシューを作成](https://github.com/yourusername/WynnTracker/issues)してください。