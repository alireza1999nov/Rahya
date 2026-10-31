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

const deleteTransaction = async (
    transactionId,
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
        const accounts = await Promise.all(
            accountIds.map((accountId) =>
                accountRepository.findById(accountId, session),
            ),
        );

        if (
            accounts.some(
                (account) => !account || account.userId !== currentUserId,
            )
        ) {
            rejectFinancialMutation({
                valid: false,
                error: 'TRANSACTION_NOT_FOUND',
                message: 'Transaction not found',
            });
        }

        if (transaction.type === 'transfer') {
            rejectFinancialMutation({
                valid: false,
                error: 'TRANSFER_DELETE_NOT_ALLOWED',
                message: 'Transfer transactions cannot be deleted',
            });
        }

        const accountsById = new Map();

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
                    error: 'TRANSACTION_NOT_FOUND',
                    message: 'Transaction not found',
                });
            }

            accountsById.set(accountId, account);
        }

        const deletedTransaction = await transactionRepository.delete(
            transactionId,
            session,
        );

        if (!deletedTransaction) {
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
            message: 'TRANSACTION_DELETED',
            data: deletedTransaction,
        };
    });

export default deleteTransaction;
