import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { TAccount, TPointReward, TToken } from '@thxnetwork/types/interfaces';
import {
    AccessTokenKind,
    OAuthRequiredScopes,
    OAuthTwitterScope,
    QuestSocialRequirement,
} from '@thxnetwork/common/lib/types/enums';
import { TWITTER_API_ENDPOINT } from '@thxnetwork/common/lib/types/contants';
import { formatDistance } from 'date-fns';
import AccountProxy from './AccountProxy';
import { logger } from '../util/logger';
import { TwitterLike } from '../models/TwitterLike';
import { TwitterRepost } from '../models/TwitterRepost';
import { TwitterUser } from '../models/TwitterUser';
import { TwitterCursor, TwitterCursorDocument } from '../models/TwitterCursor';

async function twitterClient(config: AxiosRequestConfig) {
    const client = axios.create({ ...config, baseURL: TWITTER_API_ENDPOINT });
    return await client(config);
}

export default class TwitterDataProxy {
    static async getUserByUsername(account: TAccount, username: string) {
        const token = await AccountProxy.getToken(account, AccessTokenKind.Twitter, [
            OAuthTwitterScope.UsersRead,
            OAuthTwitterScope.TweetRead,
        ]);
        if (!token) return { result: false, reason: 'Could not find an X connection for this account.' };

        const data = await this.request(account, token, {
            method: 'GET',
            url: `/users/by/username/${username}`,
            params: {
                'user.fields': 'profile_image_url,public_metrics',
            },
        });

        return data.data;
    }

    static async getUser(account: TAccount, userId: string) {
        const token = await AccountProxy.getToken(account, AccessTokenKind.Twitter, [
            OAuthTwitterScope.UsersRead,
            OAuthTwitterScope.TweetRead,
        ]);
        if (!token) return { result: false, reason: 'Could not find an X connection for this account.' };

        try {
            const data = await this.request(account, token, {
                method: 'GET',
                url: `/users/${userId}`,
                params: {
                    'user.fields': 'profile_image_url,public_metrics',
                },
            });

            // Cache TwitterUser
            await TwitterUser.findOneAndUpdate(
                { userId: data.data.id },
                {
                    userId: data.data.id,
                    profileImgUrl: data.data.profile_image_url,
                    name: data.data.name,
                    username: data.data.username,
                    publicMetrics: {
                        followersCount: data.data.public_metrics.followers_count,
                        followingCount: data.data.public_metrics.following_count,
                        tweetCount: data.data.public_metrics.tweet_count,
                        listedCount: data.data.public_metrics.listed_count,
                        likeCount: data.data.public_metrics.like_count,
                    },
                },
                { upsert: true },
            );

            return data.data;
        } catch (res) {
            return this.handleError(account, token, res);
        }
    }

    static async getTweet(account: TAccount, tweetId: string) {
        const token = await AccountProxy.getToken(account, AccessTokenKind.Twitter, [
            OAuthTwitterScope.UsersRead,
            OAuthTwitterScope.TweetRead,
        ]);
        if (!token) return { result: false, reason: 'Could not find an X connection for this account.' };

        const data = await this.request(account, token, {
            method: 'GET',
            url: `/tweets`,
            params: {
                ids: tweetId,
                expansions: 'author_id',
            },
        });

        return { tweet: data.data[0], user: data.includes.users[0] };
    }

    static async searchTweets(account: TAccount, query: string) {
        const token = await AccountProxy.getToken(account, AccessTokenKind.Twitter, [
            OAuthTwitterScope.UsersRead,
            OAuthTwitterScope.TweetRead,
        ]);
        const startTime = new Date(Date.now() - 60 * 60 * 24).toISOString(); // 24h ago
        const data = await this.request(account, token, {
            url: '/tweets/search/recent',
            method: 'GET',
            params: {
                query: `from:${token.userId} ${query}`,
                start_time: startTime,
            },
        });
        return data.data;
    }

