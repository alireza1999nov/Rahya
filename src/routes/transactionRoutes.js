import express from 'express';
import createTransaction from '../useCases/createTransaction.js';
import transactionRepository from '../repositories/transactionRepository.js';
import accountRepository from '../repositories/accountRepository.js';

const router = express.Router();

router.post('/transactions', (req, res) => {

    const result = createTransaction(
        req.body,
        transactionRepository,
        accountRepository
    );

    if (!result.valid) {
        return res.status(400).json({
            error: result.error ?? 'VALIDATION_ERROR',
            message: result.message
        });
    }

    return res.status(201).json(result.data);
});

export default router;
