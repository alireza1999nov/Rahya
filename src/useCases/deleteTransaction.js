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

    if (transaction.type === "transfer") {
        return {
            valid: false,
            error: "TRANSFER_DELETE_NOT_ALLOWED",
            message: "Transfer transactions cannot be deleted",
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
