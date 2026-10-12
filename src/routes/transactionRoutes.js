import express from 'express';
import {
    createTransactionController,
    getAccountTransactionsController,
    updateTransactionController,
    deleteTransactionController
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

router.delete(
    '/transactions/:transactionId',
    deleteTransactionController
);

export default router;
