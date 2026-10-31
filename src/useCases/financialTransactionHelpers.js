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
    const match =
        typeof transaction.transactionDate === 'string'
            ? transaction.transactionDate.match(
                  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+03:30$/,
              )
            : null;

    if (!match) {
        throw new Error('Stored transaction date is invalid');
    }

    const [, yearString, monthString, dayString, hourString, minuteString, secondString] =
        match;
    const year = Number(yearString);
    const month = Number(monthString);
    const day = Number(dayString);
    const hour = Number(hourString);
    const minute = Number(minuteString);
    const second = Number(secondString);
    const isLeapYear =
        year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [
        31,
        isLeapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];

    if (
        year === 0 ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > daysInMonth[month - 1] ||
        hour > 23 ||
        minute > 59 ||
        second > 59
    ) {
        throw new Error('Stored transaction date is invalid');
    }

    const time = Date.parse(transaction.transactionDate);

    if (!Number.isFinite(time)) {
        throw new Error('Stored transaction date is invalid');
    }

    return time;
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
        const changesByTimestamp = new Map();

        for (const transaction of transactions) {
            const timestamp = transactionTime(transaction);

            if (timestamp > now) {
                continue;
            }

            const amountInTenths = BigInt(toTenths(transaction.amount));
            let changeInTenths = 0n;

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

            changesByTimestamp.set(
                timestamp,
                (changesByTimestamp.get(timestamp) ?? 0n) + changeInTenths,
            );
        }

        let balanceInTenths = BigInt(toTenths(account.openingBalance));

        for (const timestamp of [...changesByTimestamp.keys()].sort(
            (left, right) => left - right,
        )) {
            balanceInTenths += changesByTimestamp.get(timestamp);

            if (
                balanceInTenths > BigInt(Number.MAX_SAFE_INTEGER) ||
                balanceInTenths < BigInt(Number.MIN_SAFE_INTEGER)
            ) {
                throw new Error('Calculated historical balance is invalid');
            }

            if (balanceInTenths < 0n) {
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
