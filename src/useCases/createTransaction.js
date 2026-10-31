import { randomUUID } from 'node:crypto';
import { validateTransactionCreateInput } from '../validation/transactionValidation.js';
import {
    assertHistoricalBalances,
    rejectFinancialMutation,
    runFinancialTransaction,
} from './financialTransactionHelpers.js';

const createTransaction = async (
    transactionInput,
    transactionRepository,
    accountRepository,
    currentUserId,
) => {
    const validation = validateTransactionCreateInput(transactionInput);

    if (!validation.valid) {
        return validation;
    }

    const transaction = {
        id: randomUUID(),
        ...validation.data,
        deletedAt: null,
    };
    const accountIds =
        transaction.type === 'transfer'
            ? [
                  transaction.sourceAccountId,
                  transaction.destinationAccountId,
              ]
            : [transaction.accountId];

    return runFinancialTransaction(
        transactionRepository,
        async (session) => {
            const accountsById = new Map();
            const missingAccountErrors = new Map();

            if (transaction.type === 'transfer') {
                missingAccountErrors.set(
                    transaction.sourceAccountId,
                    'SOURCE_ACCOUNT_NOT_FOUND',
                );
                missingAccountErrors.set(
                    transaction.destinationAccountId,
                    'DESTINATION_ACCOUNT_NOT_FOUND',
                );
            }

            for (const accountId of accountIds) {
                const account = await accountRepository.findById(
                    accountId,
                    session,
                );

                if (!account || account.userId !== currentUserId) {
                    rejectFinancialMutation({
                        valid: false,
                        error:
                            missingAccountErrors.get(accountId) ??
                            'ACCOUNT_NOT_FOUND',
                        message: 'Account not found',
                    });
                }

                accountsById.set(accountId, account);
            }

            for (const account of accountsById.values()) {
                if (account.isArchived) {
                    rejectFinancialMutation({
                        valid: false,
                        error: 'ACCOUNT_ARCHIVED',
                        message:
                            'New transactions on archived accounts are prohibited',
                    });
                }
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
                        error:
                            missingAccountErrors.get(accountId) ??
                            'ACCOUNT_NOT_FOUND',
                        message: 'Account not found',
                    });
                }

                if (account.isArchived) {
                    rejectFinancialMutation({
                        valid: false,
                        error: 'ACCOUNT_ARCHIVED',
                        message:
                            'New transactions on archived accounts are prohibited',
                    });
                }

                accountsById.set(accountId, account);
            }

            const createdTransaction =
                await transactionRepository.create(transaction, session);

            await assertHistoricalBalances(
                accountIds,
                accountsById,
                transactionRepository,
                session,
            );

            return {
                valid: true,
                data: createdTransaction,
            };
        },
    );
};

export default createTransaction;
