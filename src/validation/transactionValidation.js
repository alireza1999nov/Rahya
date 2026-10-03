const validateTransactionInput = ({
    type,
    amount,
    category,
    subCategory,
    transactionDate,
    description,
}) => {
    if (typeof type !== 'string') {
        return {
            valid: false,
            message: 'Transaction type must be a string',
        };
    }

    const normalizedType = type.trim().toLowerCase();

    if (!['income', 'expense', 'transfer'].includes(normalizedType)) {
        return {
            valid: false,
            message: 'invalid transaction type',
        };
    }

    if ((normalizedType === 'income' || normalizedType === 'expense')
        && (!category || category.trim() === '')
    ) {
        return {
            valid: false,
            message: 'category is required for income and expense transactions',
        };
    }
    
    if (!Number.isFinite(amount)) {
        return {
            valid: false,
            message: 'Transaction amount must be a number',
        };
    }

    if (amount <= 0) {
        return {
            valid: false,
            message: 'Transaction amount must be greater than zero',
        };
    }

    if (Math.round(amount * 10) !== amount * 10) {
        return {
            valid: false,
            message: 'Transaction amount must have at most one decimal place',
        };
    }

    if (category !== undefined && typeof category !== 'string') {
        return {
            valid: false,
            message: 'Transaction category must be a string',
        };
    }

    if (subCategory !== undefined && typeof subCategory !== 'string') {
        return {
            valid: false,
            message: 'Transaction subCategory must be a string',
        };
    }

    if (typeof transactionDate !== 'string') {
        return {
            valid: false,
            message: 'Transaction date must be a string',
        };
    }

    if (description !== undefined && typeof description !== 'string') {
        return {
            valid: false,
            message: 'Transaction description must be a string',
        };
    }

    if (description !== undefined && description.trim().length > 400 ) {
        return {
            valid: false,
            message: 'Transaction description must be at most 400 characters long',
        };
    }

    return {
        valid: true,
        data: {
            type: normalizedType,
            amount,
            transactionDate,
            ...(category !== undefined && { category }),
            ...(subCategory !== undefined && { subCategory }),
            ...(description !== undefined && { description: description.trim() }),
        },
    };
};

export default validateTransactionInput;
