import assert from 'node:assert/strict';
import test from 'node:test';

import revokeSession from '../src/useCases/revokeSession.js';

test('revokes an active session', async () => {
    const sessionRepository = {
        async revokeById(sessionId) {
            return {
                id: sessionId,
                revokedAt: new Date(),
            };
        },
    };

    const result = await revokeSession('session-123', sessionRepository);

    assert.equal(result.valid, true);
    assert.equal(result.data.id, 'session-123');
});

test('returns unauthenticated when the session cannot be revoked', async () => {
    const sessionRepository = {
        async revokeById() {
            return null;
        },
    };

    const result = await revokeSession('session-123', sessionRepository);

    assert.equal(result.valid, false);
    assert.equal(result.error, 'UNAUTHENTICATED');
});
