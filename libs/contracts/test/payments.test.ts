// SPDX-License-Identifier: MIT
import { network, ethers } from 'hardhat';
import { BigNumber, Contract } from 'ethers';
import { expect } from 'chai';
import { parseUnits } from 'ethers/lib/utils';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { BalancerSDK } from '@balancer-labs/sdk';
import { StableMathBigInt } from '@balancer-labs/sor';

const deploy = async (contractName: string, args: any[]) => {
    const factory = await ethers.getContractFactory(contractName);
    return await factory.deploy(...args);
};

const getMinBPTOut = async (owner: string, assets: string[], amountIn: BigNumber) => {
    // Calculate amount of BPT out given exact amounts in
    const rpcUrl = `https://polygon-mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;
    const balancer = new BalancerSDK({ network: 137, rpcUrl });
    const pool = await balancer.pools.find(BALANCER_POOL_ID);
    if (pool) {
        const amountsIn = [amountIn.div(100).mul(70).toString(), '0'];
        const { minBPTOut } = pool?.buildJoin(owner, assets, amountsIn, '50');
        return minBPTOut;
    }
};

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
const BALANCER_POOL_ID = '0xb204bf10bc3a5435017d3db247f56da601dfe08a0002000000000000000000fe';
const DEPOSIT_WITH_PRECISION_LOSS = BigNumber.from('497664000');
const THIRTY_DAYS_IN_S = 30 * 24 * 60 * 60;

describe('PaymentSplitter', function () {
    const costsPerMonth = '500'; // Premium tier is 500 USDC per month
    const amountDeposit = parseUnits(costsPerMonth, 6);
    let splitter: Contract, bpt: Contract, gauge: Contract, usdc: Contract, thx: Contract, registry: Contract;
    let owner: string, rewardDistributor: string, payee: string, minAmountOut: any;

    before(async function () {
        const [signer1, signer2, signer3] = await ethers.getSigners();
        owner = await signer1.getAddress();
        rewardDistributor = await signer2.getAddress();
        payee = await signer3.getAddress();

        usdc = await deploy('USDC', [owner, parseUnits('1000000', 18).toString()]);
        thx = await deploy('THX', [owner, parseUnits('1000000', 18).toString()]);

        bpt = await deploy('BPT', [owner, parseUnits('1000000', 18).toString()]);
        gauge = await deploy('BPTGauge', [bpt.address]);

        const vault = await deploy('BalancerVault', [bpt.address, usdc.address, thx.address]);
        await bpt.setVault(vault.address);
        // Mock: Fill vault with 50% of the BPT supply to transfer upon joinPool
        await bpt.transfer(vault.address, parseUnits('500000', 18));

        registry = await deploy('THXRegistry', [
            usdc.address,
            payee, // Payout receiver
            rewardDistributor, // @dev We use an EOA here but it should be the VE RewardDistributor
            gauge.address,
        ]);
        splitter = await deploy('THXPaymentSplitter', [owner, registry.address]);

        // Calc the BPT minAmountOut for the deposit using Balancer SDK
        minAmountOut = await getMinBPTOut(owner, [usdc.address, thx.address], amountDeposit);
    });

    it('should return 0 if no payments made', async function () {
        const balance = await splitter.balanceOf(owner);
        expect(balance).to.equal(0);
    });

    it('should revert if rate is not set', async function () {
        expect(await splitter.rates(owner)).to.eq(0);
        await expect(splitter.deposit(owner, amountDeposit, minAmountOut)).to.be.revertedWith('PaymentSplitter: !rate');
    });

    it('should set payoutRate in registry', async function () {
        const [_signer1, _signer2, signer3] = await ethers.getSigners();
        const payoutRate = '3000';

        expect(await registry.getPayoutRate()).to.eq(0);

        // Can only be called by the payee. The param will be subject to snapshot votes in the future
        await expect(registry.setPayoutRate('10001')).to.be.revertedWith('THXRegistry: !payee');

        // Should revert if out of bounts. We allow for max 2 decimal percentages.
        await expect(registry.connect(signer3).setPayoutRate('10001')).to.be.revertedWith(
            'THXRegistry: payoutRate out of bounds',
        );

        await registry.connect(signer3).setPayoutRate(payoutRate);
        expect(await registry.getPayoutRate()).to.be.eq(payoutRate);
    });

    it('should return rate per second if set', async function () {
        // @notice Real USDC.e contract has 6 decimals instead of 18
        const usdcPerMonthInWei = ethers.utils.parseUnits(costsPerMonth, 6);
        // Calculate the number of seconds in a month (we use 30 days for the sake of simplicity)

        // Calculate the amount of USDC paid in wei per second.
        // @notice We loose a bit of precision here but this is acceptable
        const rate = usdcPerMonthInWei.div(THIRTY_DAYS_IN_S);
        await splitter.setRate(owner, rate);

        // Assert for rate with precision loss due to devision
        expect(rate.mul(THIRTY_DAYS_IN_S)).to.eq(DEPOSIT_WITH_PRECISION_LOSS);
        expect(await splitter.rates(owner)).to.eq(rate);
    });

    describe('should deposit to splitter', async function () {
        let payout: BigNumber;

        it('should make the deposit', async function () {
            // Assert owner USDC balance (amount * payoutRate / 10000)
            const payoutRate = await registry.getPayoutRate();

            // Allow splitter contract to spend the amount
            await usdc.approve(splitter.address, amountDeposit);

            // Create a deposit for the amount
            await splitter.deposit(owner, amountDeposit, minAmountOut);

            payout = amountDeposit.mul(payoutRate).div(10000);
        });

        it('should forward payout to payee', async function () {
            expect(await registry.getPayee()).to.be.eq(payee);
            expect(payout).to.be.gt(0);
            expect(await usdc.balanceOf(payee)).to.be.eq(payout);
        });

        it('should forward remainder to reward distributor', async function () {
            const balance = await gauge.balanceOf(rewardDistributor);
            expect(balance).to.be.greaterThan(0);
        });

        it('should have 0 balance for token used', async function () {
            expect(await usdc.balanceOf(splitter.address)).to.be.eq(0);
            expect(await bpt.balanceOf(splitter.address)).to.be.eq(0);
            expect(await gauge.balanceOf(splitter.address)).to.be.eq(0);
        });
    });

    describe('should balanceOf', async function () {
        it('should return deposit amount as balance', async function () {
            expect(await splitter.balanceOf(owner)).to.be.eq(parseUnits('500', 6));
        });
        it('should return deposit - t * rate after 5 days', async function () {
            await time.increase((THIRTY_DAYS_IN_S / 30) * 5);

            const currentBalance = await splitter.balanceOf(owner);
            const used = (await splitter.rates(owner)).mul((THIRTY_DAYS_IN_S / 30) * 5);

            // current + used = deposit amount
            expect(parseUnits('500', 6)).to.be.eq(currentBalance.add(used));
        });
        it('should return 0 after 30 days (including precision loss)', async function () {
            await time.increase((THIRTY_DAYS_IN_S / 30) * 25);
            const currentBalance = await splitter.balanceOf(owner);
            expect(BigNumber.from(DEPOSIT_WITH_PRECISION_LOSS).add(currentBalance)).to.be.eq(parseUnits('500', 6));
        });
    });
});
