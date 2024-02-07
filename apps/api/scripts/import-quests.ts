import path from 'path';
import db from '@thxnetwork/api/util/database';
import { AssetPool } from '@thxnetwork/api/models/AssetPool';
import { ChainId, QuestVariant, QuestSocialRequirement, AccessTokenKind } from '@thxnetwork/types/enums';
import { Widget } from '@thxnetwork/api/models/Widget';
import { DailyReward } from '@thxnetwork/api/models/DailyReward';
import { ReferralReward } from '@thxnetwork/api/models/ReferralReward';
import { PointReward } from '@thxnetwork/api/models/PointReward';
import { MilestoneReward } from '@thxnetwork/api/models/MilestoneReward';
import {
    readCSV,
    getYoutubeID,
    getTwitterUsername,
    createPool,
    getSuggestion,
    getTwitterTWeet,
    getTwitterUser,
} from './helpers/index';
import { ERC20Perk } from '@thxnetwork/api/models/ERC20Perk';
import { Collaborator } from '@thxnetwork/api/models/Collaborator';

// db.connect(process.env.MONGODB_URI);
db.connect(process.env.MONGODB_URI_PROD);

const csvFilePath = path.join(__dirname, '../../../', 'quests.csv');
// const sub = '60a38b36bf804b033c5e3faa'; // Local
const sub = '6074cbdd1459355fae4b6a14'; // Peter
const sub2 = '655d0c5dde9eca4f50999423'; // Prasanth
const sub3 = '627d06fbb0d159d419292240'; // Mieszko
const collaborators = [
    {
        sub,
        email: 'peter@thx.network',
    },
    {
        sub: sub2,
        email: 'mieszko@thx.network',
    },
    {
        sub: sub3,
        email: 'prasanth@thx.network',
    },
];

// const chainId = ChainId.Hardhat;
const chainId = ChainId.Polygon;
// const erc20Id = '64d3a4149f7e6d78c9366982'; // Local
const erc20Id = '6464c665633c1cf385d8cc2b'; // THX Network (POS) on Prod

