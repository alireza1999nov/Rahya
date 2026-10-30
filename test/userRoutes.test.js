import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import app from '../src/app.js';
import User from '../src/models/userModel.js';

const testUri = process.env.MONGODB_TEST_URI;

test('user route integration tests', async (t) => {
    assert.ok(testUri, 'MONGODB_TEST_URI must be configured');

    const databaseName = new URL(testUri).pathname.slice(1);
    assert.equal(databaseName, 'rahya_test');

    await mongoose.connect(testUri);

    const server = createServer(app);
    const suffix = randomUUID();
    const email = `user-route-${suffix}@example.test`;
    const createdUserIds = [];

    try {
        await User.init();

        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

        const address = server.address();
        const baseUrl = `http://127.0.0.1:${address.port}`;

        await t.test('POST /users creates a user and returns 201', async () => {
            const response = await fetch(`${baseUrl}/users`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    name: '  Route User  ',
                    email: `  ${email.toUpperCase()}  `,
                    password: 'user-route-password',
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 201);
            assert.equal(typeof body.id, 'string');
            assert.equal(body.name, 'Route User');
            assert.equal(body.email, email);
            assert.equal(body.status, 'active');
            assert.equal(body.emailVerifiedAt, null);
            assert.equal('passwordHash' in body, false);
            assert.equal('password' in body, false);

            createdUserIds.push(body.id);

            const persisted = await User.findById(body.id).select('+passwordHash').lean();

            assert.ok(persisted);
            assert.equal(persisted.email, email);
            assert.equal(typeof persisted.passwordHash, 'string');
            assert.notEqual(persisted.passwordHash, 'user-route-password');
        });

        await t.test('POST /users returns 400 for invalid input', async () => {
            const response = await fetch(`${baseUrl}/users`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    name: '',
                    email,
                    password: 'user-route-password',
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 400);
            assert.equal(body.error, 'VALIDATION_ERROR');
        });

        await t.test('POST /users returns 409 for a duplicate email', async () => {
            const response = await fetch(`${baseUrl}/users`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    name: 'Another Route User',
                    email,
                    password: 'another-password',
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 409);
            assert.equal(body.error, 'EMAIL_ALREADY_EXISTS');
        });
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });

        await User.deleteMany({
            $or: [
                { _id: { $in: createdUserIds } },
                { email },
            ],
        });

        await mongoose.disconnect();
    }
});
