import { validateTransactionUpdateInput } from '../validation/transactionValidation.js';
import {
    assertHistoricalBalances,
    rejectFinancialMutation,
    runFinancialTransaction,
} from './financialTransactionHelpers.js';

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
    currentUserId,
) =>
    runFinancialTransaction(transactionRepository, async (session) => {
        const transaction = await transactionRepository.findById(
            transactionId,
            session,
        );

        if (!transaction) {
            rejectFinancialMutation({
                valid: false,
                error: 'TRANSACTION_NOT_FOUND',
                message: 'Transaction not found',
            });
        }

        const accountIds = relatedAccountIds(transaction);
        const accountsById = new Map();
        const accounts = await Promise.all(
            accountIds.map((accountId) =>
                accountRepository.findById(accountId, session),
            ),
        );

        if (accounts.some((account) => !account)) {
            rejectFinancialMutation({
                valid: false,
                error: 'DATA_INTEGRITY_ERROR',
                message:
                    'The transaction cannot be updated due to a data integrity issue',
                details: {
                    transactionId,
                    accountIds,
                },
            });
        }

        if (accounts.some((account) => account.userId !== currentUserId)) {
            rejectFinancialMutation({
                valid: false,
                error: 'TRANSACTION_NOT_FOUND',
                message: 'Transaction not found',
            });
        }

        if (transaction.type === 'transfer') {
            rejectFinancialMutation({
                valid: false,
                error: 'TRANSFER_UPDATE_NOT_ALLOWED',
                message: 'Transfer transactions cannot be updated',
            });
        }

        const validation = validateTransactionUpdateInput(updates);

        if (!validation.valid) {
            rejectFinancialMutation(validation);
        }

        for (const accountId of [...new Set(accountIds)].sort()) {
            const account =
                await accountRepository.incrementFinancialRevision(
                    accountId,
                    currentUserId,
                    session,
                );

            if (!account) {
                rejectFinancialMutation({
                    valid: false,
                    error: 'DATA_INTEGRITY_ERROR',
                    message:
                        'The transaction cannot be updated due to a data integrity issue',
                    details: {
                        transactionId,
                        accountIds,
                    },
                });
            }

            accountsById.set(accountId, account);
        }

        const account = accountsById.get(accountIds[0]);

        if (account.isArchived) {
            rejectFinancialMutation({
                valid: false,
                error: 'ACCOUNT_ARCHIVED',
                message:
                    'Transactions linked to archived accounts cannot be updated',
            });
        }

        const updatedTransaction = await transactionRepository.update(
            transactionId,
            validation.data,
            session,
        );

        if (!updatedTransaction) {
            rejectFinancialMutation({
                valid: false,
                error: 'TRANSACTION_NOT_FOUND',
                message: 'Transaction not found',
            });
        }

        await assertHistoricalBalances(
            accountIds,
            accountsById,
            transactionRepository,
            session,
        );

        return {
            valid: true,
            message: 'TRANSACTION_UPDATED',
            data: updatedTransaction,
        };
    });

export default updateTransaction;
