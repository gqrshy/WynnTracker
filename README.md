# WynnTracker

<div align="center">
  <h3>Advanced Discord Bot for Wynncraft Community Management</h3>
  <p>A comprehensive Discord bot for tracking Wynncraft player statistics, Annihilation events, guild management, and market analysis with AI-powered predictions.</p>
</div>

## 🛠 Tech Stack

<p align="center">
  <img src="https://img.shields.io/badge/-Node.js-339933.svg?logo=node.js&style=for-the-badge&logoColor=white">
  <img src="https://img.shields.io/badge/-Discord.js-5865F2.svg?logo=discord&style=for-the-badge&logoColor=white">
  <img src="https://img.shields.io/badge/-Python-3776AB.svg?logo=python&style=for-the-badge&logoColor=white">
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E.svg?logo=javascript&style=for-the-badge&logoColor=black">
  <img src="https://img.shields.io/badge/-Puppeteer-40B5A4.svg?logo=puppeteer&style=for-the-badge&logoColor=white">
</p>

## ✨ Features

### Annihilation Event Tracking
- **AI Prediction System**: ARIMA model-based next event time prediction
- **Smart Countdown**: Automatic timers with confidence ratings
- **Manual Timer Support**: Traditional tracking methods
- **Alert Notifications**: Role mention notifications
- **Historical Analysis**: Past event data tracking and analysis
- **Timezone Support**: JST/UTC compatibility

### Guild Management
- **Member Rankings**: Track guild member statistics and rankings
- **Weekly Ranking System**: Automatic reset functionality
- **Experience Tracking**: XP progress and leaderboards
- **Wynncraft API v3 Integration**: Real-time data synchronization
- **SKJ Guild Specialized**: Optimized for "Just Here After Work" guild

### Player Statistics
- **Comprehensive Player Stats**: Detailed player information display
- **Level Progress Visualization**: Visual progress bars
- **Playtime Tracking**: Monitor player activity
- **Character Class Information**: Class-specific data
- **Wynncraft Player API Integration**: Live player data

### Market Analysis
- **Trade Market Search**: Wynncraft marketplace integration
- **Multi-Currency Support**: Emeralds, EB, LE, STX pricing
- **Rarity Display**: Custom Discord emoji for item rarities
- **Real-time Market Data**: Wynnventory API integration

### Lootrun Information
- **Loot Pool Information**: Detailed camp route data
- **Mythic Item Pricing**: Price rankings and analysis
- **Market Value Analysis**: Comprehensive pricing insights
- **Weekly Raid Aspect Pools**: Different rarity support (Mythic, Fabled, Legendary)

### Translation Support
- **Bilingual Support**: Japanese/English language support
- **Message Translation**: Real-time translation capabilities
- **Language Settings Management**: User preference storage

### Help System
- **Interactive Paginated Menus**: Easy navigation
- **Detailed Command Documentation**: Comprehensive guides
- **Admin-only Command Sections**: Permission-based access

## 🚦 Command Status

### ✅ Fully Operational Commands
- **`help` commands** - Interactive help system with pagination
- **`wynn` commands** - Player statistics and information
- **`raid` commands** - Raid information and weekly pools
- **`lr` commands** - Lootrun data and market analysis

### 🧪 Testing Phase Commands
- **`anni` commands** - Annihilation event tracking
  - **Known Issue**: ARIMA model predictions have ~1 hour accuracy variance
  - **Status**: Not yet production-ready

- **`tm` commands** - Trade market search
  - **Known Issues**: Style integration incomplete, insufficient testing
  - **Status**: Feature development in progress

- **`translate` commands** - Translation functionality
  - **Status**: Redis implementation planned, private bot features in development

- **`guild` commands** - Guild management system
  - **Limitation**: Currently optimized only for "[SKJ] Just Here After Work" guild
  - **Status**: Expanding compatibility for other guilds

## 📁 Project Structure

