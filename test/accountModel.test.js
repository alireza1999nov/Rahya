import assert from 'node:assert/strict';
import test from 'node:test';

import Account from '../src/models/accountModel.js';

function createValidAccount(overrides = {}) {
    return new Account({
        userId: 'user-123',
        name: 'Cash Wallet',
        type: 'cash',
        openingBalance: 100,
        ...overrides
    });
}

async function assertValidationError(account, path) {
    await assert.rejects(account.validate(), (error) => {
        assert.equal(error.name, 'ValidationError');
        assert.ok(error.errors[path]);

        return true;
    });
}

test('generates a UUID v4 as the default account ID', () => {
    const account = createValidAccount();

    assert.match(
        account._id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
});

test('generates a unique ID for each account document', () => {
    const firstAccount = createValidAccount();
    const secondAccount = createValidAccount();

    assert.notEqual(firstAccount._id, secondAccount._id);
});

test('uses a string for the account ID', () => {
    assert.equal(typeof createValidAccount()._id, 'string');
});

test('accepts a valid account document', async () => {
    await createValidAccount().validate();
});

test('requires userId', async () => {
    await assertValidationError(
        createValidAccount({ userId: undefined }),
        'userId'
    );
});

test('requires account name', async () => {
    await assertValidationError(
        createValidAccount({ name: undefined }),
        'name'
    );
});

test('trims whitespace from account name', () => {
    const account = createValidAccount({ name: '  Wallet  ' });

    assert.equal(account.name, 'Wallet');
});

test('limits account name to 100 characters', async () => {
    await assertValidationError(
        createValidAccount({ name: 'a'.repeat(101) }),
        'name'
    );
});

test('accepts cash and bank account types', async () => {
    await createValidAccount({ type: 'cash' }).validate();
    await createValidAccount({ type: 'bank' }).validate();
});

test('rejects an unsupported account type', async () => {
    await assertValidationError(
        createValidAccount({ type: 'credit' }),
        'type'
    );
});

test('requires openingBalance', async () => {
    await assertValidationError(
        createValidAccount({ openingBalance: undefined }),
        'openingBalance'
    );
});

test('rejects a negative opening balance', async () => {
    await assertValidationError(
        createValidAccount({ openingBalance: -1 }),
        'openingBalance'
    );
});

test('rejects an opening balance with more than one decimal place', async () => {
    await assertValidationError(
        createValidAccount({ openingBalance: 10.25 }),
        'openingBalance'
    );
});

test('accepts an opening balance with one decimal place', async () => {
    await createValidAccount({ openingBalance: 10.5 }).validate();
});

test('defaults currency to Toman', () => {
    assert.equal(createValidAccount().currency, 'Toman');
});

test('defaults isDefault to false', () => {
    assert.equal(createValidAccount().isDefault, false);
});

test('defaults isArchived to false', () => {
    assert.equal(createValidAccount().isArchived, false);
});

test('allows an optional description within the limit', async () => {
    await createValidAccount({
        description: 'Everyday spending'
    }).validate();
});

test('rejects a description longer than 400 characters', async () => {
    await assertValidationError(
        createValidAccount({ description: 'a'.repeat(401) }),
        'description'
    );
});

test('defines a unique compound index on userId and name', () => {
    const indexes = Account.schema.indexes();

    assert.ok(
        indexes.some(([fields, options]) =>
            fields.userId === 1 &&
            fields.name === 1 &&
            options.unique === true
        )
    );
});

test('enables automatic createdAt and updatedAt timestamps', () => {
    assert.equal(Account.schema.options.timestamps, true);
});

test('disables the Mongoose version key', () => {
    assert.equal(Account.schema.options.versionKey, false);
});
