const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const BombBellService = require('../../services/bombbell/BombBellService');
const NotificationFormatter = require('../../services/bombbell/NotificationFormatter');

class BombStatusCommand extends BaseCommand {
    constructor() {
        super({
            name: 'bombstatus',
            description: 'アクティブなボムベルの状況を表示します',
            category: 'Bomb Bell',
            cooldown: 10
        });
        
        this.bombBellService = null;
        this.formatter = new NotificationFormatter();
    }

    getSlashCommandData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('filter')
                    .setDescription('フィルタリングオプション')
                    .setRequired(false)
                    .addChoices(
                        { name: '全て', value: 'all' },
                        { name: 'コンバット経験値', value: 'COMBAT_XP' },
                        { name: 'プロフェッション経験値', value: 'PROFESSION_XP' },
                        { name: 'プロフェッション速度', value: 'PROFESSION_SPEED' },
                        { name: 'ダンジョン', value: 'DUNGEON' },
                        { name: 'ルート', value: 'LOOT' },
                        { name: 'ルートチェスト', value: 'LOOT_CHEST' }
                    ))
            .addStringOption(option =>
                option.setName('region')
                    .setDescription('地域フィルター')
                    .setRequired(false)
                    .addChoices(
                        { name: '全地域', value: 'all' },
                        { name: '北アメリカ', value: 'North America' },
                        { name: 'ヨーロッパ', value: 'Europe' },
                        { name: 'アジア', value: 'Asia' },
                        { name: '南アメリカ', value: 'South America' }
                    ));
    }

    async run(interaction) {
        try {
            await interaction.deferReply();
            
            // Initialize service if not already done
            if (!this.bombBellService) {
                const config = global.wynnTrackerBot?.config;
                if (!config) {
                    throw new Error('Configuration not available');
                }
                this.bombBellService = new BombBellService(interaction.client, config);
            }
            
            const filter = interaction.options.getString('filter') || 'all';
            const region = interaction.options.getString('region') || 'all';
            
            let activeBombs = await this.bombBellService.getActiveBombs();
            
            // Apply filters
            if (filter !== 'all') {
                activeBombs = activeBombs.filter(bomb => bomb.bombType === filter);
            }
            
            if (region !== 'all') {
                activeBombs = activeBombs.filter(bomb => bomb.serverRegion === region);
            }
            
            const embed = this.formatter.createActiveBombsEmbed(activeBombs);
            
            if (filter !== 'all' || region !== 'all') {
                let filterText = '🔍 フィルター: ';
                if (filter !== 'all') {
                    const filterNames = {
                        'COMBAT_XP': 'コンバット経験値',
                        'PROFESSION_XP': 'プロフェッション経験値',
                        'PROFESSION_SPEED': 'プロフェッション速度',
                        'DUNGEON': 'ダンジョン',
                        'LOOT': 'ルート',
                        'LOOT_CHEST': 'ルートチェスト'
                    };
                    filterText += filterNames[filter] || filter;
                }
                if (region !== 'all') {
                    if (filter !== 'all') filterText += ', ';
                    const regionNames = {
                        'North America': '北アメリカ',
                        'Europe': 'ヨーロッパ',
                        'Asia': 'アジア',
                        'South America': '南アメリカ'
                    };
                    filterText += regionNames[region] || region;
                }
                
                embed.setDescription(filterText + '\n\n' + (embed.data.description || ''));
            }
            
            await this.editReply(interaction, { embeds: [embed] });
            
        } catch (error) {
            this.logger.error('Bomb status command error:', error);
            await this.editReply(interaction, {
                content: '❌ ボム状況の取得に失敗しました。',
                ephemeral: true
            });
        }
    }

    static create() {
        return new BombStatusCommand();
    }
}

module.exports = BombStatusCommand;