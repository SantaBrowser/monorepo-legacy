import { AccountPlanType, AccessTokenKind, Role, Goal, ChainId } from '@thxnetwork/types/enums';
import { AccountVariant } from '@thxnetwork/types/interfaces';

export type TAccount = {
    _id: string;
    sub: string;
    firstName: string;
    lastName: string;
    referralCode: string;
    profileImg: string;
    plan: AccountPlanType;
    website: string;
    organisation: string;
    active: boolean;
    isEmailVerified: boolean;
    email: string;
    password: string;
    address: string;
    variant: AccountVariant;
    privateKey: string;
    otpSecret: string;
    twitterId?: string;
    lastLoginAt: number;
    acceptTermsPrivacy: boolean;
    acceptUpdates: boolean;
    comparePassword: any;
    tokens: IAccessToken[];
    discordId?: string;
    shopifyStoreUrl?: string;
    role: Role;
    goal: Goal[];
    googleAccess?: boolean;
    youtubeViewAccess?: boolean;
    youtubeManageAccess?: boolean;
    twitterAccess?: boolean;
    githubAccess?: boolean;
    twitchAccess?: boolean;
    discordAccess?: boolean;
    shopifyAccess?: boolean;
    authenticationToken?: string;
    authenticationTokenExpires?: number;
    getAddress: (chainId: ChainId) => Promise<string>;
    getToken: (token: AccessTokenKind) => IAccessToken;
    setToken: (token: IAccessToken) => IAccessToken;
    unsetToken: (token: AccessTokenKind) => void;
    createdAt: Date;
    updatedAt: Date;
};

export interface IAccessToken {
    kind: AccessTokenKind;
    accessToken?: string;
    refreshToken?: string;
    expiry?: number;
    userId?: string;
}