```
WynnTracker/
├── index.js                    # Main bot entry point
├── config.js                   # Configuration management
├── commands/                   # Slash command modules
│   ├── anni.js                # Annihilation tracking
│   ├── guild.js               # Guild management
│   ├── help.js                # Help system
│   ├── lr.js                  # Lootrun commands
│   ├── raid.js                # Raid information
│   ├── tm.js                  # Trade market search
│   ├── translate.js           # Translation features
│   └── wynn.js                # Player statistics
├── data/                      # Persistent data storage
│   ├── anni_history.json
│   ├── annihilation.json
│   ├── aspects.json
│   ├── gambits.json
│   ├── guild_rankings.json
│   ├── prediction_cache.json
│   └── translate_settings.json
├── python/                    # Python ML integration
│   └── arima_predictor.py
└── utils/                     # Utility modules
    ├── anniPredictionEngine.js
    ├── autoSyncSystem.js
    ├── configManager.js
    ├── dataCache.js
    ├── errorHandler.js
    ├── pythonBridge.js
    ├── rateLimiter.js
    └── wynncraft-api.js
```

## 📋 Prerequisites

- **Node.js** v16.9.0 or higher
- **Python** 3.8+ (for AI prediction system)
- **Discord Bot Application** with appropriate permissions
- **Git** (for cloning the repository)

### Required Python Packages
- `pandas` - Data manipulation and analysis
- `statsmodels` - ARIMA statistical modeling
- `numpy` - Numerical computing

### Optional API Keys
- **Wynnventory API Key** - Enhanced trade market functionality
- **DeepL API Key** - High-quality translation service

## 🚀 Installation

### 1. Clone Repository
```bash
git clone https://github.com/gqrshy/WynnTracker.git
cd WynnTracker
```

### 2. Install Node.js Dependencies
```bash
npm install
```

### 3. Install Python Dependencies
```bash
# Using the provided script (recommended)
chmod +x install_python_deps.sh
./install_python_deps.sh

# Or install manually
pip3 install pandas statsmodels numpy
```

### 4. Environment Setup
Create a `.env` file in the root directory:

```env
# Required Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_application_client_id
GUILD_ID=your_target_guild_id

# Optional API Keys (for enhanced functionality)
WYNNVENTORY_API_KEY=your_wynnventory_api_key
DEEPL_API_KEY=your_deepl_api_key
```

**Environment Variables Explained:**

