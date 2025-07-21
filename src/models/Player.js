class Player {
    constructor(data) {
        this.username = data.username;
        this.uuid = data.uuid;
        this.rank = data.rank;
        this.supportRank = data.supportRank;
        this.online = data.online;
        this.server = data.server;
        this.playtime = data.playtime;
        this.firstJoin = data.firstJoin ? new Date(data.firstJoin) : null;
        this.lastJoin = data.lastJoin ? new Date(data.lastJoin) : null;
        this.guild = data.guild;
        this.characters = this.parseCharacters(data.characters);
        this.globalData = data.globalData;
        this.activeCharacter = data.activeCharacter;
        this.raw = data.raw;
    }

    parseCharacters(charactersData) {
        if (!charactersData || !Array.isArray(charactersData)) {
            return [];
        }

        return charactersData.map(char => ({
            uuid: char.uuid,
            type: char.type,
            nickname: char.nickname,
            level: char.level,
            xp: char.xp,
            xpPercent: char.xpPercent,
            totalLevel: char.totalLevel,
            wars: char.wars,
            playtime: char.playtime,
            mobsKilled: char.mobsKilled,
            chestsFound: char.chestsFound,
            blocksWalked: char.blocksWalked,
            itemsIdentified: char.itemsIdentified,
            mobsKilled: char.mobsKilled,
            pvpKills: char.pvpKills,
            pvpDeaths: char.pvpDeaths,
            gamemode: char.gamemode,
            skillPoints: char.skillPoints,
            dungeons: char.dungeons,
            raids: char.raids,
            quests: char.quests,
            lastJoin: char.lastJoin ? new Date(char.lastJoin) : null,
            ...char
        }));
    }

    getActiveCharacter() {
        if (!this.activeCharacter) {
            return null;
        }

        return this.characters.find(char => char.uuid === this.activeCharacter) || null;
    }

    getTotalXP() {
        if (!this.characters || this.characters.length === 0) {
            return 0;
        }

        return this.characters.reduce((total, char) => {
            return total + (char.xp || 0);
        }, 0);
    }

    getTotalLevel() {
        if (!this.characters || this.characters.length === 0) {
            return 0;
        }

        return this.characters.reduce((total, char) => {
            return total + (char.totalLevel || 0);
        }, 0);
    }

    getMaxCharacterLevel() {
        if (!this.characters || this.characters.length === 0) {
            return 0;
        }

        return Math.max(...this.characters.map(char => char.totalLevel || 0));
    }

    getCharactersByClass(className) {
        if (!this.characters || this.characters.length === 0) {
            return [];
        }

        return this.characters.filter(char => 
            char.type?.toLowerCase() === className.toLowerCase()
        );
    }

    getHighestLevelCharacterByClass(className) {
        const characters = this.getCharactersByClass(className);
        
        if (characters.length === 0) {
            return null;
        }

        return characters.reduce((highest, char) => {
            return (char.totalLevel || 0) > (highest.totalLevel || 0) ? char : highest;
        }, characters[0]);
    }

    getTotalPlaytime() {
        if (!this.characters || this.characters.length === 0) {
            return this.playtime || 0;
        }

        return this.characters.reduce((total, char) => {
            return total + (char.playtime || 0);
        }, 0);
    }

    getTotalWars() {
        if (!this.characters || this.characters.length === 0) {
            return 0;
        }

        return this.characters.reduce((total, char) => {
            return total + (char.wars || 0);
        }, 0);
    }

    getTotalMobsKilled() {
        if (!this.characters || this.characters.length === 0) {
            return 0;
        }

        return this.characters.reduce((total, char) => {
            return total + (char.mobsKilled || 0);
        }, 0);
    }

    getTotalChestsFound() {
        if (!this.characters || this.characters.length === 0) {
            return 0;
        }

        return this.characters.reduce((total, char) => {
            return total + (char.chestsFound || 0);
        }, 0);
    }

    getTotalPvpKills() {
        if (!this.characters || this.characters.length === 0) {
            return 0;
        }

        return this.characters.reduce((total, char) => {
            return total + (char.pvpKills || 0);
        }, 0);
    }

    getTotalPvpDeaths() {
        if (!this.characters || this.characters.length === 0) {
            return 0;
        }

        return this.characters.reduce((total, char) => {
            return total + (char.pvpDeaths || 0);
        }, 0);
    }

    getPvpKDRatio() {
        const kills = this.getTotalPvpKills();
        const deaths = this.getTotalPvpDeaths();
        
        if (deaths === 0) {
            return kills > 0 ? kills : 0;
        }
        
        return parseFloat((kills / deaths).toFixed(2));
    }

    getCompletedDungeons() {
        if (!this.characters || this.characters.length === 0) {
            return {};
        }

        const dungeonTotals = {};
        
        this.characters.forEach(char => {
            if (char.dungeons && char.dungeons.completed) {
                Object.entries(char.dungeons.completed).forEach(([dungeon, count]) => {
                    dungeonTotals[dungeon] = (dungeonTotals[dungeon] || 0) + count;
                });
            }
        });

        return dungeonTotals;
    }

    getCompletedRaids() {
        if (!this.characters || this.characters.length === 0) {
            return {};
        }

        const raidTotals = {};
        
        this.characters.forEach(char => {
            if (char.raids && char.raids.completed) {
                Object.entries(char.raids.completed).forEach(([raid, count]) => {
                    raidTotals[raid] = (raidTotals[raid] || 0) + count;
                });
            }
        });

        return raidTotals;
    }

    getCompletedQuests() {
        if (!this.characters || this.characters.length === 0) {
            return [];
        }

        const allQuests = new Set();
        
        this.characters.forEach(char => {
            if (char.quests && Array.isArray(char.quests)) {
                char.quests.forEach(quest => allQuests.add(quest));
            }
        });

        return Array.from(allQuests);
    }

    hasGuild() {
        return this.guild && this.guild.name;
    }

    getGuildRank() {
        return this.guild ? this.guild.rank : null;
    }

    getGuildName() {
        return this.guild ? this.guild.name : null;
    }

    getGuildPrefix() {
        return this.guild ? this.guild.prefix : null;
    }

    getGuildJoinDate() {
        return this.guild && this.guild.joined ? this.guild.joined : null;
    }

    isOnline() {
        return this.online === true;
    }

    getOnlineServer() {
        return this.isOnline() ? this.server : null;
    }

    getAccountAge() {
        if (!this.firstJoin) {
            return null;
        }

        const now = new Date();
        const diff = now - this.firstJoin;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        return days;
    }

    getTimeSinceLastSeen() {
        if (!this.lastJoin) {
            return null;
        }

        const now = new Date();
        const diff = now - this.lastJoin;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        return days;
    }

    formatPlaytime(playtime = null) {
        const time = playtime || this.getTotalPlaytime();
        
        if (time === 0) {
            return '0 minutes';
        }

        const hours = Math.floor(time / 60);
        const minutes = time % 60;

        if (hours === 0) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }

        if (minutes === 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        }

        return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    toJSON() {
        return {
            username: this.username,
            uuid: this.uuid,
            rank: this.rank,
            supportRank: this.supportRank,
            online: this.online,
            server: this.server,
            playtime: this.playtime,
            firstJoin: this.firstJoin,
            lastJoin: this.lastJoin,
            guild: this.guild,
            characters: this.characters,
            globalData: this.globalData,
            activeCharacter: this.activeCharacter,
            stats: {
                totalXP: this.getTotalXP(),
                totalLevel: this.getTotalLevel(),
                maxCharacterLevel: this.getMaxCharacterLevel(),
                totalPlaytime: this.getTotalPlaytime(),
                totalWars: this.getTotalWars(),
                totalMobsKilled: this.getTotalMobsKilled(),
                totalChestsFound: this.getTotalChestsFound(),
                totalPvpKills: this.getTotalPvpKills(),
                totalPvpDeaths: this.getTotalPvpDeaths(),
                pvpKDRatio: this.getPvpKDRatio(),
                completedDungeons: this.getCompletedDungeons(),
                completedRaids: this.getCompletedRaids(),
                completedQuests: this.getCompletedQuests().length,
                accountAge: this.getAccountAge(),
                timeSinceLastSeen: this.getTimeSinceLastSeen()
            }
        };
    }

    static fromWynncraftAPI(data) {
        return new Player(data);
    }
}

module.exports = Player;