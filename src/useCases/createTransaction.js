import { randomUUID } from 'node:crypto';
import { validateTransactionCreateInput } from '../validation/transactionValidation.js';

const createTransaction = async (
    transactionInput,
    transactionRepository,
    accountRepository
) => {
    const validation = validateTransactionCreateInput(transactionInput);

    if (!validation.valid) {
        return validation;
    }

    if (
        validation.data.type === 'income' ||
        validation.data.type === 'expense'
    ) {
        const account = await accountRepository.findById(
            validation.data.accountId
        );

        if (!account) {
            return {
                valid: false,
                error: 'ACCOUNT_NOT_FOUND',
                message: 'Account not found',
            };
        }

        if (account.isArchived) {
            return {
                valid: false,
                error: 'ACCOUNT_ARCHIVED',
                message: 'New transactions on archived accounts are prohibited',
            };
        }
    }

    if (validation.data.type === 'transfer') {
        const sourceAccount = await accountRepository.findById(
            validation.data.sourceAccountId
        );

        if (!sourceAccount) {
            return {
                valid: false,
                error: 'SOURCE_ACCOUNT_NOT_FOUND',
                message: 'Source account not found',
            };
        }

        if (sourceAccount.isArchived) {
            return {
                valid: false,
                error: 'ACCOUNT_ARCHIVED',
                message: 'New transactions on archived accounts are prohibited',
            };
        }

        const destinationAccount = await accountRepository.findById(
            validation.data.destinationAccountId
        );

        if (!destinationAccount) {
            return {
                valid: false,
                error: 'DESTINATION_ACCOUNT_NOT_FOUND',
                message: 'Destination account not found',
            };
        }

        if (destinationAccount.isArchived) {
            return {
                valid: false,
                error: 'ACCOUNT_ARCHIVED',
                message: 'New transactions on archived accounts are prohibited',
            };
        }
    }

    const transaction = {
        id: randomUUID(),
        ...validation.data,
        deletedAt: null,
    };

    const createdTransaction = await transactionRepository.create(transaction);

    return {
        valid: true,
        data: createdTransaction,
    };
};

export default createTransaction;
