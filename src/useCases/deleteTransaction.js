const relatedAccountIds = (transaction) => {
    if (transaction.type === "transfer") {
        return [transaction.sourceAccountId, transaction.destinationAccountId];
    }

    return [transaction.accountId];
};

const deleteTransaction = async (
    transactionId,
    transactionRepository,
    accountRepository,
    currentUserId
) => {
    const transaction = await transactionRepository.findById(transactionId);

    if (!transaction) {
        return {
            valid: false,
            error: "TRANSACTION_NOT_FOUND",
            message: "Transaction not found",
        };
    }

    const accounts = await Promise.all(
        relatedAccountIds(transaction).map((accountId) =>
            accountRepository.findById(accountId)
        )
    );

    if (
        accounts.some(
            (account) => !account || account.userId !== currentUserId
        )
    ) {
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

    const deletedTransaction = await transactionRepository.delete(transactionId);

    if (!deletedTransaction) {
        return {
            valid: false,
            error: "TRANSACTION_NOT_FOUND",
            message: "Transaction not found",
        };
    }

    return {
        valid: true,
        message: "TRANSACTION_DELETED",
        data: deletedTransaction,
    };
};

export default deleteTransaction;
