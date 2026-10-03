const transactions = [];

const transactionRepository = {
    create(transaction) {
        transactions.push(transaction);
        return transaction;
    }
}

export default transactionRepository;
