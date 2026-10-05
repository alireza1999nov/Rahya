import { validateTransactionUpdateInput } from "../validation/transactionValidation.js";

const updateTransaction = (
    transactionId,
    updates,
    transactionRepository
) => {
    const validation = validateTransactionUpdateInput(updates);

    if (!validation.valid) {
        return validation;
    }

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
            error: "TRANSFER_UPDATE_NOT_ALLOWED",
            message: "Transfer transactions cannot be updated",
        };
    }

    const updatedTransaction = transactionRepository.update(
        transactionId,
        validation.data
    );

    return {
        valid: true,
        message: "TRANSACTION_UPDATED",
        data: updatedTransaction,
    };
};

export default updateTransaction;
