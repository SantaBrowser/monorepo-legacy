import { assertRequestInput, checkJwt, corsHandler } from '@thxnetwork/api/middlewares';
import express from 'express';
import ListQuests from './list.controller';
import ListQuestsPublic from './public/list.controller';
import CreateQuestDailyClaim from './daily/claim/post.controller';
import CreateQuestInviteClaim from './invite/claim/post.controller';
import CreateQuestSocialClaim from './social/claim/post.controller';
import CreateQuestCustomClaim from './custom/claim/post.controller';
import CreateQuestWeb3Claim from './web3/complete/post.controller';
import rateLimit from 'express-rate-limit';
import { NODE_ENV } from '@thxnetwork/api/config/secrets';

const router = express.Router();

router.get('/', ListQuests.controller);
router.get('/public', ListQuestsPublic.controller);
router.use(checkJwt).use(corsHandler).post('/daily/:id/claim', CreateQuestDailyClaim.controller);
router.post(
    '/invite/:uuid/claim',
    rateLimit((() => (NODE_ENV !== 'test' ? { windowMs: 1 * 1000, max: 1 } : {}))()),
    assertRequestInput(CreateQuestInviteClaim.validation),
    CreateQuestInviteClaim.controller,
);
router.use(checkJwt).use(corsHandler).post('/social/:id/claim', CreateQuestSocialClaim.controller);
router.use(checkJwt).use(corsHandler).post('/custom/claims/:uuid/collect', CreateQuestCustomClaim.controller);
router.use(checkJwt).use(corsHandler).post('/web3/:uuid/claim', CreateQuestWeb3Claim.controller);

export default router;