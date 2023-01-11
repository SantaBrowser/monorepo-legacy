import { AUTH_URL, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } from '../config/secrets';
import { AccountDocument } from '../models/Account';
import CommonOauthLoginOptions from '../types/CommonOauthLoginOptions';
import { AccessTokenKind } from '@thxnetwork/types/enums/AccessTokenKind';
import { discordClient } from '../util/axios';

export const DISCORD_API_SCOPE = ['identify', 'email', 'guilds', 'guilds.join', 'guilds.members.read'];

const ERROR_NO_DATA = 'Could not find an Discord data for this accesstoken';
const ERROR_NOT_AUTHORIZED = 'Not authorized for Discord API';
const ERROR_TOKEN_REQUEST_FAILED = 'Failed to request access token';

class DiscordService {
    static async isAuthorized(account: AccountDocument) {
        const token = account.getToken(AccessTokenKind.Discord);
        if (!token || !token.accessToken) return false;
        const isExpired = Date.now() > token.expiry;
        if (isExpired) {
            try {
                const accessToken = await this.refreshTokens(token.refreshToken);
                account.setToken({
                    kind: AccessTokenKind.Discord,
                    accessToken,
                    expiry: Date.now() + Number(3600) * 1000,
                });
                await account.save();
            } catch {
                return false;
            }
        }
        return true;
    }

    static getLoginURL(
        state: string,
        { scope = DISCORD_API_SCOPE, redirectUrl = AUTH_URL + '/oidc/callback/discord' }: CommonOauthLoginOptions,
    ) {
        const body = new URLSearchParams();

        if (state) body.append('state', state);
        body.append('response_type', 'code');
        body.append('client_id', DISCORD_CLIENT_ID);
        body.append('redirect_uri', redirectUrl);
        body.append('scope', scope.join(' '));

        return `https://discord.com/oauth2/authorize?${body.toString()}`;
    }

    static async requestTokens(code: string) {
        const body = new URLSearchParams();

        body.append('code', code);
        body.append('grant_type', 'authorization_code');
        body.append('redirect_uri', AUTH_URL + '/oidc/callback/discord');
        body.append('client_secret', DISCORD_CLIENT_SECRET);
        body.append('client_id', DISCORD_CLIENT_ID);

        const r = await discordClient({
            url: 'https://discord.com/api/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: body,
        });

        if (r.status !== 200) {
            throw new Error(ERROR_TOKEN_REQUEST_FAILED);
        }

        return r.data;
    }

    static async refreshTokens(refreshToken: string) {
        const body = new URLSearchParams();

        body.append('grant_type', 'refresh_token');
        body.append('refresh_token', refreshToken);
        body.append('client_secret', DISCORD_CLIENT_SECRET);
        body.append('client_id', DISCORD_CLIENT_ID);

        const r = await discordClient({
            url: 'https://discord.com/api/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: body,
        });

        if (r.status !== 200) throw new Error(ERROR_TOKEN_REQUEST_FAILED);

        return r.data.access_token;
    }

    static async getUser(accessToken: string) {
        const r = await discordClient({
            url: '/oauth2/@me',
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (r.status !== 200) throw new Error(ERROR_NOT_AUTHORIZED);
        if (!r.data) throw new Error(ERROR_NO_DATA);

        return r.data;
    }

    static async getGuilds(accessToken: string) {
        const res = await discordClient({
            method: 'GET',
            url: '/users/@me/guilds',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        if (res.status !== 200) throw new Error(ERROR_NOT_AUTHORIZED);
        const guilds = res.data;
        return guilds;
    }

    static async validateUserJoined({ guildId, accessToken }: { guildId: string; accessToken: string }) {
        const guilds = await this.getGuilds(accessToken);
        const isUserJoinedGuild = guilds.find((guild) => guild.id === guildId);

        return !!isUserJoinedGuild;
    }
}

export { DiscordService };
