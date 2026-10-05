import express from 'express';
import {
    createTransactionController,
    getAccountTransactionsController,
    updateTransactionController
} from '../controllers/transactionController.js';

const router = express.Router();

router.get(
    '/accounts/:accountId/transactions',
    getAccountTransactionsController
);

router.post(
    '/transactions',
    createTransactionController
);

router.patch(
    '/transactions/:transactionId',
    updateTransactionController
);

export default router;
