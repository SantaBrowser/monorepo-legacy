import { Request, Response } from 'express';
import { param, query } from 'express-validator';
import { BadRequestError, ForbiddenError } from '@thxnetwork/api/util/errors';
import { WithdrawalState, WithdrawalType } from '@thxnetwork/api/types/enums';
import { WithdrawalDocument } from '@thxnetwork/api/models/Withdrawal';
import { Claim } from '@thxnetwork/api/models/Claim';
import { findRewardByUuid, isTERC20Perk, isTERC721Perk } from '@thxnetwork/api/util/rewards';
import { canClaim } from '@thxnetwork/api/util/condition';
import AccountProxy from '@thxnetwork/api/proxies/AccountProxy';
import WithdrawalService from '@thxnetwork/api/services/WithdrawalService';
import ERC721Service from '@thxnetwork/api/services/ERC721Service';
import PoolService from '@thxnetwork/api/services/PoolService';
import ERC20Service from '@thxnetwork/api/services/ERC20Service';
import ClaimService from '@thxnetwork/api/services/ClaimService';
import MembershipService from '@thxnetwork/api/services/MembershipService';
import db from '@thxnetwork/api/util/database';

const validation = [param('id').exists().isString(), query('forceSync').optional().isBoolean()];

const controller = async (req: Request, res: Response) => {
    // #swagger.tags = ['Claims']

    let claim = await ClaimService.findByUuid(req.params.id);
    if (!claim) throw new BadRequestError('This claim URL is invalid.');

    const pool = await PoolService.getById(claim.poolId);
    if (!pool) throw new BadRequestError('The pool for this rewards has been removed.');

    const account = await AccountProxy.getById(req.auth.sub);
    if (!account.address) throw new BadRequestError('The authenticated account has not accessed its wallet.');

    const reward = await findRewardByUuid(claim.rewardUuid);
    if (!reward) throw new BadRequestError('The reward for this ID does not exist.');

    // Validate the claim
    const { result, error } = await canClaim(reward, account);
    if (!result || error) throw new ForbiddenError(error);

    // Memberships could be removed but tokens should be created
    const hasMembership = await MembershipService.hasMembership(pool, account.sub);
    if (!hasMembership) {
        if (claim.erc20Id) {
            await MembershipService.addERC20Membership(account.sub, pool);
        }
        if (claim.erc721Id) {
            await MembershipService.addERC721Membership(account.sub, pool);
        }
    }

    // Force sync by default but allow the requester to do async calls.
    const forceSync = req.query.forceSync !== undefined ? req.query.forceSync === 'true' : true;

    if (isTERC20Perk(reward) && claim.erc20Id) {
        let withdrawal: WithdrawalDocument = await WithdrawalService.create(
            pool,
            WithdrawalType.ClaimReward,
            req.auth.sub,
            Number(reward.amount),
            WithdrawalState.Pending,
            null,
            String(reward._id),
        );
        const erc20 = await ERC20Service.getById(claim.erc20Id);
        withdrawal = await WithdrawalService.withdrawFor(pool, withdrawal, account, forceSync);

        // When more than one claim is created for this reward we update the existing ones,
        // since the check on rewardLimit will take into account the claims with existing sub
        if (reward.claimAmount > 1) {
            claim = await Claim.findByIdAndUpdate(claim._id, { sub: req.auth.sub });
        } else {
            claim = await Claim.create({
                sub: req.auth.sub,
                erc20Id: claim.erc20Id,
                rewardUuid: claim.rewardUuid,
                poolId: claim.poolId,
                uuid: db.createUUID(),
            });
        }

        return res.json({ withdrawal, erc20, reward, claim });
    }

    if (isTERC721Perk(reward) && claim.erc721Id) {
        const metadata = await ERC721Service.findMetadataById(reward.erc721metadataId);
        const erc721 = await ERC721Service.findById(metadata.erc721);
        const token = await ERC721Service.mint(pool, erc721, metadata, account, forceSync);

        // TODO make abstract method for this. Take note of difference in claim creation.

        // When more than one claim is created for this reward we update the existing ones,
        // since the check on rewardLimit will take into account the claims with existing sub
        if (reward.claimAmount > 1) {
            claim = await Claim.findByIdAndUpdate(claim._id, { sub: req.auth.sub });
        } else {
            claim = await Claim.create({
                sub: req.auth.sub,
                erc721Id: claim.erc721Id,
                rewardUuid: claim.rewardUuid,
                poolId: claim.poolId,
                uuid: db.createUUID(),
            });
        }

        return res.json({ token, erc721, metadata, reward, claim });
    }
};

export default { controller, validation };
