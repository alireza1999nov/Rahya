
import test from 'node:test';
import assert from 'node:assert/strict';

import createTransaction from '../src/useCases/createTransaction.js';
import updateTransaction from '../src/useCases/updateTransaction.js';

import transactionRepository from '../src/repositories/transactionRepository.js';
import accountRepository from '../src/repositories/accountRepository.js';

import {
    validateTransactionCreateInput,
    validateTransactionUpdateInput,
} from '../src/validation/transactionValidation.js';

// 2026-10-13 15:00:00 in Asia/Tehran (+03:30)
const NOW = new Date('2026-10-13T11:30:00.000Z');
const NOW_LOCAL = '2026-10-13T15:00:00+03:30';

const createAccount = (id) => {
    accountRepository.create({
        id,
        userId: `user-${id}`,
        name: `Test account ${id}`,
    });
};

const createInputForType = (type, transactionDate) => {
    if (type === 'transfer') {
        return {
            type,
            sourceAccountId: 'date-test-source',
            destinationAccountId: 'date-test-destination',
            amount: 50,
            transactionDate,
        };
    }

    return {
        type,
        accountId: `date-test-${type}-account`,
        amount: 100,
        category: type === 'income' ? 'Salary' : 'Food',
        transactionDate,
    };
};

const withFixedTime = (t) => {
    t.mock.timers.enable({
        apis: ['Date'],
        now: NOW,
    });
};

const invalidDateStrings = [
    '',
    'not-a-date',
    '2026-10-13',
    '2026-10-13T14:30:00',
    '2026-10-13T14:30:00Z',
    '2026-10-13T14:30:00+04:30',
    '2026-10-13T14:30:00-03:30',
    '2026-10-13T14:30:00.123+03:30',
    '2026-10-13 14:30:00+03:30',
    '2026-10-13T14:30+03:30',
    '2026-10-13T14:30:00+0330',
    '2026-10-13T14:30:00+03:00',
    '2026-10-13T14:30:00+03:30extra',
];

const impossibleCalendarDates = [
    '2026-02-30T14:30:00+03:30',
    '2026-02-29T14:30:00+03:30',
    '2026-13-01T14:30:00+03:30',
    '2026-00-10T14:30:00+03:30',
    '2026-04-31T14:30:00+03:30',
    '2026-06-31T14:30:00+03:30',
    '2026-10-00T14:30:00+03:30',
];

const invalidTimeComponents = [
    '2026-10-13T24:00:00+03:30',
    '2026-10-13T25:00:00+03:30',
    '2026-10-13T14:60:00+03:30',
    '2026-10-13T14:30:60+03:30',
];

const futureDates = [
    '2026-10-13T15:00:01+03:30',
    '2026-10-13T15:01:00+03:30',
    '2026-10-14T00:00:00+03:30',
];

test('accepts a valid date for every transaction type', (t) => {
    withFixedTime(t);

    for (const type of ['income', 'expense', 'transfer']) {
        const result = validateTransactionCreateInput(
            createInputForType(type, '2026-10-13T14:30:00+03:30'),
        );

        assert.equal(result.valid, true, `Expected ${type} date to be valid`);
        assert.equal(
            result.data.transactionDate,
            '2026-10-13T14:30:00+03:30',
        );
    }
});

test('rejects malformed date strings for every transaction type', (t) => {
    withFixedTime(t);

    for (const type of ['income', 'expense', 'transfer']) {
        for (const transactionDate of invalidDateStrings) {
            const result = validateTransactionCreateInput(
                createInputForType(type, transactionDate),
            );

            assert.equal(
                result.valid,
                false,
                `Expected ${type} to reject: ${transactionDate}`,
            );
        }
    }
});

test('rejects impossible calendar dates for every transaction type', (t) => {
    withFixedTime(t);

    for (const type of ['income', 'expense', 'transfer']) {
        for (const transactionDate of impossibleCalendarDates) {
            const result = validateTransactionCreateInput(
                createInputForType(type, transactionDate),
            );

            assert.equal(
                result.valid,
                false,
                `Expected ${type} to reject: ${transactionDate}`,
            );
        }
    }
});

