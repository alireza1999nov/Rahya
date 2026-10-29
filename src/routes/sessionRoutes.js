import express from 'express';

import {
    createSessionController,
    revokeCurrentSessionController,
} from '../controllers/sessionController.js';
import requireJsonBody from '../middleware/requireJsonBody.js';
import requireAuthenticatedUser from '../middleware/requireAuthenticatedUser.js';

const router = express.Router();

router.post('/sessions', requireJsonBody, createSessionController);

router.delete(
    '/sessions/current',
    requireAuthenticatedUser,
    revokeCurrentSessionController,
);

export default router;
