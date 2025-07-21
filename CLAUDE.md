# WynnTracker Revival - 開発ガイド

このファイルは、WynnTracker Revivalコードベースで作業するClaude Codeのためのガイドです。
**2025年1月18日更新**: Annihilation予測システムの高精度化完了に伴う重要な学びを追加。

## Development Commands

### Core Commands
- `npm start` - Start the bot in production mode
- `npm run dev` - Start with nodemon for development
- `npm test` - Run the test suite
- `npm run test:coverage` - Run tests with coverage report
- `npm run deploy-commands` - Deploy Discord slash commands

### Production Commands
- `npm run prod` - Start with PM2 for production
- `npm run prod:logs` - View production logs
- `npm run prod:restart` - Restart production instance

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier

### Testing Scripts (開発用)
- `node test-enhanced-annihilation.js` - Annihilation予測システムテスト
- `node test-github-auto-import.js` - GitHub自動データ取得テスト
- `node import-wynnpool-data.js` - Wynnpoolデータの手動インポート

## 実装済み機能 (2025年1月現在)

### Discord コマンド一覧
1. **`/help`** - インタラクティブヘルプシステム
2. **`/tm <item>`** - Trade Market価格検索
3. **`/wynn <player>`** - プレイヤー統計表示
4. **`/lr lootpool`** - Lootrunプール表示
5. **`/lr mythranking`** - Mythicアイテム価格ランキング
6. **`/raid aspectpool`** - 週次アスペクトプール
7. **`/guild rank set`** - ギルドランキング記録（管理者のみ）
8. **`/guild gxp ranking`** - 週間GXPランキング
9. **`/guild raid ranking`** - 週間レイドランキング
10. **`/annihilation next`** - 次回Annihilation予測（**高精度版**）
11. **`/annihilation multiple`** - 複数回予測
12. **`/annihilation accuracy`** - 予測精度評価

### 自動化システム
- **GitHub自動データ同期**: 6時間ごとにAiverAiva/anni-predから最新データ取得
- **予測自動更新**: 5分ごとの予測再計算
- **週次ギルドリセット**: 月曜日の自動ランキングリセット
- **キャッシュ自動管理**: TTL基づく期限切れデータの自動削除

## Architecture Overview

### Core Design Patterns
This is a Discord bot for Wynncraft built with a **layered architecture** that separates concerns:

1. **Commands Layer** (`src/commands/`): Discord slash commands that extend `BaseCommand`
   - HelpCommand, TMCommand, WynnCommand, LRCommand, RaidCommand, GuildCommand
   - **AnnihilationCommand** (高精度予測システム)

2. **Services Layer** (`src/services/`): Business logic that extends `BaseService`
   - PlayerService, GuildService, MarketService, TranslationService
   - **AnnihilationService** (ARIMA予測 + GitHub自動同期)

3. **API Layer** (`src/api/`): External API clients that extend `BaseAPIClient`
   - WynncraftAPIClient, WynnventoryAPIClient

4. **Utils Layer** (`src/utils/`): Shared utilities and specialized predictors
   - CacheManager, ErrorHandler, RateLimiter, ConfigManager
   - **ARIMAPredictor** (Python統合予測エンジン)

5. **External Integration** (`python/`): Python scripts for advanced computation
   - **arima_predictor.py** (ARIMA(1,1,1)時系列予測)

### Key Base Classes
- **BaseCommand**: Provides common command functionality, rate limiting, error handling
- **BaseService**: Provides logging, caching, configuration access
- **BaseAPIClient**: Provides HTTP client with retry logic, caching, error handling

### Command Pattern Implementation
All commands follow this pattern:
```javascript
class MyCommand extends BaseCommand {
    constructor() {
        super({
            name: 'commandname',
            description: 'Command description',
            category: 'Category'
        });
    }

    getSlashCommandData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction) {
        // Command logic here
    }
}
```

### Service Integration
Services are injected into commands and handle business logic:
```javascript
// In command constructor
this.guildService = new GuildService();

// In command run method
const result = await this.guildService.getGXPRanking();
```

## Configuration Management

