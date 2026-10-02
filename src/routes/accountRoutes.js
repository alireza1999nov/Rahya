import express from 'express';
import createAccount from '../useCases/createAccount.js';
import userRepository from '../repositories/userRepository.js';
import accountRepository from '../repositories/accountRepository.js';

const router = express.Router();

router.post('/accounts', (req, res) => {

    const userId = req.headers['x-user-id'];

    const result = createAccount({
        userId,
        accountInput: req.body,
        userRepository,
        accountRepository
    });

    if (!result.valid) {
        return res.status(400).json({
            error: result.error ?? 'VALIDATION_ERROR',
            message: result.message
        });
    }

    return res.status(201).json(result.data);
});

export default router;
