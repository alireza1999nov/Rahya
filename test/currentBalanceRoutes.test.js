import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Account from '../src/models/accountModel.js';
import Transaction from '../src/models/transactionModel.js';
import Session from '../src/models/sessionModel.js';
import { hashSessionToken } from '../src/auth/sessionToken.js';

const testUri = process.env.MONGODB_TEST_URI;
const toTransactionDate = (date) =>
    `${new Date(date.getTime() + 210 * 60_000)
        .toISOString()
        .slice(0, 19)}+03:30`;

test('current balance route integration tests', async (t) => {
    assert.ok(testUri, 'MONGODB_TEST_URI must be configured');

    const databaseName = new URL(testUri).pathname.slice(1);
    assert.equal(databaseName, 'rahya_test');

    await mongoose.connect(testUri);

    const userId = randomUUID();
    const otherUserId = randomUUID();
    const accessToken = randomUUID();
    const otherAccessToken = randomUUID();
    const accountIds = {
        primary: randomUUID(),
        transferSource: randomUUID(),
        transferDestination: randomUUID(),
        zero: randomUUID(),
        archived: randomUUID(),
        otherUser: randomUUID(),
    };
    const allAccountIds = Object.values(accountIds);
    const createdTransactionIds = [];
    const server = createServer(app);

    try {
        await Promise.all([
            User.init(),
            Account.init(),
            Transaction.init(),
            Session.init(),
        ]);

        await User.create([
            {
                _id: userId,
                name: 'Current Balance Test User',
                email: `current-balance-${userId}@example.test`,
                passwordHash: 'integration-test-password-hash',
                status: 'active',
            },
            {
                _id: otherUserId,
                name: 'Other Current Balance User',
                email: `current-balance-${otherUserId}@example.test`,
                passwordHash: 'integration-test-password-hash',
                status: 'active',
            },
        ]);

        await Session.create([
            {
                userId,
                tokenHash: hashSessionToken(accessToken),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
            {
                userId: otherUserId,
                tokenHash: hashSessionToken(otherAccessToken),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        ]);

        await Account.create([
            {
                _id: accountIds.primary,
                userId,
                name: 'Current Balance Primary',
                type: 'bank',
                openingBalance: 1000,
            },
            {
                _id: accountIds.transferSource,
                userId,
                name: 'Current Balance Transfer Source',
                type: 'bank',
                openingBalance: 500,
            },
            {
                _id: accountIds.transferDestination,
                userId,
                name: 'Current Balance Transfer Destination',
                type: 'cash',
                openingBalance: 300,
            },
            {
                _id: accountIds.zero,
                userId,
                name: 'Current Balance Zero',
                type: 'cash',
                openingBalance: 100,
            },
            {
                _id: accountIds.archived,
                userId,
                name: 'Current Balance Archived',
                type: 'bank',
                openingBalance: 80,
                isArchived: true,
            },
            {
                _id: accountIds.otherUser,
                userId: otherUserId,
                name: 'Other User Balance',
                type: 'bank',
                openingBalance: 700,
            },
        ]);

        const pastDate = '2020-01-01T00:00:00+03:30';
        const futureDate = toTransactionDate(
            new Date(Date.now() + 24 * 60 * 60 * 1000),
        );
        const seededTransactions = await Transaction.create([
            {
                type: 'income',
                accountId: accountIds.primary,
                amount: 200,
                category: 'Salary',
                transactionDate: pastDate,
            },
            {
                type: 'expense',
                accountId: accountIds.primary,
                amount: 100,
                category: 'Food',
                transactionDate: pastDate,
            },
            {
                type: 'expense',
                accountId: accountIds.primary,
                amount: 20,
                category: 'Deleted expense',
                transactionDate: pastDate,
                deletedAt: new Date(),
            },
            {
                type: 'income',
                accountId: accountIds.primary,
                amount: 900,
                category: 'Future income',
                transactionDate: futureDate,
            },
            {
                type: 'expense',
                accountId: accountIds.primary,
                amount: 300,
                category: 'Future expense',
                transactionDate: futureDate,
            },
            {
                type: 'transfer',
                sourceAccountId: accountIds.primary,
                destinationAccountId: accountIds.transferDestination,
                amount: 50,
                transactionDate: pastDate,
            },
            {
                type: 'transfer',
                sourceAccountId: accountIds.transferSource,
                destinationAccountId: accountIds.primary,
                amount: 75,
                transactionDate: pastDate,
            },
            {
                type: 'expense',
                accountId: accountIds.zero,
                amount: 100,
                category: 'Balance to zero',
                transactionDate: pastDate,
            },
            {
                type: 'expense',
                accountId: accountIds.archived,
                amount: 10,
                category: 'Archived account expense',
                transactionDate: pastDate,
            },
        ]);
        createdTransactionIds.push(...seededTransactions.map(({ _id }) => _id));

        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const authHeaders = {
            Authorization: `Bearer ${accessToken}`,
        };

        await t.test('returns the derived balance and currency', async () => {
            const response = await fetch(
                `${baseUrl}/accounts/${accountIds.primary}/balance`,
                { headers: authHeaders },
            );
            const body = await response.json();

            assert.equal(response.status, 200);
            assert.deepEqual(body, {
                accountId: accountIds.primary,
                currentBalance: 1125,
                currency: 'Toman',
            });

            const persistedAccount = await Account.findById(
                accountIds.primary,
            ).lean();
            assert.equal('currentBalance' in persistedAccount, false);
        });

        await t.test('rejects a request without authentication', async () => {
            const response = await fetch(
                `${baseUrl}/accounts/${accountIds.primary}/balance`,
            );
            const body = await response.json();

            assert.equal(response.status, 401);
            assert.equal(body.error, 'UNAUTHENTICATED');
        });

        await t.test('hides another user account as not found', async () => {
            const response = await fetch(
                `${baseUrl}/accounts/${accountIds.otherUser}/balance`,
                { headers: authHeaders },
            );
            const body = await response.json();

            assert.equal(response.status, 404);
            assert.equal(body.error, 'ACCOUNT_NOT_FOUND');
        });

        await t.test('allows a user to read their own account balance', async () => {
            const response = await fetch(
                `${baseUrl}/accounts/${accountIds.otherUser}/balance`,
                {
                    headers: {
                        Authorization: `Bearer ${otherAccessToken}`,
                    },
                },
            );
            const body = await response.json();

            assert.equal(response.status, 200);
            assert.equal(body.accountId, accountIds.otherUser);
            assert.equal(body.currentBalance, 700);
        });

        await t.test('returns not found for a nonexistent account', async () => {
            const response = await fetch(
                `${baseUrl}/accounts/${randomUUID()}/balance`,
                { headers: authHeaders },
            );
            const body = await response.json();

            assert.equal(response.status, 404);
            assert.equal(body.error, 'ACCOUNT_NOT_FOUND');
        });

        await t.test('counts incoming and outgoing transfers correctly', async () => {
            const [sourceResponse, destinationResponse] = await Promise.all([
                fetch(
                    `${baseUrl}/accounts/${accountIds.transferSource}/balance`,
                    { headers: authHeaders },
                ),
                fetch(
                    `${baseUrl}/accounts/${accountIds.transferDestination}/balance`,
                    { headers: authHeaders },
                ),
            ]);

            const sourceBody = await sourceResponse.json();
            const destinationBody = await destinationResponse.json();

            assert.equal(sourceBody.currentBalance, 425);
            assert.equal(destinationBody.currentBalance, 350);
        });

        await t.test('returns zero as a valid balance', async () => {
            const response = await fetch(
                `${baseUrl}/accounts/${accountIds.zero}/balance`,
                { headers: authHeaders },
            );
            const body = await response.json();

            assert.equal(response.status, 200);
            assert.equal(body.currentBalance, 0);
        });

        await t.test('returns the balance of an archived account', async () => {
            const response = await fetch(
                `${baseUrl}/accounts/${accountIds.archived}/balance`,
                { headers: authHeaders },
            );
            const body = await response.json();

            assert.equal(response.status, 200);
            assert.equal(body.currentBalance, 70);
        });

        await t.test(
            'recalculates from persisted transactions and excludes soft deletions',
            async () => {
                const newTransaction = await Transaction.create({
                    type: 'income',
                    accountId: accountIds.primary,
                    amount: 25,
                    category: 'New income',
                    transactionDate: pastDate,
                });
                createdTransactionIds.push(newTransaction._id);

                const updatedResponse = await fetch(
                    `${baseUrl}/accounts/${accountIds.primary}/balance`,
                    { headers: authHeaders },
                );
                const updatedBody = await updatedResponse.json();

                assert.equal(updatedBody.currentBalance, 1150);

                await Transaction.updateOne(
                    { _id: seededTransactions[0]._id },
                    { $set: { deletedAt: new Date() } },
                );

                const deletedResponse = await fetch(
                    `${baseUrl}/accounts/${accountIds.primary}/balance`,
                    { headers: authHeaders },
                );
                const deletedBody = await deletedResponse.json();

                assert.equal(deletedBody.currentBalance, 950);
            },
        );
    } finally {
        try {
            if (server.listening) {
                await new Promise((resolve, reject) => {
                    server.close((error) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
            }
        } finally {
            try {
                await Transaction.deleteMany({
                    _id: { $in: createdTransactionIds },
                });
                await Account.deleteMany({ _id: { $in: allAccountIds } });
                await Session.deleteMany({
                    userId: { $in: [userId, otherUserId] },
                });
                await User.deleteMany({
                    _id: { $in: [userId, otherUserId] },
                });
            } finally {
                await mongoose.disconnect();
            }
        }
    }
});
