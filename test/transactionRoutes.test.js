import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Account from '../src/models/accountModel.js';
import Transaction from '../src/models/transactionModel.js';

import { randomUUID } from 'node:crypto';

const testUri = process.env.MONGODB_TEST_URI;

test('transaction route integration tests', async (t) => {
    assert.ok(testUri, 'MONGODB_TEST_URI must be configured');

    const databaseName = new URL(testUri).pathname.slice(1);

    assert.equal(
        databaseName,
        'rahya_test',
        'Tests must only run against the rahya_test database',
    );

    await mongoose.connect(testUri);

    const userId = randomUUID();

    const accountIds = {
        primary: randomUUID(),
        source: randomUUID(),
        destination: randomUUID(),
    };

    const archivedAccountId = randomUUID();
    const orphanAccountId = randomUUID();

    const allAccountIds = [
    ...Object.values(accountIds),
    archivedAccountId,
    orphanAccountId,
    ];

    let server;
    let baseUrl;

    let incomeTransactionId;
    let expenseTransactionId;
    let transferTransactionId;
    let archivedAccountTransactionId;
    let orphanTransactionId;

    const transactionDate = '2026-10-10T12:00:00+03:30';

    try {
        await Promise.all([
            User.init(),
            Account.init(),
            Transaction.init(),
        ]);

        await User.create({
            _id: userId,
            name: 'Transaction Route Test User',
            email: `transaction-route-${userId}@example.com`,
            passwordHash: 'integration-test-password-hash',
        });

        await Account.create([
            {
                _id: accountIds.primary,
                userId,
                name: 'Transaction Route Primary',
                type: 'bank',
                openingBalance: 1000,
            },
            {
                _id: accountIds.source,
                userId,
                name: 'Transaction Route Source',
                type: 'bank',
                openingBalance: 1000,
            },
            {
                _id: accountIds.destination,
                userId,
                name: 'Transaction Route Destination',
                type: 'bank',
                openingBalance: 1000,
            },
            {
                _id: archivedAccountId,
                userId,
                name: 'Transaction Route Archived',
                type: 'bank',
                openingBalance: 1000,
                isArchived: true,
            },
            {
                _id: orphanAccountId,
                userId,
                name: 'Transaction Route Orphan',
                type: 'bank',
                openingBalance: 1000,
            }
        ]);

        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });

        baseUrl = `http://127.0.0.1:${server.address().port}`;

        await t.test(
            'POST /transactions creates an income and returns 201',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: 'income',
                            accountId: accountIds.primary,
                            amount: 100,
                            category: 'Salary',
                            transactionDate,
                        }),
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 201);
                assert.equal(typeof body.id, 'string');
                assert.ok(body.id.length > 0);
                assert.equal(body.type, 'income');
                assert.equal(body.accountId, accountIds.primary);
                assert.equal(body.amount, 100);
                assert.equal(body.category, 'Salary');

                incomeTransactionId = body.id;

                const persisted =
                    await Transaction.findById(incomeTransactionId).lean();

                assert.ok(persisted);
                assert.equal(persisted._id, incomeTransactionId);
            },
        );

        await t.test(
            'POST /transactions creates an expense and returns 201',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: 'expense',
                            accountId: accountIds.primary,
                            amount: 25.5,
                            category: 'Food',
                            transactionDate,
                        }),
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 201);
                assert.equal(body.type, 'expense');
                assert.equal(body.accountId, accountIds.primary);
                assert.equal(body.amount, 25.5);

                expenseTransactionId = body.id;
            },
        );

        await t.test(
            'GET /accounts/:accountId/transactions returns related transactions',
            async () => {
                const response = await fetch(
                    `${baseUrl}/accounts/${accountIds.primary}/transactions`,
                );

                const body = await response.json();

                assert.equal(response.status, 200);
                assert.ok(Array.isArray(body));

                const transactionIds = body.map(
                    (transaction) => transaction.id,
                );

                assert.ok(transactionIds.includes(incomeTransactionId));
                assert.ok(transactionIds.includes(expenseTransactionId));
            },
        );

        await t.test(
            'PATCH /transactions/:transactionId updates an income',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions/${incomeTransactionId}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            amount: 150,
                            category: 'Salary Updated',
                        }),
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 200);
                assert.equal(body.id, incomeTransactionId);
                assert.equal(body.amount, 150);
                assert.equal(body.category, 'Salary Updated');

                const persisted =
                    await Transaction.findById(incomeTransactionId).lean();

                assert.equal(persisted.amount, 150);
                assert.equal(persisted.category, 'Salary Updated');
            },
        );

        await t.test(
            'PATCH rejects updating a transaction linked to an archived account',
            async () => {
                const transaction = await Transaction.create({
                    _id: randomUUID(),
                    type: 'income',
                    accountId: archivedAccountId,
                    amount: 100,
                    category: 'Salary',
                    transactionDate,
                });

                archivedAccountTransactionId = transaction._id;

                const response = await fetch(
                    `${baseUrl}/transactions/${archivedAccountTransactionId}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            amount: 200,
                        }),
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 409);
                assert.equal(body.error, 'ACCOUNT_ARCHIVED');
                assert.equal(typeof body.message, 'string');

                const persisted = await Transaction.findById(
                    archivedAccountTransactionId,
                ).lean();

                assert.equal(persisted.amount, 100);
            },
        );

        await t.test(
            'PATCH returns a safe integrity error when the linked account is missing',
            async () => {
                const transaction = await Transaction.create({
                    _id: randomUUID(),
                    type: 'income',
                    accountId: orphanAccountId,
                    amount: 100,
                    category: 'Salary',
                    transactionDate,
                });

                orphanTransactionId = transaction._id;

                await Account.deleteOne({
                    _id: orphanAccountId,
                });

                const response = await fetch(
                    `${baseUrl}/transactions/${orphanTransactionId}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            amount: 200,
                        }),
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 500);
                assert.equal(body.error, 'DATA_INTEGRITY_ERROR');
                assert.equal(
                    body.message,
                    'The transaction cannot be updated due to an internal data integrity issue',
                );

                assert.equal('details' in body, false);
                assert.equal('stack' in body, false);

                const persisted = await Transaction.findById(
                    orphanTransactionId,
                ).lean();

                assert.equal(persisted.amount, 100);
            },
        );

        await t.test(
            'PATCH rejects an invalid amount without mutating the transaction',
            async () => {
                const persistedBefore = await Transaction.findById(
                    incomeTransactionId,
                ).lean();

                const response = await fetch(
                    `${baseUrl}/transactions/${incomeTransactionId}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            amount: -10,
                        }),
                    },
                );

                assert.equal(response.status, 400);

                const persistedAfter = await Transaction.findById(
                    incomeTransactionId,
                ).lean();

                assert.equal(persistedAfter.amount, persistedBefore.amount);
            },
        );

        await t.test(
            'DELETE /transactions/:transactionId soft-deletes an expense',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions/${expenseTransactionId}`,
                    {
                        method: 'DELETE',
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 200);
                assert.equal(body.id, expenseTransactionId);
                assert.ok(body.deletedAt);

                const persisted =
                    await Transaction.findById(expenseTransactionId).lean();

                assert.ok(persisted);
                assert.ok(persisted.deletedAt);

                const listResponse = await fetch(
                    `${baseUrl}/accounts/${accountIds.primary}/transactions`,
                );

                const transactions = await listResponse.json();

                assert.equal(
                    transactions.some(
                        (transaction) =>
                            transaction.id === expenseTransactionId,
                    ),
                    false,
                );
            },
        );

        await t.test(
            'POST rejects a transaction on an archived account',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: 'income',
                            accountId: archivedAccountId,
                            amount: 100,
                            category: 'Salary',
                            transactionDate,
                        }),
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 409);
                assert.equal(body.error, 'ACCOUNT_ARCHIVED');
                assert.equal(typeof body.message, 'string');
            },
        );

        await t.test(
            'POST /transactions creates a transfer',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: 'transfer',
                            sourceAccountId: accountIds.source,
                            destinationAccountId: accountIds.destination,
                            amount: 50,
                            transactionDate,
                        }),
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 201);
                assert.equal(body.type, 'transfer');
                assert.equal(body.sourceAccountId, accountIds.source);
                assert.equal(
                    body.destinationAccountId,
                    accountIds.destination,
                );

                transferTransactionId = body.id;
            },
        );

        await t.test(
            'PATCH rejects updating a transfer',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions/${transferTransactionId}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            amount: 70,
                        }),
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 409);
                assert.equal(
                    body.error,
                    'TRANSFER_UPDATE_NOT_ALLOWED',
                );

                const persisted =
                    await Transaction.findById(transferTransactionId).lean();

                assert.equal(persisted.amount, 50);
            },
        );

        await t.test(
            'DELETE rejects deleting a transfer',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions/${transferTransactionId}`,
                    {
                        method: 'DELETE',
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 409);
                assert.equal(
                    body.error,
                    'TRANSFER_DELETE_NOT_ALLOWED',
                );

                const persisted =
                    await Transaction.findById(transferTransactionId).lean();

                assert.ok(persisted);
                assert.equal(persisted.deletedAt, null);
            },
        );

        await t.test(
            'POST rejects an invalid transaction',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: 'expense',
                            accountId: accountIds.primary,
                            amount: 0,
                            category: 'Food',
                            transactionDate,
                        }),
                    },
                );

                assert.equal(response.status, 400);
            },
        );

        await t.test(
            'GET returns 404 when the account does not exist',
            async () => {
                const response = await fetch(
                    `${baseUrl}/accounts/${randomUUID()}/transactions`,
                );

                const body = await response.json();

                assert.equal(response.status, 404);
                assert.equal(body.error, 'ACCOUNT_NOT_FOUND');
            },
        );

        await t.test(
            'PATCH returns 404 when the transaction does not exist',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions/${randomUUID()}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            amount: 80,
                        }),
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 404);
                assert.equal(body.error, 'TRANSACTION_NOT_FOUND');
            },
        );

        await t.test(
            'DELETE returns 404 when the transaction does not exist',
            async () => {
                const response = await fetch(
                    `${baseUrl}/transactions/${randomUUID()}`,
                    {
                        method: 'DELETE',
                    },
                );

                const body = await response.json();

                assert.equal(response.status, 404);
                assert.equal(body.error, 'TRANSACTION_NOT_FOUND');
            },
        );
    } finally {
        try {
            if (server) {
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
                    $or: [
                        { accountId: { $in: allAccountIds } },
                        { sourceAccountId: { $in: allAccountIds } },
                        { destinationAccountId: { $in: allAccountIds } },
                    ],
                });

                await Account.deleteMany({
                    _id: { $in: allAccountIds },
                });

                await User.deleteOne({
                    _id: userId,
                });
            } finally {
                await mongoose.disconnect();
            }
        }
    }
});
