import type { IAccount } from '@thxnetwork/api/models/Account';
import { authClient, getAuthAccessToken } from '@thxnetwork/api/util/auth';
import { AssetPoolDocument } from '../models/AssetPool';

export default class ShopifyDataProxy {
    static async getShopify(sub: string) {
        const { data } = await authClient({
            method: 'GET',
            url: `/account/${sub}/shopify`,
            headers: {
                Authorization: await getAuthAccessToken(),
            },
        });
        return { isAuthorized: data.isAuthorized, enabledCurrencies: data.enabledCurrencies };
    }

    static async validateOrderAmount(pool: AssetPoolDocument, account: IAccount, content: string) {
        const amount = JSON.parse(content).amount;
        const { data } = await authClient({
            method: 'GET',
            url: `/account/${pool.sub}/shopify/order-amount?amount=${amount}&email=${account.email}`,
            headers: {
                Authorization: await getAuthAccessToken(),
            },
        });
        return data.result;
    }

    static async validateTotalSpent(pool: AssetPoolDocument, account: IAccount, content: string) {
        const amount = JSON.parse(content).amount;
        const { data } = await authClient({
            method: 'GET',
            url: `/account/${pool.sub}/shopify/total-spent?amount=${amount}&email=${account.email}`,
            headers: {
                Authorization: await getAuthAccessToken(),
            },
        });
        return data.result;
    }

    static async validateNewsletterSubscription(pool: AssetPoolDocument, account: IAccount, content: string) {
        const { data } = await authClient({
            method: 'GET',
            url: `/account/${pool.sub}/shopify/newsletter-subscription?email=${account.email}`,
            headers: {
                Authorization: await getAuthAccessToken(),
            },
        });
        return data.result;
    }
}
