import { Request, Response } from 'express';
import { param } from 'express-validator';
import { ShopifyPerk } from '@thxnetwork/api/models/ShopifyPerk';
import { BadRequestError, ForbiddenError, NotFoundError } from '@thxnetwork/api/util/errors';
import PointBalanceService, { PointBalance } from '@thxnetwork/api/services/PointBalanceService';
import PoolService from '@thxnetwork/api/services/PoolService';
import AccountProxy from '@thxnetwork/api/proxies/AccountProxy';
import ShopifyDataProxy from '@thxnetwork/api/proxies/ShopifyDataProxy';
import { ShopifyPerkPayment } from '@thxnetwork/api/models/ShopifyPerkPayment';
import { ShopifyDiscountCode } from '@thxnetwork/api/models/ShopifyDiscountCode';
import { generateRandomString } from '@thxnetwork/api/util/random';
import { redeemValidation } from '@thxnetwork/api/util/perks';

const validation = [param('uuid').exists()];

const controller = async (req: Request, res: Response) => {
    // #swagger.tags = ['Perks Payment']
    const pool = await PoolService.getById(req.header('X-PoolId'));
    const shopifyPerk = await ShopifyPerk.findOne({ uuid: req.params.uuid });
    if (!shopifyPerk) throw new NotFoundError('Could not find this perk');

    const pointBalance = await PointBalance.findOne({ sub: req.auth.sub, poolId: pool._id });
    if (!pointBalance || Number(pointBalance.balance) < Number(shopifyPerk.pointPrice)) {
        throw new BadRequestError('Not enough points on this account for this perk.');
    }

    const redeemValidationResult = await redeemValidation({ perk: shopifyPerk, sub: req.auth.sub });
    if (redeemValidationResult.isError) {
        throw new ForbiddenError(redeemValidationResult.errorMessage);
    }

    const account = await AccountProxy.getById(req.auth.sub);
    const poolAccount = await AccountProxy.getById(pool.sub);
    const discountCode = await ShopifyDataProxy.createDiscountCode(
        poolAccount,
        shopifyPerk.priceRuleId,
        shopifyPerk.discountCode + '#' + generateRandomString(5).toUpperCase(),
    );
    await ShopifyDiscountCode.create({
        sub: account.sub,
        poolId: pool._id,
        shopifyPerkId: shopifyPerk._id,
        discountCodeId: discountCode.id,
        priceRuleId: discountCode.price_rule_id,
        code: discountCode.code,
    });
    const shopifyPerkPayment = await ShopifyPerkPayment.create({
        perkId: shopifyPerk._id,
        sub: req.auth.sub,
        poolId: pool._id,
    });
    await PointBalanceService.subtract(pool, req.auth.sub, shopifyPerk.pointPrice);

    res.status(201).json({ discountCode, shopifyPerkPayment });
};

export default { controller, validation };