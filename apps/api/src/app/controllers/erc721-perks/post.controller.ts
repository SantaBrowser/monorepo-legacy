import { body, check } from 'express-validator';
import { Request, Response } from 'express';
import { createERC721Perk } from '@thxnetwork/api/util/rewards';
import ImageService from '@thxnetwork/api/services/ImageService';
import { TERC721Perk } from '@thxnetwork/types/interfaces/ERC721Perk';

const validation = [
    body('title').isString(),
    body('description').isString(),
    // body('erc721metadataIds').exists().isArray(),
    body('expiryDate').optional().isString(),
    body('claimAmount').optional().isInt({ gt: 0 }),
    body('platform').optional().isNumeric(),
    body('interaction').optional().isNumeric(),
    body('content').optional().isString(),
    body('pointPrice').optional().isNumeric(),
    check('file')
        .optional()
        .custom((value, { req }) => {
            return ['jpg', 'jpeg', 'gif', 'png'].includes(req.file.mimetype);
        }),
    body('isPromoted').optional().isBoolean(),
];

const controller = async (req: Request, res: Response) => {
    // #swagger.tags = ['ERC721 Rewards']
    let image: string;

    if (req.file) {
        const response = await ImageService.upload(req.file);
        image = ImageService.getPublicUrl(response.key);
    }

    const perks = await Promise.all(
        req.body.erc721metadataIds.map(async (erc721metadataId: string) => {
            const config = {
                poolId: String(req.assetPool._id),
                erc721metadataId,
                image,
                title: req.body.title,
                description: req.body.description,
                expiryDate: req.body.expiryDate,
                claimAmount: req.body.claimAmount,
                pointPrice: req.body.pointPrice,
                isPromoted: req.body.isPromoted,
            } as TERC721Perk;
            const { reward, claims } = await createERC721Perk(req.assetPool, config);

            return { ...reward.toJSON(), claims };
        }),
    );

    res.status(201).json(perks);
};

export default { controller, validation };