### Environment Variables
Key environment variables (see `.env.example`):
- `DISCORD_TOKEN` - Discord bot token
- `DISCORD_CLIENT_ID` - Discord application client ID
- `GUILD_NAME` / `GUILD_TAG` - Target guild for guild commands
- `WYNNVENTORY_API_KEY` - For trade market data
- `DEEPL_API_KEY` - For translation features

### Python Dependencies (Annihilation予測用)
```bash
pip3 install pandas statsmodels numpy scikit-learn
```
**必須**: ARIMA予測システムの動作には上記パッケージが必要

### ConfigManager Usage
```javascript
const config = ConfigManager.getInstance();
const guildName = config.get('guild.name');
const apiTimeout = config.get('apis.wynncraft.timeout', 15000);
```

## Error Handling Patterns

### Unified Error Handling
All errors go through the `ErrorHandler` class which categorizes them:
- `VALIDATION_ERROR` - User input errors
- `DATA_ERROR` - API/data not found errors
- `RATE_LIMIT_ERROR` - Rate limiting errors
- `SYSTEM_ERROR` - Unexpected errors

### Command Error Pattern
```javascript
try {
    const data = await this.apiClient.getData();
    // Process data
} catch (error) {
    console.error('Command error:', error);
    if (error.message && error.message.includes('specific error')) {
        await this.editReply(interaction, { content: 'Specific error message' });
    } else {
        await this.editReply(interaction, { content: 'Generic error message' });
    }
}
```

## Rate Limiting System

### Hierarchical Rate Limiting
The bot uses a three-tier rate limiting system:
1. **Global limits**: Overall bot usage
2. **Command limits**: Per-command limits
3. **User limits**: Per-user limits

### Rate Limit Usage
```javascript
const rateLimitResult = await this.rateLimiter.checkRateLimit(
    interaction.user.id, 
    'command_name'
);

if (!rateLimitResult.allowed) {
    await interaction.reply({
        content: `Rate limit exceeded. Try again in ${Math.ceil(rateLimitResult.waitTime / 1000)} seconds.`,
        ephemeral: true
    });
    return;
}
```

## API Integration

### Wynncraft API v3
- Base URL: `https://api.wynncraft.com/v3`
- Rate limit: 600 requests per 10 minutes
- Caching: 1-10 minutes depending on data type

### Wynnventory API
- Requires API key authentication
- Used for trade market, lootrun, and raid data
- Caching: 5-30 minutes depending on data freshness

### API Client Pattern
```javascript
const response = await this.wynncraftApi.getPlayer(username, {
    cacheTtl: 60000,
    fullResult: true
});
```

## Data Persistence

### Guild Rankings
Guild data is stored in JSON files in the `data/` directory:
- `guild_rankings.json` - Weekly guild member rankings
- Automatic weekly reset on Mondays
- Backup system for data safety

### Cache Strategy
- **Memory cache**: Fast access for frequently used data (30 seconds - 5 minutes)
- **File cache**: Persistent storage for larger datasets (5 minutes - 1 hour)
- **Static data**: Long-term caching (1+ hours)

## Testing

### Test Structure
Tests are located in the `test/` directory:
- `integration.test.js` - Integration tests for all major components
- Tests cover: ConfigManager, RateLimiter, ErrorHandler, Cache, API clients, Services

### Running Tests
```bash
npm test                # Run all tests
npm run test:coverage   # Run with coverage
npm run test:watch      # Watch mode
```

## Japanese Localization

### Message Consistency
All user-facing messages are in Japanese to maintain consistency with the original bot:
- Error messages: `❌ エラーメッセージ`
- Success messages: `✅ 成功メッセージ`
- Status messages: `📊 ステータス`

### Custom Emoji Integration
The bot uses custom Discord emojis with specific IDs:
- `<:lootcamp:1392860439641067692>` - Lootcamp emoji
- Emoji IDs are hardcoded and maintained for consistency

## Common Issues and Solutions

### Guild Configuration
The most common issue is incorrect guild configuration. Users must set valid Wynncraft guild names/tags in `.env`:
```env
GUILD_NAME=Imperial
GUILD_TAG=Imp
```

