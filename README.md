# WynnTracker Revival

A comprehensive Discord bot for Wynncraft players and guilds, completely redesigned with modern architecture and enhanced features.

## Features

### 🎮 Player Statistics
- Comprehensive player profile lookup
- Character information and statistics
- Guild membership details
- PvP and PvE statistics
- Dungeon and raid completion tracking

### 🏛️ Guild Management
- Guild information and statistics
- Member rankings (total and weekly)
- Contribution tracking
- Territory management
- Historical data analysis

### ⚔️ Annihilation Predictions
- AI-powered event prediction using ARIMA models
- Smart countdown timers
- Event verification system
- Historical event tracking
- Multiple prediction sources

### 🛒 Market Analysis
- Trade market search and filtering
- Mythic item pricing
- Price trend analysis
- Market statistics
- Item comparison tools

### 🌐 Translation System
- Real-time message translation
- Auto-translation for channels
- Reaction-based translation
- Support for 10+ languages
- Intelligent caching

### 📊 Data Visualization
- Interactive progress bars
- Statistical charts
- Ranking displays
- Trend analysis
- Performance metrics

## Architecture

WynnTracker Revival is built with a clean, layered architecture:

```
├── src/
│   ├── commands/          # Discord slash commands
│   ├── services/          # Business logic layer
│   ├── api/              # External API clients
│   ├── models/           # Data models
│   ├── utils/            # Utility functions
│   ├── config/           # Configuration management
│   └── data/             # Data storage
```

### Key Components

- **ConfigManager**: Centralized configuration with validation
- **ErrorHandler**: Unified error handling and user-friendly messages
- **RateLimiter**: Hierarchical rate limiting (global, command, user)
- **CacheManager**: Memory and file-based caching with TTL
- **BaseService**: Common service functionality and patterns
- **BaseCommand**: Shared command features and validation

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- Discord Bot Token
- DeepL API Key (optional, for translation features)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/WynnTracker_Revival.git
   cd WynnTracker_Revival
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Deploy commands:
   ```bash
   npm run deploy-commands
   ```

5. Start the bot:
   ```bash
   npm start
   ```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Discord bot token | Yes |
| `DISCORD_CLIENT_ID` | Discord application client ID | Yes |
| `DISCORD_GUILD_ID` | Guild ID for testing (optional) | No |
| `DEEPL_API_KEY` | DeepL API key for translation | No |
| `NODE_ENV` | Environment (development/production) | No |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | No |
| `CACHE_TTL` | Default cache TTL in milliseconds | No |
| `RATE_LIMIT_WINDOW` | Rate limit window in milliseconds | No |

### Advanced Configuration

The bot supports advanced configuration through the `ConfigManager`:

```javascript
const config = ConfigManager.getInstance();

// Get configuration values
const apiTimeout = config.get('apis.wynncraft.timeout');
const cacheSettings = config.get('cache');

// Set configuration values
config.set('rateLimiting.maxRequests', 20);
```

## Commands

### Player Commands

- `/wynn <player>` - Get comprehensive player statistics
- `/wynn <player> format:compact` - Get compact player overview
- `/wynn <player> format:stats` - Get statistics only

### Guild Commands

- `/guild info <guild>` - Get guild information
- `/guild rankings <guild>` - Get member rankings
- `/guild member <guild> <player>` - Get specific member info
- `/guild stats <guild>` - Get detailed guild statistics
- `/guild track <guild>` - Start tracking a guild (Admin only)

### Annihilation Commands

- `/anni timer` - Show countdown timers
- `/anni predict <server>` - Generate predictions
- `/anni add <server> <time>` - Add new event
- `/anni verify <event_id>` - Verify event occurred
- `/anni history` - Show recent events
- `/anni stats` - Show event statistics

### Market Commands

- `/market search <query>` - Search trade market
- `/market item <name>` - Get item pricing
- `/market mythics` - Get mythic prices
- `/market trends <item>` - Show price trends
- `/market compare <item1> <item2>` - Compare items

### Translation Commands

- `/translate <text> <language>` - Translate text
- `/translate setup <channel>` - Configure auto-translation
- `/translate disable <channel>` - Disable auto-translation

## API Integration

### Wynncraft API v3
- Player statistics and profiles
- Guild information and members
- Server status and online players
- Leaderboards and rankings

### Wynnventory API
- Trade market data
- Lootrun information
- Raid aspects and gambits
- Mythic item pricing

### DeepL API
- High-quality text translation
- Language detection
- Batch translation support
- Usage monitoring

## Data Models

### Player Model
Represents a Wynncraft player with:
- Basic profile information
- Character statistics
- Guild membership
- Combat statistics
- Completion tracking

### Guild Model
Represents a guild with:
- Basic guild information
- Member management
- Contribution tracking
- Territory management
- Statistical analysis

### AnniEvent Model
Represents an Annihilation event with:
- Event timing and details
- Confidence and verification
- Source tracking
- Accuracy measurement

### Prediction Model
Represents AI predictions with:
- Prediction algorithms
- Confidence scoring
- Source aggregation
- Accuracy tracking

## Error Handling

The bot implements comprehensive error handling:

- **Categorized Errors**: Different error types with appropriate responses
- **User-Friendly Messages**: Clear, actionable error messages
- **Logging**: Detailed error logging for debugging
- **Graceful Degradation**: Continues operation when possible
- **Rate Limit Handling**: Automatic retry with backoff

## Caching Strategy

Multi-level caching for optimal performance:

- **Memory Cache**: Fast access for frequently used data
- **File Cache**: Persistent storage for larger datasets
- **TTL Management**: Automatic cache expiration
- **Cache Invalidation**: Smart cache updating

## Rate Limiting

Hierarchical rate limiting system:

- **Global Limits**: Overall bot usage limits
- **Command Limits**: Per-command rate limits
- **User Limits**: Per-user rate limits
- **Adaptive Limits**: Dynamic adjustment based on load

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Original WynnTracker developers
- Wynncraft community
- Discord.js library maintainers
- All contributors and testers

## Support

For support, questions, or feature requests:

- Open an issue on GitHub
- Join our Discord server
- Check the documentation

---

**WynnTracker Revival** - Bringing Wynncraft data to Discord with modern architecture and enhanced features.