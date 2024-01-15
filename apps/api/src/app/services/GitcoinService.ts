import axios from 'axios';
import { GITCOIN_API_KEY } from '../config/secrets';
import { logger } from '../util/logger';

async function submitPassport(scorerId: number, address: string) {
    await axios({
        url: 'https://api.scorer.gitcoin.co/registry/submit-passport',
        headers: { 'X-API-KEY': GITCOIN_API_KEY },
        data: {
            address,
            scorer_id: scorerId,
        },
    });
}

async function getScoreUniqueHumanity(scorerId: number, address: string) {
    try {
        await submitPassport(scorerId, address);

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

export default { submitPassport, getScoreUniqueHumanity };
