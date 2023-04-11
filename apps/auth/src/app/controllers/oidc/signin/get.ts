import { GithubService } from './../../../services/GithubServices';
import { Request, Response } from 'express';
import { AUTH_URL, WALLET_URL } from '../../../config/secrets';
import { TwitterService } from '../../../services/TwitterService';
import { YouTubeService } from '../../../services/YouTubeService';
import { AUTH_REQUEST_TYPED_MESSAGE, createTypedMessage } from '../../../util/typedMessage';
import { DiscordService } from '@thxnetwork/auth/services/DiscordService';
import { TwitchService } from '@thxnetwork/auth/services/TwitchService';
import ClaimProxy from '@thxnetwork/auth/proxies/ClaimProxy';
import BrandProxy from '@thxnetwork/auth/proxies/BrandProxy';
import PoolProxy from '@thxnetwork/auth/proxies/PoolProxy';
import { AccountVariant } from '@thxnetwork/auth/types/enums/AccountVariant';

async function controller(req: Request, res: Response) {
    const { uid, params } = req.interaction;
    const alert = {};
    let claim,
        brand,
        claimUrl = '';

    let authenticationMethods = Object.values(AccountVariant);
    if (params.pool_id) {
        brand = await BrandProxy.get(params.pool_id);
        const pool = await PoolProxy.getPool(params.pool_id);
        if (pool.settings && pool.settings.authenticationMethods) {
            authenticationMethods = pool.settings.authenticationMethods;
        }
    }

    if (params.pool_transfer_token) {
        alert['variant'] = 'success';
        alert[
            'message'
        ] = `<i class="fas fa-gift mr-2" aria-hidden="true"></i>Sign in to access your <strong>loyalty pool</strong>!`;
    }

    if (params.claim_id) {
        claim = await ClaimProxy.get(params.claim_id);
        claimUrl = `${WALLET_URL}/claim/${params.claim_id}`;
        brand = await BrandProxy.get(claim.pool._id);

        alert['variant'] = 'success';
        if (claim.erc20) {
            alert[
                'message'
            ] = `<i class="fas fa-gift mr-2" aria-hidden="true"></i>Sign in and claim your <strong>${claim.reward.amount} ${claim.erc20.symbol}!</strong>`;
        }
        if (claim.erc721) {
            alert[
                'message'
            ] = `<i class="fas fa-gift mr-2" aria-hidden="true"></i>Sign in and claim your <strong>${claim.erc721.symbol} NFT!</strong>`;
        }
    }

    params.emailPasswordEnabled = authenticationMethods.includes(AccountVariant.EmailPassword);
    params.metaMaskEnabled = authenticationMethods.includes(AccountVariant.Metamask);
    params.googleLoginUrl = authenticationMethods.includes(AccountVariant.SSOGoogle)
        ? YouTubeService.getLoginUrl(req.params.uid, YouTubeService.getBasicScopes())
        : null;
    params.githubLoginUrl = authenticationMethods.includes(AccountVariant.SSOGithub)
        ? GithubService.getLoginURL(uid, {})
        : null;
    params.discordLoginUrl = authenticationMethods.includes(AccountVariant.SSODiscord)
        ? DiscordService.getLoginURL(uid, {})
        : null;
    params.twitchLoginUrl = authenticationMethods.includes(AccountVariant.SSOTwitch)
        ? TwitchService.getLoginURL(uid, {})
        : null;
    params.twitterLoginUrl = authenticationMethods.includes(AccountVariant.SSOTwitter)
        ? TwitterService.getLoginURL(uid, {})
        : null;
    params.authRequestMessage = createTypedMessage(AUTH_REQUEST_TYPED_MESSAGE, AUTH_URL, uid);

    res.render('signin', {
        uid,
        params: { ...params, ...brand, claim, claimUrl },
        alert,
    });
}

export default { controller };
