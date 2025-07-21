# WynnTracker Bot コマンドリファクタリング実装タスク

## 概要

このタスクリストは、WynnTracker Botのコマンドシステムをレイヤードアーキテクチャにリファクタリングするための実装手順を定義します。段階的なアプローチにより、既存機能を維持しながら新しいアーキテクチャに移行します。

## フェーズ1: 基盤構築

### 1. プロジェクト構造の準備

- [ ] 1.1 新しいディレクトリ構造を作成
  - src/commands/, src/services/, src/repositories/, src/models/, src/middleware/, src/utils/, src/config/ディレクトリを作成
  - 既存のcommandsディレクトリをlegacy-commandsにリネーム
  - _要件: 要件定義書のアーキテクチャ構造_

- [ ] 1.2 TypeScript設定ファイルを作成
  - tsconfig.jsonを作成し、厳密な型チェックを有効化
  - パスマッピングを設定してインポートを簡素化
  - _要件: 設計書のTypeScript設定_

- [ ] 1.3 テスト環境の構築
  - Jest設定ファイルを作成
  - テストユーティリティとモックヘルパーを実装
  - _要件: 設計書のテスト戦略_

### 2. 共通コンポーネントの実装

- [ ] 2.1 基本インターフェースの定義
  - src/models/common.tsに共通インターフェースを定義
  - CommandContext, AppError, CacheEntry等の基本型を実装
  - _要件: 設計書のモデル層設計_

- [ ] 2.2 設定管理システムの実装
  - src/config/ConfigManager.tsを実装
  - 環境変数の読み込みとバリデーション機能を追加
  - 設定のホットリロード機能を実装
  - _要件: 設計書の設定管理設計_

- [ ] 2.3 エラーハンドリングシステムの実装
  - src/utils/errors.tsにエラークラス階層を実装
  - src/middleware/ErrorHandlingMiddleware.tsを実装
  - 統一されたエラーレスポンス形式を定義
  - _要件: 設計書のエラーハンドリング設計_

### 3. キャッシュシステムの実装

- [ ] 3.1 キャッシュサービスの基本実装
  - src/services/CacheService.tsを実装
  - メモリベースキャッシュとTTL機能を実装
  - キャッシュ統計とメトリクス収集機能を追加
  - _要件: 設計書のキャッシュ戦略_

- [ ] 3.2 キャッシュサービスのテスト作成
  - CacheServiceのユニットテストを作成
  - TTL、容量制限、統計機能のテストを実装
  - _要件: 設計書のテスト戦略_

### 4. HTTP クライアントの実装

- [ ] 4.1 HTTPクライアントの基本実装
  - src/utils/HttpClient.tsを実装
  - レート制限、リトライ、タイムアウト機能を統合
  - リクエスト/レスポンスのログ機能を追加
  - _要件: 設計書のHTTP Client設計_

- [ ] 4.2 レート制限システムの実装
  - src/middleware/RateLimitMiddleware.tsを実装
  - コマンド別レート制限設定を実装
  - レート制限統計の収集機能を追加
  - _要件: 設計書のレート制限設計_

## フェーズ2: 小規模コマンドの移行

### 5. Helpコマンドのリファクタリング

- [ ] 5.1 Helpモデルの実装
  - src/models/Help.tsにHelpPageインターフェースを定義
  - ヘルプページのバリデーション機能を実装
  - _要件: 要件定義書のhelpコマンド仕様_

- [ ] 5.2 HelpServiceの実装
  - src/services/HelpService.tsを実装
  - 権限に基づくページフィルタリング機能を実装
  - ページネーション機能を実装
  - _要件: 要件定義書のhelpコマンド仕様_

- [ ] 5.3 新しいHelpCommandの実装
  - src/commands/HelpCommand.tsを実装
  - ミドルウェアパイプラインを統合
  - 既存機能との互換性を確保
  - _要件: 要件定義書のhelpコマンド仕様_

### 6. Wynnコマンドのリファクタリング

- [ ] 6.1 Playerモデルの実装
  - src/models/Player.tsにPlayerStats等のインターフェースを定義
  - プレイヤーデータのバリデーション機能を実装
  - _要件: 要件定義書のwynnコマンド仕様_

- [ ] 6.2 WynncraftRepositoryの実装
  - src/repositories/WynncraftRepository.tsを実装
  - プレイヤー統計取得APIを統合
  - キャッシュとレート制限を適用
  - _要件: 設計書のRepository層設計_

