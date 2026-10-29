import createSession from '../useCases/createSession.js';
import revokeSession from '../useCases/revokeSession.js';
import userRepository from '../repositories/userRepository.js';
import sessionRepository from '../repositories/sessionRepository.js';

const createSessionController = async (req, res, next) => {
    try {
        const result = await createSession(
            req.body,
            userRepository,
            sessionRepository,
        );

        if (!result.valid) {
            const statusByError = {
                INVALID_CREDENTIALS: 401,
                USER_DEACTIVATED: 403,
            };

            return res.status(statusByError[result.error] ?? 400).json({
                error: result.error ?? 'VALIDATION_ERROR',
                message: result.message,
            });
        }

        return res.status(201).json(result.data);
    } catch (error) {
        return next(error);
    }
};

const revokeCurrentSessionController = async (req, res, next) => {
    try {
        const result = await revokeSession(
            req.currentSession.id,
            sessionRepository,
        );

        if (!result.valid) {
            return res.status(401).json({
                error: result.error ?? 'UNAUTHENTICATED',
                message: result.message ?? 'Authentication is required',
            });
        }

        return res.status(200).json({
            message: 'Session revoked',
        });
    } catch (error) {
        return next(error);
    }
};

export { createSessionController, revokeCurrentSessionController };
