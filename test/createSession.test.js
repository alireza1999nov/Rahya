import assert from 'node:assert/strict';
import test from 'node:test';
import argon2 from 'argon2';

import createSession from '../src/useCases/createSession.js';
import { hashSessionToken } from '../src/auth/sessionToken.js';

const password = 'correct-password';
const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
});

function createDependencies({
    user = {
        id: 'user-123',
        name: 'Test User',
        email: 'user@example.com',
        passwordHash,
        emailVerifiedAt: null,
        status: 'active',
    },
} = {}) {
    const calls = {
        findByEmail: [],
        createSession: [],
    };

    const userRepository = {
        async findByEmailWithPasswordHash(email) {
            calls.findByEmail.push(email);
            return user && user.email === email ? user : null;
        },
    };

    const sessionRepository = {
        async create(session) {
            calls.createSession.push(session);

            return {
                id: 'session-123',
                ...session,
            };
        },
    };

    return { userRepository, sessionRepository, calls };
}

test('rejects invalid credentials for an unknown email', async () => {
    const deps = createDependencies({ user: null });

    const result = await createSession(
        {
            email: 'missing@example.com',
            password,
        },
        deps.userRepository,
        deps.sessionRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'INVALID_CREDENTIALS');
    assert.equal(deps.calls.createSession.length, 0);
});

test('rejects invalid credentials for a wrong password', async () => {
    const deps = createDependencies();

    const result = await createSession(
        {
            email: 'user@example.com',
            password: 'wrong-password',
        },
        deps.userRepository,
        deps.sessionRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'INVALID_CREDENTIALS');
    assert.equal(deps.calls.createSession.length, 0);
});

test('rejects a deactivated user after verifying the password', async () => {
    const deps = createDependencies({
        user: {
            id: 'user-123',
            name: 'Test User',
            email: 'user@example.com',
            passwordHash,
            emailVerifiedAt: null,
            status: 'deactivated',
        },
    });

    const result = await createSession(
        {
            email: 'user@example.com',
            password,
        },
        deps.userRepository,
        deps.sessionRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'USER_DEACTIVATED');
    assert.equal(deps.calls.createSession.length, 0);
});

test('creates a session and returns the raw token only once', async () => {
    const deps = createDependencies();

    const result = await createSession(
        {
            email: '  USER@EXAMPLE.COM  ',
            password,
        },
        deps.userRepository,
        deps.sessionRepository,
    );

    assert.equal(result.valid, true);
    assert.equal(typeof result.data.token, 'string');
    assert.ok(result.data.token.length > 20);
    assert.equal(result.data.user.id, 'user-123');
    assert.equal(result.data.user.status, 'active');
    assert.equal('passwordHash' in result.data.user, false);
    assert.equal(deps.calls.createSession.length, 1);

    const storedSession = deps.calls.createSession[0];

    assert.equal(storedSession.userId, 'user-123');
    assert.equal(storedSession.tokenHash, hashSessionToken(result.data.token));
    assert.notEqual(storedSession.tokenHash, result.data.token);
    assert.equal(storedSession.revokedAt, null);
    assert.ok(storedSession.expiresAt instanceof Date);
    assert.ok(storedSession.expiresAt.getTime() > Date.now());
});