test('rejects invalid time components for every transaction type', (t) => {
    withFixedTime(t);

    for (const type of ['income', 'expense', 'transfer']) {
        for (const transactionDate of invalidTimeComponents) {
            const result = validateTransactionCreateInput(
                createInputForType(type, transactionDate),
            );

            assert.equal(
                result.valid,
                false,
                `Expected ${type} to reject: ${transactionDate}`,
            );
        }
    }
});

test('accepts a valid past leap-day date', (t) => {
    withFixedTime(t);

    const result = validateTransactionCreateInput(
        createInputForType('income', '2024-02-29T14:30:00+03:30'),
    );

    assert.equal(result.valid, true);
});

test('accepts a valid past date at the beginning and end of a month', (t) => {
    withFixedTime(t);

    const dates = [
        '2026-01-01T00:00:00+03:30',
        '2026-01-31T23:59:59+03:30',
        '2026-04-30T23:59:59+03:30',
        '2026-09-30T23:59:59+03:30',
    ];

    for (const transactionDate of dates) {
        const result = validateTransactionCreateInput(
            createInputForType('expense', transactionDate),
        );

        assert.equal(
            result.valid,
            true,
            `Expected valid calendar date: ${transactionDate}`,
        );
    }
});

test('accepts a date one second before now', (t) => {
    withFixedTime(t);

    const result = validateTransactionCreateInput(
        createInputForType('income', '2026-10-13T14:59:59+03:30'),
    );

    assert.equal(result.valid, true);
});

test('accepts a date exactly equal to now', (t) => {
    withFixedTime(t);

    const result = validateTransactionCreateInput(
        createInputForType('income', NOW_LOCAL),
    );

    assert.equal(result.valid, true);
});

test('rejects dates after now for every transaction type', (t) => {
    withFixedTime(t);

    for (const type of ['income', 'expense', 'transfer']) {
        for (const transactionDate of futureDates) {
            const result = validateTransactionCreateInput(
                createInputForType(type, transactionDate),
            );

            assert.equal(
                result.valid,
                false,
                `Expected ${type} to reject future date: ${transactionDate}`,
            );
        }
    }
});

test('rejects non-string transaction dates', (t) => {
    withFixedTime(t);

    for (const transactionDate of [undefined, null, 123, new Date(NOW), {}]) {
        const result = validateTransactionCreateInput({
            ...createInputForType('income', NOW_LOCAL),
            transactionDate,
        });

        assert.equal(result.valid, false);
    }
});

test('validates transaction dates in update input', (t) => {
    withFixedTime(t);

    const invalidDates = [
        ...invalidDateStrings,
        ...impossibleCalendarDates,
        ...invalidTimeComponents,
        ...futureDates,
    ];

    for (const transactionDate of invalidDates) {
        const result = validateTransactionUpdateInput({ transactionDate });

        assert.equal(
            result.valid,
            false,
            `Expected update to reject: ${transactionDate}`,
        );
    }
});

test('accepts a valid past date in update input', (t) => {
    withFixedTime(t);

    const result = validateTransactionUpdateInput({
        transactionDate: '2026-10-10T12:00:00+03:30',
    });

    assert.equal(result.valid, true);
    assert.equal(
        result.data.transactionDate,
        '2026-10-10T12:00:00+03:30',
    );
});