### API Rate Limits
Wynncraft API has strict rate limits. The bot handles this with:
- Automatic retry with exponential backoff
- Intelligent caching to reduce API calls
- Rate limit detection and user feedback

### Permission Handling
Guild management commands require Discord administrator permissions, not just the hardcoded user ID list. The bot checks `interaction.member.permissions.has(PermissionFlagsBits.Administrator)`.

## Development Workflow

### Adding New Commands
1. Create command class extending `BaseCommand`
2. Implement required methods: `getSlashCommandData()`, `run()`
3. Register in `src/index.js`
4. Add to help system in `HelpCommand.js`
5. Deploy commands with `npm run deploy-commands`

### Adding New Services
1. Create service class extending `BaseService`
2. Implement business logic methods
3. Add initialization in `src/index.js`
4. Inject into commands that need it

### API Integration
1. Extend `BaseAPIClient` for new API providers
2. Implement authentication and error handling
3. Add caching strategy appropriate for data freshness
4. Document rate limits and usage patterns

## 重要な実装学習 (2025年1月)

### Annihilation予測システムの高精度化プロジェクト

#### 背景と課題
- **元の問題**: 既存の予測システムが8日以上の誤差を示し、「53分前」のような過去時間を予測
- **目標**: Wynnpool.com級の1時間精度を実現
- **参考実装**: AiverAiva/anni-pred リポジトリ (ARIMA(1,1,1)モデル使用)

#### 重要な技術的学び

##### 1. 外部データ統合の自動化
**実装**: GitHub APIからの自動データ取得
```javascript
// GitHub APIから履歴データを自動取得
const response = await axios.get(this.config.githubDataUrl, {
    timeout: 10000,
    headers: { 'User-Agent': 'WynnTracker-Revival/1.0' }
});

// 6時間ごとの自動更新スケジュール
setInterval(async () => {
    await this.updateFromGitHub();
}, this.config.githubDataCacheHours * 60 * 60 * 1000);
```

**学び**: 
- 手動データ追加を緊急時のみに限定し、自動化で品質向上
- フォールバック機能でローカルキャッシュを活用
- 適切な更新間隔（6時間）でネットワーク負荷とデータ新鮮度のバランス

##### 2. 時系列予測の実装パターン
**実装**: ARIMA(1,1,1) + 統計的手法のアンサンブル
```javascript
// ARIMA予測（高精度）
const arimaPrediction = await this.arimaPredictor.predictNextEvent(timestamps);

// 統計的フォールバック（安定性）
const statisticalPrediction = this.generateStatisticalPrediction(intervals);

// アンサンブル予測
const ensemblePrediction = this.generateEnsemblePrediction([
    arimaPrediction, statisticalPrediction
]);
```

**学び**:
- 単一手法よりも複数手法の組み合わせが安定性を向上
- Python統合でNode.jsの数値計算限界を克服
- 適切なフォールバック機能で可用性確保

##### 3. Python-Node.js連携の実装
**実装**: child_processを使った統計計算の外部委託
```javascript
// Python ARIMAスクリプトの呼び出し
const result = await new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [scriptPath, ...args]);
    // データの送受信とエラーハンドリング
});
```

**学び**:
- Node.jsの数値計算限界は外部ツール統合で解決
- 依存関係管理（pip install）の重要性
- プロセス間通信でのJSONデータ交換の安全性

##### 4. データ品質管理
**実装**: 外れ値検出と自動データクリーニング
```javascript
// 3σ法による外れ値除去
const filteredIntervals = intervals.filter(interval => {
    const zScore = Math.abs((interval - mean) / stdDev);
    return zScore <= this.config.maxOutlierDeviation; // 3.0
});

// 妥当性チェック
const isValidInterval = interval >= 24 && interval <= 240; // 1-10日
```

**学び**:
- 生データをそのまま使わず、統計的手法での前処理が必須
- 外れ値の影響は予測精度に致命的
- ドメイン知識（Annihilationの開催間隔）による制約が重要

