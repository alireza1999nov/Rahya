import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import deleteTransaction from '../src/useCases/deleteTransaction.js';

const createTransactionRecord = (type, overrides = {}) => {
    const id = randomUUID();

    const commonFields = {
        id,
        type,
        amount: 100,
        transactionDate: '2026-10-10T12:00:00+03:30',
        createdAt: new Date('2026-10-10T08:30:00.000Z'),
        updatedAt: new Date('2026-10-10T08:30:00.000Z'),
        deletedAt: null,
    };

    if (type === 'transfer') {
        return {
            ...commonFields,
            sourceAccountId: `source-${id}`,
            destinationAccountId: `destination-${id}`,
            ...overrides,
        };
    }

    return {
        ...commonFields,
        accountId: `account-${id}`,
        category: type === 'income' ? 'Salary' : 'Food',
        ...overrides,
    };
};

const createInMemoryTransactionRepository = (initialTransactions = []) => {
    const transactions = new Map();

    for (const transaction of initialTransactions) {
        transactions.set(transaction.id, { ...transaction });
    }

    return {
        async withTransaction(operation) {
            return operation({});
        },

        async create(transaction) {
            transactions.set(transaction.id, { ...transaction });
            return { ...transactions.get(transaction.id) };
        },

        async findById(id) {
            const transaction = transactions.get(id);

            if (!transaction || transaction.deletedAt !== null) {
                return null;
            }

            return { ...transaction };
        },

        async delete(id) {
            const transaction = transactions.get(id);

            if (!transaction || transaction.deletedAt !== null) {
                return null;
            }

            const deletedTransaction = {
                ...transaction,
                deletedAt: new Date(),
                updatedAt: new Date(),
            };

            transactions.set(id, deletedTransaction);

            return { ...deletedTransaction };
        },

        async findByRelatedAccountId(accountId) {
            return [...transactions.values()].filter(
                (transaction) =>
                    transaction.deletedAt === null &&
                    (transaction.accountId === accountId ||
                        transaction.sourceAccountId === accountId ||
                        transaction.destinationAccountId === accountId),
            );
        },
    };
};

const currentUserId = 'user-1';

const createAccountRepository = (transaction) => {
    const accounts = {};

    if (transaction.type === 'transfer') {
        accounts[transaction.sourceAccountId] = {
            id: transaction.sourceAccountId,
            userId: currentUserId,
            openingBalance: 0,
        };
        accounts[transaction.destinationAccountId] = {
            id: transaction.destinationAccountId,
            userId: currentUserId,
            openingBalance: 0,
        };
    } else if (transaction.accountId) {
        accounts[transaction.accountId] = {
            id: transaction.accountId,
            userId: currentUserId,
            openingBalance: 0,
        };
    }

    return {
        async findById(accountId) {
            return accounts[accountId] ?? null;
        },
        async incrementFinancialRevision(accountId) {
            return accounts[accountId] ?? null;
        },
    };
};

const createDeleteSpyRepository = (repository) => {
    let deleteCalls = 0;

    return {
        withTransaction(operation) {
            return repository.withTransaction(operation);
        },

        findById(id) {
            return repository.findById(id);
        },

        findByRelatedAccountId(accountId, session) {
            return repository.findByRelatedAccountId(accountId, session);
        },

        delete(id) {
            deleteCalls += 1;
            return repository.delete(id);
        },

        getDeleteCalls() {
            return deleteCalls;
        },
    };
};

test('soft-deletes an income transaction', async () => {
    const transaction = createTransactionRecord('income');
    const repository = createInMemoryTransactionRepository([transaction]);

    const result = await deleteTransaction(
        transaction.id,
        repository,
        createAccountRepository(transaction),
        currentUserId,
    );

    assert.equal(result.valid, true);
    assert.equal(result.message, 'TRANSACTION_DELETED');
    assert.equal(result.data.id, transaction.id);
    assert.equal(result.data.type, 'income');
    assert.ok(result.data.deletedAt instanceof Date);

    assert.equal(await repository.findById(transaction.id), null);
});

