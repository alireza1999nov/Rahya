import express from 'express';
import {
    createTransactionController,
    getAccountTransactionsController,
    updateTransactionController,
    deleteTransactionController
} from '../controllers/transactionController.js';
import requireJsonBody from '../middleware/requireJsonBody.js';
import requireAuthenticatedUser from '../middleware/requireAuthenticatedUser.js';

const router = express.Router();

router.get(
    '/accounts/:accountId/transactions',
    requireAuthenticatedUser,
    getAccountTransactionsController
);

router.post(
    '/transactions',
    requireAuthenticatedUser,
    requireJsonBody,
    createTransactionController
);

router.patch(
    '/transactions/:transactionId',
    requireAuthenticatedUser,
    requireJsonBody,
    updateTransactionController
);

router.delete(
    '/transactions/:transactionId',
    requireAuthenticatedUser,
    deleteTransactionController
);

export default router;
