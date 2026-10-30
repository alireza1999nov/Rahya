import test from 'node:test';
import assert from 'node:assert/strict';

import createTransaction from '../src/useCases/createTransaction.js';
import updateTransaction from '../src/useCases/updateTransaction.js';

import {
    validateTransactionCreateInput,
    validateTransactionUpdateInput,
} from '../src/validation/transactionValidation.js';

// 2026-10-13 15:00:00 in Asia/Tehran (+03:30)
const NOW = new Date('2026-10-13T11:30:00.000Z');

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

        assert.equal(
            result.valid,
            true,
            `Expected ${type} date to be valid`,
        );
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
        createInputForType('income', '2026-10-13T15:00:00+03:30'),
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

test('rejects non-string transaction dates', () => {
    for (const transactionDate of [undefined, null, 123, new Date(NOW), {}]) {
        const result = validateTransactionCreateInput({
            ...createInputForType(
                'income',
                '2026-10-13T15:00:00+03:30',
            ),
            transactionDate,
        });

        assert.equal(result.valid, false);
    }
});

test('allows only explicitly supported fields in transaction updates', () => {
    const result = validateTransactionUpdateInput({
        amount: 150,
        category: 'Transport',
        type: 'transfer',
        accountId: 'another-account',
        sourceAccountId: 'another-source',
        destinationAccountId: 'another-destination',
    });

    assert.equal(result.valid, true);

    assert.deepEqual(result.data, {
        amount: 150,
        category: 'Transport',
    });
});

test('rejects updates containing only undefined values', () => {
    const result = validateTransactionUpdateInput({
        amount: undefined,
        category: undefined,
    });

    assert.equal(result.valid, false);
    assert.equal(result.error, 'NO_FIELDS_TO_UPDATE');
});

test('rejects null values for amount and category', () => {
    for (const updates of [
        { amount: null },
        { category: null },
    ]) {
        const result = validateTransactionUpdateInput(updates);

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

test('does not create an income transaction with a future date', async (t) => {
    withFixedTime(t);

    const accountRepository = {
        async findById() {
            assert.fail('Account lookup must not occur for invalid input');
        },
    };

    const transactionRepository = {
        async create() {
            assert.fail('Transaction must not be created for invalid input');
        },
    };

    const result = await createTransaction(
        {
            ...createInputForType('income', '2026-10-13T15:00:01+03:30'),
            accountId: 'test-future-income-account',
        },
        transactionRepository,
        accountRepository,
    );

    assert.equal(result.valid, false);
    assert.match(result.message, /future/i);
});

test('does not create an expense transaction with an impossible date', async (t) => {
    withFixedTime(t);

    const accountRepository = {
        async findById() {
            assert.fail('Account lookup must not occur for invalid input');
        },
    };

    const transactionRepository = {
        async create() {
            assert.fail('Transaction must not be created for invalid input');
        },
    };

    const result = await createTransaction(
        {
            ...createInputForType('expense', '2026-02-30T14:30:00+03:30'),
            accountId: 'test-invalid-expense-account',
        },
        transactionRepository,
        accountRepository,
    );

    assert.equal(result.valid, false);
    assert.match(result.message, /calendar date/i);
});

test('does not create a transfer with an invalid offset', async (t) => {
    withFixedTime(t);

    const accountRepository = {
        async findById() {
            assert.fail('Account lookup must not occur for invalid input');
        },
    };

    const transactionRepository = {
        async create() {
            assert.fail('Transaction must not be created for invalid input');
        },
    };

    const result = await createTransaction(
        {
            ...createInputForType('transfer', '2026-10-13T14:30:00+04:30'),
            sourceAccountId: 'test-invalid-transfer-source',
            destinationAccountId: 'test-invalid-transfer-destination',
        },
        transactionRepository,
        accountRepository,
    );

    assert.equal(result.valid, false);
    assert.match(result.message, /format/i);
});

test('does not mutate an income transaction when its date is invalid', async (t) => {
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

    let storedTransaction = { ...originalTransaction };
    let updateCalled = false;

    const transactionRepository = {
        async findById(id) {
            return id === transactionId ? { ...storedTransaction } : null;
        },
        async update(id, updates) {
            updateCalled = true;
            storedTransaction = { ...storedTransaction, ...updates };
            return { ...storedTransaction };
        },
    };

    const originalSnapshot = { ...storedTransaction };

    for (const transactionDate of [
        '2026-02-30T14:30:00+03:30',
        '2026-10-13T15:00:01+03:30',
    ]) {
        const result = await updateTransaction(
            transactionId,
            { transactionDate },
            transactionRepository,
            {
                async findById(accountId) {
                    return {
                        id: accountId,
                        userId: 'user-1',
                        isArchived: false,
                    };
                },
            },
            'user-1',
        );

        assert.equal(result.valid, false);
        assert.deepEqual(storedTransaction, originalSnapshot);
    }

    assert.equal(updateCalled, false);
});

test('does not mutate an expense transaction when its date is invalid', async (t) => {
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

    let storedTransaction = { ...originalTransaction };
    let updateCalled = false;

    const transactionRepository = {
        async findById(id) {
            return id === transactionId ? { ...storedTransaction } : null;
        },
        async update(id, updates) {
            updateCalled = true;
            storedTransaction = { ...storedTransaction, ...updates };
            return { ...storedTransaction };
        },
    };

    const originalSnapshot = { ...storedTransaction };

    for (const transactionDate of [
        '2026-02-30T14:30:00+03:30',
        '2026-10-13T15:00:01+03:30',
    ]) {
        const result = await updateTransaction(
            transactionId,
            { transactionDate },
            transactionRepository,
            {
                async findById(accountId) {
                    return {
                        id: accountId,
                        userId: 'user-1',
                        isArchived: false,
                    };
                },
            },
            'user-1',
        );

        assert.equal(result.valid, false);
        assert.deepEqual(storedTransaction, originalSnapshot);
    }

    assert.equal(updateCalled, false);
});

test('does not allow transfer updates', async (t) => {
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

    let storedTransaction = { ...originalTransaction };
    let updateCalled = false;

    const transactionRepository = {
        async findById(id) {
            return id === transactionId ? { ...storedTransaction } : null;
        },
        async update() {
            updateCalled = true;
            return null;
        },
    };

    const originalSnapshot = { ...storedTransaction };

    const result = await updateTransaction(
        transactionId,
        { amount: 200 },
        transactionRepository,
        {
            async findById(accountId) {
                return {
                    id: accountId,
                    userId: 'user-1',
                    isArchived: false,
                };
            },
        },
        'user-1',
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'TRANSFER_UPDATE_NOT_ALLOWED');
    assert.equal(updateCalled, false);
    assert.deepEqual(storedTransaction, originalSnapshot);
});