test('soft-deletes an expense transaction', async () => {
    const transaction = createTransactionRecord('expense');
    const repository = createInMemoryTransactionRepository([transaction]);

    const result = await deleteTransaction(
        transaction.id,
        repository,
        createAccountRepository(transaction),
        currentUserId,
    );

    assert.equal(result.valid, true);
    assert.equal(result.message, 'TRANSACTION_DELETED');
    assert.equal(result.data.id, transaction.id);
    assert.equal(result.data.type, 'expense');
    assert.ok(result.data.deletedAt instanceof Date);

    assert.equal(await repository.findById(transaction.id), null);
});

test('rejects deleting a transfer with the expected error', async () => {
    const transaction = createTransactionRecord('transfer');
    const repository = createInMemoryTransactionRepository([transaction]);

    const result = await deleteTransaction(
        transaction.id,
        repository,
        createAccountRepository(transaction),
        currentUserId,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'TRANSFER_DELETE_NOT_ALLOWED');
    assert.equal(
        result.message,
        'Transfer transactions cannot be deleted',
    );
});

test('does not mutate a transfer when deletion is rejected', async () => {
    const transaction = createTransactionRecord('transfer');
    const repository = createInMemoryTransactionRepository([transaction]);
    const originalSnapshot = await repository.findById(transaction.id);

    const result = await deleteTransaction(
        transaction.id,
        repository,
        createAccountRepository(transaction),
        currentUserId,
    );

    assert.equal(result.valid, false);
    assert.deepEqual(
        await repository.findById(transaction.id),
        originalSnapshot,
    );
    assert.equal(transaction.deletedAt, null);
});

test('does not call repository.delete for a transfer', async () => {
    const transaction = createTransactionRecord('transfer');
    const repository = createInMemoryTransactionRepository([transaction]);
    const repositorySpy = createDeleteSpyRepository(repository);

    const result = await deleteTransaction(
        transaction.id,
        repositorySpy,
        createAccountRepository(transaction),
        currentUserId,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'TRANSFER_DELETE_NOT_ALLOWED');
    assert.equal(repositorySpy.getDeleteCalls(), 0);

    assert.deepEqual(
        await repository.findById(transaction.id),
        transaction,
    );
});

test('returns TRANSACTION_NOT_FOUND for a nonexistent ID', async () => {
    const repository = createInMemoryTransactionRepository();
    const repositorySpy = createDeleteSpyRepository(repository);

    const result = await deleteTransaction(
        randomUUID(),
        repositorySpy,
        createAccountRepository({ type: 'income' }),
        currentUserId,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'TRANSACTION_NOT_FOUND');
    assert.equal(result.message, 'Transaction not found');
    assert.equal(repositorySpy.getDeleteCalls(), 0);
});

test('does not allow deleting the same transaction twice', async () => {
    const transaction = createTransactionRecord('income');
    const repository = createInMemoryTransactionRepository([transaction]);

    const accountRepository = createAccountRepository(transaction);

    const firstResult = await deleteTransaction(
        transaction.id,
        repository,
        accountRepository,
        currentUserId,
    );

    assert.equal(firstResult.valid, true);
    assert.ok(firstResult.data.deletedAt instanceof Date);

    const secondResult = await deleteTransaction(
        transaction.id,
        repository,
        accountRepository,
        currentUserId,
    );

    assert.equal(secondResult.valid, false);
    assert.equal(secondResult.error, 'TRANSACTION_NOT_FOUND');
    assert.equal(secondResult.message, 'Transaction not found');
});

test('hides another user transfer behind TRANSACTION_NOT_FOUND', async () => {
    const transaction = createTransactionRecord('transfer');
    const repository = createInMemoryTransactionRepository([transaction]);
    const accountRepository = {
        async findById(accountId) {
            return {
                id: accountId,
                userId: 'other-user',
            };
        },
    };

    const result = await deleteTransaction(
        transaction.id,
        repository,
        accountRepository,
        currentUserId,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'TRANSACTION_NOT_FOUND');
    assert.equal(await repository.findById(transaction.id) !== null, true);
});