    static async validateUser(account: TAccount, quest: TPointReward) {
        const token = await AccountProxy.getToken(
            account,
            AccessTokenKind.Twitter,
            OAuthRequiredScopes.TwitterValidateUser,
        );
        if (!token) return { result: false, reason: 'Could not find an X connection for this account.' };

        const metadata = JSON.parse(quest.contentMetadata);
        const minFollowersCount = metadata.minFollowersCount ? Number(metadata.minFollowersCount) : 0;

        try {
            const user = await this.getUser(account, token.userId);

            // Validate the follower count for this user
            const followersCount = user.public_metrics.followers_count;
            if (followersCount >= minFollowersCount) return { result: true, reason: '' };

            return {
                result: false,
                reason: `X: Your account does not meet the threshold of ${minFollowersCount} followers.`,
            };
        } catch (res) {
            return this.handleError(account, token, res);
        }
    }

    static async validateFollow(account: TAccount, userId: string) {
        const token = await AccountProxy.getToken(
            account,
            AccessTokenKind.Twitter,
            OAuthRequiredScopes.TwitterValidateFollow,
        );
        if (!token) return { result: false, reason: 'Could not find an X connection for this account.' };
        try {
            if (token.userId === userId) {
                return { result: false, reason: 'X: Can not validate a follow for your account with your account.' };
            }

            const data = await this.request(account, token, {
                url: `/users/${token.userId}/following`,
                method: 'POST',
                data: {
                    target_user_id: userId,
                },
            });

            // TODO Cache TwitterFollower here if isFollowing is true
            // TODO Create migration to build follower cache based on existing TwitterFollow quest entries

            const isFollowing = data.data.following;
            if (isFollowing) return { result: true, reason: '' };

            return { result: false, reason: 'X: Account is not found as a follower.' };
        } catch (res) {
            return this.handleError(account, token, res);
        }
    }

    static async validateLike(
        account: TAccount,
        postId: string,
        cursor?: TwitterCursorDocument & { nextPageToken: string },
    ) {
        const token = await AccountProxy.getToken(
            account,
            AccessTokenKind.Twitter,
            OAuthRequiredScopes.TwitterValidateLike,
        );
        if (!token) return { result: false, reason: 'Could not find an X connection for this account.' };

        // Query TwitterLikes for this userId and postId
        const like = await TwitterLike.findOne({ userId: token.userId, postId });
        if (like) return { result: true, reason: '' };

        const requirement = QuestSocialRequirement.TwitterLike;
        try {
            // // Get the cursor for this requirement and postId
            // if (!cursor) {
            //     cursor = await TwitterCursor.findOne({ requirement, postId });
            //     if (cursor) this.validateLike(account, postId, cursor);
            // }

            const params = { max_results: 100 };
            if (cursor && cursor.nextPageToken) params['pagination_token'] = cursor.nextPageToken;
            if (cursor && cursor.newestId) params['since_id'] = cursor.newestId;
            // if (cursor && cursor.oldestId) params['max_id'] = cursor.oldestId;

            // Not found? Search for it and cache results along the way
            const data = await this.request(account, token, {
                url: `/tweets/${postId}/liking_users`,
                method: 'GET',
                params,
            });

            console.log(data);

            // Cache TwitterLike for future searches
            await Promise.all(
                data.data.map(async (user: { id: string }) => {
                    return await TwitterLike.findOneAndUpdate(
                        { userId: user.id, postId },
                        { userId: user.id, postId },
                        { upsert: true },
                    );
                }),
            );

            // Update the cursor
            cursor = await TwitterCursor.findOneAndUpdate(
                { requirement, postId },
                {
                    requirement,
                    postId,
                    newestId: data.meta.newest_id,
                    oldestId: data.meta.oldest_id,
                },
                { upsert: true, new: true },
            );

            // Check if the user is liked in the current set of data
            const isLiked = data.data ? !!data.data.find((u) => u.id === token.userId) : false;
            if (isLiked) return { result: true, reason: '' };

            // If there is a next_token run again
            if (data.meta.next_token) {
                return await this.validateLike(account, postId, {
                    ...cursor.toJSON(),
                    nextPageToken: data.meta.next_token,
                });
            }

            return { result: false, reason: 'X: Post has not been not liked.' };
        } catch (res) {
            return this.handleError(account, token, res);
        }
    }

