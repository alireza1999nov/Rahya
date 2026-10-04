const transactions = [];

const transactionRepository = {
    create(transaction) {
        transactions.push(transaction);
        return transaction;
    },
    findByAccountId(accountId) {
        return transactions.filter(
            transaction =>
                transaction.accountId === accountId &&
                transaction.deletedAt === null
        );
    }
}

export default transactionRepository;