- [ ] 6.3 PlayerServiceの実装
  - src/services/PlayerService.tsを実装
  - プレイヤー統計の計算ロジックを実装
  - プログレスバー生成機能を実装
  - _要件: 要件定義書のwynnコマンド仕様_

- [ ] 6.4 新しいWynnCommandの実装
  - src/commands/WynnCommand.tsを実装
  - 統計表示の整形機能を実装
  - 既存機能との互換性を確保
  - _要件: 要件定義書のwynnコマンド仕様_

## フェーズ3: 中規模コマンドの移行

### 7. LRコマンドのリファクタリング

- [ ] 7.1 Lootrunモデルの実装
  - src/models/Lootrun.tsにLootPool等のインターフェースを定義
  - ルートプールデータのバリデーション機能を実装
  - _要件: 要件定義書のlrコマンド仕様_

- [ ] 7.2 WynnventoryRepositoryの実装
  - src/repositories/WynnventoryRepository.tsを実装
  - ルートプール取得APIを統合
  - 価格データ取得APIを統合
  - _要件: 設計書のRepository層設計_

- [ ] 7.3 LootrunServiceの実装
  - src/services/LootrunService.tsを実装
  - Mythicランキング計算ロジックを実装
  - 価格フォーマット機能を実装
  - _要件: 要件定義書のlrコマンド仕様_

- [ ] 7.4 新しいLRCommandの実装
  - src/commands/LRCommand.tsを実装
  - ページネーション機能を統合
  - 既存機能との互換性を確保
  - _要件: 要件定義書のlrコマンド仕様_

### 8. Raidコマンドのリファクタリング

- [ ] 8.1 Raidモデルの実装
  - src/models/Raid.tsにAspectPool等のインターフェースを定義
  - アスペクトデータのバリデーション機能を実装
  - _要件: 要件定義書のraidコマンド仕様_

- [ ] 8.2 RaidServiceの実装
  - src/services/RaidService.tsを実装
  - アスペクト説明の多言語対応機能を実装
  - Gambit情報の処理機能を実装
  - _要件: 要件定義書のraidコマンド仕様_

- [ ] 8.3 新しいRaidCommandの実装
  - src/commands/RaidCommand.tsを実装
  - レアリティフィルタリング機能を統合
  - 既存機能との互換性を確保
  - _要件: 要件定義書のraidコマンド仕様_

### 9. TMコマンドのリファクタリング

- [ ] 9.1 TradeMarketモデルの実装
  - src/models/TradeMarket.tsにItemListing等のインターフェースを定義
  - 取引データのバリデーション機能を実装
  - _要件: 要件定義書のtmコマンド仕様_

- [ ] 9.2 TradeMarketServiceの実装
  - src/services/TradeMarketService.tsを実装
  - 価格計算と統計機能を実装
  - 通貨フォーマット機能を実装
  - _要件: 要件定義書のtmコマンド仕様_

- [ ] 9.3 新しいTMCommandの実装
  - src/commands/TMCommand.tsを実装
  - 検索フィルタリング機能を統合
  - 既存機能との互換性を確保
  - _要件: 要件定義書のtmコマンド仕様_

## フェーズ4: 大規模コマンドの移行

### 10. Guildコマンドのリファクタリング

- [ ] 10.1 Guildモデルの実装
  - src/models/Guild.tsにGuildMember等のインターフェースを定義
  - ギルドデータのバリデーション機能を実装
  - _要件: 要件定義書のguildコマンド仕様_

- [ ] 10.2 GuildRepositoryの実装
  - src/repositories/GuildRepository.tsを実装
  - ギルド情報取得APIを統合
  - データ永続化機能を実装
  - _要件: 設計書のRepository層設計_

- [ ] 10.3 GuildServiceの実装
  - src/services/GuildService.tsを実装
  - ランキング計算ロジックを実装
  - 週次リセット機能を実装
  - _要件: 要件定義書のguildコマンド仕様_

- [ ] 10.4 新しいGuildCommandの実装
  - src/commands/GuildCommand.tsを実装
  - ランキング表示機能を統合
  - 既存機能との互換性を確保
  - _要件: 要件定義書のguildコマンド仕様_

### 11. Translateコマンドのリファクタリング

- [ ] 11.1 Translationモデルの実装
  - src/models/Translation.tsにTranslationRequest等のインターフェースを定義
  - 翻訳データのバリデーション機能を実装
  - _要件: 要件定義書のtranslateコマンド仕様_

