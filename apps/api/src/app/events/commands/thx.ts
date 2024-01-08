import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
    DiscordCommandVariant,
    onSubcommandBuy,
    onSubcommandComplete,
    onSubcommandInfo,
    onSubcommandConnect,
    onSubcommandPoints,
} from './thx/index';

export const commands: any[] = [
    new SlashCommandBuilder().setName('connect').setDescription('Connect your server to a campaign.'),
    new SlashCommandBuilder().setName('quest').setDescription('Complete a quest.'),
    // new SlashCommandBuilder().setName('buy').setDescription('Buy a reward from the shop.'),
    new SlashCommandBuilder().setName('info').setDescription('Campaign and participant info.'),
    new SlashCommandBuilder()
        .setName('remove-points')
        .setDescription('Remove an amount of points for a user.')
        .addUserOption((option) =>
            option.setName('user').setDescription('The user to transfer points to').setRequired(true),
        )
        .addIntegerOption((option) =>
            option.setName('amount').setDescription('The amount of points to transfer').setRequired(true),
        ),
    new SlashCommandBuilder()
        .setName('give-points')
        .setDescription('Give an amount of points to a user.')
        .addUserOption((option) =>
            option.setName('user').setDescription('The user to transfer points to').setRequired(true),
        )
        .addIntegerOption((option) =>
            option.setName('amount').setDescription('The amount of points to transfer').setRequired(true),
        ),
];

export default {
    data: commands,
    executor: (interaction: CommandInteraction) => {
        const commandMap = {
            'connect': () => onSubcommandConnect(interaction),
            'quest': () => onSubcommandComplete(interaction),
            'buy': () => onSubcommandBuy(interaction),
            'info': () => onSubcommandInfo(interaction),
            'give-points': () => onSubcommandPoints(interaction, DiscordCommandVariant.GivePoints),
            'remove-points': () => onSubcommandPoints(interaction, DiscordCommandVariant.RemovePoints),
        };
        const command = interaction.commandName;
        if (commandMap[command]) commandMap[command]();
    },
};
