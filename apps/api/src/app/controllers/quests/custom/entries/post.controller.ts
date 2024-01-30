import { Request, Response } from 'express';
import { MilestoneReward } from '@thxnetwork/api/models/MilestoneReward';
import { param } from 'express-validator';
import { JobType, QuestVariant } from '@thxnetwork/common/lib/types';
import { agenda } from '@thxnetwork/api/util/agenda';
import PoolService from '@thxnetwork/api/services/PoolService';
import QuestService from '@thxnetwork/api/services/QuestService';
import AccountProxy from '@thxnetwork/api/proxies/AccountProxy';
import SafeService from '@thxnetwork/api/services/SafeService';
import LockService from '@thxnetwork/api/services/LockService';

const validation = [param('uuid').isUUID(4)];

const controller = async (req: Request, res: Response) => {
    const quest = await MilestoneReward.findOne({ uuid: req.params.uuid });
    if (!quest) return res.json({ error: 'This quest is no longer available.' });

    const pool = await PoolService.getById(quest.poolId);
    const account = await AccountProxy.getById(req.auth.sub);
    const wallet = await SafeService.findPrimary(req.auth.sub, pool.chainId);
    if (!wallet) {
        return res.json({ error: 'No wallet found for this account' });
    }

    const isLocked = await LockService.getIsLocked(quest.locks, wallet);
    if (isLocked) {
        return res.json({ error: 'Quest is locked' });
    }

    const validationResult = await QuestService.validate(QuestVariant.Custom, quest, account, wallet);
    if (!validationResult.result) return res.json({ error: validationResult.reason });

    const job = await agenda.now(JobType.CreateQuestEntry, {
        variant: QuestVariant.Custom,
        questId: quest._id,
        sub: account.sub,
        data: {
            isClaimed: true,
        },
    });

    res.json({ jobId: job.attrs._id });
};

export default { controller, validation };
