import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import Account from '../src/models/accountModel.js';
import Transaction from '../src/models/transactionModel.js';
import accountRepository from '../src/repositories/accountRepository.js';
import transactionRepository from '../src/repositories/transactionRepository.js';
import createTransaction from '../src/useCases/createTransaction.js';
import deleteTransaction from '../src/useCases/deleteTransaction.js';
import updateTransaction from '../src/useCases/updateTransaction.js';

const testUri = process.env.MONGODB_TEST_URI;
const currentUserId = randomUUID();
const accountIds = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
];

test('historical balance mutations use atomic account revisions', async (t) => {
    assert.ok(testUri, 'MONGODB_TEST_URI must be configured');
    assert.equal(
        new URL(testUri).pathname.slice(1),
        'rahya_test',
        'Tests must only run against the rahya_test database',
    );

    await mongoose.connect(testUri);

    try {
        await Promise.all([Account.init(), Transaction.init()]);
        await Account.create([
            {
                _id: accountIds[0],
                userId: currentUserId,
                name: `Concurrent ${accountIds[0]}`,
                type: 'cash',
                openingBalance: 100,
            },
            {
                _id: accountIds[1],
                userId: currentUserId,
                name: `Income ${accountIds[1]}`,
                type: 'cash',
                openingBalance: 0,
            },
            {
                _id: accountIds[2],
                userId: currentUserId,
                name: `Transfer Source ${accountIds[2]}`,
                type: 'cash',
                openingBalance: 0,
            },
            {
                _id: accountIds[3],
                userId: currentUserId,
                name: `Transfer Destination ${accountIds[3]}`,
                type: 'cash',
                openingBalance: 0,
            },
        ]);

        await t.test(
            're-reads history after concurrent account revision conflicts',
            async () => {
                const expense = () =>
                    createTransaction(
                        {
                            type: 'expense',
                            accountId: accountIds[0],
                            amount: 80,
                            category: 'Test',
                            transactionDate: '2026-10-10T12:00:00+03:30',
                        },
                        transactionRepository,
                        accountRepository,
                        currentUserId,
                    );

                const results = await Promise.all([expense(), expense()]);
                const successful = results.filter((result) => result.valid);
                const rejected = results.filter((result) => !result.valid);

                assert.equal(successful.length, 1);
                assert.equal(rejected.length, 1);
                assert.equal(
                    rejected[0].error,
                    'HISTORICAL_BALANCE_VIOLATION',
                );

                const remainingTransactions = await Transaction.find({
                    accountId: accountIds[0],
                    deletedAt: null,
                }).lean();
                const account = await Account.findById(accountIds[0]).lean();

                assert.equal(remainingTransactions.length, 1);
                assert.equal(remainingTransactions[0].amount, 80);
                assert.equal(account.financialRevision, 1);

                const update = await updateTransaction(
                    successful[0].data.id,
                    { amount: 101 },
                    transactionRepository,
                    accountRepository,
                    currentUserId,
                );
                const unchangedTransaction = await Transaction.findById(
                    successful[0].data.id,
                ).lean();
                const unchangedAccount = await Account.findById(
                    accountIds[0],
                ).lean();

                assert.equal(update.valid, false);
                assert.equal(
                    update.error,
                    'HISTORICAL_BALANCE_VIOLATION',
                );
                assert.equal(unchangedTransaction.amount, 80);
                assert.equal(unchangedAccount.financialRevision, 1);
            },
        );

        await t.test(
            'rejects deleting income when later expenses would become invalid',
            async () => {
                const income = await createTransaction(
                    {
                        type: 'income',
                        accountId: accountIds[1],
                        amount: 50,
                        category: 'Test',
                        transactionDate: '2026-10-10T12:00:00+03:30',
                    },
                    transactionRepository,
                    accountRepository,
                    currentUserId,
                );
                const expense = await createTransaction(
                    {
                        type: 'expense',
                        accountId: accountIds[1],
                        amount: 40,
                        category: 'Test',
                        transactionDate: '2026-10-11T12:00:00+03:30',
                    },
                    transactionRepository,
                    accountRepository,
                    currentUserId,
                );

                assert.equal(income.valid, true);
                assert.equal(expense.valid, true);

                const deletion = await deleteTransaction(
                    income.data.id,
                    transactionRepository,
                    accountRepository,
                    currentUserId,
                );

                assert.equal(deletion.valid, false);
                assert.equal(
                    deletion.error,
                    'HISTORICAL_BALANCE_VIOLATION',
                );

                const persistedIncome = await Transaction.findById(
                    income.data.id,
                ).lean();
                const account = await Account.findById(accountIds[1]).lean();

                assert.equal(persistedIncome.deletedAt, null);
                assert.equal(account.financialRevision, 2);
            },
        );

        await t.test(
            'rolls back both account revisions when a transfer overdraws its source',
            async () => {
                const transfer = await createTransaction(
                    {
                        type: 'transfer',
                        sourceAccountId: accountIds[2],
                        destinationAccountId: accountIds[3],
                        amount: 1,
                        transactionDate: '2026-10-12T12:00:00+03:30',
                    },
                    transactionRepository,
                    accountRepository,
                    currentUserId,
                );

                assert.equal(transfer.valid, false);
                assert.equal(
                    transfer.error,
                    'HISTORICAL_BALANCE_VIOLATION',
                );

                const [source, destination] = await Promise.all([
                    Account.findById(accountIds[2]).lean(),
                    Account.findById(accountIds[3]).lean(),
                ]);
                const persistedTransfers = await Transaction.find({
                    sourceAccountId: accountIds[2],
                    destinationAccountId: accountIds[3],
                    deletedAt: null,
                }).lean();

                assert.equal(source.financialRevision, 0);
                assert.equal(destination.financialRevision, 0);
                assert.equal(persistedTransfers.length, 0);
            },
        );
    } finally {
        await Transaction.deleteMany({
            $or: [
                { accountId: { $in: accountIds } },
                { sourceAccountId: { $in: accountIds } },
                { destinationAccountId: { $in: accountIds } },
            ],
        });
        await Account.deleteMany({ _id: { $in: accountIds } });
        await mongoose.disconnect();
    }
});
