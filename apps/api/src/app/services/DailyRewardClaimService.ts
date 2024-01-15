import { DailyRewardClaim } from '@thxnetwork/api/models/DailyRewardClaims';
import db from '@thxnetwork/api/util/database';
import { DailyRewardDocument } from '../models/DailyReward';
import { DailyRewardClaimState } from '@thxnetwork/types/enums/DailyRewardClaimState';
import { WalletDocument } from '../models/Wallet';
import { Event } from '../models/Event';
import { Identity, IdentityDocument } from '../models/Identity';
export const DailyRewardClaimDocument = DailyRewardClaim;

export const ONE_DAY_MS = 86400 * 1000; // 24 hours in milliseconds

async function getLastEntry(wallet: WalletDocument, quest: DailyRewardDocument, start: number, end: number) {
    let lastEntry = await DailyRewardClaim.findOne({
        questId: quest._id,
        walletId: wallet._id,
        createdAt: { $gt: new Date(start), $lt: new Date(end) },
    });

    if (!lastEntry) {
        lastEntry = await DailyRewardClaim.findOne({
            questId: quest._id,
            walletId: wallet._id,
            createdAt: { $gt: new Date(start - ONE_DAY_MS), $lt: new Date(end - ONE_DAY_MS) },
        });
    }
    return lastEntry;
}

export default {
    create: (data: {
        questId: string;
        sub: string;
        walletId: string;
        amount?: number;
        poolId: string;
        state?: DailyRewardClaimState;
    }) => {
        return DailyRewardClaim.create({ uuid: db.createUUID(), ...data });
    },
    findByUUID: (uuid: string) => {
        return DailyRewardClaim.findOne({ uuid });
    },
    findByDailyReward: async (quest: DailyRewardDocument) => {
        return await DailyRewardClaim.find({ questId: quest._id });
    },
    findByWallet: async (quest: DailyRewardDocument, wallet: WalletDocument) => {
        const claims = [];
        const now = Date.now(),
            start = now - ONE_DAY_MS,
            end = now;

        let lastEntry = await getLastEntry(wallet, quest, start, end);
        if (!lastEntry) return [];
        claims.push(lastEntry);

        while (lastEntry) {
            const timestamp = new Date(lastEntry.createdAt).getTime();
            lastEntry = await DailyRewardClaim.findOne({
                questId: quest._id,
                walletId: wallet._id,
                createdAt: {
                    $gt: new Date(timestamp - ONE_DAY_MS * 2),
                    $lt: new Date(timestamp - ONE_DAY_MS),
                },
            });
            if (!lastEntry) break;
            claims.push(lastEntry);
        }

        return claims;
    },
    isAvailable: async (quest, account, wallet) => {
        const now = Date.now(),
            start = now - ONE_DAY_MS,
            end = now;

        const entry = await DailyRewardClaim.findOne({
            questId: quest._id,
            walletId: wallet._id,
            createdAt: { $gt: new Date(start), $lt: new Date(end) },
        });

        return !entry;
    },
    validate: async (quest: DailyRewardDocument, wallet: WalletDocument) => {
        const identities = await Identity.find({ sub: wallet.sub, poolId: quest.poolId });
        const now = Date.now(),
            start = now - ONE_DAY_MS,
            end = now;

        const entry = await DailyRewardClaim.findOne({
            questId: quest._id,
            walletId: wallet._id,
            createdAt: { $gt: new Date(start), $lt: new Date(end) },
        });

        // If an entry has been found the user needs to wait
        if (entry) {
            return { result: false, reason: `Already completed within the last 24 hours.` };
        }

        // If no entry has been found and no event is required the entry is allowed to be created
        if (!quest.eventName) {
            return { result: true, reason: '' };
        }

        // If an event is required we check if there is an event found within the time window
        const identityIds = identities.map(({ _id }) => String(_id));
        const events = await Event.find({
            name: quest.eventName,
            poolId: quest.poolId,
            identityId: identityIds,
            createdAt: { $gt: new Date(start), $lt: new Date(end) },
        });

        // If no events are found we invalidate
        if (!events.length) {
            return { result: false, reason: 'No events found for this account' };
        }

        // If events are found we validate true
        else {
            return { result: true, reason: '' };
        }
    },
};
