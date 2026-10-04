import express from 'express';
import {
    createTransactionController,
    getAccountTransactionsController
} from '../controllers/transactionController.js';

const router = express.Router();

router.get('/accounts/:accountId/transactions',
    getAccountTransactionsController
);

router.post(
    '/transactions',
    createTransactionController
);

export default router;
