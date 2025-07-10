require('dotenv').config();

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    wynnventoryApiKey: process.env.WYNNVENTORY_API_KEY || '7f3qkChz_KO9NsYLVsqyEs7kSdtaDSAeF2QyBf8YDz4'
};