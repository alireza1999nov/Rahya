import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createServer } from 'node:http';

import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Account from '../src/models/accountModel.js';

const testUri = process.env.MONGODB_TEST_URI;
const testUserId = 'account-route-test-user';
const testUserEmail = 'account-route-test@example.test';

test('account route integration tests', async (t) => {
    assert.ok(testUri, 'MONGODB_TEST_URI must be configured');

    const databaseName = new URL(testUri).pathname.slice(1);
    assert.equal(databaseName, 'rahya_test');

    await mongoose.connect(testUri);

    const server = createServer(app);

    try {
        await User.init();
        await Account.init();

        await User.deleteMany({ _id: testUserId });
        await Account.deleteMany({ userId: testUserId });

        await User.create({
            _id: testUserId,
            name: 'Account Route Test',
            email: testUserEmail,
            passwordHash: 'test-hash'
        });

        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

        const address = server.address();
        const baseUrl = `http://127.0.0.1:${address.port}`;

        await t.test('creates an account and returns 201', async () => {
            const response = await fetch(`${baseUrl}/accounts`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    userId: testUserId,
                    name: 'Route Test Wallet',
                    type: 'cash',
                    openingBalance: 25
                })
            });

            const body = await response.json();

            assert.equal(response.status, 201);
            assert.equal(body.userId, testUserId);
            assert.equal(body.name, 'Route Test Wallet');
            assert.equal(body.openingBalance, 25);
            assert.equal(body.isDefault, true);
            assert.ok(body.id);
        });

        await t.test('returns 400 for invalid account input', async () => {
            const response = await fetch(`${baseUrl}/accounts`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    userId: testUserId,
                    name: '',
                    type: 'cash',
                    openingBalance: 25
                })
            });

            const body = await response.json();

            assert.equal(response.status, 400);
            assert.equal(body.error, 'VALIDATION_ERROR');
        });

        await t.test('returns 409 for a duplicate account name', async () => {
            const response = await fetch(`${baseUrl}/accounts`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    userId: testUserId,
                    name: 'Route Test Wallet',
                    type: 'cash',
                    openingBalance: 30
                })
            });

            const body = await response.json();

            assert.equal(response.status, 409);
            assert.equal(body.error, 'ACCOUNT_NAME_ALREADY_EXISTS');
        });

        await t.test('returns 404 for an unknown user', async () => {
            const response = await fetch(`${baseUrl}/accounts`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    userId: 'account-route-missing-user',
                    name: 'Missing User Wallet',
                    type: 'cash',
                    openingBalance: 10
                })
            });

            const body = await response.json();

            assert.equal(response.status, 404);
            assert.equal(body.error, 'USER_NOT_FOUND');
        });
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });

        await Account.deleteMany({ userId: testUserId });
        await User.deleteMany({ _id: testUserId });

        await mongoose.disconnect();
    }
});
