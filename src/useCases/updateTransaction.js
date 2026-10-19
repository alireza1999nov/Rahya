import { validateTransactionUpdateInput } from "../validation/transactionValidation.js";

const updateTransaction = async (
    transactionId,
    updates,
    transactionRepository
) => {
    const validation = validateTransactionUpdateInput(updates);

    if (!validation.valid) {
        return validation;
    }

    const transaction = await transactionRepository.findById(transactionId);

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

    const updatedTransaction = await transactionRepository.update(
        transactionId,
        validation.data
    );

    if (!updatedTransaction) {
        return {
            valid: false,
            error: "TRANSACTION_NOT_FOUND",
            message: "Transaction not found",
        };
    }

    return {
        valid: true,
        message: "TRANSACTION_UPDATED",
        data: updatedTransaction,
    };
};

export default updateTransaction;
