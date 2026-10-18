import assert from 'node:assert/strict';
import test from 'node:test';
import argon2 from 'argon2';

import createUser from '../src/useCases/createUser.js';

function createUserRepositoryStub(createdUser = {}) {
    const calls = {
        create: [],
    };

    const userRepository = {
        async create(userData) {
            calls.create.push(userData);

            return {
                id: 'user-123',
                name: userData.name,
                email: userData.email,
                emailVerifiedAt: null,
                status: 'pendingVerification',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                updatedAt: new Date('2026-01-01T00:00:00.000Z'),
                ...createdUser,
            };
        },
    };

    return { userRepository, calls };
}

const validInput = {
    name: '  Test User  ',
    email: '  USER@EXAMPLE.COM  ',
    password: 'test-password-123',
};

test('rejects invalid input without creating a user', async () => {
    const { userRepository, calls } = createUserRepositoryStub();

    const result = await createUser(
        {
            name: '',
            email: validInput.email,
            password: validInput.password,
        },
        userRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(result.message, 'Name is required');
    assert.equal(calls.create.length, 0);
});

test('creates a user with normalized data and an Argon2id password hash', async () => {
    const { userRepository, calls } = createUserRepositoryStub();

    const result = await createUser(validInput, userRepository);

    assert.equal(result.valid, true);
    assert.equal(calls.create.length, 1);

    const savedUser = calls.create[0];

    assert.equal(savedUser.name, 'Test User');
    assert.equal(savedUser.email, 'user@example.com');
    assert.equal(typeof savedUser.passwordHash, 'string');
    assert.notEqual(savedUser.passwordHash, validInput.password);

    assert.equal(
        await argon2.verify(savedUser.passwordHash, validInput.password),
        true,
    );

    assert.equal(
        await argon2.needsRehash(savedUser.passwordHash),
        false,
    );
});

test('returns public user data without exposing the password hash', async () => {
    const { userRepository } = createUserRepositoryStub();

    const result = await createUser(validInput, userRepository);

    assert.equal(result.valid, true);

    assert.deepEqual(result.data, {
        id: 'user-123',
        name: 'Test User',
        email: 'user@example.com',
        emailVerifiedAt: null,
        status: 'pendingVerification',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    assert.equal('passwordHash' in result.data, false);
    assert.equal('password' in result.data, false);
});

test('returns a validation error when email is invalid', async () => {
    const { userRepository, calls } = createUserRepositoryStub();

    const result = await createUser(
        {
            ...validInput,
            email: 'not-an-email',
        },
        userRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(result.message, 'Email is invalid');
    assert.equal(calls.create.length, 0);
});

test('returns a validation error when password is missing', async () => {
    const { userRepository, calls } = createUserRepositoryStub();

    const result = await createUser(
        {
            name: 'Test User',
            email: 'user@example.com',
        },
        userRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(result.message, 'Password must be a string');
    assert.equal(calls.create.length, 0);
});

test('propagates repository errors', async () => {
    const databaseError = new Error('Database unavailable');

    const userRepository = {
        async create() {
            throw databaseError;
        },
    };

    await assert.rejects(
        createUser(validInput, userRepository),
        (error) => error === databaseError,
    );
});
