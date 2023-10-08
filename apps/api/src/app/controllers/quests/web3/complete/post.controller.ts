import { Request, Response } from 'express';
import { BigNumber, ethers } from 'ethers';
import { body, param } from 'express-validator';
import { validate } from 'uuid';
import { Web3Quest } from '@thxnetwork/api/models/Web3Quest';
import { NotFoundError } from '@thxnetwork/api/util/errors';
import { recoverSigner } from '@thxnetwork/api/util/network';
import { Web3QuestClaim } from '@thxnetwork/api/models/Web3QuestClaim';
import { AssetPool } from '@thxnetwork/api/models/AssetPool';
import { chainList } from '@thxnetwork/common';
import { logger } from '@thxnetwork/api/util/logger';
import SafeService from '@thxnetwork/api/services/SafeService';
import PointBalanceService from '@thxnetwork/api/services/PointBalanceService';
import QuestService from '@thxnetwork/api/services/QuestService';
import { QuestVariant } from '@thxnetwork/common/lib/types';
import AccountProxy from '@thxnetwork/api/proxies/AccountProxy';

const validation = [
    param('uuid').custom((uuid) => validate(uuid)),
    body('signature').isString(),
    body('chainId').isInt(),
];

const controller = async (req: Request, res: Response) => {
    const poolId = req.header('X-PoolId');
    const pool = await AssetPool.findById(poolId);
    if (!pool) throw new NotFoundError('Could not find campaign');

    const quest = await Web3Quest.findOne({ uuid: req.params.uuid });
    if (!quest) throw new NotFoundError('Could not find Web3 Quest');

    const wallet = await SafeService.findPrimary(req.auth.sub, pool.chainId);
    if (!wallet) throw new NotFoundError('Could not find primary wallet');

    const { rpc, name } = chainList[req.body.chainId];
    if (!rpc) throw new NotFoundError(`Could not find RPC for ${name}`);

    const provider = new ethers.providers.JsonRpcProvider(rpc);
    const address = recoverSigner(req.body.message, req.body.signature);
    const isClaimed = await Web3QuestClaim.exists({
        web3QuestId: quest._id,
        $or: [{ sub: req.auth.sub }, { walletId: wallet._id }, { address }],
    });
    if (isClaimed) {
        return res.json({ error: 'You have claimed this quest already' });
    }

    const contract = quest.contracts.find((c) => c.chainId === req.body.chainId);
    if (!contract) res.json({ error: 'Smart contract not found.' });
    const contractInstance = new ethers.Contract(
        contract.address,
        ['function ' + quest.methodName + '(address) view returns (uint256)'],
        provider,
    );

    let result: BigNumber;
    try {
        result = await contractInstance[quest.methodName](address);
    } catch (error) {
        logger.error(error);
        return res.json({ error: `Smart contract call on ${name} failed` });
    }

    const threshold = BigNumber.from(quest.threshold);
    if (result.lt(threshold)) {
        return res.json({ error: 'Result does not meet the threshold' });
    }

    const account = await AccountProxy.getById(req.auth.sub);
    const entry = await QuestService.complete(QuestVariant.Web3, quest.amount, pool, quest, account, wallet, {
        web3QuestId: quest._id,
        chainId: req.body.chainId,
        address,
    });

    res.json(entry);
};

export default { controller, validation };
