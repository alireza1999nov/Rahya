import { randomUUID } from 'node:crypto';
import validateAccountInput from '../validation/accountValidation.js';

const createAccount = async ({
    userId,
    accountInput,
    userRepository,
    accountRepository
}) => {
    if (typeof userId !== 'string' || userId.trim() === '') {
        return {
            valid: false,
            error: 'USER_NOT_FOUND',
            message: 'User not found'
        };
    }

    const user = await userRepository.findById(userId);

    if (!user) {
        return {
            valid: false,
            error: 'USER_NOT_FOUND',
            message: 'User not found'
        };
    }

    const validation = validateAccountInput(accountInput);

    if (!validation.valid) {
        return validation;
    }

    const existingAccount = await accountRepository.findByUserIdAndName(
        userId,
        validation.data.name
    );

    if (existingAccount) {
        return {
            valid: false,
            error: 'ACCOUNT_NAME_ALREADY_EXISTS',
            message: 'An account with this name already exists for the user'
        };
    }

    const userAccounts = await accountRepository.findByUserId(userId);
    const now = new Date();

    const account = {
        id: randomUUID(),
        userId,
        name: validation.data.name,
        type: validation.data.type,
        openingBalance: validation.data.openingBalance,
        currency: 'Toman',
        ...(validation.data.description !== undefined && {
            description: validation.data.description
        }),
        isDefault: userAccounts.length === 0,
        isArchived: false,
        createdAt: now
    };

    const createdAccount = await accountRepository.create(account);

    return {
        valid: true,
        data: {
            id: createdAccount._id,
            userId: createdAccount.userId,
            name: createdAccount.name,
            type: createdAccount.type,
            openingBalance: createdAccount.openingBalance,
            currency: createdAccount.currency,
            ...(createdAccount.description !== undefined && {
                description: createdAccount.description
            }),
            isDefault: createdAccount.isDefault,
            isArchived: createdAccount.isArchived,
            createdAt: createdAccount.createdAt,
            updatedAt: createdAccount.updatedAt
        }
    };
};

export default createAccount;
