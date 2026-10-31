import assert from 'node:assert/strict';
import test from 'node:test';
import createTransaction from '../src/useCases/createTransaction.js';

const currentUserId = 'user-1';

function createDependencies({
    accountsById = {},
} = {}) {
    const calls = {
        findAccountById: 0,
        createTransaction: 0,
    };
    const transactions = [];

    const accountRepository = {
        async findById(accountId) {
            calls.findAccountById++;
            return accountsById[accountId] ?? null;
        },
        async incrementFinancialRevision(accountId, userId) {
            const account = accountsById[accountId];

            return account && account.userId === userId
                ? { openingBalance: 0, ...account }
                : null;
        },
    };

    const transactionRepository = {
        async withTransaction(operation) {
            return operation({});
        },
        async create(transaction) {
            calls.createTransaction++;
            const created = {
                ...transaction,
                id: transaction.id,
                createdAt: new Date(),
            };
            transactions.push(created);
            return created;
        },
        async findByRelatedAccountId(accountId) {
            return transactions.filter(
                (transaction) =>
                    transaction.deletedAt === null &&
                    (transaction.accountId === accountId ||
                        transaction.sourceAccountId === accountId ||
                        transaction.destinationAccountId === accountId),
            );
        },
    };

    return { accountRepository, transactionRepository, calls };
}

const transactionDate = '2026-10-10T12:00:00+03:30';

test('rejects income on an archived account', async () => {
    const deps = createDependencies({
        accountsById: {
            'account-1': {
                id: 'account-1',
                userId: currentUserId,
                isArchived: true,
            },
        },
    });

    const result = await createTransaction(
        {
            type: 'income',
            accountId: 'account-1',
            amount: 100,
            category: 'Salary',
            transactionDate,
        },
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'ACCOUNT_ARCHIVED');
    assert.equal(deps.calls.createTransaction, 0);
});

test('rejects expense on an archived account', async () => {
    const deps = createDependencies({
        accountsById: {
            'account-1': {
                id: 'account-1',
                userId: currentUserId,
                isArchived: true,
            },
        },
    });

    const result = await createTransaction(
        {
            type: 'expense',
            accountId: 'account-1',
            amount: 40,
            category: 'Food',
            transactionDate,
        },
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'ACCOUNT_ARCHIVED');
    assert.equal(deps.calls.createTransaction, 0);
});

test('rejects transfer when the source account is archived', async () => {
    const deps = createDependencies({
        accountsById: {
            source: {
                id: 'source',
                userId: currentUserId,
                isArchived: true,
            },
            destination: {
                id: 'destination',
                userId: currentUserId,
                isArchived: false,
            },
        },
    });

    const result = await createTransaction(
        {
            type: 'transfer',
            sourceAccountId: 'source',
            destinationAccountId: 'destination',
            amount: 25,
            transactionDate,
        },
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'ACCOUNT_ARCHIVED');
    assert.equal(deps.calls.createTransaction, 0);
});

test('rejects transfer when the destination account is archived', async () => {
    const deps = createDependencies({
        accountsById: {
            source: {
                id: 'source',
                userId: currentUserId,
                isArchived: false,
            },
            destination: {
                id: 'destination',
                userId: currentUserId,
                isArchived: true,
            },
        },
    });

    const result = await createTransaction(
        {
            type: 'transfer',
            sourceAccountId: 'source',
            destinationAccountId: 'destination',
            amount: 25,
            transactionDate,
        },
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'ACCOUNT_ARCHIVED');
    assert.equal(deps.calls.createTransaction, 0);
});

test('creates income on an active account', async () => {
    const deps = createDependencies({
        accountsById: {
            'account-1': {
                id: 'account-1',
                userId: currentUserId,
                isArchived: false,
            },
        },
    });

    const result = await createTransaction(
        {
            type: 'income',
            accountId: 'account-1',
            amount: 100,
            category: 'Salary',
            transactionDate,
        },
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.valid, true);
    assert.equal(result.data.accountId, 'account-1');
    assert.equal(deps.calls.createTransaction, 1);
});

test('rejects income on an account owned by another user', async () => {
    const deps = createDependencies({
        accountsById: {
            'account-1': {
                id: 'account-1',
                userId: 'other-user',
                isArchived: false,
            },
        },
    });

    const result = await createTransaction(
        {
            type: 'income',
            accountId: 'account-1',
            amount: 100,
            category: 'Salary',
            transactionDate,
        },
        deps.transactionRepository,
        deps.accountRepository,
        currentUserId,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'ACCOUNT_NOT_FOUND');
    assert.equal(deps.calls.createTransaction, 0);
});
