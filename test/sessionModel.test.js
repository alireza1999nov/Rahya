import assert from 'node:assert/strict';
import test from 'node:test';

import Session from '../src/models/sessionModel.js';

function createValidSession(overrides = {}) {
    return new Session({
        userId: 'user-123',
        tokenHash: 'a'.repeat(64),
        expiresAt: new Date('2026-10-21T12:00:00.000Z'),
        ...overrides,
    });
}

async function assertValidationError(session, path) {
    await assert.rejects(session.validate(), (error) => {
        assert.equal(error.name, 'ValidationError');
        assert.ok(error.errors[path]);

        return true;
    });
}

test('generates a UUID v4 as the default session ID', () => {
    const session = createValidSession();

    assert.match(
        session._id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
});

test('requires userId', async () => {
    const session = createValidSession({ userId: undefined });

    await assertValidationError(session, 'userId');
});

test('requires tokenHash', async () => {
    const session = createValidSession({ tokenHash: undefined });

    await assertValidationError(session, 'tokenHash');
});

test('requires expiresAt', async () => {
    const session = createValidSession({ expiresAt: undefined });

    await assertValidationError(session, 'expiresAt');
});

test('defaults revokedAt to null', () => {
    const session = createValidSession();

    assert.equal(session.revokedAt, null);
});

test('defines tokenHash as unique', () => {
    assert.equal(Session.schema.path('tokenHash').options.unique, true);
});

test('disables the Mongoose version key', () => {
    assert.equal(Session.schema.options.versionKey, false);
});
