import mongoose from 'mongoose';
import { getDiamondAbi } from '../config/contracts';
import { getProvider } from '../util/network';
import { TWallet } from '@thxnetwork/types/interfaces';

export type WalletDocument = mongoose.Document & TWallet;

const walletSchema = new mongoose.Schema(
    { uuid: String, poolId: String, address: String, sub: String, chainId: Number, version: String },
    { timestamps: true },
);

walletSchema.virtual('contract').get(function () {
    if (!this.address) return;
    const { readProvider, defaultAccount } = getProvider(this.chainId);
    const abi = getDiamondAbi(this.chainId, 'sharedWallet');
    return new readProvider.eth.Contract(abi, this.address, { from: defaultAccount });
});

export const Wallet = mongoose.model<WalletDocument>('wallet', walletSchema);
