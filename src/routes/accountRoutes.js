import express from 'express';
import createAccount from '../useCases/createAccount.js';
import userRepository from '../repositories/userRepository.js';
import accountRepository from '../repositories/accountRepository.js';

const router = express.Router();

router.post('/accounts', async (req, res, next) => {
    try {
        const { userId, ...accountInput } = req.body;

        const result = await createAccount({
            userId,
            accountInput,
            userRepository,
            accountRepository
        });

        if (!result.valid) {
            const statusCode =
                result.error === 'ACCOUNT_NAME_ALREADY_EXISTS' ? 409 :
                result.error === 'USER_NOT_FOUND' ? 404 :
                400;

            return res.status(statusCode).json({
                error: result.error ?? 'VALIDATION_ERROR',
                message: result.message
            });
        }

        return res.status(201).json(result.data);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'ACCOUNT_NAME_ALREADY_EXISTS',
                message: 'An account with this name already exists for the user'
            });
        }

        return next(error);
    }
});

export default router;
