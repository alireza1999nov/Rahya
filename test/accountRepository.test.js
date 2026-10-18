import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import Account from '../src/models/accountModel.js';
import accountRepository from '../src/repositories/accountRepository.js';

const testUri = process.env.MONGODB_TEST_URI;

test('accountRepository integration tests', async (t) => {
    assert.ok(testUri, 'MONGODB_TEST_URI must be configured');

    const databaseName = new URL(testUri).pathname.slice(1);

    assert.equal(
        databaseName,
        'rahya_test',
        'Tests must only run against the rahya_test database'
    );

    await mongoose.connect(testUri);

    try {
        await Account.init();

        // Remove only test-owned records from the dedicated test database.
        await Account.deleteMany({
            userId: { $in: ['account-repository-test-user-1', 'account-repository-test-user-2'] }
        });

        await t.test('creates and retrieves an account', async () => {
            const created = await accountRepository.create({
                id: 'account-repository-test-id-1',
                userId: 'account-repository-test-user-1',
                name: 'Test Wallet',
                type: 'cash',
                openingBalance: 100,
                currency: 'Toman',
                isDefault: true,
                isArchived: false
            });

            assert.equal(created._id, 'account-repository-test-id-1');

            const found = await accountRepository.findById(created._id);

            assert.ok(found);
            assert.equal(found.name, 'Test Wallet');
            assert.equal(found.userId, 'account-repository-test-user-1');
        });

        await t.test('finds accounts by user ID', async () => {
            const accounts = await accountRepository.findByUserId(
                'account-repository-test-user-1'
            );

            assert.equal(accounts.length, 1);
            assert.equal(accounts[0].name, 'Test Wallet');
        });

        await t.test('finds an account by user ID and name', async () => {
            const account = await accountRepository.findByUserIdAndName(
                'account-repository-test-user-1',
                'Test Wallet'
            );

            assert.ok(account);
            assert.equal(account._id, 'account-repository-test-id-1');
        });

        await t.test('returns null when an account is not found by name', async () => {
            const account = await accountRepository.findByUserIdAndName(
                'account-repository-test-user-1',
                'Missing Wallet'
            );

            assert.equal(account, null);
        });

        await t.test('enforces unique account names per user in MongoDB', async () => {
            await assert.rejects(
                accountRepository.create({
                    id: 'account-repository-test-id-2',
                    userId: 'account-repository-test-user-1',
                    name: 'Test Wallet',
                    type: 'cash',
                    openingBalance: 50,
                    currency: 'Toman',
                    isDefault: false,
                    isArchived: false
                }),
                (error) => error.code === 11000
            );
        });

        await t.test('allows the same account name for different users', async () => {
            const created = await accountRepository.create({
                id: 'account-repository-test-id-3',
                userId: 'account-repository-test-user-2',
                name: 'Test Wallet',
                type: 'cash',
                openingBalance: 50,
                currency: 'Toman',
                isDefault: false,
                isArchived: false
            });

            assert.equal(created.name, 'Test Wallet');
            assert.equal(created.userId, 'account-repository-test-user-2');
        });
    } finally {
        await Account.deleteMany({
            userId: { $in: ['account-repository-test-user-1', 'account-repository-test-user-2'] }
        });

        await mongoose.disconnect();
    }
});
