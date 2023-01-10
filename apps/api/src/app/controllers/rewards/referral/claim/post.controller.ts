import { Request, Response } from 'express';
import { ReferralReward } from '@thxnetwork/api/models/ReferralReward';
import { ReferralRewardClaim } from '@thxnetwork/api/models/ReferralRewardClaim';
import { ForbiddenError, NotFoundError } from '@thxnetwork/api/util/errors';
import AccountProxy from '@thxnetwork/api/proxies/AccountProxy';
import MailService from '@thxnetwork/api/services/MailService';
import PoolService from '@thxnetwork/api/services/PoolService';
import { v4 } from 'uuid';

const controller = async (req: Request, res: Response) => {
    // #swagger.tags = ['Rewards']
    const reward = await ReferralReward.findOne({ uuid: req.params.uuid });
    if (!reward) throw new NotFoundError('No reward for that uuid could be found.');

    const account = await AccountProxy.getById(req.body.sub);
    if (!account) throw new NotFoundError('No account for that sub could be found.');

    const isClaimCreatedInLast24h = await ReferralRewardClaim.exists({
        createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 1)) },
    });
    if (isClaimCreatedInLast24h) throw new ForbiddenError('A referral has been completed within 24h');

    const pool = await PoolService.getById(req.header('X-PoolId'));
    const claim = await ReferralRewardClaim.create({
        referralRewardId: String(reward._id),
        poolId: pool._id,
        sub: req.body.sub,
        amount: reward.amount,
        uuid: v4(),
    });

    await MailService.send(
        account.email,
        'Update on your referral',
        `Congratulations! Your referral link has been used and approval for a transfer of ${reward.amount} points has been requested.`,
    );

    res.status(201).json(claim);
};

export default { controller };
