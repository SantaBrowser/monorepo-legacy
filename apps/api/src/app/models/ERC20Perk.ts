import mongoose from 'mongoose';
import { TERC20Perk } from '@thxnetwork/types/';

export const rewardBaseSchema = {
    uuid: String,
    poolId: { type: String, index: 'hashed' },
    title: String,
    description: String,
    image: String,
    index: Number,
    infoLinks: [{ label: String, url: String }],
    isPublished: { type: Boolean, default: false },
};

export const perkBaseSchema = {
    uuid: String,
    poolId: { type: String, index: 'hashed' },
    title: String,
    description: String,
    image: String,
    pointPrice: Number,
    expiryDate: Date,
    claimAmount: Number,
    claimLimit: Number,
    isPromoted: { type: Boolean, default: false },
    tokenGatingVariant: Number,
    tokenGatingContractAddress: String,
    tokenGatingAmount: Number,
    isPublished: { type: Boolean, default: false },
};

export type ERC20PerkDocument = mongoose.Document & TERC20Perk;

const schema = new mongoose.Schema(
    {
        ...perkBaseSchema,
        limit: Number,
        erc20Id: String,
        amount: String,
        pointPrice: Number,
        image: String,
    },
    { timestamps: true },
);
schema.index({ createdAt: 1 });

export const ERC20Perk = mongoose.model<ERC20PerkDocument>('erc20perks', schema);
