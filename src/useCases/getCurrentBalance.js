const toTenths = (amount) => {
    const tenths = amount * 10;

    if (
        !Number.isFinite(amount) ||
        !Number.isSafeInteger(tenths) ||
        Math.round(tenths) !== tenths
    ) {
        throw new Error('Stored balance amount is invalid');
    }

    return tenths;
};

const getCurrentBalance = async (
    accountId,
    transactionRepository,
    accountRepository,
    currentUserId,
) => {
    const account = await accountRepository.findById(accountId);

    if (!account || account.userId !== currentUserId) {
        return {
            valid: false,
            error: 'ACCOUNT_NOT_FOUND',
            message: 'Account not found',
        };
    }

    const transactions =
        await transactionRepository.findByRelatedAccountId(accountId);
    const currentTime = Date.now();
    let balanceInTenths = toTenths(account.openingBalance);

    for (const transaction of transactions) {
        const isRelated =
            transaction.accountId === accountId ||
            transaction.sourceAccountId === accountId ||
            transaction.destinationAccountId === accountId;

        if (!isRelated) {
            continue;
        }

        const transactionTime =
            typeof transaction.transactionDate === 'string'
                ? Date.parse(transaction.transactionDate)
                : Number.NaN;

        if (!Number.isFinite(transactionTime)) {
            throw new Error('Stored transaction date is invalid');
        }

        if (transactionTime > currentTime) {
            continue;
        }

        const amountInTenths = toTenths(transaction.amount);

        switch (transaction.type) {
            case 'income':
                if (transaction.accountId === accountId) {
                    balanceInTenths += amountInTenths;
                }
                break;
            case 'expense':
                if (transaction.accountId === accountId) {
                    balanceInTenths -= amountInTenths;
                }
                break;
            case 'transfer':
                if (transaction.sourceAccountId === accountId) {
                    balanceInTenths -= amountInTenths;
                } else if (transaction.destinationAccountId === accountId) {
                    balanceInTenths += amountInTenths;
                }
                break;
            default:
                throw new Error('Stored transaction type is invalid');
        }

        if (!Number.isSafeInteger(balanceInTenths)) {
            throw new Error('Calculated balance exceeds the supported range');
        }
    }

    return {
        valid: true,
        data: {
            accountId: account._id,
            currentBalance: balanceInTenths / 10,
            currency: account.currency,
        },
    };
};

export default getCurrentBalance;
