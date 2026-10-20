import express from 'express';
import {
    createTransactionController,
    getAccountTransactionsController,
    updateTransactionController,
    deleteTransactionController
} from '../controllers/transactionController.js';
import requireJsonBody from '../middleware/requireJsonBody.js';

const router = express.Router();

router.get(
    '/accounts/:accountId/transactions',
    getAccountTransactionsController
);

router.post(
    '/transactions',
    requireJsonBody,
    createTransactionController
);

router.patch(
    '/transactions/:transactionId',
    requireJsonBody,
    updateTransactionController
);

router.delete(
    '/transactions/:transactionId',
    deleteTransactionController
);

export default router;
