import express from 'express';
import createUser from '../useCases/createUser.js';
import userRepository from '../repositories/userRepository.js';
import requireJsonBody from '../middleware/requireJsonBody.js';

const router = express.Router();

router.post('/users', requireJsonBody, async (req, res, next) => {
    try {
        const result = await createUser(req.body, userRepository);

        if (!result.valid) {
            return res.status(400).json({
                error: result.error ?? 'VALIDATION_ERROR',
                message: result.message,
            });
        }

        return res.status(201).json(result.data);
    } catch (error) {
        const isDuplicateEmail =
            error.code === 11000 &&
            (
                error.keyPattern?.email === 1 ||
                error.keyValue?.email !== undefined
            );

        if (isDuplicateEmail) {
            return res.status(409).json({
                error: 'EMAIL_ALREADY_EXISTS',
                message: 'An account with this email already exists',
            });
        }

        return next(error);
    }
});

export default router;
