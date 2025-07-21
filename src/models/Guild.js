class Guild {
    constructor(data) {
        this.name = data.name;
        this.prefix = data.prefix;
        this.members = this.parseMembers(data.members);
        this.memberCount = data.memberCount || this.members.length;
        this.xp = data.xp;
        this.level = data.level;
        this.created = data.created ? new Date(data.created) : null;
        this.territories = data.territories;
        this.territoryCount = data.territoryCount || (data.territories ? Object.keys(data.territories).length : 0);
        this.banner = data.banner;
        this.raw = data.raw;
    }

    parseMembers(membersData) {
        if (!membersData || !Array.isArray(membersData)) {
            return [];
        }

        return membersData.map(member => ({
            uuid: member.uuid,
            username: member.username,
            rank: member.rank,
            contributed: member.contributed || 0,
            contributedDelta: member.contributedDelta || 0,
            joined: member.joined ? new Date(member.joined) : null,
            online: member.online || false,
            server: member.server || null,
            ...member
        }));
    }

    getMemberCount() {
        return this.members.length;
    }

    getMemberByUUID(uuid) {
        return this.members.find(member => member.uuid === uuid) || null;
    }

    getMemberByUsername(username) {
        return this.members.find(member => 
            member.username?.toLowerCase() === username.toLowerCase()
        ) || null;
    }

    getMembersByRank(rank) {
        return this.members.filter(member => member.rank === rank);
    }

    getOnlineMembers() {
        return this.members.filter(member => member.online === true);
    }

    getOfflineMembers() {
        return this.members.filter(member => member.online !== true);
    }

    getMemberRankings() {
        return this.members
            .filter(member => member.contributed > 0)
            .sort((a, b) => b.contributed - a.contributed)
            .map((member, index) => ({
                rank: index + 1,
                ...member
            }));
    }

    getWeeklyRankings() {
        return this.members
            .filter(member => member.contributedDelta > 0)
            .sort((a, b) => b.contributedDelta - a.contributedDelta)
            .map((member, index) => ({
                rank: index + 1,
                ...member
            }));
    }

    getRankDistribution() {
        const distribution = {};
        
        this.members.forEach(member => {
            const rank = member.rank || 'Unknown';
            distribution[rank] = (distribution[rank] || 0) + 1;
        });

        return distribution;
    }

    getTotalContributed() {
        return this.members.reduce((total, member) => {
            return total + (member.contributed || 0);
        }, 0);
    }

    getTotalWeeklyContributed() {
        return this.members.reduce((total, member) => {
            return total + (member.contributedDelta || 0);
        }, 0);
    }

    getAverageContribution() {
        if (this.members.length === 0) {
            return 0;
        }

        return Math.round(this.getTotalContributed() / this.members.length);
    }

    getAverageWeeklyContribution() {
        if (this.members.length === 0) {
            return 0;
        }

        return Math.round(this.getTotalWeeklyContributed() / this.members.length);
    }

    getTopContributor() {
        if (this.members.length === 0) {
            return null;
        }

        return this.members.reduce((top, member) => {
            return (member.contributed || 0) > (top.contributed || 0) ? member : top;
        }, this.members[0]);
    }

    getTopWeeklyContributor() {
        if (this.members.length === 0) {
            return null;
        }

        return this.members.reduce((top, member) => {
            return (member.contributedDelta || 0) > (top.contributedDelta || 0) ? member : top;
        }, this.members[0]);
    }

    getInactiveMembers(days = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return this.members.filter(member => {
            if (member.online) {
                return false;
            }
            
            // If we don't have last seen data, consider them inactive
            if (!member.lastSeen) {
                return true;
            }

            return member.lastSeen < cutoffDate;
        });
    }

    getActiveMembers(days = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return this.members.filter(member => {
            if (member.online) {
                return true;
            }
            
            // If we don't have last seen data, consider them inactive
            if (!member.lastSeen) {
                return false;
            }

            return member.lastSeen >= cutoffDate;
        });
    }

    getNewMembers(days = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return this.members.filter(member => {
            return member.joined && member.joined >= cutoffDate;
        });
    }

    getGuildAge() {
        if (!this.created) {
            return null;
        }

        const now = new Date();
        const diff = now - this.created;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        return days;
    }

    getXpPerLevel() {
        if (this.level === 0) {
            return 0;
        }

        return Math.round(this.xp / this.level);
    }

    getTerritoriesPerMember() {
        if (this.members.length === 0) {
            return 0;
        }

        return parseFloat((this.territoryCount / this.members.length).toFixed(2));
    }

    hasTerritory(territoryName) {
        return this.territories && this.territories[territoryName] !== undefined;
    }

    getTerritoryList() {
        if (!this.territories) {
            return [];
        }

        return Object.keys(this.territories);
    }

    getTerritoryDetails(territoryName) {
        if (!this.territories || !this.territories[territoryName]) {
            return null;
        }

        return this.territories[territoryName];
    }

    getContributionStats() {
        if (this.members.length === 0) {
            return {
                total: 0,
                average: 0,
                median: 0,
                top10Percent: 0,
                activeContributors: 0
            };
        }

        const contributions = this.members
            .map(member => member.contributed || 0)
            .filter(contrib => contrib > 0)
            .sort((a, b) => b - a);

        const total = contributions.reduce((sum, contrib) => sum + contrib, 0);
        const average = Math.round(total / contributions.length);
        
        const median = contributions.length > 0 ? 
            contributions[Math.floor(contributions.length / 2)] : 0;
        
        const top10Count = Math.max(1, Math.ceil(contributions.length * 0.1));
        const top10Percent = contributions.length > 0 ? 
            Math.round(contributions.slice(0, top10Count).reduce((sum, contrib) => sum + contrib, 0) / top10Count) : 0;

        return {
            total,
            average,
            median,
            top10Percent,
            activeContributors: contributions.length
        };
    }

    getWeeklyContributionStats() {
        if (this.members.length === 0) {
            return {
                total: 0,
                average: 0,
                median: 0,
                top10Percent: 0,
                activeContributors: 0
            };
        }

        const contributions = this.members
            .map(member => member.contributedDelta || 0)
            .filter(contrib => contrib > 0)
            .sort((a, b) => b - a);

        const total = contributions.reduce((sum, contrib) => sum + contrib, 0);
        const average = Math.round(total / contributions.length);
        
        const median = contributions.length > 0 ? 
            contributions[Math.floor(contributions.length / 2)] : 0;
        
        const top10Count = Math.max(1, Math.ceil(contributions.length * 0.1));
        const top10Percent = contributions.length > 0 ? 
            Math.round(contributions.slice(0, top10Count).reduce((sum, contrib) => sum + contrib, 0) / top10Count) : 0;

        return {
            total,
            average,
            median,
            top10Percent,
            activeContributors: contributions.length
        };
    }

    toJSON() {
        return {
            name: this.name,
            prefix: this.prefix,
            members: this.members,
            memberCount: this.memberCount,
            xp: this.xp,
            level: this.level,
            created: this.created,
            territories: this.territories,
            territoryCount: this.territoryCount,
            banner: this.banner,
            stats: {
                guildAge: this.getGuildAge(),
                xpPerLevel: this.getXpPerLevel(),
                territoriesPerMember: this.getTerritoriesPerMember(),
                onlineMembers: this.getOnlineMembers().length,
                offlineMembers: this.getOfflineMembers().length,
                totalContributed: this.getTotalContributed(),
                totalWeeklyContributed: this.getTotalWeeklyContributed(),
                averageContribution: this.getAverageContribution(),
                averageWeeklyContribution: this.getAverageWeeklyContribution(),
                rankDistribution: this.getRankDistribution(),
                contributionStats: this.getContributionStats(),
                weeklyContributionStats: this.getWeeklyContributionStats()
            }
        };
    }

    static fromWynncraftAPI(data) {
        return new Guild(data);
    }
}

module.exports = Guild;