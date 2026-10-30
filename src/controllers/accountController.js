import accountRepository from '../repositories/accountRepository.js';
import transactionRepository from '../repositories/transactionRepository.js';
import getCurrentBalance from '../useCases/getCurrentBalance.js';

const getCurrentBalanceController = async (req, res, next) => {
    try {
        const result = await getCurrentBalance(
            req.params.accountId,
            transactionRepository,
            accountRepository,
            req.currentUser.id,
        );

        if (!result.valid) {
            return res.status(404).json({
                error: result.error,
                message: result.message,
            });
        }

        return res.status(200).json(result.data);
    } catch (error) {
        return next(error);
    }
};

export { getCurrentBalanceController };
