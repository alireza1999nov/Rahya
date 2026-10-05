const transactions = [];

const transactionRepository = {
    create(transaction) {
        transactions.push(transaction);
        return transaction;
    },
    findByRelatedAccountId(accountId) {
        return transactions.filter(
            transaction => (
                transaction.accountId === accountId ||
                transaction.sourceAccountId === accountId ||
                transaction.destinationAccountId === accountId
            ) &&
            transaction.deletedAt === null
        );
    },
    findById(transactionId) {
        return transactions.find(
            transaction => transaction.id === transactionId &&
            transaction.deletedAt === null
        );
    },
    update(transactionId, updates) {
        const transaction = transactions.find(
            transaction =>
                transaction.id === transactionId &&
                transaction.deletedAt === null
        );
        if (!transaction) {
            return null;
        }
        Object.assign(transaction, updates);
        return transaction;
    }
};

export default transactionRepository;
