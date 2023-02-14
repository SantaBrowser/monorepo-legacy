import request, { Response } from 'supertest';
import app from '@thxnetwork/api/';
import { ChainId } from '@thxnetwork/api/types/enums';
import { dashboardAccessToken, dashboardAccessToken2, sub2 } from '@thxnetwork/api/util/jest/constants';
import { afterAllCallback, beforeAllCallback } from '@thxnetwork/api/util/jest/config';
import { AssetPoolDocument } from '@thxnetwork/api/models/AssetPool';
import { PoolTransfer, PoolTransferDocument } from '@thxnetwork/api/models/PoolTransfer';

const user = request.agent(app);

describe('Pool Transfer', () => {
    let pool: AssetPoolDocument, poolTransfer: PoolTransferDocument;

    beforeAll(beforeAllCallback);
    afterAll(afterAllCallback);

    describe('POST /pools', () => {
        it('HTTP 201 (success)', (done) => {
            const title = 'My Test Pool';
            user.post('/v1/pools')
                .set('Authorization', dashboardAccessToken)
                .send({
                    chainId: ChainId.Hardhat,
                    title,
                })
                .expect((res: request.Response) => {
                    pool = res.body;
                    expect(res.body.title).toBe(title);
                    expect(res.body.archived).toBe(false);
                })
                .expect(201, done);
        });
    });

    describe('POST /pool-transfers', () => {
        it('HTTP 201 (success)', (done) => {
            user.post(`/v1/pool-transfers`)
                .set({ 'Authorization': dashboardAccessToken, 'X-PoolId': pool._id })
                .send({
                    poolId: pool._id,
                })
                .expect(({ body }: Response) => {
                    expect(body.token).toBeDefined();
                    expect(body.sub).toBeDefined();
                    expect(new Date(body.expiry).getTime()).toBeGreaterThan(Date.now());

                    poolTransfer = body;
                })
                .expect(201, done);
        });
    });

    describe('GET /pools/:id/transfer', () => {
        it('HTTP 200', (done) => {
            user.get(`/v1/pools/${pool._id}/transfers`)
                .set('Authorization', dashboardAccessToken)
                .expect(({ body }: Response) => {
                    expect(body.length).toBe(1);
                    expect(body[0].token).toBeDefined();
                    expect(body[0].sub).toBeDefined();
                })
                .expect(200, done);
        });
    });

    describe('POST /pools/:id/transfer', () => {
        it('HTTP 403 (Already owner)', (done) => {
            user.post(`/v1/pools/${pool._id}/transfers`)
                .set('Authorization', dashboardAccessToken)
                .send({ token: poolTransfer.token })
                .expect(async ({ body }: Response) => {
                    expect(body.error.message).toBe('You are already an owner for this pool.');
                })
                .expect(403, done);
        });
        it('HTTP 403 (Token expired)', async () => {
            await PoolTransfer.findByIdAndUpdate(poolTransfer._id, { expiry: new Date(Date.now() - 10000) });
            await user
                .post(`/v1/pools/${pool._id}/transfers`)
                .set('Authorization', dashboardAccessToken)
                .send({ token: poolTransfer.token })
                .expect(async ({ body }: Response) => {
                    expect(body.error.message).toBe('Pool transfer token has expired');

                    await PoolTransfer.findByIdAndUpdate(poolTransfer._id, { expiry: poolTransfer.expiry });
                })
                .expect(403);
        });
        it('HTTP 200', (done) => {
            user.post(`/v1/pools/${pool._id}/transfers`)
                .set('Authorization', dashboardAccessToken2)
                .send({ token: poolTransfer.token })
                .expect(200, done);
        });
    });

    describe('GET /pools/:id/transfer (after)', () => {
        it('HTTP 200', (done) => {
            user.get(`/v1/pools/${pool._id}/transfers`)
                .set('Authorization', dashboardAccessToken)
                .expect(({ body }: Response) => {
                    expect(body[0].sub).toBe(sub2);
                    expect(body[0].isExpired).toBe(true);
                    expect(body[0].isTransferred).toBe(true);
                })
                .expect(200, done);
        });
    });
});
