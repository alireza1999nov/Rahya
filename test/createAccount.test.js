import assert from 'node:assert/strict';
import test from 'node:test';
import createAccount from '../src/useCases/createAccount.js';

function createDependencies({
    userExists = true,
    existingAccount = null,
    userAccounts = [],
    createdAccount = null
} = {}) {
    const calls = {
        findUserById: 0,
        findAccountByName: 0,
        findAccountsByUser: 0,
        createAccount: 0,
        accountInput: null
    };

    const userRepository = {
        async findById(userId) {
            calls.findUserById++;
            return userExists ? { id: userId } : null;
        }
    };

    const accountRepository = {
        async findByUserIdAndName(userId, name) {
            calls.findAccountByName++;
            return existingAccount;
        },

        async findByUserId(userId) {
            calls.findAccountsByUser++;
            return userAccounts;
        },

        async create(account) {
            calls.createAccount++;
            calls.accountInput = account;

            return createdAccount ?? {
                _id: account.id,
                ...account,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }
    };

    return { userRepository, accountRepository, calls };
}

const validInput = {
    name: '  Cash Wallet  ',
    type: 'cash',
    openingBalance: 100
};

test('rejects a missing or empty user ID', async () => {
    for (const userId of [undefined, null, '', '   ', 123]) {
        const deps = createDependencies();

        const result = await createAccount({
            userId,
            accountInput: validInput,
            ...deps
        });

        assert.equal(result.valid, false);
        assert.equal(result.error, 'USER_NOT_FOUND');
        assert.equal(deps.calls.findUserById, 0);
        assert.equal(deps.calls.createAccount, 0);
    }
});

test('rejects a user that does not exist', async () => {
    const deps = createDependencies({ userExists: false });

    const result = await createAccount({
        userId: 'user-123',
        accountInput: validInput,
        ...deps
    });

    assert.equal(result.valid, false);
    assert.equal(result.error, 'USER_NOT_FOUND');
    assert.equal(deps.calls.createAccount, 0);
});

test('rejects invalid account input without creating an account', async () => {
    const deps = createDependencies();

    const result = await createAccount({
        userId: 'user-123',
        accountInput: { ...validInput, openingBalance: -1 },
        ...deps
    });

    assert.equal(result.valid, false);
    assert.equal(deps.calls.findAccountByName, 0);
    assert.equal(deps.calls.createAccount, 0);
});

test('rejects an account name that already exists for the user', async () => {
    const deps = createDependencies({
        existingAccount: { _id: 'existing-account' }
    });

    const result = await createAccount({
        userId: 'user-123',
        accountInput: validInput,
        ...deps
    });

    assert.equal(result.valid, false);
    assert.equal(result.error, 'ACCOUNT_NAME_ALREADY_EXISTS');
    assert.equal(deps.calls.createAccount, 0);
});

test('creates the first account as the default account', async () => {
    const deps = createDependencies({ userAccounts: [] });

    const result = await createAccount({
        userId: 'user-123',
        accountInput: validInput,
        ...deps
    });

    assert.equal(result.valid, true);
    assert.equal(result.data.userId, 'user-123');
    assert.equal(result.data.name, 'Cash Wallet');
    assert.equal(result.data.type, 'cash');
    assert.equal(result.data.openingBalance, 100);
    assert.equal(result.data.currency, 'Toman');
    assert.equal(result.data.isDefault, true);
    assert.equal(result.data.isArchived, false);
    assert.equal(typeof result.data.id, 'string');
    assert.equal(deps.calls.createAccount, 1);
    assert.equal(deps.calls.accountInput.name, 'Cash Wallet');
});

test('does not make a new account default when another account exists', async () => {
    const deps = createDependencies({
        userAccounts: [{ _id: 'existing-account' }]
    });

    const result = await createAccount({
        userId: 'user-123',
        accountInput: validInput,
        ...deps
    });

    assert.equal(result.valid, true);
    assert.equal(result.data.isDefault, false);
});

test('preserves an optional description', async () => {
    const deps = createDependencies();

    const result = await createAccount({
        userId: 'user-123',
        accountInput: {
            ...validInput,
            description: 'Everyday spending'
        },
        ...deps
    });

    assert.equal(result.valid, true);
    assert.equal(result.data.description, 'Everyday spending');
});

test('does not expose internal fields from the created document', async () => {
    const deps = createDependencies({
        createdAccount: {
            _id: 'account-123',
            userId: 'user-123',
            name: 'Cash Wallet',
            type: 'cash',
            openingBalance: 100,
            currency: 'Toman',
            isDefault: true,
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            internalField: 'must not be exposed'
        }
    });

    const result = await createAccount({
        userId: 'user-123',
        accountInput: validInput,
        ...deps
    });

    assert.equal(result.valid, true);
    assert.equal('internalField' in result.data, false);
});
