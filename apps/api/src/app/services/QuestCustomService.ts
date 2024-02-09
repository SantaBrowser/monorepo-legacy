import {
    TAccount,
    TIdentity,
    TMilestoneReward,
    TMilestoneRewardClaim,
    TValidationResult,
} from '@thxnetwork/types/index';
import { MilestoneReward, MilestoneRewardDocument } from '../models/MilestoneReward';
import { Identity, IdentityDocument } from '../models/Identity';
import { Event } from '../models/Event';
import { MilestoneRewardClaim } from '../models/MilestoneRewardClaims';
import { WalletDocument } from '../models/Wallet';
import { IQuestService } from './interfaces/IQuestService';

export default class QuestCustomService implements IQuestService {
    models = {
        quest: MilestoneReward,
        entry: MilestoneRewardClaim,
    };

    async isAvailable({
        quest,
        wallet,
    }: {
        quest: MilestoneRewardDocument;
        wallet?: WalletDocument;
        account?: TAccount;
        data: Partial<TMilestoneRewardClaim>;
    }): Promise<TValidationResult> {
        const entries = await this.findEntries({ quest, wallet });
        if (quest.limit && entries.length >= quest.limit) {
            return { result: false, reason: 'Quest entry limit has been reached.' };
        }

        return { result: true, reason: '' };
    }

    async getAmount({ quest }: { quest: MilestoneRewardDocument; wallet: WalletDocument; account: TAccount }) {
        return quest.amount;
    }

    async decorate({
        quest,
        account,
        wallet,
        data,
    }: {
        quest: MilestoneRewardDocument;
        account?: TAccount;
        wallet?: WalletDocument;
        data: Partial<TMilestoneRewardClaim>;
    }) {
        const entries = await this.findEntries({ quest, wallet });
        const identities = await this.findIdentities({ quest, wallet });
        const events = await this.findEvents({ quest, identities });
        const isAvailable = await this.isAvailable({ quest, wallet, account, data });
        const pointsAvailable = quest.limit ? (quest.limit - entries.length) * quest.amount : quest.amount;

        return {
            ...quest,
            isAvailable: isAvailable.result,
            pointsAvailable,
            entries,
            events,
        };
    }

    async getValidationResult({
        quest,
        wallet,
    }: {
        quest: MilestoneRewardDocument;
        account: TAccount;
        wallet: WalletDocument;
        data: Partial<TMilestoneRewardClaim>;
    }): Promise<{ reason: string; result: boolean }> {
        // See if there are identities
        const identities = await Identity.find({ poolId: quest.poolId, sub: wallet.sub });
        if (!identities.length) {
            return {
                result: false,
                reason: 'No identity connected to this account. Please ask for this in your community!',
            };
        }

        // Find existing entries for this quest and check optional limit
        const entries = await this.findEntries({ quest, wallet });
        if (quest.limit && entries.length >= quest.limit) {
            return { result: false, reason: 'Quest entry limit has been reached' };
        }

        // Find events for this quest and the identities connected to the account
        const events = await this.findEvents({ quest, identities });
        if (entries.length >= events.length) {
            return { result: false, reason: 'Insufficient custom events found for this quest' };
        }

        if (entries.length < events.length) return { result: true, reason: '' };
    }

    private async findEntries({ quest, wallet }: { quest: MilestoneRewardDocument; wallet: WalletDocument }) {
        if (!wallet) return [];
        return await this.models.entry.find({
            questId: quest._id,
            walletId: wallet._id,
            isClaimed: true,
        });
    }

    private async findIdentities({ quest, wallet }: { quest: MilestoneRewardDocument; wallet: WalletDocument }) {
        if (!wallet) return [];
        return await Identity.find({ poolId: quest.poolId, sub: wallet.sub });
    }

    private async findEvents({
        quest,
        identities,
    }: {
        quest: MilestoneRewardDocument;
        identities: IdentityDocument[];
    }) {
        if (!identities.length) return [];
        return await Event.find({
            identityId: { $in: identities.map(({ _id }) => String(_id)) },
            poolId: quest.poolId,
            name: quest.eventName,
        }).limit(quest.limit || null);
    }
}