- [ ] 11.2 TranslationServiceのリファクタリング
  - 既存のTranslationServiceを新しいアーキテクチャに適合
  - 依存性注入パターンを適用
  - バッチ処理機能を最適化
  - _要件: 要件定義書のtranslateコマンド仕様_

- [ ] 11.3 新しいTranslateCommandの実装
  - src/commands/TranslateCommand.tsを実装
  - 自動翻訳機能を統合
  - 既存機能との互換性を確保
  - _要件: 要件定義書のtranslateコマンド仕様_

### 12. Anniコマンドのリファクタリング

- [ ] 12.1 Annihilationモデルの実装
  - src/models/Annihilation.tsにAnnihilationEvent等のインターフェースを定義
  - 予測データのバリデーション機能を実装
  - _要件: 要件定義書のanniコマンド仕様_

- [ ] 12.2 PredictionServiceのリファクタリング
  - 既存のPredictionEngineを新しいアーキテクチャに適合
  - AI予測ロジックを分離
  - 履歴管理機能を最適化
  - _要件: 要件定義書のanniコマンド仕様_

- [ ] 12.3 新しいAnniCommandの実装
  - src/commands/AnniCommand.tsを実装
  - タイマー機能を統合
  - 既存機能との互換性を確保
  - _要件: 要件定義書のanniコマンド仕様_

## フェーズ5: 統合とテスト

### 13. コマンドローダーの実装

- [ ] 13.1 CommandLoaderの実装
  - src/utils/CommandLoader.tsを実装
  - 動的コマンド読み込み機能を実装
  - 依存性注入コンテナを統合
  - _要件: 設計書のDI設計_

- [ ] 13.2 ミドルウェアパイプラインの実装
  - src/middleware/MiddlewarePipeline.tsを実装
  - 認証、レート制限、エラーハンドリングを統合
  - ミドルウェアの順序制御機能を実装
  - _要件: 設計書のMiddleware設計_

### 14. 統合テストの実装

- [ ] 14.1 コマンド統合テストの作成
  - 各コマンドの統合テストを実装
  - モックDiscord.jsインタラクションを作成
  - エンドツーエンドテストシナリオを実装
  - _要件: 設計書のテスト戦略_

- [ ] 14.2 パフォーマンステストの実装
  - レスポンス時間測定テストを実装
  - メモリ使用量監視テストを実装
  - 負荷テストシナリオを作成
  - _要件: 設計書のパフォーマンス最適化_

### 15. 移行とデプロイ

- [ ] 15.1 段階的移行の実装
  - 新旧コマンドの並行実行機能を実装
  - フィーチャーフラグによる切り替え機能を実装
  - ロールバック機能を実装
  - _要件: 設計書の移行戦略_

- [ ] 15.2 監視とログの実装
  - メトリクス収集機能を実装
  - 構造化ログ出力機能を実装
  - アラート機能を実装
  - _要件: 設計書の監視・ログ設計_

- [ ] 15.3 ドキュメントの更新
  - APIドキュメントを作成
  - 開発者ガイドを更新
  - デプロイメントガイドを作成
  - _要件: 設計書のドキュメント要件_

## フェーズ6: 最適化と清理

### 16. パフォーマンス最適化

- [ ] 16.1 キャッシュ最適化の実装
  - キャッシュヒット率の分析と改善
  - キャッシュ階層の最適化
  - キャッシュ無効化戦略の改善
  - _要件: 設計書のキャッシュ戦略_

- [ ] 16.2 並列処理の最適化
  - バッチ処理の並列化
  - API呼び出しの並列化
  - レスポンス時間の最適化
  - _要件: 設計書の並列処理_

### 17. レガシーコードの削除

- [ ] 17.1 旧コマンドファイルの削除
  - legacy-commandsディレクトリの削除
  - 未使用ユーティリティの削除
  - 設定ファイルの清理
  - _要件: リファクタリング完了後の清理_

- [ ] 17.2 最終テストとバリデーション
  - 全機能の動作確認テスト
  - パフォーマンス回帰テスト
  - セキュリティ監査
  - _要件: 要件定義書の成功基準_

## 完了基準

- [ ] 全ての既存機能が新しいアーキテクチャで正常に動作する
- [ ] テストカバレッジが80%以上達成される
- [ ] レスポンス時間が既存実装と同等以上である
- [ ] コードの重複が50%以上削減される
- [ ] 新しいコマンド追加のためのテンプレートが整備される