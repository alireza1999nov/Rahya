import {randomUUID} from 'node:crypto';
import validateTransactionInput from '../validation/transactionValidation.js';

const createTransaction = (transactionInput, transactionRepository, accountRepository) => {

    const validation = validateTransactionInput(transactionInput);

    if (!validation.valid) {
        return validation;
    }

    if (validation.data.type === 'income' || validation.data.type === 'expense') {
        const account = accountRepository.findById(validation.data.accountId);
        if(!account) {
            return {
                valid: false,
                error: 'ACCOUNT_NOT_FOUND',
                message: 'Account not found'
            };
        }
    }


    if (validation.data.type === 'transfer') {

        const sourceAccount = accountRepository.findById(validation.data.sourceAccountId);
        if (!sourceAccount) {
            return {
                valid: false,
                error: 'SOURCE_ACCOUNT_NOT_FOUND',
                message: 'Source account not found'
            };
        }

        const destinationAccount = accountRepository.findById(validation.data.destinationAccountId);
        if (!destinationAccount) {
            return {
                valid: false,
                error: 'DESTINATION_ACCOUNT_NOT_FOUND',
                message: 'Destination account not found'
            };
        }
    }

    const now = new Date();

    const transaction = {
        id: randomUUID(),
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
