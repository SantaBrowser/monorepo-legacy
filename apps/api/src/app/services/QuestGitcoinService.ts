import axios from 'axios';
import { WalletDocument } from '../models/Wallet';
import { GitcoinQuestDocument } from '../models/GitcoinQuest';
import { GitcoinQuestEntry } from '../models/GitcoinQuestEntry';
import { GITCOIN_API_KEY } from '../config/secrets';
import { logger } from '../util/logger';
import { TAccount } from '@thxnetwork/common/lib/types/interfaces';

async function getScore(scorerId: number, address: string) {
    try {
        const response = await axios({
            url: `https://api.scorer.gitcoin.co/registry/score/${scorerId}/${address}`,
            headers: { 'X-API-KEY': GITCOIN_API_KEY },
        });
        return { score: response.data.score };
    } catch (error) {
        logger.error(error.message);
        return { error: `Could not get a score for ${address}.` };
    }
}

async function validate(quest: GitcoinQuestDocument, account: TAccount, wallet: WalletDocument) {
    return { result: false, reason: 'Sorry! Not yet implemented for Discord slash commands.' };
}

async function findOne(quest: GitcoinQuestDocument, wallet?: WalletDocument) {
    const isClaimed = wallet
        ? await GitcoinQuestEntry.exists({
              questId: quest._id,
              $or: [{ sub: wallet.sub }, { walletId: wallet._id }],
          })
        : false;

    return {
        ...quest.toJSON(),
        amount: quest.amount,
        isClaimed,
        pointsAvailable: quest.amount,
    };
}

export default { findOne, getScore, validate };