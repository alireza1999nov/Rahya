import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import Transaction from '../src/models/transactionModel.js';
import transactionRepository from '../src/repositories/transactionRepository.js';

const testUri = process.env.MONGODB_TEST_URI;

test('transactionRepository integration tests', async (t) => {
    assert.ok(testUri, 'MONGODB_TEST_URI must be configured');

    const databaseName = new URL(testUri).pathname.slice(1);

    assert.equal(
        databaseName,
        'rahya_test',
        'Tests must only run against the rahya_test database',
    );

    await mongoose.connect(testUri);

    const createdTransactionIds = new Set();

    async function createTransaction(transaction) {
        const created = await transactionRepository.create(transaction);

        assert.equal(typeof created.id, 'string');
        assert.ok(created.id.length > 0);

        createdTransactionIds.add(created.id);

        return created;
    }

    function createIncome(overrides = {}) {
        return {
            type: 'income',
            accountId: randomUUID(),
            amount: 100,
            category: 'Salary',
            transactionDate: '2026-10-10T12:00:00+03:30',
            ...overrides,
        };
    }

    function createExpense(overrides = {}) {
        return {
            type: 'expense',
            accountId: randomUUID(),
            amount: 25.5,
            category: 'Food',
            transactionDate: '2026-10-10T12:00:00+03:30',
            ...overrides,
        };
    }

    function createTransfer(overrides = {}) {
        return {
            type: 'transfer',
            sourceAccountId: randomUUID(),
            destinationAccountId: randomUUID(),
            amount: 50,
            transactionDate: '2026-10-10T12:00:00+03:30',
            ...overrides,
        };
    }

    try {
        await Transaction.init();

        await t.test('creates and persists a transaction', async () => {
            const input = createIncome();
            const created = await createTransaction(input);

            assert.equal(created.type, 'income');
            assert.equal(created.accountId, input.accountId);
            assert.equal(created.amount, input.amount);
            assert.equal(created.category, input.category);
            assert.equal(created.deletedAt, null);

            const persisted = await Transaction.findById(created.id).lean();

            assert.ok(persisted);
            assert.equal(persisted._id, created.id);
            assert.equal(persisted.accountId, input.accountId);
        });

        await t.test(
            'finds income and expense transactions by accountId',
            async () => {
                const accountId = randomUUID();

                const income = await createTransaction(
                    createIncome({ accountId }),
                );

                const expense = await createTransaction(
                    createExpense({ accountId }),
                );

                await createTransaction(
                    createIncome({ accountId: randomUUID() }),
                );

                const transactions =
                    await transactionRepository.findByRelatedAccountId(
                        accountId,
                    );

                assert.deepEqual(
                    new Set(transactions.map((transaction) => transaction.id)),
                    new Set([income.id, expense.id]),
                );
            },
        );

        await t.test('finds a transfer by its source account', async () => {
            const sourceAccountId = randomUUID();

            const transfer = await createTransaction(
                createTransfer({ sourceAccountId }),
            );

            const transactions =
                await transactionRepository.findByRelatedAccountId(
                    sourceAccountId,
                );

            assert.deepEqual(
                transactions.map((transaction) => transaction.id),
                [transfer.id],
            );
        });

        await t.test(
            'finds a transfer by its destination account',
            async () => {
                const destinationAccountId = randomUUID();

                const transfer = await createTransaction(
                    createTransfer({ destinationAccountId }),
                );

                const transactions =
                    await transactionRepository.findByRelatedAccountId(
                        destinationAccountId,
                    );

                assert.deepEqual(
                    transactions.map((transaction) => transaction.id),
                    [transfer.id],
                );
            },
        );

        await t.test(
            'does not return transactions unrelated to the requested account',
            async () => {
                const transaction = await createTransaction(
                    createIncome({ accountId: randomUUID() }),
                );

                const transactions =
                    await transactionRepository.findByRelatedAccountId(
                        randomUUID(),
                    );

                assert.equal(
                    transactions.some(
                        (item) => item.id === transaction.id,
                    ),
                    false,
                );
            },
        );

        await t.test(
            'returns null when a transaction ID does not exist',
            async () => {
                const transaction =
                    await transactionRepository.findById(randomUUID());

                assert.equal(transaction, null);
            },
        );

        await t.test(
            'excludes soft-deleted transactions from account queries',
            async () => {
                const accountId = randomUUID();

                await createTransaction(createIncome({ accountId }));

                const deleted = await createTransaction(
                    createExpense({
                        accountId,
                        deletedAt: new Date(),
                    }),
                );

                const transactions =
                    await transactionRepository.findByRelatedAccountId(
                        accountId,
                    );

                assert.equal(
                    transactions.some(
                        (transaction) => transaction.id === deleted.id,
                    ),
                    false,
                );
            },
        );

        await t.test(
            'does not return a soft-deleted transaction by ID',
            async () => {
                const deleted = await createTransaction(
                    createIncome({ deletedAt: new Date() }),
                );

                const transaction =
                    await transactionRepository.findById(deleted.id);

                assert.equal(transaction, null);
            },
        );

        await t.test(
            'updates an active transaction and returns the updated document',
            async () => {
                const created = await createTransaction(
                    createExpense({
                        amount: 25,
                        category: 'Food',
                    }),
                );

                const updated = await transactionRepository.update(
                    created.id,
                    {
                        amount: 30.5,
                        category: 'Transport',
                    },
                );

                assert.ok(updated);
                assert.equal(updated.id, created.id);
                assert.equal(updated.amount, 30.5);
                assert.equal(updated.category, 'Transport');

                const persisted = await Transaction.findById(
                    created.id,
                ).lean();

                assert.equal(persisted.amount, 30.5);
                assert.equal(persisted.category, 'Transport');
            },
        );

        await t.test(
            'rejects an update with an invalid amount',
            async () => {
                const created = await createTransaction(
                    createExpense({ amount: 25 }),
                );

                await assert.rejects(
                    transactionRepository.update(
                        created.id,
                        { amount: -10 },
                    ),
                    (error) => error.name === 'ValidationError',
                );

                const persisted = await Transaction.findById(
                    created.id,
                ).lean();

                assert.equal(persisted.amount, 25);
            },
        );

        await t.test(
            'does not update a soft-deleted transaction',
            async () => {
                const created = await createTransaction(
                    createExpense({
                        amount: 25,
                        deletedAt: new Date(),
                    }),
                );

                const updated = await transactionRepository.update(
                    created.id,
                    { amount: 50 },
                );

                assert.equal(updated, null);

                const persisted = await Transaction.findById(
                    created.id,
                ).lean();

                assert.equal(persisted.amount, 25);
                assert.ok(persisted.deletedAt);
            },
        );

        await t.test(
            'returns null when updating a missing transaction',
            async () => {
                const updated = await transactionRepository.update(
                    randomUUID(),
                    { amount: 50 },
                );

                assert.equal(updated, null);
            },
        );

        await t.test(
            'soft-deletes an active transaction and records deletedAt',
            async () => {
                const created = await createTransaction(createExpense());

                const deleted = await transactionRepository.delete(
                    created.id,
                );

                assert.ok(deleted);
                assert.equal(deleted.id, created.id);
                assert.ok(deleted.deletedAt instanceof Date);

                const persisted = await Transaction.findById(
                    created.id,
                ).lean();

                assert.ok(persisted);
                assert.ok(persisted.deletedAt);

                const found = await transactionRepository.findById(
                    created.id,
                );

                assert.equal(found, null);
            },
        );

        await t.test(
            'does not delete an already soft-deleted transaction again',
            async () => {
                const created = await createTransaction(
                    createExpense({ deletedAt: new Date() }),
                );

                const deleted = await transactionRepository.delete(
                    created.id,
                );

                assert.equal(deleted, null);
            },
        );

        await t.test(
            'returns null when deleting a missing transaction',
            async () => {
                const deleted = await transactionRepository.delete(
                    randomUUID(),
                );

                assert.equal(deleted, null);
            },
        );
    } finally {
        try {
            if (createdTransactionIds.size > 0) {
                await Transaction.deleteMany({
                    _id: { $in: [...createdTransactionIds] },
                });
            }
        } finally {
            await mongoose.disconnect();
        }
    }
});
