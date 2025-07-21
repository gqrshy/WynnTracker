# WynnTracker Bot コマンドリファクタリング設計書

## 概要

本設計書では、WynnTracker Botの既存コマンドシステムをより保守性が高く、拡張性のあるアーキテクチャにリファクタリングするための設計を定義します。レイヤードアーキテクチャとDependency Injectionパターンを採用し、テスタビリティと再利用性を向上させます。

## アーキテクチャ概要

### 現在のアーキテクチャの問題点

1. **モノリシックなコマンドファイル**: 各コマンドファイルが大きく（guild.js: 774行）、複数の責任を持っている
2. **コードの重複**: エラーハンドリング、レート制限、キャッシュ処理が各コマンドで重複
3. **密結合**: 外部API呼び出し、データ処理、表示ロジックが混在
4. **テストの困難さ**: 依存関係が複雑でユニットテストが困難

### 新しいアーキテクチャ

```
src/
├── commands/           # コマンドハンドラー（薄いレイヤー）
├── services/          # ビジネスロジック
├── repositories/      # データアクセス層
├── models/           # データモデル
├── utils/            # 共通ユーティリティ
├── middleware/       # 共通ミドルウェア
└── config/           # 設定管理
```

## コンポーネント設計

### 1. Command Layer（コマンド層）

**責任**: Discord.jsとの統合、入力バリデーション、レスポンス整形

```typescript
// 例: AnniCommand
class AnniCommand {
    constructor(
        private anniService: AnniService,
        private validator: CommandValidator,
        private responseFormatter: ResponseFormatter
    ) {}
    
    async execute(interaction: CommandInteraction) {
        // 1. 入力バリデーション
        // 2. サービス層呼び出し
        // 3. レスポンス整形
        // 4. エラーハンドリング
    }
}
```

### 2. Service Layer（サービス層）

**責任**: ビジネスロジック、複数のリポジトリの調整

```typescript
// 例: AnniService
class AnniService {
    constructor(
        private anniRepository: AnniRepository,
        private predictionEngine: PredictionEngine,
        private cacheService: CacheService
    ) {}
    
    async getPrediction(): Promise<AnnihilationPrediction> {
        // ビジネスロジック実装
    }
    
    async recordEvent(event: AnnihilationEvent): Promise<void> {
        // イベント記録ロジック
    }
}
```

### 3. Repository Layer（リポジトリ層）

**責任**: データアクセス、外部API呼び出し、キャッシュ管理

```typescript
// 例: WynncraftRepository
class WynncraftRepository {
    constructor(
        private httpClient: HttpClient,
        private cacheService: CacheService,
        private rateLimiter: RateLimiter
    ) {}
    
    async getPlayerStats(mcid: string): Promise<PlayerStats> {
        // API呼び出し、キャッシュ、レート制限処理
    }
}
```

### 4. Model Layer（モデル層）

**責任**: データ構造の定義、バリデーション

```typescript
// 例: PlayerStats
export interface PlayerStats {
    uuid: string;
    username: string;
    online: boolean;
    characters: Character[];
    guild?: GuildInfo;
}

export class PlayerStatsModel {
    static validate(data: any): PlayerStats {
        // バリデーションロジック
    }
}
```

## 共通コンポーネント設計

### 1. Middleware System

#### RateLimitMiddleware
```typescript
class RateLimitMiddleware {
    async execute(context: CommandContext, next: () => Promise<void>) {
        const rateLimitCheck = this.rateLimiter.canUseCommand(
            context.userId, 
            context.commandName
        );
        
        if (!rateLimitCheck.allowed) {
            throw new RateLimitError(rateLimitCheck.waitTime);
        }
        
        await next();
    }
}
```

#### AuthorizationMiddleware
```typescript
class AuthorizationMiddleware {
    async execute(context: CommandContext, next: () => Promise<void>) {
        if (context.requiresAdmin && !context.isAdmin) {
            throw new UnauthorizedError();
        }
        
        await next();
    }
}
```

#### ErrorHandlingMiddleware
```typescript
class ErrorHandlingMiddleware {
    async execute(context: CommandContext, next: () => Promise<void>) {
        try {
            await next();
        } catch (error) {
            await this.handleError(error, context);
        }
    }
}
```

### 2. Cache Service

