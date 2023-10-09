import jwt_decode from 'jwt-decode';
import { Request, Response } from 'express';
import { PointReward } from '@thxnetwork/api/models/PointReward';
import { ReferralReward } from '@thxnetwork/api/models/ReferralReward';
import { MilestoneReward } from '@thxnetwork/api/models/MilestoneReward';
import { MilestoneRewardClaim } from '@thxnetwork/api/models/MilestoneRewardClaims';
import { PointRewardClaim } from '@thxnetwork/api/models/PointRewardClaim';
import { DailyReward } from '@thxnetwork/api/models/DailyReward';
import { WalletDocument } from '@thxnetwork/api/models/Wallet';
import { Web3Quest } from '@thxnetwork/api/models/Web3Quest';
import { Web3QuestClaim } from '@thxnetwork/api/models/Web3QuestClaim';
import { TBaseReward } from '@thxnetwork/types/interfaces';
import AnalyticsService from '@thxnetwork/api/services/AnalyticsService';
import PoolService from '@thxnetwork/api/services/PoolService';
import DailyRewardClaimService, { ONE_DAY_MS } from '@thxnetwork/api/services/DailyRewardClaimService';
import WalletService from '@thxnetwork/api/services/WalletService';

const controller = async (req: Request, res: Response) => {
    // #swagger.tags = ['Rewards']
    const pool = await PoolService.getById(req.header('X-PoolId'));
    const referralRewards = await ReferralReward.find({ poolId: pool._id, isPublished: true });
    const pointRewards = await PointReward.find({ poolId: pool._id, isPublished: true });
    const milestoneRewards = await MilestoneReward.find({ poolId: pool._id, isPublished: true });
    const dailyRewards = await DailyReward.find({ poolId: pool._id, isPublished: true });
    const web3Quests = await Web3Quest.find({ poolId: pool._id, isPublished: true });
    const authHeader = req.header('authorization');

    let wallet: WalletDocument, sub: string;
    // This endpoint is public so we do not get req.auth populated and decode the token ourselves
    // when the request is made with an authorization header to obtain the sub.
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token: { sub: string } = jwt_decode(authHeader.split(' ')[1]);
        sub = token.sub;
        wallet = await WalletService.findPrimary(sub, pool.chainId);
    }

    const leaderboard = await AnalyticsService.getLeaderboard(pool, {
        startDate: new Date(pool.createdAt),
        endDate: new Date(),
    });

    const getDefaults = ({ _id, index, title, description, infoLinks, uuid, image }: TBaseReward) => ({
        _id,
        index,
        title,
        description,
        infoLinks,
        image,
        uuid,
    });

    res.json({
        leaderboard: leaderboard.map(({ score, wallet, questsCompleted }) => ({
            questsCompleted,
            score,
            address: wallet.address,
        })),
        daily: await Promise.all(
            dailyRewards.map(async (r) => {
                const isDisabled = wallet ? !(await DailyRewardClaimService.isClaimable(r, wallet)) : true;
                const validClaims = wallet ? await DailyRewardClaimService.findByWallet(r, wallet) : [];
                const claimAgainTime = validClaims.length
                    ? new Date(validClaims[0].createdAt).getTime() + ONE_DAY_MS
                    : null;
                const now = Date.now();
                const defaults = getDefaults(r);
                return {
                    ...defaults,
                    amount: r.amounts[validClaims.length],
                    amounts: r.amounts,
                    isDisabled,
                    claims: validClaims,
                    claimAgainDuration:
                        claimAgainTime && claimAgainTime - now > 0 ? Math.floor((claimAgainTime - now) / 1000) : null, // Convert and floor to S,
                };
            }),
        ),
        custom: await Promise.all(
            milestoneRewards.map(async (r) => {
                const claims = wallet
                    ? await MilestoneRewardClaim.find({
                          walletId: String(wallet._id),
                          milestoneRewardId: String(r._id),
                      })
                    : [];
                const defaults = getDefaults(r);
                return {
                    ...defaults,
                    amount: r.amount,
                    claims,
                };
            }),
        ),
        invite: referralRewards.map((r) => {
            const defaults = getDefaults(r);
            return {
                ...defaults,
                amount: r.amount,
                pathname: r.pathname,
                successUrl: r.successUrl,
            };
        }),
        social: await Promise.all(
            pointRewards.map(async (r) => {
                const isClaimed = wallet
                    ? await PointRewardClaim.exists({
                          $or: [{ walletId: wallet._id }, { sub }],
                          pointRewardId: String(r._id),
                      }) // TODO SHould move to service since its also used in the claim controller
                    : false;
                const defaults = getDefaults(r);
                return {
                    ...defaults,
                    amount: r.amount,
                    isClaimed,
                    platform: r.platform,
                    interaction: r.interaction,
                    content: r.content,
                    contentMetadata: r.contentMetadata,
                };
            }),
        ),
        web3: await Promise.all(
            web3Quests.map(async (r) => {
                const isClaimed = wallet
                    ? await Web3QuestClaim.exists({
                          web3QuestId: r._id,
                          $or: [{ sub }, { walletId: wallet._id }],
                      })
                    : false;
                const defaults = getDefaults(r);
                return {
                    ...defaults,
                    amount: r.amount,
                    contracts: r.contracts,
                    methodName: r.methodName,
                    threshold: r.threshold,
                    isClaimed,
                };
            }),
        ),
    });
};

export default { controller };