    static async validateRetweet(
        account: TAccount,
        postId: string,
        options?: { sinceId: string; maxId: string; nextPageToken?: string },
    ) {
        let { sinceId, maxId } = options || {};
        const { nextPageToken } = options || {};

        const token = await AccountProxy.getToken(
            account,
            AccessTokenKind.Twitter,
            OAuthRequiredScopes.TwitterValidateRepost,
        );
        if (!token) return { result: false, reason: 'Could not find an X connection for this account.' };
        try {
            // Query cached TwitterReposts for this tweetId and userId
            const repost = await TwitterRepost.findOne({ userId: token.userId, postId });
            if (repost) return { result: true, reason: '' };

            // Construct paging parameters
            const params = { max_results: 100 };
            if (nextPageToken) params['pagination_token'] = nextPageToken;
            if (sinceId) params['since_id'] = sinceId;
            if (maxId) params['max_id'] = maxId;

            const data = await this.request(account, token, {
                url: `/tweets/${postId}/retweeted_by`,
                method: 'GET',
                params,
            });

            // Update sinceId for future searches
            sinceId = data.meta.newest_id;
            maxId = data.meta.oldest_id;

            // Cache TwitterReposts for future searches
            await Promise.all(
                data.data.map(async (user: { id: string }) => {
                    return await TwitterRepost.findOneAndUpdate(
                        { userId: user.id, postId },
                        { userId: user.id, postId },
                        { upsert: true },
                    );
                }),
            );

            // Check if the user is liked in the current set of data
            const isReposted = data.data ? !!data.data.find((u: { id: string }) => u.id === token.userId) : false;

            // If user has reposted or there is no next_token, break out of the loop
            if (isReposted) {
                return { result: true, reason: '' };
            }

            if (data.meta.next_token) {
                return await this.validateRetweet(account, postId, { sinceId, maxId, nextPageToken });
            }

            return { result: false, reason: 'X: Post has not been reposted.' };
        } catch (res) {
            return this.handleError(account, token, res);
        }
    }

    static async validateMessage(account: TAccount, message: string) {
        const token = await AccountProxy.getToken(
            account,
            AccessTokenKind.Twitter,
            OAuthRequiredScopes.TwitterValidateMessage,
        );
        if (!token) return { result: false, reason: 'Could not find an X connection for this account.' };
        try {
            const query = this.parseSearchQuery(message);
            const results = await this.searchTweets(account, query);
            if (results.length) return { result: true, reason: '' };

            return {
                result: false,
                reason: `X: Could not find a post matching the requirements for your account in the last 7 days.`,
            };
        } catch (res) {
            return this.handleError(account, token, res);
        }
    }

    private static async request(account: TAccount, token: TToken, config: AxiosRequestConfig) {
        try {
            const { data } = await twitterClient({
                ...config,
                headers: { Authorization: `Bearer ${token.accessToken}` },
            });
            return data;
        } catch (error) {
            if (error.response) {
                // Rethrow if this is an axios error
                throw error.response;
            } else {
                logger.error(error);
            }
        }
    }

    private static async handleError(account: TAccount, token: TToken, res: AxiosResponse) {
        logger.error(res);

        if (res.status === 429) {
            logger.info(`[429] X-RateLimit is hit by account ${account.sub} with X UserId ${token.userId}.`);
            return this.handleRateLimitError(res);
        }

        if (res.status === 401) {
            logger.info(`[401] Token for ${account.sub} with X UserId ${token.userId} is invalid and disconnected.`);
            await AccountProxy.disconnect(account, token.kind);
            return { result: false, reason: 'Your X account connection has been removed, please reconnect!' };
        }

        if (res.status === 403) {
            logger.info(`[403] Token for ${account.sub} with X UserId ${token.userId} has insufficient permissions.`);
            return { result: false, reason: 'Your X account access level is insufficient, please reconnect!' };
        }

        return { result: false, reason: 'X: An unexpected issue occured during your request.' };
    }

    private static handleRateLimitError(res: AxiosResponse) {
        const limit = res.headers['x-rate-limit-limit'];
        const resetTime = Number(res.headers['x-rate-limit-reset']);
        const seconds = resetTime - Math.ceil(Date.now() / 1000);

        return {
            result: false,
            reason: `X API allows for a max of ${limit} requests within a 15 minute window. Try again in ${formatDistance(
                0,
                seconds * 1000,
                { includeSeconds: true },
            )}.`,
        };
    }

    private static parseSearchQuery(content: string) {
        const emojiRegex = /<a?:.+?:\d{18}>|\p{Extended_Pictographic}/gu;
        return content
            .split(emojiRegex)
            .filter((text) => text && text.length > 1 && !text.match(emojiRegex))
            .map((text) => `"${text}"`)
            .join(' ');
    }
}
