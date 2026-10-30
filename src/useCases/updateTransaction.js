import { validateTransactionUpdateInput } from '../validation/transactionValidation.js';

const relatedAccountIds = (transaction) => {
    if (transaction.type === 'transfer') {
        return [transaction.sourceAccountId, transaction.destinationAccountId];
    }

    return [transaction.accountId];
};

const updateTransaction = async (
    transactionId,
    updates,
    transactionRepository,
    accountRepository,
    currentUserId
) => {
    const transaction = await transactionRepository.findById(transactionId);

    if (!transaction) {
        return {
            valid: false,
            error: 'TRANSACTION_NOT_FOUND',
            message: 'Transaction not found',
        };
    }

    const accounts = await Promise.all(
        relatedAccountIds(transaction).map((accountId) =>
            accountRepository.findById(accountId)
        )
    );

    if (accounts.some((account) => !account)) {
        return {
            valid: false,
            error: 'DATA_INTEGRITY_ERROR',
            message: 'The transaction cannot be updated due to a data integrity issue',
            details: {
                transactionId,
                accountIds: relatedAccountIds(transaction),
            },
        };
    }

    if (accounts.some((account) => account.userId !== currentUserId)) {
        return {
            valid: false,
            error: 'TRANSACTION_NOT_FOUND',
            message: 'Transaction not found',
        };
    }

    if (transaction.type === 'transfer') {
        return {
            valid: false,
            error: 'TRANSFER_UPDATE_NOT_ALLOWED',
            message: 'Transfer transactions cannot be updated',
        };
    }

    const validation = validateTransactionUpdateInput(updates);

    if (!validation.valid) {
        return validation;
    }

    const [account] = accounts;

    if (account.isArchived) {
        return {
            valid: false,
            error: 'ACCOUNT_ARCHIVED',
            message: 'Transactions linked to archived accounts cannot be updated',
        };
    }

    const updatedTransaction = await transactionRepository.update(
        transactionId,
        validation.data
    );

    if (!updatedTransaction) {
        return {
            valid: false,
            error: 'TRANSACTION_NOT_FOUND',
            message: 'Transaction not found',
        };
    }

    return {
        valid: true,
        message: 'TRANSACTION_UPDATED',
        data: updatedTransaction,
    };
};

export default updateTransaction;
