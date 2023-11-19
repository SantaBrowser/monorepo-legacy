import { Request, Response } from 'express';
import { param } from 'express-validator';
import { BadRequestError, ForbiddenError, NotFoundError } from '@thxnetwork/api/util/errors';
import { Widget } from '@thxnetwork/api/models/Widget';
import PointBalanceService, { PointBalance } from '@thxnetwork/api/services/PointBalanceService';
import PoolService from '@thxnetwork/api/services/PoolService';
import AccountProxy from '@thxnetwork/api/proxies/AccountProxy';
import MailService from '@thxnetwork/api/services/MailService';
import SafeService from '@thxnetwork/api/services/SafeService';
import PerkService from '@thxnetwork/api/services/PerkService';
import { DiscordRoleReward } from '@thxnetwork/api/models/DiscordRoleReward';
import { DiscordRoleRewardPayment } from '@thxnetwork/api/models/DiscordRoleRewardPayment';
import { client } from 'apps/api/src/discord';
import DiscordGuild from '@thxnetwork/api/models/DiscordGuild';
import { AccessTokenKind } from '@thxnetwork/common/lib/types';

const validation = [param('uuid').exists()];

const controller = async (req: Request, res: Response) => {
    // #swagger.tags = ['Reward Payment']

    const pool = await PoolService.getById(req.header('X-PoolId'));
    const widget = await Widget.findOne({ poolId: pool._id });

    const discordRoleReward = await DiscordRoleReward.findOne({ uuid: req.params.uuid });
    if (!discordRoleReward) throw new NotFoundError('Could not find this reward');
    if (!discordRoleReward.pointPrice) throw new NotFoundError('No point price for this reward has been set.');

    const account = await AccountProxy.getById(req.auth.sub);
    const wallet = await SafeService.findPrimary(account.sub, pool.chainId);
    const pointBalance = await PointBalance.findOne({ walletId: wallet._id, poolId: pool._id });
    if (!pointBalance || Number(pointBalance.balance) < Number(discordRoleReward.pointPrice)) {
        throw new BadRequestError('Not enough points on this account for this payment');
    }

    const redeemValidationResult = await PerkService.validate({ perk: discordRoleReward, sub: req.auth.sub, pool });
    if (redeemValidationResult.isError) {
        throw new ForbiddenError(redeemValidationResult.errorMessage);
    }

    // Give role to user
    const discordGuild = await DiscordGuild.findOne({ poolId: discordRoleReward.poolId });
    if (!discordGuild) {
        throw new ForbiddenError(`THX Bot is not invited to the ${discordGuild.name} Discord server`);
    }
    const guild = await client.guilds.fetch(discordGuild.guildId);
    const connectedAccount = account.connectedAccounts.find(({ kind }) => kind === AccessTokenKind.Discord);
    if (!connectedAccount) {
        throw new ForbiddenError('Your account is not connected to a Discord account');
    }

    const member = await guild.members.fetch(connectedAccount.userId);
    if (!member) {
        throw new ForbiddenError(`You are not a member of the ${discordGuild.name} Discord server`);
    }

    await member.roles.add(discordRoleReward.discordRoleId);

    const discordRoleRewardPayment = await DiscordRoleRewardPayment.create({
        perkId: discordRoleReward._id,
        discordRoleId: discordRoleReward.discordRoleId,
        sub: req.auth.sub,
        walletId: wallet._id,
        poolId: discordRoleReward.poolId,
        amount: discordRoleReward.pointPrice,
    });

    await PointBalanceService.subtract(pool, wallet._id, discordRoleReward.pointPrice);

    let html = `<p style="font-size: 18px">Congratulations!🚀</p>`;
    html += `<p>Your point redemption has been received and a Discord Role Reward has been created for you!</p>`;
    html += `<p class="btn"><a href="${widget.domain}">View Wallet</a></p>`;

    await MailService.send(account.email, `🎁 Discord Role Reward Received!"`, html);

    res.status(201).json({ discordRoleRewardPayment });
};

export default { controller, validation };