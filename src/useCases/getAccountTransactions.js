const getAccountTransactions = (accountId, transactionRepository, accountRepository) => {
    const account = accountRepository.findById(accountId);
    if (!account) {
        return {
            valid: false,
            error: 'ACCOUNT_NOT_FOUND',
            message: 'Account not found'
        };
    }

    const transactions = transactionRepository.findByRelatedAccountId(accountId);

    return {
        valid: true,
        data: transactions
    };
};

export default getAccountTransactions;
