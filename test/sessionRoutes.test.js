import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import { createServer } from 'node:http';

import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Session from '../src/models/sessionModel.js';
import { hashSessionToken } from '../src/auth/sessionToken.js';

const testUri = process.env.MONGODB_TEST_URI;
const testUserId = 'session-route-test-user';
const deactivatedUserId = 'session-route-deactivated-user';
const expiredUserId = 'session-route-expired-user';
const testPassword = 'session-route-password';
const testEmail = 'session-route-test@example.test';
const deactivatedEmail = 'session-route-deactivated@example.test';
const expiredEmail = 'session-route-expired@example.test';
const expiredToken = 'session-route-expired-token';
const deactivatedSessionToken = 'session-route-deactivated-token';

test('session route integration tests', async (t) => {
    assert.ok(testUri, 'MONGODB_TEST_URI must be configured');

    const databaseName = new URL(testUri).pathname.slice(1);
    assert.equal(databaseName, 'rahya_test');

    await mongoose.connect(testUri);

    const server = createServer(app);
    const passwordHash = await argon2.hash(testPassword, {
        type: argon2.argon2id,
    });

    try {
        await Promise.all([User.init(), Session.init()]);

        await Session.deleteMany({
            userId: { $in: [testUserId, deactivatedUserId, expiredUserId] },
        });
        await User.deleteMany({
            _id: { $in: [testUserId, deactivatedUserId, expiredUserId] },
        });

        await User.create([
            {
                _id: testUserId,
                name: 'Session Route Test',
                email: testEmail,
                passwordHash,
                status: 'active',
            },
            {
                _id: deactivatedUserId,
                name: 'Deactivated User',
                email: deactivatedEmail,
                passwordHash,
                status: 'deactivated',
            },
            {
                _id: expiredUserId,
                name: 'Expired Session User',
                email: expiredEmail,
                passwordHash,
                status: 'active',
            },
        ]);

        await Session.create([
            {
                userId: expiredUserId,
                tokenHash: hashSessionToken(expiredToken),
                expiresAt: new Date(Date.now() - 60_000),
            },
            {
                userId: deactivatedUserId,
                tokenHash: hashSessionToken(deactivatedSessionToken),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        ]);

        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

        const address = server.address();
        const baseUrl = `http://127.0.0.1:${address.port}`;
        let accessToken;

        await t.test('creates a session and returns 201', async () => {
            const response = await fetch(`${baseUrl}/sessions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail,
                    password: testPassword,
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 201);
            assert.equal(typeof body.token, 'string');
            assert.ok(body.token.length > 20);
            assert.equal(body.user.id, testUserId);
            assert.equal(body.user.email, testEmail);
            assert.equal(body.user.status, 'active');
            assert.equal('passwordHash' in body.user, false);
            assert.ok(Date.parse(body.expiresAt));

            const storedSession = await Session.findOne({
                userId: testUserId,
            }).lean();

            assert.ok(storedSession);
            assert.equal(storedSession.tokenHash, hashSessionToken(body.token));
            assert.notEqual(storedSession.tokenHash, body.token);

            accessToken = body.token;
        });

        await t.test('normalizes email case when creating a session', async () => {
            const response = await fetch(`${baseUrl}/sessions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail.toUpperCase(),
                    password: testPassword,
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 201);
            assert.equal(body.user.email, testEmail);
            assert.equal(typeof body.token, 'string');
        });

        await t.test('rejects a wrong password with 401', async () => {
            const response = await fetch(`${baseUrl}/sessions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail,
                    password: 'not-the-session-password',
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 401);
            assert.equal(body.error, 'INVALID_CREDENTIALS');
        });

        await t.test('returns 400 for invalid login input', async () => {
            const response = await fetch(`${baseUrl}/sessions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    email: 'not-an-email',
                    password: testPassword,
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 400);
            assert.equal(body.error, 'VALIDATION_ERROR');
        });

        await t.test('rejects unknown credentials with 401', async () => {
            const response = await fetch(`${baseUrl}/sessions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    email: 'missing-session-user@example.test',
                    password: testPassword,
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 401);
            assert.equal(body.error, 'INVALID_CREDENTIALS');
        });

        await t.test('rejects a deactivated user with 403', async () => {
            const response = await fetch(`${baseUrl}/sessions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    email: deactivatedEmail,
                    password: testPassword,
                }),
            });

            const body = await response.json();

            assert.equal(response.status, 403);
            assert.equal(body.error, 'USER_DEACTIVATED');
        });

        await t.test('rejects logout without a token', async () => {
            const response = await fetch(`${baseUrl}/sessions/current`, {
                method: 'DELETE',
            });

            const body = await response.json();

            assert.equal(response.status, 401);
            assert.equal(body.error, 'UNAUTHENTICATED');
        });

        await t.test('rejects a malformed authorization header', async () => {
            const response = await fetch(`${baseUrl}/sessions/current`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${accessToken} extra`,
                },
            });

            const body = await response.json();

            assert.equal(response.status, 401);
            assert.equal(body.error, 'UNAUTHENTICATED');
        });

        await t.test('rejects an expired session', async () => {
            const response = await fetch(`${baseUrl}/sessions/current`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${expiredToken}`,
                },
            });

            const body = await response.json();

            assert.equal(response.status, 401);
            assert.equal(body.error, 'UNAUTHENTICATED');
        });

        await t.test('rejects a deactivated user session with 403', async () => {
            const response = await fetch(`${baseUrl}/sessions/current`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${deactivatedSessionToken}`,
                },
            });

            const body = await response.json();

            assert.equal(response.status, 403);
            assert.equal(body.error, 'USER_DEACTIVATED');
        });

        await t.test('revokes the current session', async () => {
            const response = await fetch(`${baseUrl}/sessions/current`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            const body = await response.json();

            assert.equal(response.status, 200);
            assert.equal(body.message, 'Session revoked');

            const storedSession = await Session.findOne({
                userId: testUserId,
                tokenHash: hashSessionToken(accessToken),
            }).lean();

            assert.ok(storedSession.revokedAt);
        });

        await t.test('rejects a revoked token', async () => {
            const response = await fetch(`${baseUrl}/sessions/current`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            const body = await response.json();

            assert.equal(response.status, 401);
            assert.equal(body.error, 'UNAUTHENTICATED');
        });
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });

        await Session.deleteMany({
            userId: { $in: [testUserId, deactivatedUserId, expiredUserId] },
        });
        await User.deleteMany({
            _id: { $in: [testUserId, deactivatedUserId, expiredUserId] },
        });

        await mongoose.disconnect();
    }
});
