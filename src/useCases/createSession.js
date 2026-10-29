import argon2 from 'argon2';

import {
    SESSION_TTL_MS,
    generateSessionToken,
    hashSessionToken,
} from '../auth/sessionToken.js';
import validateSessionCredentials from '../validation/sessionValidation.js';

let dummyPasswordHashPromise;

const getDummyPasswordHash = () => {
    if (!dummyPasswordHashPromise) {
        dummyPasswordHashPromise = argon2.hash('rahya-invalid-login-dummy', {
            type: argon2.argon2id,
        });
    }

    return dummyPasswordHashPromise;
};

const invalidCredentials = {
    valid: false,
    error: 'INVALID_CREDENTIALS',
    message: 'Email or password is incorrect',
};

const toPublicUser = (user) => ({
    id: user.id ?? user._id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    status: user.status,
});

const createSession = async (input, userRepository, sessionRepository) => {
    const validation = validateSessionCredentials(input);

    if (!validation.valid) {
        return validation;
    }

    const user = await userRepository.findByEmailWithPasswordHash(
        validation.data.email,
    );

    const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());

    let passwordMatches = false;

    try {
        passwordMatches = await argon2.verify(
            passwordHash,
            validation.data.password,
        );
    } catch {
        passwordMatches = false;
    }

    if (!user || !passwordMatches) {
        return invalidCredentials;
    }

    if (user.status === 'deactivated') {
        return {
            valid: false,
            error: 'USER_DEACTIVATED',
            message: 'This account has been deactivated',
        };
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const createdSession = await sessionRepository.create({
        userId: user.id ?? user._id,
        tokenHash: hashSessionToken(token),
        expiresAt,
        revokedAt: null,
    });

    return {
        valid: true,
        data: {
            token,
            expiresAt: createdSession.expiresAt,
            user: toPublicUser(user),
        },
    };
};

export default createSession;
