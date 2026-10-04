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
    }
}

export default transactionRepository;
