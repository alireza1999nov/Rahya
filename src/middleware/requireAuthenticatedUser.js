import { hashSessionToken } from '../auth/sessionToken.js';
import sessionRepository from '../repositories/sessionRepository.js';
import userRepository from '../repositories/userRepository.js';

const sendUnauthenticated = (res) => {
    return res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: 'Authentication is required',
    });
};

const requireAuthenticatedUser = async (req, res, next) => {
    try {
        const header = req.get('authorization');

        if (typeof header !== 'string' || header.trim() === '') {
            return sendUnauthenticated(res);
        }

        const [scheme, token, ...extraParts] = header.trim().split(/\s+/);

        if (
            scheme.toLowerCase() !== 'bearer' ||
            !token ||
            extraParts.length > 0
        ) {
            return sendUnauthenticated(res);
        }

        const session = await sessionRepository.findActiveByTokenHash(
            hashSessionToken(token),
        );

        if (!session) {
            return sendUnauthenticated(res);
        }

        const user = await userRepository.findById(session.userId);

        if (!user) {
            return sendUnauthenticated(res);
        }

        if (user.status === 'deactivated') {
            return res.status(403).json({
                error: 'USER_DEACTIVATED',
                message: 'This account has been deactivated',
            });
        }

        req.currentUser = {
            id: user.id ?? user._id,
            name: user.name,
            email: user.email,
            emailVerifiedAt: user.emailVerifiedAt ?? null,
            status: user.status,
        };

        req.currentSession = {
            id: session.id,
            userId: session.userId,
            expiresAt: session.expiresAt,
        };

        return next();
    } catch (error) {
        return next(error);
    }
};

export default requireAuthenticatedUser;
