import transactionRepository from '../repositories/transactionRepository.js';
import accountRepository from '../repositories/accountRepository.js';

import createTransaction from '../useCases/createTransaction.js';
import getAccountTransactions from '../useCases/getAccountTransactions.js';
import updateTransaction from '../useCases/updateTransaction.js';
import deleteTransaction from '../useCases/deleteTransaction.js';

const createTransactionController = async (req, res) => {
    const result = await createTransaction(
        req.body,
        transactionRepository,
        accountRepository
    );

    if (!result.valid) {
        return res.status(400).json({
            error: result.error ?? 'VALIDATION_ERROR',
            message: result.message,
        });
    }

    return res.status(201).json(result.data);
};

const getAccountTransactionsController = async (req, res) => {
    const { accountId } = req.params;

    const result = await getAccountTransactions(
        accountId,
        transactionRepository,
        accountRepository
    );

    if (!result.valid) {
        return res.status(404).json({
            error: result.error,
            message: result.message,
        });
    }

    return res.status(200).json(result.data);
};

const updateTransactionController = async (req, res) => {
    const { transactionId } = req.params;

    const result = await updateTransaction(
        transactionId,
        req.body,
        transactionRepository
    );

    if (!result.valid) {
        const statusCode =
            result.error === 'TRANSACTION_NOT_FOUND' ? 404 : 400;

        return res.status(statusCode).json({
            error: result.error ?? 'VALIDATION_ERROR',
            message: result.message,
        });
    }

    return res.status(200).json(result.data);
};

const deleteTransactionController = async (req, res) => {
    const { transactionId } = req.params;

    const result = await deleteTransaction(
        transactionId,
        transactionRepository
    );

    if (!result.valid) {
        const statusCode =
            result.error === 'TRANSACTION_NOT_FOUND' ? 404 : 400;

        return res.status(statusCode).json({
            error: result.error,
            message: result.message,
        });
    }

    return res.status(200).json(result.data);
};

export {
    createTransactionController,
    getAccountTransactionsController,
    updateTransactionController,
    deleteTransactionController,
};
