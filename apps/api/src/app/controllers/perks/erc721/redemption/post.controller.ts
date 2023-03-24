import { Request, Response } from 'express';
import { param } from 'express-validator';
import { ERC721Perk } from '@thxnetwork/api/models/ERC721Perk';
import { BadRequestError, NotFoundError } from '@thxnetwork/api/util/errors';
import PointBalanceService, { PointBalance } from '@thxnetwork/api/services/PointBalanceService';
import ERC721Service from '@thxnetwork/api/services/ERC721Service';
import PoolService from '@thxnetwork/api/services/PoolService';
import AccountProxy from '@thxnetwork/api/proxies/AccountProxy';
import { ERC721Token, ERC721TokenDocument } from '@thxnetwork/api/models/ERC721Token';
import { ERC721MetadataDocument } from '@thxnetwork/api/models/ERC721Metadata';
import { ERC721PerkPayment } from '@thxnetwork/api/models/ERC721PerkPayment';

const validation = [param('uuid').exists()];

const controller = async (req: Request, res: Response) => {
    // #swagger.tags = ['Perks Payment']
    const pool = await PoolService.getById(req.header('X-PoolId'));

    const erc721Perk = await ERC721Perk.findOne({ uuid: req.params.uuid });
    if (!erc721Perk) throw new NotFoundError('Could not find this perk');

    const erc721 = await ERC721Service.findById(erc721Perk.erc721Id);
    if (!erc721) throw new NotFoundError('Could not find this erc721');

    let metadata: ERC721MetadataDocument;
    if (erc721Perk.erc721metadataId) {
        metadata = await ERC721Service.findMetadataById(erc721Perk.erc721metadataId);
        if (!metadata) {
            throw new NotFoundError('Could not find the erc721 metadata for this perk');
        }
    }

    const pointBalance = await PointBalance.findOne({ sub: req.auth.sub, poolId: pool._id });
    if (!pointBalance || Number(pointBalance.balance) < Number(erc721Perk.pointPrice))
        throw new BadRequestError('Not enough points on this account for this perk.');

    const account = await AccountProxy.getById(req.auth.sub);
    const to = await account.getAddress(erc721.chainId);

    let erc721Token: ERC721TokenDocument;
    if (metadata) {
        erc721Token = await ERC721Service.mint(pool, erc721, metadata, req.auth.sub, to);
    } else {
        erc721Token = await ERC721Token.findById(erc721Perk.erc721tokenId);
        erc721Token = await ERC721Service.transferFrom(pool, erc721Token, erc721, req.auth.sub, to);
    }

    const erc721PerkPayment = await ERC721PerkPayment.create({
        perkId: erc721Perk._id,
        sub: req.auth.sub,
        poolId: pool._id,
    });

    await PointBalanceService.subtract(pool, req.auth.sub, erc721Perk.pointPrice);

    res.status(201).json({ erc721Token, erc721PerkPayment });
};

export default { controller, validation };
