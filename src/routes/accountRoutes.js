import express from 'express';
import createAccount from '../useCases/createAccount.js';
import userRepository from '../repositories/userRepository.js';
import accountRepository from '../repositories/accountRepository.js';
import requireJsonBody from '../middleware/requireJsonBody.js';
import requireAuthenticatedUser from '../middleware/requireAuthenticatedUser.js';
import { getCurrentBalanceController } from '../controllers/accountController.js';

const router = express.Router();

router.get(
    '/accounts/:accountId/balance',
    requireAuthenticatedUser,
    getCurrentBalanceController
);

router.post(
    '/accounts',
    requireAuthenticatedUser,
    requireJsonBody,
    async (req, res, next) => {
        try {
            const { userId: _ignoredClientUserId, ...accountInput } = req.body;

            const result = await createAccount({
                userId: req.currentUser.id,
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
            const isDuplicateAccountName =
                error.code === 11000 &&
                (
                    (
                        error.keyPattern?.userId === 1 &&
                        error.keyPattern?.name === 1
                    ) ||
                    (
                        error.keyValue?.userId !== undefined &&
                        error.keyValue?.name !== undefined
                    )
                );

            if (isDuplicateAccountName) {
                return res.status(409).json({
                    error: 'ACCOUNT_NAME_ALREADY_EXISTS',
                    message: 'An account with this name already exists for the user',
                });
            }

            return next(error);
        }
    }
);

export default router;