async function main() {
    const start = Date.now();
    const skipped = [];
    const results = [];
    console.log('Start', new Date());

    let tokens = 0;
    try {
        const data: any = await readCSV(csvFilePath);

        for (const sql of data) {
            const videoUrl = sql['Youtube Video URL'];
            const tweetUrl = sql['Twitter Tweet URL'];
            const serverId = sql['Discord Server ID'];
            const missingMaterials = sql['Sales Material'] === 'Missing';
            const gameName = sql['Game'];
            const gameDomain = sql['Game Domain'];

            if (!missingMaterials || !gameName || !gameDomain) continue;

            let pool = await AssetPool.findOne({ 'settings.title': gameName });
            console.log('===============');
            console.log('Import: ', gameName, gameDomain);
            if (pool) {
                await Widget.updateOne({ poolId: pool._id }, { domain: new URL(gameDomain).origin });
            } else {
                pool = await createPool(sub, gameName, gameDomain);
            }

            const poolId = pool._id;

            // Remove all existing data
            await Promise.all([
                DailyReward.deleteMany({ poolId }),
                ReferralReward.deleteMany({ poolId }),
                PointReward.deleteMany({ poolId }),
                MilestoneReward.deleteMany({ poolId }),
                ERC20Perk.deleteMany({ poolId, erc20Id }),
                Collaborator.deleteMany({ poolId }),
            ]);

            // Create social quest youtube like
            if (videoUrl && videoUrl !== 'N/A') {
                const videoId = getYoutubeID(videoUrl);
                const socialQuestYoutubeLike = {
                    poolId,
                    index: 0,
                    uuid: db.createUUID(),
                    title: `Watch & Like`,
                    description: '',
                    amount: 75,
                    kind: AccessTokenKind.Google,
                    interaction: QuestSocialRequirement.YouTubeLike,
                    content: videoId,
                    contentMetadata: JSON.stringify({ videoId }),
                    isPublished: true,
                    variant: QuestVariant.YouTube,
                };
                await PointReward.create(socialQuestYoutubeLike);
            }

            // Create social quest twitter retweet
            if (tweetUrl && tweetUrl !== 'N/A') {
                const username = getTwitterUsername(tweetUrl);
                const twitterUser = await getTwitterUser(username);
                const socialQuestFollow = {
                    poolId,
                    index: 1,
                    uuid: db.createUUID(),
                    title: `Follow ${sql['Game']}`,
                    description: '',
                    amount: 75,
                    kind: AccessTokenKind.Twitter,
                    interaction: QuestSocialRequirement.TwitterFollow,
                    content: twitterUser.id,
                    variant: QuestVariant.Twitter,
                    contentMetadata: JSON.stringify({
                        id: twitterUser.id,
                        name: twitterUser.name,
                        username: twitterUser.username,
                        profileImgUrl: twitterUser.profile_image_url,
                    }),
                    isPublished: true,
                };
                await PointReward.create(socialQuestFollow);

                const tweetId = tweetUrl.match(/\/(\d+)(?:\?|$)/)[1];
                const [tweet] = await getTwitterTWeet(tweetId);
                const socialQuestRetweet = {
                    poolId,
                    uuid: db.createUUID(),
                    variant: QuestVariant.Twitter,
                    title: `Boost Tweet!`,
                    description: '',
                    amount: 50,
                    kind: AccessTokenKind.Twitter,
                    interaction: QuestSocialRequirement.TwitterLikeRetweet,
                    content: tweetId,
                    contentMetadata: JSON.stringify({
                        url: tweetUrl,
                        username: twitterUser.username,
                        text: tweet.text,
                    }),
                    isPublished: true,
                };
                await PointReward.create(socialQuestRetweet);
            }

            // Create social quest twitter retweet
            if (serverId && serverId !== 'N/A') {
                const inviteURL = sql['Discord Invite URL'];
                const socialQuestJoin = {
                    poolId,
                    variant: QuestVariant.Discord,
                    uuid: db.createUUID(),
                    title: `Join ${gameName} Discord`,
                    description: 'Become a part of our fam!',
                    amount: 75,
                    kind: AccessTokenKind.Discord,
                    interaction: QuestSocialRequirement.DiscordGuildJoined,
                    content: serverId,
                    contentMetadata: JSON.stringify({ serverId, inviteURL: inviteURL || undefined }),
                    isPublished: true,
                };
                await PointReward.create(socialQuestJoin);
            }

            // Create default erc20 rewards
            await ERC20Perk.create({
                poolId,
                uuid: db.createUUID(),
                title: `Small bag of $THX`,
                description: 'A token of appreciation offered to you by THX Network. Could also be your own token!',
                image: 'https://thx-storage-bucket.s3.eu-west-3.amazonaws.com/widget-referral-xmzfznsqschvqxzvgn47qo-xtencq4fmgjg7qgwewmybj-(1)-8EHr7ckbrEZLqUyxqJK1LG.png',
                pointPrice: 1000,
                limit: 1000,
                amount: 10,
                erc20Id,
                isPublished: true,
            });

            // Create colloborators
            for (const c of collaborators) {
                await Collaborator.create({
                    poolId,
                    sub: c.sub,
                    state: 1,
                    uuid: db.createUUID(),
                    email: c.email,
                });
            }

            // Iterate over available quests and create
            for (let i = 1; i < 3; i++) {
                const questType = sql[`Q${i} - Type`];
                const points = sql[`Q${i} - Points`];
                const title = sql[`Q${i} - Title`];
                if (!questType || !points || !title) {
                    console.log(`Incomplete Q${i}!`);
                    continue;
                }

                let titleSuggestion, descriptionSuggestion;
                if (['Daily', 'Custom'].includes(questType)) {
                    titleSuggestion = await getSuggestion(sql[`Q${i} - Title`], 40);
                    tokens += titleSuggestion.tokensUsed;
                    descriptionSuggestion = await getSuggestion(sql[`Q${i} - Description`], 100);
                    tokens += descriptionSuggestion.tokensUsed;
                }

                switch (questType) {
                    case 'Daily': {
                        const dailyQuest = {
                            poolId,
                            variant: QuestVariant.Daily,
                            title: titleSuggestion.content,
                            description: descriptionSuggestion.content,
                            amounts: [5, 10, 20, 40, 80, 160, 360],
                            isPublished: true,
                        };
                        await DailyReward.create(dailyQuest);
                        console.log(sql[`Q${i} - Type`], titleSuggestion.content, 'quest created!');
                        break;
                    }
                    case 'Custom': {
                        const customQuest = {
                            poolId,
                            variant: QuestVariant.Custom,
                            title: titleSuggestion.content,
                            description: descriptionSuggestion.content,
                            amount: Number(sql[`Q${i} - Points`]),
                            limit: 0,
                            isPublished: true,
                        };
                        await MilestoneReward.create(customQuest);
                        console.log(sql[`Q${i} - Type`], titleSuggestion.content, 'quest created!');
                        break;
                    }
                    default: {
                        console.log(sql[`Q${i} - Type`], 'quest skipped...');
                    }
                }
            }
            results.push([sql['Game'], `https://dashboard.thx.network/preview/${poolId}`]);
        }
    } catch (err) {
        console.error(err);
    }
    console.log('===============');
    console.log('COPY BELOW INTO SHEET');
    console.log('===============');
    results.forEach((item) => {
        console.log(`${item[0]}\t${item[1]}`);
    });
    console.log('===============');
    console.log('Skipped', skipped);
    console.log('End', new Date());
    console.log('Duration', Date.now() - start, 'seconds');
    console.log('Tokens Spent', tokens);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
