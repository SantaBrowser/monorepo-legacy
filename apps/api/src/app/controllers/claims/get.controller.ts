import { Request, Response } from 'express';
import { NotFoundError } from '@thxnetwork/api/util/errors';
import { param } from 'express-validator';
import ERC20Service from '@thxnetwork/api/services/ERC20Service';
import ERC721Service from '@thxnetwork/api/services/ERC721Service';
import PoolService from '@thxnetwork/api/services/PoolService';
import { Claim } from '@thxnetwork/api/models/Claim';
import { findRewardByUuid, isTERC20Perk, isTERC721Perk } from '@thxnetwork/api/util/rewards';

const validation = [
    param('uuid')
        .exists()
        .isString()
        .custom((uuid: string) => {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return uuidRegex.test(uuid);
        }),
];

const controller = async (req: Request, res: Response) => {
    /*
    #swagger.tags = ['Claims']
    #swagger.responses[200] = { 
        description: 'Get a reward claim',
        schema: { $ref: '#/definitions/Claim' } 
    }
    */
    const claim = await Claim.findOne({ uuid: req.params.uuid });
    if (!claim) throw new NotFoundError('Could not find this claim');

    const pool = await PoolService.getById(claim.poolId);
    if (!pool) throw new NotFoundError('Could not find this pool');

    const reward = await findRewardByUuid(claim.rewardUuid);
    if (!reward) throw new NotFoundError('Could not find this reward');

    if (isTERC20Perk(reward) && claim.erc20Id) {
        const erc20 = await ERC20Service.getById(claim.erc20Id);

        return res.json({ erc20, claim, pool, reward });
    }

    if (isTERC721Perk(reward) && claim.erc721Id) {
        const erc721 = await ERC721Service.findById(claim.erc721Id);
        const metadata = await ERC721Service.findMetadataById(reward.erc721metadataId);

        return res.json({ erc721, metadata, claim, pool, reward });
    }
};

export default { controller, validation };
