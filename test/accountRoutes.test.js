import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createServer } from 'node:http';

import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Account from '../src/models/accountModel.js';
import Session from '../src/models/sessionModel.js';
import { hashSessionToken } from '../src/auth/sessionToken.js';

const testUri = process.env.MONGODB_TEST_URI;
const testUserId = 'account-route-test-user';
const otherUserId = 'account-route-other-user';
const testUserEmail = 'account-route-test@example.test';
const accessToken = 'account-route-access-token';

test('account route integration tests', async (t) => {
    assert.ok(testUri, 'MONGODB_TEST_URI must be configured');

    const databaseName = new URL(testUri).pathname.slice(1);
    assert.equal(databaseName, 'rahya_test');

    await mongoose.connect(testUri);

    const server = createServer(app);

    try {
        await Promise.all([User.init(), Account.init(), Session.init()]);

        await Session.deleteMany({ userId: { $in: [testUserId, otherUserId] } });
        await User.deleteMany({ _id: { $in: [testUserId, otherUserId] } });
        await Account.deleteMany({ userId: { $in: [testUserId, otherUserId] } });

        await User.create([
            {
                _id: testUserId,
                name: 'Account Route Test',
                email: testUserEmail,
                passwordHash: 'test-hash',
                status: 'active',
            },
            {
                _id: otherUserId,
                name: 'Other User',
                email: 'account-route-other@example.test',
                passwordHash: 'test-hash',
                status: 'active',
            },
        ]);

        await Session.create({
            userId: testUserId,
            tokenHash: hashSessionToken(accessToken),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

        const address = server.address();
        const baseUrl = `http://127.0.0.1:${address.port}`;
        const authHeaders = {
            'content-type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        };

        await t.test('rejects account creation without a session', async () => {
            const response = await fetch(`${baseUrl}/accounts`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    name: 'Unauthenticated Wallet',
                    type: 'cash',
                    openingBalance: 25,
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 401);
            assert.equal(body.error, 'UNAUTHENTICATED');
        });

        await t.test('creates an account for the authenticated user', async () => {
            const response = await fetch(`${baseUrl}/accounts`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                    userId: otherUserId,
                    name: 'Route Test Wallet',
                    type: 'cash',
                    openingBalance: 25,
                }),
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
                headers: authHeaders,
                body: JSON.stringify({
                    name: '',
                    type: 'cash',
                    openingBalance: 25,
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 400);
            assert.equal(body.error, 'VALIDATION_ERROR');
        });

        await t.test('returns 409 for a duplicate account name', async () => {
            const response = await fetch(`${baseUrl}/accounts`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                    name: 'Route Test Wallet',
                    type: 'cash',
                    openingBalance: 30,
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 409);
            assert.equal(body.error, 'ACCOUNT_NAME_ALREADY_EXISTS');
        });
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });

        await Account.deleteMany({ userId: { $in: [testUserId, otherUserId] } });
        await Session.deleteMany({ userId: { $in: [testUserId, otherUserId] } });
        await User.deleteMany({ _id: { $in: [testUserId, otherUserId] } });

        await mongoose.disconnect();
    }
});
