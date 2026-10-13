
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import deleteTransaction from '../src/useCases/deleteTransaction.js';
import transactionRepository from '../src/repositories/transactionRepository.js';

const createTransactionRecord = (type, overrides = {}) => {
    const id = randomUUID();

    const commonFields = {
        id,
        type,
        amount: 100,
        transactionDate: '2026-10-10T12:00:00+03:30',
        createdAt: new Date('2026-10-10T08:30:00.000Z'),
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

const createDeleteSpyRepository = (repository) => {
    let deleteCalls = 0;

    return {
        findById: (id) => repository.findById(id),

        delete: (id) => {
            deleteCalls += 1;
            return repository.delete(id);
        },

        getDeleteCalls: () => deleteCalls,
    };
};

test('soft-deletes an income transaction', () => {
    const transaction = createTransactionRecord('income');
    transactionRepository.create(transaction);

    const result = deleteTransaction(
        transaction.id,
        transactionRepository,
    );

    assert.equal(result.valid, true);
    assert.equal(result.message, 'TRANSACTION_DELETED');
    assert.equal(result.data.id, transaction.id);
    assert.equal(result.data.type, 'income');
    assert.ok(result.data.deletedAt instanceof Date);
    assert.notEqual(result.data.deletedAt, null);

    assert.equal(
        transactionRepository.findById(transaction.id),
        undefined,
    );
});

test('soft-deletes an expense transaction', () => {
    const transaction = createTransactionRecord('expense');
    transactionRepository.create(transaction);

    const result = deleteTransaction(
        transaction.id,
        transactionRepository,
    );

    assert.equal(result.valid, true);
    assert.equal(result.message, 'TRANSACTION_DELETED');
    assert.equal(result.data.id, transaction.id);
    assert.equal(result.data.type, 'expense');
    assert.ok(result.data.deletedAt instanceof Date);

    assert.equal(
        transactionRepository.findById(transaction.id),
        undefined,
    );
});

test('rejects deleting a transfer with the expected error', () => {
    const transaction = createTransactionRecord('transfer');
    transactionRepository.create(transaction);

    const result = deleteTransaction(
        transaction.id,
        transactionRepository,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'TRANSFER_DELETE_NOT_ALLOWED');
    assert.equal(
        result.message,
        'Transfer transactions cannot be deleted',
    );
});

test('does not mutate a transfer when deletion is rejected', () => {
    const transaction = createTransactionRecord('transfer');
    transactionRepository.create(transaction);

    const originalSnapshot = { ...transaction };

    const result = deleteTransaction(
        transaction.id,
        transactionRepository,
    );

    assert.equal(result.valid, false);

    assert.deepEqual(
        transactionRepository.findById(transaction.id),
        originalSnapshot,
    );

    assert.equal(transaction.deletedAt, null);
});

test('does not call repository.delete for a transfer', () => {
    const transaction = createTransactionRecord('transfer');
    transactionRepository.create(transaction);

    const repositorySpy = createDeleteSpyRepository(
        transactionRepository,
    );

    const result = deleteTransaction(
        transaction.id,
        repositorySpy,
    );

    assert.equal(result.valid, false);
    assert.equal(repositorySpy.getDeleteCalls(), 0);

    assert.deepEqual(
        transactionRepository.findById(transaction.id),
        transaction,
    );
});

test('returns TRANSACTION_NOT_FOUND for a nonexistent ID', () => {
    const repositorySpy = createDeleteSpyRepository(
        transactionRepository,
    );

    const result = deleteTransaction(
        randomUUID(),
        repositorySpy,
    );

    assert.equal(result.valid, false);
    assert.equal(result.error, 'TRANSACTION_NOT_FOUND');
    assert.equal(result.message, 'Transaction not found');
    assert.equal(repositorySpy.getDeleteCalls(), 0);
});

test('does not allow deleting the same transaction twice', () => {
    const transaction = createTransactionRecord('income');
    transactionRepository.create(transaction);

    const firstResult = deleteTransaction(
        transaction.id,
        transactionRepository,
    );

    assert.equal(firstResult.valid, true);
    assert.ok(firstResult.data.deletedAt instanceof Date);

    const secondResult = deleteTransaction(
        transaction.id,
        transactionRepository,
    );

    assert.equal(secondResult.valid, false);
    assert.equal(secondResult.error, 'TRANSACTION_NOT_FOUND');
    assert.equal(secondResult.message, 'Transaction not found');
});