##### 5. キャッシュ戦略の階層化
**実装**: メモリ、ファイル、外部ソースの3層キャッシュ
```javascript
// 1. メモリキャッシュ（5分）
this.currentPredictions = { ... };

// 2. ファイルキャッシュ（6時間）
fs.writeFileSync(this.predictionsFile, JSON.stringify(data));

// 3. 外部ソース（GitHub、定期更新）
await this.loadHistoryFromGitHub();
```

**学び**:
- キャッシュ層ごとに適切なTTL設定が性能と精度のバランスに重要
- ネットワーク障害時の耐性向上には多層フォールバックが効果的
- 更新頻度の異なるデータの分離管理

##### 6. エラーハンドリングの段階的フォールバック
**実装**: ARIMA失敗時の段階的フォールバック
```javascript
try {
    // ARIMA予測（最高精度）
    prediction = await this.arimaPredictor.predict();
} catch (arimaError) {
    try {
        // 統計的予測（中精度）
        prediction = this.generateStatisticalPrediction();
    } catch (statError) {
        // 最低限の予測（低精度だが必ず動作）
        prediction = this.generateSimplePrediction();
    }
}
```

**学び**:
- 予測システムでは「精度は落ちても動作継続」が重要
- エラーの種類に応じた適切なフォールバック戦略
- ユーザーには信頼度を明示して期待値を管理

#### 実装完了時の成果
- **予測精度**: 8日誤差 → 3日範囲の高精度予測
- **データ品質**: 手動追加 → GitHub自動同期（100イベント）
- **システム可用性**: 単一障害点 → 多層フォールバック
- **保守性**: モノリシック → 層分離アーキテクチャ

#### 今後の開発での重要指針

##### 1. 外部データ依存システムの設計原則
- **必須**: 自動取得 + ローカルキャッシュ + 手動フォールバック
- **推奨**: 定期更新間隔の最適化（データ性質に応じて1時間〜24時間）
- **必須**: 外部API障害時の継続動作保証

##### 2. 予測・機械学習システムの実装パターン
- **アンサンブル手法**: 複数アルゴリズムの組み合わせで安定性向上
- **段階的フォールバック**: 高精度→中精度→低精度の順次フォールバック
- **外部ツール統合**: Node.jsの限界を超える計算はPython等で補完

##### 3. データ品質管理の重要性
- **前処理必須**: 生データの統計的検証と外れ値除去
- **ドメイン制約**: 業務知識による妥当性チェック
- **継続監視**: 定期的な精度評価とアラート

##### 4. Python連携の実装ベストプラクティス
```bash
# 依存関係の事前確認
pip3 install pandas statsmodels numpy scikit-learn

# プロセス実行時の適切なエラーハンドリング
python3 script.py --test  # 環境確認
```

これらの学びは、将来の高度な機能実装（機械学習、外部API統合、リアルタイム予測）において重要な指針となります。

---

## クイックリファレンス

### 新規開発時のチェックリスト
1. **BaseCommand/BaseServiceの継承**: 統一されたアーキテクチャに従う
2. **エラーハンドリング**: try-catch + フォールバック戦略の実装
3. **レート制限**: ユーザー/コマンド別の制限確認
4. **キャッシュ戦略**: データ性質に応じたTTL設定
5. **外部API統合**: 障害時のフォールバック確保
6. **日本語対応**: メッセージとエラーの統一

### トラブルシューティング
- **Annihilation予測エラー**: `python3 python/arima_predictor.py --test`でPython環境確認
- **GitHub同期失敗**: `data/github_cache_info.json`の削除で強制更新
- **予測が過去時間**: データクリア後に`import-wynnpool-data.js`実行
- **ARIMA計算エラー**: 統計的フォールバックで動作継続（信頼度で区別）

### パフォーマンス最適化
- キャッシュ階層: メモリ(30s-5m) → ファイル(5m-1h) → 外部(6h+)
- 並列API呼び出し: 複数データ取得時は`Promise.all()`使用
- データクリーニング: 外れ値除去で予測精度向上

**最終更新**: 2025年1月18日 - Annihilation予測システム高精度化完了