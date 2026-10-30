import assert from 'node:assert/strict';
import test from 'node:test';

import getCurrentBalance from '../src/useCases/getCurrentBalance.js';

const currentUserId = 'user-1';
const accountId = 'account-1';

function createDependencies({
    account = {
        _id: accountId,
        userId: currentUserId,
        openingBalance: 100,
        currency: 'Toman',
    },
    transactions = [],
} = {}) {
    const calls = {
        findAccountById: 0,
        findTransactionsByAccountId: 0,
    };

    const accountRepository = {
        async findById(id) {
            calls.findAccountById++;
            assert.equal(id, accountId);
            return account;
        },
    };

    const transactionRepository = {
        async findByRelatedAccountId(id) {
            calls.findTransactionsByAccountId++;
            assert.equal(id, accountId);
            return transactions;
        },
    };

    return { accountRepository, transactionRepository, calls };
}

const pastDate = '2020-01-01T00:00:00+03:30';
const toTransactionDate = (date) =>
    `${new Date(date.getTime() + 210 * 60_000)
        .toISOString()
        .slice(0, 19)}+03:30`;

test('returns the opening balance when there are no transactions', async () => {
    const deps = createDependencies();

    const result = await getCurrentBalance(
        accountId,
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.deepEqual(result, {
        valid: true,
        data: {
            accountId,
            currentBalance: 100,
            currency: 'Toman',
        },
    });
});

test('adds income and subtracts expenses for the requested account', async () => {
    const deps = createDependencies({
        transactions: [
            {
                type: 'income',
                accountId,
                amount: 25.5,
                transactionDate: pastDate,
            },
            {
                type: 'expense',
                accountId,
                amount: 10.2,
                transactionDate: pastDate,
            },
            {
                type: 'income',
                accountId: 'another-account',
                amount: 500,
                transactionDate: pastDate,
            },
        ],
    });

    const result = await getCurrentBalance(
        accountId,
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.data.currentBalance, 115.3);
});

test('applies transfers once in the direction of the requested account', async () => {
    const deps = createDependencies({
        transactions: [
            {
                type: 'transfer',
                sourceAccountId: accountId,
                destinationAccountId: 'destination',
                amount: 20,
                transactionDate: pastDate,
            },
            {
                type: 'transfer',
                sourceAccountId: 'source',
                destinationAccountId: accountId,
                amount: 12.5,
                transactionDate: pastDate,
            },
        ],
    });

    const result = await getCurrentBalance(
        accountId,
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.data.currentBalance, 92.5);
});

test('excludes future-dated transactions from the current balance', async () => {
    const futureDate = toTransactionDate(new Date(Date.now() + 60_000));
    const deps = createDependencies({
        transactions: [
            {
                type: 'income',
                accountId,
                amount: 100,
                transactionDate: futureDate,
            },
            {
                type: 'expense',
                accountId,
                amount: 50,
                transactionDate: pastDate,
            },
        ],
    });

    const result = await getCurrentBalance(
        accountId,
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.data.currentBalance, 50);
});

test('retains a valid zero balance', async () => {
    const deps = createDependencies({
        account: {
            _id: accountId,
            userId: currentUserId,
            openingBalance: 100,
            currency: 'Toman',
        },
        transactions: [
            {
                type: 'expense',
                accountId,
                amount: 100,
                transactionDate: pastDate,
            },
        ],
    });

    const result = await getCurrentBalance(
        accountId,
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.valid, true);
    assert.equal(result.data.currentBalance, 0);
});

test('allows reading the balance of an archived account', async () => {
    const deps = createDependencies({
        account: {
            _id: accountId,
            userId: currentUserId,
            openingBalance: 40,
            currency: 'Toman',
            isArchived: true,
        },
    });

    const result = await getCurrentBalance(
        accountId,
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.valid, true);
    assert.equal(result.data.currentBalance, 40);
});

test('returns the same not-found result for missing and foreign accounts', async () => {
    for (const account of [
        null,
        {
            _id: accountId,
            userId: 'another-user',
            openingBalance: 100,
            currency: 'Toman',
        },
    ]) {
        const deps = createDependencies({ account });

        const result = await getCurrentBalance(
            accountId,
            deps.transactionRepository,
            deps.accountRepository,
            currentUserId,
        );

        assert.deepEqual(result, {
            valid: false,
            error: 'ACCOUNT_NOT_FOUND',
            message: 'Account not found',
        });
        assert.equal(deps.calls.findTransactionsByAccountId, 0);
    }
});

test('uses integer tenths for exact one-decimal-place arithmetic', async () => {
    const deps = createDependencies({
        account: {
            _id: accountId,
            userId: currentUserId,
            openingBalance: 0.1,
            currency: 'Toman',
        },
        transactions: [
            {
                type: 'income',
                accountId,
                amount: 0.2,
                transactionDate: pastDate,
            },
            {
                type: 'income',
                accountId,
                amount: 0.3,
                transactionDate: pastDate,
            },
        ],
    });

    const result = await getCurrentBalance(
        accountId,
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.data.currentBalance, 0.6);
});

test('surfaces invalid persisted transaction dates', async () => {
    const deps = createDependencies({
        transactions: [
            {
                type: 'income',
                accountId,
                amount: 10,
                transactionDate: 'invalid-date',
            },
        ],
    });

    await assert.rejects(
        getCurrentBalance(
            accountId,
            deps.transactionRepository,
            deps.accountRepository,
            currentUserId,
        ),
        /Stored transaction date is invalid/,
    );
});
