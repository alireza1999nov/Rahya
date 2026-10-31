import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assertHistoricalBalances,
    FinancialMutationRejected,
    runFinancialTransaction,
} from '../src/useCases/financialTransactionHelpers.js';

test('does not replay a financial operation after an unknown commit result', async () => {
    let callbackRuns = 0;
    const unknownCommitError = new Error('Commit result is unknown');
    unknownCommitError.hasErrorLabel = (label) =>
        label === 'UnknownTransactionCommitResult';

    const transactionRepository = {
        async withTransaction(operation) {
            await operation({});
            throw unknownCommitError;
        },
    };

    await assert.rejects(
        runFinancialTransaction(transactionRepository, async () => {
            callbackRuns++;
        }),
        { name: 'FinancialOutcomeUnknownError' },
    );

    assert.equal(callbackRuns, 1);
});

test('same-timestamp income and expense are validated as one net group regardless of ordering', async () => {
    const accountId = 'account-1';
    const timestamp = '2026-10-10T12:00:00+03:30';
    const createdAt = new Date('2026-10-10T08:30:00.000Z');
    const transactions = [
        {
            id: 'expense',
            type: 'expense',
            accountId,
            amount: 10,
            transactionDate: timestamp,
            createdAt,
        },
        {
            id: 'income',
            type: 'income',
            accountId,
            amount: 20,
            transactionDate: timestamp,
            createdAt,
        },
    ];

    const validate = async (history) =>
        assertHistoricalBalances(
            [accountId],
            new Map([[accountId, { openingBalance: 0 }]]),
            {
                async findByRelatedAccountId() {
                    return history;
                },
            },
        );

    const reorderedTransactions = transactions
        .slice()
        .reverse()
        .map((transaction, index) => ({
            ...transaction,
            id: `reordered-${index}`,
            createdAt: new Date(createdAt.getTime() + index * 1000),
        }));

    await assert.doesNotReject(validate(transactions));
    await assert.doesNotReject(validate(reorderedTransactions));
});

test('same-timestamp groups reject negative net balance regardless of ordering', async () => {
    const accountId = 'account-2';
    const timestamp = '2026-10-10T12:00:00+03:30';
    const transactions = [
        {
            id: 'income',
            type: 'income',
            accountId,
            amount: 10,
            transactionDate: timestamp,
        },
        {
            id: 'expense',
            type: 'expense',
            accountId,
            amount: 20,
            transactionDate: timestamp,
        },
    ];

    const validate = (history) =>
        assertHistoricalBalances(
            [accountId],
            new Map([[accountId, { openingBalance: 0 }]]),
            {
                async findByRelatedAccountId() {
                    return history;
                },
            },
        );

    for (const history of [
        transactions,
        transactions.slice().reverse().map((transaction, index) => ({
            ...transaction,
            id: `reordered-${index}`,
            createdAt: new Date(index),
        })),
    ]) {
        await assert.rejects(validate(history), (error) => {
            assert.ok(error instanceof FinancialMutationRejected);
            assert.equal(
                error.result.error,
                'HISTORICAL_BALANCE_VIOLATION',
            );
            return true;
        });
    }
});

test('different timestamps are sorted chronologically instead of input order', async () => {
    const accountId = 'account-chronological-order';
    const transactions = [
        {
            id: 'later-expense',
            type: 'expense',
            accountId,
            amount: 10,
            transactionDate: '2026-10-11T12:00:00+03:30',
        },
        {
            id: 'earlier-income',
            type: 'income',
            accountId,
            amount: 20,
            transactionDate: '2026-10-10T12:00:00+03:30',
        },
    ];

    const result = await assertHistoricalBalances(
        [accountId],
        new Map([[accountId, { openingBalance: 0 }]]),
        {
            async findByRelatedAccountId() {
                return transactions;
            },
        },
    );

    assert.equal(result, undefined);
});

test('different timestamps are checked chronologically and reject an intermediate negative balance', async () => {
    const accountId = 'account-3';
    const transactions = [
        {
            id: 'later-income',
            type: 'income',
            accountId,
            amount: 20,
            transactionDate: '2026-10-11T12:00:00+03:30',
        },
        {
            id: 'earlier-expense',
            type: 'expense',
            accountId,
            amount: 10,
            transactionDate: '2026-10-10T12:00:00+03:30',
        },
    ];

    await assert.rejects(
        assertHistoricalBalances(
            [accountId],
            new Map([[accountId, { openingBalance: 0 }]]),
            {
                async findByRelatedAccountId() {
                    return transactions;
                },
            },
        ),
        (error) => {
            assert.ok(error instanceof FinancialMutationRejected);
            assert.equal(
                error.result.error,
                'HISTORICAL_BALANCE_VIOLATION',
            );
            return true;
        },
    );
});

test('invalid stored transaction timestamps are rejected before grouping', async () => {
    const accountId = 'account-4';

    for (const transactionDate of [
        '2026-02-30T12:00:00+03:30',
        '2026-10-10T12:00:00+04:30',
        null,
    ]) {
        await assert.rejects(
            assertHistoricalBalances(
                [accountId],
                new Map([[accountId, { openingBalance: 0 }]]),
                {
                    async findByRelatedAccountId() {
                        return [
                            {
                                id: 'invalid-date',
                                type: 'income',
                                accountId,
                                amount: 10,
                                transactionDate,
                            },
                        ];
                    },
                },
            ),
            {
                message: 'Stored transaction date is invalid',
            },
        );
    }
});
