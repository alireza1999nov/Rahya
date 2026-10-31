export class FinancialMutationRejected extends Error {
    constructor(result) {
        super(result.message);
        this.result = result;
    }
}

export class FinancialOutcomeUnknownError extends Error {
    constructor(cause) {
        super(
            'The financial operation outcome could not be confirmed. Check the transaction history before retrying.',
        );
        this.name = 'FinancialOutcomeUnknownError';
        this.cause = cause;
    }
}

export const rejectFinancialMutation = (result) => {
    throw new FinancialMutationRejected(result);
};

export const runFinancialTransaction = async (
    transactionRepository,
    operation,
) => {
    try {
        return await transactionRepository.withTransaction(operation);
    } catch (error) {
        if (error instanceof FinancialMutationRejected) {
            return error.result;
        }

        if (error.hasErrorLabel?.('UnknownTransactionCommitResult')) {
            throw new FinancialOutcomeUnknownError(error);
        }

        throw error;
    }
};

const toTenths = (amount) => {
    const tenths = amount * 10;

    if (
        !Number.isFinite(amount) ||
        !Number.isSafeInteger(tenths) ||
        Math.round(tenths) !== tenths
    ) {
        throw new Error('Stored transaction balance amount is invalid');
    }

    return tenths;
};

const transactionTime = (transaction) => {
    const time = Date.parse(transaction.transactionDate);

    if (!Number.isFinite(time)) {
        throw new Error('Stored transaction date is invalid');
    }

    return time;
};

const createdTime = (transaction) => {
    const time = new Date(transaction.createdAt ?? 0).getTime();

    return Number.isFinite(time) ? time : 0;
};

export const assertHistoricalBalances = async (
    accountIds,
    accountsById,
    transactionRepository,
    session,
) => {
    const now = Date.now();

    for (const accountId of accountIds) {
        const account = accountsById.get(accountId);

        if (!account) {
            rejectFinancialMutation({
                valid: false,
                error: 'DATA_INTEGRITY_ERROR',
                message: 'Account data is unavailable for balance validation',
            });
        }

        const transactions =
            await transactionRepository.findByRelatedAccountId(
                accountId,
                session,
            );
        const orderedTransactions = transactions
            .filter((transaction) => transactionTime(transaction) <= now)
            .sort((left, right) => {
                const timeDifference =
                    transactionTime(left) - transactionTime(right);

                if (timeDifference !== 0) {
                    return timeDifference;
                }

                const createdDifference =
                    createdTime(left) - createdTime(right);

                if (createdDifference !== 0) {
                    return createdDifference;
                }

                return String(left.id).localeCompare(String(right.id));
            });

        let balanceInTenths = toTenths(account.openingBalance);

        for (const transaction of orderedTransactions) {
            const amountInTenths = toTenths(transaction.amount);
            let changeInTenths = 0;

            if (
                transaction.type === 'income' &&
                transaction.accountId === accountId
            ) {
                changeInTenths = amountInTenths;
            } else if (
                transaction.type === 'expense' &&
                transaction.accountId === accountId
            ) {
                changeInTenths = -amountInTenths;
            } else if (
                transaction.type === 'transfer' &&
                transaction.sourceAccountId === accountId
            ) {
                changeInTenths = -amountInTenths;
            } else if (
                transaction.type === 'transfer' &&
                transaction.destinationAccountId === accountId
            ) {
                changeInTenths = amountInTenths;
            }

            balanceInTenths += changeInTenths;

            if (!Number.isSafeInteger(balanceInTenths)) {
                throw new Error('Calculated historical balance is invalid');
            }

            if (balanceInTenths < 0) {
                rejectFinancialMutation({
                    valid: false,
                    error: 'HISTORICAL_BALANCE_VIOLATION',
                    message:
                        'The transaction would make the account balance negative at a historical point',
                });
            }
        }
    }
};