test('does not create an income transaction with a future date', (t) => {
    withFixedTime(t);

    const accountId = 'test-future-income-account';
    createAccount(accountId);

    const result = createTransaction(
        {
            ...createInputForType('income', '2026-10-13T15:00:01+03:30'),
            accountId,
        },
        transactionRepository,
        accountRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(
        transactionRepository.findByRelatedAccountId(accountId).length,
        0,
    );
});

test('does not create an expense transaction with an impossible date', (t) => {
    withFixedTime(t);

    const accountId = 'test-invalid-expense-account';
    createAccount(accountId);

    const result = createTransaction(
        {
            ...createInputForType('expense', '2026-02-30T14:30:00+03:30'),
            accountId,
        },
        transactionRepository,
        accountRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(
        transactionRepository.findByRelatedAccountId(accountId).length,
        0,
    );
});

test('does not create a transfer with an invalid offset', (t) => {
    withFixedTime(t);

    const sourceAccountId = 'test-invalid-transfer-source';
    const destinationAccountId = 'test-invalid-transfer-destination';

    const result = createTransaction(
        {
            ...createInputForType('transfer', '2026-10-13T14:30:00+04:30'),
            sourceAccountId,
            destinationAccountId,
        },
        transactionRepository,
        accountRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(
        transactionRepository.findByRelatedAccountId(sourceAccountId).length,
        0,
    );
    assert.equal(
        transactionRepository.findByRelatedAccountId(destinationAccountId).length,
        0,
    );
});

test('does not mutate an income transaction when its date is invalid', (t) => {
    withFixedTime(t);

    const transactionId = 'test-income-update-invalid-date';

    const originalTransaction = {
        id: transactionId,
        type: 'income',
        accountId: 'test-income-update-account',
        amount: 100,
        category: 'Salary',
        transactionDate: '2026-10-10T12:00:00+03:30',
        createdAt: new Date('2026-10-10T09:00:00.000Z'),
        deletedAt: null,
    };

    transactionRepository.create(originalTransaction);
    const originalSnapshot = { ...originalTransaction };

    for (const transactionDate of [
        '2026-02-30T14:30:00+03:30',
        '2026-10-13T15:00:01+03:30',
    ]) {
        const result = updateTransaction(
            transactionId,
            { transactionDate },
            transactionRepository,
        );

        assert.equal(result.valid, false);
        assert.deepEqual(
            transactionRepository.findById(transactionId),
            originalSnapshot,
        );
    }
});

test('does not mutate an expense transaction when its date is invalid', (t) => {
    withFixedTime(t);

    const transactionId = 'test-expense-update-invalid-date';

    const originalTransaction = {
        id: transactionId,
        type: 'expense',
        accountId: 'test-expense-update-account',
        amount: 40,
        category: 'Food',
        transactionDate: '2026-10-10T12:00:00+03:30',
        createdAt: new Date('2026-10-10T09:00:00.000Z'),
        deletedAt: null,
    };

    transactionRepository.create(originalTransaction);
    const originalSnapshot = { ...originalTransaction };

    for (const transactionDate of [
        '2026-02-30T14:30:00+03:30',
        '2026-10-13T15:00:01+03:30',
    ]) {
        const result = updateTransaction(
            transactionId,
            { transactionDate },
            transactionRepository,
        );

        assert.equal(result.valid, false);
        assert.deepEqual(
            transactionRepository.findById(transactionId),
            originalSnapshot,
        );
    }
});

test('does not allow transfer updates', (t) => {
    withFixedTime(t);

    const transactionId = 'test-transfer-update-forbidden';

    const originalTransaction = {
        id: transactionId,
        type: 'transfer',
        sourceAccountId: 'test-transfer-update-source',
        destinationAccountId: 'test-transfer-update-destination',
        amount: 75,
        transactionDate: '2026-10-10T12:00:00+03:30',
        createdAt: new Date('2026-10-10T09:00:00.000Z'),
        deletedAt: null,
    };

    transactionRepository.create(originalTransaction);
    const originalSnapshot = { ...originalTransaction };

    const result = updateTransaction(
        transactionId,
        { amount: 200 },
        transactionRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'TRANSFER_UPDATE_NOT_ALLOWED');
    assert.deepEqual(
        transactionRepository.findById(transactionId),
        originalSnapshot,
    );
});
