import request from 'supertest';
import app from '@thxnetwork/api/';
import { ChainId } from '@thxnetwork/types/enums';
import { authAccessToken, dashboardAccessToken, sub3, widgetAccessToken3 } from '@thxnetwork/api/util/jest/constants';
import { isAddress } from 'web3-utils';
import { afterAllCallback, beforeAllCallback } from '@thxnetwork/api/util/jest/config';
import { AssetPoolDocument } from '@thxnetwork/api/models/AssetPool';
import { validate } from 'uuid';
import { MilestoneRewardDocument } from '@thxnetwork/api/models/MilestoneReward';

const user = request.agent(app);

describe('Milestone Rewards', () => {
    let pool: AssetPoolDocument, milestoneReward: MilestoneRewardDocument;

    beforeAll(beforeAllCallback);
    afterAll(afterAllCallback);

    it('POST /pools', (done) => {
        user.post('/v1/pools')
            .set('Authorization', dashboardAccessToken)
            .send({ chainId: ChainId.Hardhat })
            .expect((res: request.Response) => {
                expect(isAddress(res.body.address)).toBe(true);
                pool = res.body;
            })
            .expect(201, done);
    });

    it('POST /milestone-rewards', (done) => {
        user.post('/v1/milestone-rewards/')
            .set({ 'X-PoolId': pool._id, 'Authorization': dashboardAccessToken })
            .send({
                title: 'Expiration date is next 30 min',
                description: 'Lorem ipsum dolor sit amet',
                amount: 100,
            })
            .expect((res: request.Response) => {
                expect(res.body.uuid).toBeDefined();
                expect(res.body.amount).toBe(100);
                milestoneReward = res.body;
            })
            .expect(201, done);
    });

    describe('Wallet onboarding', () => {
        let wallet, code, userWalletAddress3;

        // Onboard a new wallet
        it('POST /webhook/wallet/:token', (done) => {
            user.post('/v1/webhook/wallet/' + pool.token)
                .send()
                .expect((res: request.Response) => {
                    expect(validate(res.body.code)).toEqual(true);
                    code = res.body.code;
                })
                .expect(201, done);
        });

        // Claim a milestone reward for a wallet code
        it('POST /webhook/milestone/:token/claim', (done) => {
            user.post(`/v1/webhook/milestone/${milestoneReward.uuid}/claim`)
                .send({ code })
                .expect((res: request.Response) => {
                    expect(res.body.uuid).toBeDefined();
                    expect(res.body.milestoneRewardId).toBe(milestoneReward._id);
                    expect(res.body.wallet.address).toBe('');
                    expect(res.body.wallet.uuid).toBe(code);
                    expect(res.body.wallet.sub).toBeUndefined();
                    wallet = res.body.wallet;
                })
                .expect(201, done);
        });

        // Deploy a wallet for an authenticated user
        it('POST /wallets', (done) => {
            user.post(`/v1/wallets`)
                .set({ Authorization: authAccessToken })
                .send({ sub: sub3, chainId: ChainId.Hardhat, forceSync: true })
                .expect((res: request.Response) => {
                    expect(isAddress(res.body.address)).toBeTruthy();
                    userWalletAddress3 = res.body.address;
                })
                .expect(201, done);
        });

        // Get onboarded wallet details for code
        it('GET /webhook/wallet/:code', (done) => {
            user.get('/v1/webhook/wallet/' + code)
                .send()
                .expect((res: request.Response) => {
                    expect(res.body.wallet._id).toBe(wallet._id);
                    expect(res.body.wallet.address).toBe('');
                    expect(res.body.wallet.uuid).toBe(code);
                    expect(res.body.wallet.sub).toBeUndefined();
                    expect(res.body.pointBalance).toBe(100);
                })
                .expect(200, done);
        });

        // Claim ownership of wallet and pending rewards
        it('PATCH /account/wallet', (done) => {
            user.patch(`/v1/account/wallet`)
                .set({ Authorization: widgetAccessToken3 })
                .send({ code })
                .expect((res: request.Response) => {
                    expect(res.body.sub).toBe(sub3);
                })
                .expect(200, done);
        });

        // Subsequent claims should become available for the primary wallet
        it('POST /webhook/milestone/:token/claim for sub3 (for used code)', (done) => {
            user.post(`/v1/webhook/milestone/${milestoneReward.uuid}/claim`)
                .send({ code })
                .expect((res: request.Response) => {
                    expect(res.body.uuid).toBeDefined();
                    expect(res.body.milestoneRewardId).toBe(milestoneReward._id);
                    expect(res.body.wallet.address).toBe(userWalletAddress3);
                })
                .expect(201, done);
        });

        // The GET wehbook should no longer return updated point balances for claimed wallets
        it('GET /webhook/wallet/:code (post reward claim)', (done) => {
            user.get('/v1/webhook/wallet/' + code)
                .send()
                .expect((res: request.Response) => {
                    expect(res.body.wallet.uuid).toBe(code);
                    expect(res.body.wallet.address).toBe('');
                    expect(res.body.pointBalance).toBe(0);
                })
                .expect(200, done);
        });

        // Show the correct amount of reward claims when listing perks for sub3
        it('GET /perks', (done) => {
            user.get(`/v1/rewards`)
                .set({ 'Authorization': widgetAccessToken3, 'X-PoolId': pool._id })
                .send()
                .expect((res: request.Response) => {
                    expect(res.body.milestoneRewards.find((r) => r._id === milestoneReward._id).claims).toHaveLength(2);
                })
                .expect(200, done);
        });
    });
});