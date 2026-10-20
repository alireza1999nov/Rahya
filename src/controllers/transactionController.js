import transactionRepository from '../repositories/transactionRepository.js';
import accountRepository from '../repositories/accountRepository.js';

import createTransaction from '../useCases/createTransaction.js';
import getAccountTransactions from '../useCases/getAccountTransactions.js';
import updateTransaction from '../useCases/updateTransaction.js';
import deleteTransaction from '../useCases/deleteTransaction.js';

const createTransactionController = async (req, res, next) => {
    try {
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
    } catch (error) {
        return next(error);
    }
};

const getAccountTransactionsController = async (req, res, next) => {
    try {
        const { accountId } = req.params;

        const result = await getAccountTransactions(
            accountId,
            transactionRepository,
            accountRepository
        );

        if (!result.valid) {
            const statusCode =
                result.error === 'ACCOUNT_NOT_FOUND' ? 404 : 400;

            return res.status(statusCode).json({
                error: result.error ?? 'VALIDATION_ERROR',
                message: result.message,
            });
        }

        return res.status(200).json(result.data);
    } catch (error) {
        return next(error);
    }
};

const updateTransactionController = async (req, res, next) => {
    try {
        const { transactionId } = req.params;

        const result = await updateTransaction(
            transactionId,
            req.body,
            transactionRepository,
            accountRepository
        );

        if (!result.valid) {
            const statusByError = {
                TRANSACTION_NOT_FOUND: 404,
                TRANSFER_UPDATE_NOT_ALLOWED: 409,
                ACCOUNT_ARCHIVED: 409,
                DATA_INTEGRITY_ERROR: 500,
            };

            const statusCode = statusByError[result.error] ?? 400;

            if (result.error === 'DATA_INTEGRITY_ERROR') {
                console.error(
                    'Transaction data integrity error',
                    result.details
                );
            }

            return res.status(statusCode).json({
                error: result.error ?? 'VALIDATION_ERROR',
                message:
                    result.error === 'DATA_INTEGRITY_ERROR'
                        ? 'The transaction cannot be updated due to an internal data integrity issue'
                        : result.message,
            });
        }

        return res.status(200).json(result.data);
    } catch (error) {
        return next(error);
    }
};

const deleteTransactionController = async (req, res, next) => {
    try {
        const { transactionId } = req.params;

        const result = await deleteTransaction(
            transactionId,
            transactionRepository
        );

        if (!result.valid) {
            const statusByError = {
                TRANSACTION_NOT_FOUND: 404,
                TRANSFER_DELETE_NOT_ALLOWED: 409,
            };

            const statusCode = statusByError[result.error] ?? 400;

            return res.status(statusCode).json({
                error: result.error ?? 'VALIDATION_ERROR',
                message: result.message,
            });
        }

        return res.status(200).json(result.data);
    } catch (error) {
        return next(error);
    }
};

export {
    createTransactionController,
    getAccountTransactionsController,
    updateTransactionController,
    deleteTransactionController,
};
