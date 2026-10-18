import express from 'express';
import createUser from '../useCases/createUser.js';
import userRepository from '../repositories/userRepository.js';

const router = express.Router();

router.post('/users', async (req, res, next) => {
    try {
        const result = await createUser(req.body, userRepository);

        if (!result.valid) {
            return res.status(400).json({ error: result.message });
        }

        return res.status(201).json(result.data);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'An account with this email already exists'
            });
        }

        return next(error);
    }
});

export default router;
