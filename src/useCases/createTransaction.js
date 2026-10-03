import {randomUUID} from 'node:crypto';
import validateTransactionInput from '../validation/transactionValidation.js';

const createTransaction = (transactionInput, transactionRepository, accountRepository) => {

    const validation = validateTransactionInput(transactionInput);

    if (!validation.valid) {
        return validation;
    }

    const account = accountRepository.findById(transactionInput.accountId);

    if (!account) {
        return {
            valid: false,
            error: 'ACCOUNT_NOT_FOUND',
            message: 'Account not found'
        };
    }

    const now = new Date();

    const transaction = {
        id: randomUUID(),
        accountId: account.id,
        ...validation.data,
        createdAt: now,
        deletedAt: null
    };

    return {
        valid: true,
        data: transactionRepository.create(transaction),
    }
};

export default createTransaction;
