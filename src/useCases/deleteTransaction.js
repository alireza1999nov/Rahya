const deleteTransaction = (
    transactionId,
    transactionRepository
) => {
    const transaction = transactionRepository.findById(transactionId);

    if (!transaction) {
        return {
            valid: false,
            error: "TRANSACTION_NOT_FOUND",
            message: "Transaction not found",
        };
    }

    const deletedTransaction = transactionRepository.delete(transactionId);

    return {
        valid: true,
        message: "TRANSACTION_DELETED",
        data: deletedTransaction
    };
};

export default deleteTransaction;
