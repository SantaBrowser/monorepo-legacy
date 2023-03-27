import { Request, Response } from 'express';
import { query, param } from 'express-validator';
import PoolService from '@thxnetwork/api/services/PoolService';
import { getLeaderboard } from '@thxnetwork/api/services/AnalyticsService';
import DiscordDataProxy from '@thxnetwork/api/proxies/DiscordDataProxy';

export const validation = [param('id').isMongoId(), query('platform').optional().isString()];

export const controller = async (req: Request, res: Response) => {
    // #swagger.tags = ['Pools']
    const pool = await PoolService.getById(req.params.id);

    const leaderBoard = await getLeaderboard(pool);
    if (req.query.platform === 'discord') {
        const promises = leaderBoard
            .filter((x) => x.account.discordAccess === true)
            .map(async (y) => {
                const discordId = await DiscordDataProxy.getUserId(y.account);
                y.account['discordUserId'] = discordId;
            });
        await Promise.all(promises);
    }

    res.json(leaderBoard);
};

export default { controller, validation };