```typescript
class CacheService {
    private cache: Map<string, CacheEntry> = new Map();
    
    async get<T>(key: string): Promise<T | null> {
        const entry = this.cache.get(key);
        if (entry && !this.isExpired(entry)) {
            return entry.data;
        }
        return null;
    }
    
    async set<T>(key: string, data: T, ttl: number): Promise<void> {
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttl
        });
    }
}
```

### 3. HTTP Client

```typescript
class HttpClient {
    constructor(
        private rateLimiter: RateLimiter,
        private retryPolicy: RetryPolicy
    ) {}
    
    async get<T>(url: string, options?: RequestOptions): Promise<T> {
        await this.rateLimiter.waitIfNeeded();
        
        return this.retryPolicy.execute(async () => {
            const response = await axios.get(url, options);
            return response.data;
        });
    }
}
```

## データモデル設計

### 1. Annihilation関連

```typescript
export interface AnnihilationEvent {
    id: string;
    timestamp: Date;
    server: 'asia' | 'eu' | 'us';
    downtime: boolean;
    confidence: number;
    source: string;
}

export interface AnnihilationPrediction {
    predictedTime: Date;
    confidence: number;
    method: string;
    sources: string[];
    agreement: number;
}
```

### 2. Guild関連

```typescript
export interface GuildMember {
    uuid: string;
    username: string;
    contributed: number;
    contributionRank: number;
    wars: number;
    raids: RaidStats;
    joined: Date;
    rank: string;
}

export interface GuildRanking {
    week: {
        start: Date;
        end: Date;
    };
    gxpRankings: GuildMemberRanking[];
    raidRankings: GuildMemberRanking[];
}
```

### 3. Player関連

```typescript
export interface PlayerStats {
    uuid: string;
    username: string;
    online: boolean;
    server?: string;
    rank: string;
    supportRank?: string;
    playtime: number;
    firstJoin: Date;
    lastJoin: Date;
    characters: Character[];
    guild?: GuildInfo;
    globalData: GlobalData;
}

export interface Character {
    uuid: string;
    type: string;
    level: number;
    xp: number;
    xpPercent: number;
    wars: number;
    playtime: number;
}
```

## エラーハンドリング設計

### エラー階層

```typescript
abstract class AppError extends Error {
    abstract statusCode: number;
    abstract isOperational: boolean;
}

class ValidationError extends AppError {
    statusCode = 400;
    isOperational = true;
}

class RateLimitError extends AppError {
    statusCode = 429;
    isOperational = true;
    
    constructor(public waitTime: number) {
        super(`Rate limit exceeded. Wait ${waitTime} seconds.`);
    }
}

class ExternalAPIError extends AppError {
    statusCode = 502;
    isOperational = true;
}
```

### エラーハンドラー

```typescript
class ErrorHandler {
    static async handleCommandError(
        error: Error, 
        context: CommandContext
    ): Promise<void> {
        if (error instanceof RateLimitError) {
            await context.reply({
                content: `⏳ このコマンドは制限されています。${error.waitTime}秒後に再試行してください。`,
                ephemeral: true
            });
        } else if (error instanceof ValidationError) {
            await context.reply({
                content: `❌ 入力エラー: ${error.message}`,
                ephemeral: true
            });
        } else {
            // 予期しないエラー
            console.error('Unexpected error:', error);
            await context.reply({
                content: '❌ 予期しないエラーが発生しました。',
                ephemeral: true
            });
        }
    }
}
```

## 設定管理設計

### 設定構造

```typescript
export interface AppConfig {
    discord: {
        token: string;
        clientId: string;
        guildId: string;
    };
    apis: {
        wynncraft: {
            baseUrl: string;
            timeout: number;
        };
        wynnventory: {
            baseUrl: string;
            apiKey: string;
            timeout: number;
        };
        deepl: {
            apiKey: string;
            timeout: number;
        };
    };
    cache: {
        defaultTTL: number;
        maxSize: number;
    };
    rateLimits: {
        [commandName: string]: {
            interval: number;
            maxRequests: number;
        };
    };
}
```

### 設定管理クラス

```typescript
class ConfigManager {
    private static instance: ConfigManager;
    private config: AppConfig;
    
    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    
    getConfig(): AppConfig {
        if (!this.config) {
            this.config = this.loadConfig();
        }
        return this.config;
    }
    
    private loadConfig(): AppConfig {
        // 環境変数とデフォルト値から設定を構築
    }
}
```

