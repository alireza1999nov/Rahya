import express from 'express';
import createUser from '../useCases/createUser.js';
import  userRepository  from '../repositories/userRepository.js';

const router = express.Router();

router.post('/users', (req, res) => {
    const result = createUser(req.body, userRepository);

    if (!result.valid) {
        return res.status(400).json({ error: result.message });
    }

    res.status(201).json(result.data);
});

export default router;
