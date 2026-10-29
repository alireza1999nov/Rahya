import assert from 'node:assert/strict';
import test from 'node:test';

import User from '../src/models/userModel.js';

function createValidUser(overrides = {}) {
    return new User({
        name: 'Test User',
        email: 'user@example.com',
        passwordHash: 'test-hash',
        ...overrides,
    });
}

async function assertValidationError(user, path) {
    await assert.rejects(user.validate(), (error) => {
        assert.equal(error.name, 'ValidationError');
        assert.ok(error.errors[path]);

        return true;
    });
}

test('generates a UUID v4 as the default user ID', () => {
    const user = createValidUser();

    assert.match(
        user._id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
});

test('generates a unique ID for each user document', () => {
    const firstUser = createValidUser();
    const secondUser = createValidUser();

    assert.notEqual(firstUser._id, secondUser._id);
});

test('uses a string for the user ID', () => {
    const user = createValidUser();

    assert.equal(typeof user._id, 'string');
});

test('accepts a valid user document', async () => {
    const user = createValidUser();

    await user.validate();
});

test('requires email', async () => {
    const user = new User({
        passwordHash: 'test-hash',
    });

    await assertValidationError(user, 'email');
});

test('requires passwordHash', async () => {
    const user = new User({
        email: 'user@example.com',
    });

    await assertValidationError(user, 'passwordHash');
});

test('trims whitespace from email', () => {
    const user = createValidUser({
        email: '  user@example.com  ',
    });

    assert.equal(user.email, 'user@example.com');
});

test('converts email to lowercase', () => {
    const user = createValidUser({
        email: 'USER@EXAMPLE.COM',
    });

    assert.equal(user.email, 'user@example.com');
});

test('defaults emailVerifiedAt to null', () => {
    const user = createValidUser();

    assert.equal(user.emailVerifiedAt, null);
});

test('defaults status to active', () => {
    const user = createValidUser();

    assert.equal(user.status, 'active');
});

test('accepts active status', async () => {
    const user = createValidUser({
        status: 'active',
    });

    await user.validate();
});

test('accepts deactivated status', async () => {
    const user = createValidUser({
        status: 'deactivated',
    });

    await user.validate();
});

test('accepts pendingVerification status', async () => {
    const user = createValidUser({
        status: 'pendingVerification',
    });

    await user.validate();
});

test('rejects a status outside the approved enum', async () => {
    const user = createValidUser({
        status: 'pending',
    });

    await assertValidationError(user, 'status');
});

test('requires email in the schema', () => {
    assert.equal(User.schema.path('email').isRequired, true);
});

test('trims email in the schema', () => {
    assert.equal(User.schema.path('email').options.trim, true);
});

test('lowercases email in the schema', () => {
    assert.equal(User.schema.path('email').options.lowercase, true);
});

test('defines email as unique in the schema', () => {
    assert.equal(User.schema.path('email').options.unique, true);
});

test('excludes passwordHash from query results by default', () => {
    assert.equal(User.schema.path('passwordHash').options.select, false);
});

test('restricts status to the approved enum values', () => {
    assert.deepEqual(
        User.schema.path('status').enumValues,
        ['pendingVerification', 'active', 'deactivated'],
    );
});

test('enables automatic createdAt and updatedAt timestamps', () => {
    assert.equal(User.schema.options.timestamps, true);
});

test('disables the Mongoose version key', () => {
    assert.equal(User.schema.options.versionKey, false);
});