## テスト戦略

### 1. ユニットテスト

各レイヤーを独立してテスト

```typescript
describe('AnniService', () => {
    let anniService: AnniService;
    let mockRepository: jest.Mocked<AnniRepository>;
    let mockPredictionEngine: jest.Mocked<PredictionEngine>;
    
    beforeEach(() => {
        mockRepository = createMockRepository();
        mockPredictionEngine = createMockPredictionEngine();
        anniService = new AnniService(mockRepository, mockPredictionEngine);
    });
    
    it('should return prediction when data is available', async () => {
        // テスト実装
    });
});
```

### 2. 統合テスト

複数のコンポーネント間の連携をテスト

```typescript
describe('AnniCommand Integration', () => {
    let app: TestApplication;
    
    beforeEach(async () => {
        app = await createTestApplication();
    });
    
    it('should handle anni timer command', async () => {
        const interaction = createMockInteraction('/anni timer');
        await app.handleCommand(interaction);
        // アサーション
    });
});
```

## パフォーマンス最適化

### 1. キャッシュ戦略

- **L1キャッシュ**: メモリ内キャッシュ（短期間、高速アクセス）
- **L2キャッシュ**: ファイルベースキャッシュ（長期間、永続化）

### 2. バッチ処理

```typescript
class BatchProcessor<T> {
    private queue: T[] = [];
    private timer: NodeJS.Timeout | null = null;
    
    add(item: T): void {
        this.queue.push(item);
        this.scheduleProcess();
    }
    
    private scheduleProcess(): void {
        if (this.timer) return;
        
        this.timer = setTimeout(() => {
            this.processBatch();
            this.timer = null;
        }, 100); // 100ms後にバッチ処理
    }
}
```

### 3. 並列処理

```typescript
class ParallelProcessor {
    async processInParallel<T, R>(
        items: T[], 
        processor: (item: T) => Promise<R>,
        concurrency: number = 5
    ): Promise<R[]> {
        const results: R[] = [];
        
        for (let i = 0; i < items.length; i += concurrency) {
            const batch = items.slice(i, i + concurrency);
            const batchResults = await Promise.all(
                batch.map(processor)
            );
            results.push(...batchResults);
        }
        
        return results;
    }
}
```

## セキュリティ設計

### 1. 入力バリデーション

```typescript
class InputValidator {
    static validateMCID(mcid: string): void {
        if (!mcid || mcid.length < 3 || mcid.length > 16) {
            throw new ValidationError('Invalid Minecraft ID');
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(mcid)) {
            throw new ValidationError('Minecraft ID contains invalid characters');
        }
    }
}
```

### 2. レート制限

```typescript
class RateLimiter {
    private limits: Map<string, RateLimit> = new Map();
    
    canUseCommand(userId: string, command: string): RateLimitResult {
        const key = `${userId}:${command}`;
        const limit = this.limits.get(key);
        
        if (!limit) {
            this.limits.set(key, new RateLimit());
            return { allowed: true };
        }
        
        return limit.check();
    }
}
```

## 移行戦略

### フェーズ1: 基盤構築
1. 共通コンポーネント（Cache, HttpClient, ErrorHandler）の実装
2. 設定管理システムの構築
3. テスト環境の整備

### フェーズ2: コマンド移行
1. 小さなコマンド（help, wynn）から開始
2. 中規模コマンド（lr, raid, tm）の移行
3. 大規模コマンド（guild, anni, translate）の移行

### フェーズ3: 最適化
1. パフォーマンス最適化
2. 監視・ログ機能の追加
3. ドキュメント整備

## 監視・ログ設計

### ログレベル

```typescript
enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}

class Logger {
    static error(message: string, error?: Error): void {
        console.error(`[ERROR] ${message}`, error);
    }
    
    static info(message: string, data?: any): void {
        console.log(`[INFO] ${message}`, data);
    }
}
```

### メトリクス収集

```typescript
class MetricsCollector {
    private metrics: Map<string, number> = new Map();
    
    increment(metric: string): void {
        const current = this.metrics.get(metric) || 0;
        this.metrics.set(metric, current + 1);
    }
    
    getMetrics(): Record<string, number> {
        return Object.fromEntries(this.metrics);
    }
}
```

この設計により、保守性、拡張性、テスタビリティが大幅に向上し、新機能の追加や既存機能の修正が容易になります。