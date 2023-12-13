import { ButtonInteraction, CommandInteraction, StringSelectMenuInteraction } from 'discord.js';
import { logger } from '@thxnetwork/api/util/logger';

export const handleError = async (
    error: Error,
    interaction?: ButtonInteraction | CommandInteraction | StringSelectMenuInteraction,
) => {
    logger.error(error);
    if (interaction) {
        interaction.reply({ content: 'An error occured.', ephemeral: true });
    }
};
