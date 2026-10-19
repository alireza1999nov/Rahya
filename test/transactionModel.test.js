import test from 'node:test';
import assert from 'node:assert/strict';

import Transaction from '../src/models/transactionModel.js';

const validIncome = {
    type: 'income',
    accountId: 'account-1',
    amount: 100.5,
    category: 'Salary',
    transactionDate: '2026-10-10T12:00:00+03:30',
};

test('creates a valid income transaction document', async () => {
    const transaction = new Transaction(validIncome);

    await transaction.validate();

    assert.equal(typeof transaction._id, 'string');
    assert.ok(transaction._id.length > 0);
    assert.equal(transaction.deletedAt, null);
    assert.equal(transaction.transactionDate, validIncome.transactionDate);
});

test('creates a valid expense transaction document', async () => {
    const transaction = new Transaction({
        type: 'expense',
        accountId: 'account-1',
        amount: 25.5,
        category: 'Food',
        transactionDate: '2026-10-10T12:00:00+03:30',
    });

    await transaction.validate();
});

test('creates a valid transfer transaction document', async () => {
    const transaction = new Transaction({
        type: 'transfer',
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        amount: 50,
        transactionDate: '2026-10-10T12:00:00+03:30',
    });

    await transaction.validate();
});

test('rejects a transaction with an invalid type', async () => {
    const transaction = new Transaction({
        ...validIncome,
        type: 'refund',
    });

    await assert.rejects(
        transaction.validate(),
        error => Boolean(error.errors.type),
    );
});

test('rejects zero and negative amounts', async () => {
    for (const amount of [0, -1]) {
        const transaction = new Transaction({
            ...validIncome,
            amount,
        });

        await assert.rejects(
            transaction.validate(),
            error => Boolean(error.errors.amount),
        );
    }
});

test('rejects an amount with more than one decimal place', async () => {
    const transaction = new Transaction({
        ...validIncome,
        amount: 10.25,
    });

    await assert.rejects(
        transaction.validate(),
        error => Boolean(error.errors.amount),
    );
});

test('rejects a transfer between the same account', async () => {
    const transaction = new Transaction({
        type: 'transfer',
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-1',
        amount: 50,
        transactionDate: '2026-10-10T12:00:00+03:30',
    });

    await assert.rejects(
        transaction.validate(),
        error => Boolean(error.errors.destinationAccountId),
    );
});

test('preserves the exact transaction date string', async () => {
    const transaction = new Transaction(validIncome);

    await transaction.validate();

    assert.equal(
        transaction.transactionDate,
        '2026-10-10T12:00:00+03:30',
    );
});

test('rejects a transaction date with a different format', async () => {
    const transaction = new Transaction({
        ...validIncome,
        transactionDate: '2026-10-10T12:00:00Z',
    });

    await assert.rejects(
        transaction.validate(),
        error => Boolean(error.errors.transactionDate),
    );
});