| Variable | Required | Description | How to Obtain |
|----------|----------|-------------|---------------|
| `DISCORD_TOKEN` | ✅ Yes | Discord bot token | [Discord Developer Portal](https://discord.com/developers/applications) → Your App → Bot → Token |
| `CLIENT_ID` | ✅ Yes | Discord application client ID | [Discord Developer Portal](https://discord.com/developers/applications) → Your App → General Information → Application ID |
| `GUILD_ID` | ✅ Yes | Target Discord server ID | Enable Developer Mode → Right-click your server → Copy Server ID |
| `WYNNVENTORY_API_KEY` | ❌ Optional | Wynnventory API access | [Wynnventory Discord](https://discord.gg/rQ3wS5hZME) → Request API access |
| `DEEPL_API_KEY` | ❌ Optional | DeepL translation API | [DeepL Pro](https://www.deepl.com/pro-api) → Create API key |

### 5. Start the Bot
```bash
npm start
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DISCORD_TOKEN` | Discord bot token | ✅ Yes | - |
| `CLIENT_ID` | Discord application client ID | ✅ Yes | - |
| `GUILD_ID` | Target Discord guild ID | ✅ Yes | - |
| `WYNNVENTORY_API_KEY` | Wynnventory API key for trade market | ❌ Optional | - |
| `DEEPL_API_KEY` | DeepL API key for translation | ❌ Optional | Free tier available |

### Bot Configuration

The `config.js` file manages environment variables and allows:
- Discord bot authentication
- API endpoint configuration
- External service integration
- Rate limiting compliance

### Additional Configuration Files

- `config/translation.json` - Translation service settings
- `data/` directory - Persistent data storage for:
  - Guild rankings (`guild_rankings.json`)
  - Annihilation history (`anni_history.json`)
  - Translation settings (`translate_settings.json`)
  - Prediction cache (`prediction_cache.json`)

## 🎮 Usage

#### General User Commands

```bash
# Display help menu
/help

# Player statistics and information
/wynn stats mcid:<Minecraft_ID>

# Trade Market search
/tm search item:<item_name> [unidentified:<true/false>]

# Lootrun information
/lr lootpool [page:<1-10>] [camp:<COTL/CP/MH/SI/SE>]
/lr mythranking

# Raid information
/raid aspectpool [rarity:<mythic/fabled/legendary>] [language:<ja/en>]

# Guild rankings (view only)
/guild gxp ranking
/guild raid ranking

# Text translation (DeepL API powered)
/translate text text:<text_to_translate> [to:<language>] [from:<language>]
/translate status
/translate metrics
/translate health
```

#### Administrator Commands

```bash
# AI-powered Annihilation timer management
/anni timer [timezone:<jst/utc/both>]
/anni predict
/anni history [action:<show/reset>] [confirm:<true>]
/anni record datetime:<YYYY-MM-DD HH:MM:SS> server:<asia/eu/us> [downtime:<true/false>]
/anni debug

# Guild management
/guild rank set

# Translation system management
/translate auto enabled:<true/false> [channel:<channel>] [target:<EN-US/JA>]
/translate cache action:<clear/stats>
/translate reload
```

### 📚 Command Details

#### `/anni` - AI-Powered Annihilation Timer System
- **timer**: ARIMA model + deep learning hybrid prediction system
- **predict**: Multi-method next event prediction
- **history**: Historical event data management
- **record**: Manual event occurrence recording
- **debug**: Prediction system internal state display

#### `/guild` - Guild Management System (SKJ-optimized)
- **rank set**: Record current guild member statistics
- **gxp ranking**: Weekly GXP ranking display
- **raid ranking**: Weekly raid ranking display

#### `/lr` - Lootrun Information System
- **lootpool**: Detailed camp loot pool information
- **mythranking**: Mythic item market price rankings

#### `/raid` - Raid Information System
- **aspectpool**: Weekly raid aspect information (multilingual support)

#### `/tm` - Trade Market Search
- **search**: Real-time market search using Wynnventory API

#### `/translate` - High-Performance Translation System
- **text**: High-accuracy translation via DeepL API
- **auto**: Channel-specific automatic translation setup
- **status/metrics/health**: System monitoring functions

#### `/wynn` - Player Statistics System
- **stats**: Detailed player information via Wynncraft API v3

### 🔒 Permissions & Rate Limits

- **Admin Only**: `/anni` (all functions), selected `/guild` and `/translate` management functions
- **Rate Limits**: Appropriate limits set for each command (30 seconds to 5 minutes intervals)
- **API Limits**: Compliant with external API restrictions (Wynncraft, Wynnventory, DeepL)

## 🔌 API Integration

### External APIs
- **[Wynncraft Official API v3](https://docs.wynncraft.com/)** - Player and guild data
- **[Wynnventory API](https://wynnventory.com/)** - Market data and pricing
- **Custom Prediction Endpoints** - AI prediction data
- **GitHub-hosted Static Assets** - Images and resources

### Data Sources
- Real-time player statistics
- Live market pricing data
- Historical event tracking
- Guild member analytics

## 📄 License

This project is licensed under the **GNU General Public License (GPL)**. 

**You are free to use this code**, but any modifications must be distributed under the same GPL license.
This ensures that improvements and modifications remain open source and benefit the entire community.

For more details, see the [LICENSE](LICENSE) file in this repository.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 🙏 Acknowledgments

- **[Wynncraft Official API](https://docs.wynncraft.com/docs/)** - Player statistics integration
- **[nori.fish](https://nori.fish/)** - Inspiration for design and features
- **[wynnpool.com](https://www.wynnpool.com/annihilation)** - Annihilation tracking inspiration
- **Wynncraft Community** - Continuous feedback and support

## 📞 Support

If you encounter any issues or have questions, please [create an issue](https://github.com/gqrshy/WynnTracker/issues) on GitHub.

---

<div align="center">
  <p>Made with ❤️ for the Wynncraft community</p>
</div>
