const validateAmount = (amount) => {
    if (!Number.isFinite(amount)) {
        return {
            valid: false,
            message: 'Transaction amount must be a number',
        };
    };

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
    return {
        valid: true
    };
}

const validateCategory = (category) => {
    if (category !== undefined && typeof category !== 'string') {
        return {
            valid: false,
            message: 'Transaction category must be a string',
        };
    }

    if (category !== undefined && category.trim() === "") {
        return {
            valid: false,
            message: 'Transaction category cannot be empty'
        };
    }

    return {
        valid: true,
        data: category?.trim()
    }
}

const validateSubCategory = (subCategory) => {

    if (subCategory !== undefined && typeof subCategory !== 'string') {
        return {
            valid: false,
            message: 'Transaction subCategory must be a string',
        };
    }

    return {
        valid: true,
        data: subCategory?.trim()
    };
};

const validateTransactionDate = (transactionDate) => {
    if (typeof transactionDate !== 'string') {
        return {
            valid: false,
            message: 'Transaction date must be a string',
        };
    }

    const datePattern =
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+03:30$/;

    const match = transactionDate.match(datePattern);

    if (!match) {
        return {
            valid: false,
            message: 'Transaction date must use YYYY-MM-DDTHH:mm:ss+03:30 format',
        };
    }

    const [
        ,
        yearString,
        monthString,
        dayString,
        hourString,
        minuteString,
        secondString,
    ] = match;

    const year = Number(yearString);
    const month = Number(monthString);
    const day = Number(dayString);
    const hour = Number(hourString);
    const minute = Number(minuteString);
    const second = Number(secondString);

    if (
        year === 0
        || month < 1
        || month > 12
        || hour > 23
        || minute > 59
        || second > 59
    ) {
        return {
            valid: false,
            message: 'Transaction date contains invalid date or time components',
        };
    }

    const isLeapYear =
        year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

    const daysInMonth = [
        31,
        isLeapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];

    if (day < 1 || day > daysInMonth[month - 1]) {
        return {
            valid: false,
            message: 'Transaction date contains an invalid calendar date',
        };
    }

    const timestamp = Date.parse(transactionDate);

    if (!Number.isFinite(timestamp)) {
        return {
            valid: false,
            message: 'Transaction date is invalid',
        };
    }

    if (timestamp > Date.now()) {
        return {
            valid: false,
            message: 'Transaction date cannot be in the future',
        };
    }

    return {
        valid: true,
        data: transactionDate,
    };
};

const validateDescription = (description) => {
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
        data: description?.trim()
    }
}

const validateTransactionCreateInput = ({
    type,
    accountId,
    sourceAccountId,
    destinationAccountId,
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
            message: 'Invalid transaction type',
        };
    }

    if (
        (normalizedType === 'income' || normalizedType === 'expense')
        && (!accountId || accountId.trim() === '')
    ) {
        return {
            valid: false,
            message: 'accountId is required for income and expense transactions',
        };
    }

    if (normalizedType === 'transfer') {
        if (!sourceAccountId || sourceAccountId.trim() === '') {
            return {
                valid: false,
                message: 'sourceAccountId is required for transfer transactions',
            };
        }
        if (!destinationAccountId || destinationAccountId.trim() === '') {
            return {
                valid: false,
                message: 'destinationAccountId is required for transfer transactions',
            };
        }
        if (sourceAccountId.trim() === destinationAccountId.trim()) {
            return {
                valid: false,
                message: 'sourceAccountId and destinationAccountId cannot be the same',
            };
        }
    }

    if ((normalizedType === 'income' || normalizedType === 'expense')
        && (!category || category.trim() === '')
    ) {
        return {
            valid: false,
            message: 'category is required for income and expense transactions',
        };
    }

    const amountValidation = validateAmount(amount);

    if (!amountValidation.valid) {
        return amountValidation;
    }

    let validatedCategory;
    if (category !== undefined) {
        const categoryValidation = validateCategory(category);

        if (!categoryValidation.valid) {
            return categoryValidation;
        }

        validatedCategory = categoryValidation.data;
    }

    let validatedSubCategory;
    if (subCategory !== undefined) {
        const subCategoryValidation = validateSubCategory(subCategory);

        if (!subCategoryValidation.valid) {
            return subCategoryValidation;
        }

        validatedSubCategory = subCategoryValidation.data;
    }

    const dateValidation = validateTransactionDate(transactionDate);

    if (!dateValidation.valid) {
        return dateValidation;
    }

    let validatedDescription;
    if (description !== undefined) {
        const descriptionValidation = validateDescription(description);

        if (!descriptionValidation.valid) {
            return descriptionValidation;
        }
        validatedDescription = descriptionValidation.data;
    }

    return {
        valid: true,
        data: {
            type: normalizedType,
            amount,
            transactionDate: dateValidation.data,
            ...(normalizedType === 'income' || normalizedType === 'expense'
                ? { accountId }
                : {}),
            ...(normalizedType === 'transfer'
                ? { sourceAccountId, destinationAccountId }
                : {}),
            ...(category !== undefined && {
                category: validatedCategory
            }),
            ...(subCategory !== undefined && {
                subCategory: validatedSubCategory
            }),
            ...(description !== undefined && {
                description: validatedDescription
            }),
        },
    };
};

const validateTransactionUpdateInput = (updates) => {

    const allowedFields = [
        'amount',
        'category',
        'subCategory',
        'transactionDate',
        'description',
    ];

    const updateData = {};

    for (const field of allowedFields) {
        if (
            Object.prototype.hasOwnProperty.call(updates, field) &&
            updates[field] !== undefined
        ) {
            updateData[field] = updates[field];
        }
    }

    if (Object.keys(updateData).length === 0) {
        return {
            valid: false,
            error: 'NO_FIELDS_TO_UPDATE',
            message: 'No fields provided for update',
        };
    }

    if (updateData.amount !== undefined) {
        const amountValidation = validateAmount(updateData.amount);

        if (!amountValidation.valid) {
            return amountValidation;
        }
    }

    if (updateData.category !== undefined) {
        const categoryValidation = validateCategory(updateData.category);

        if (!categoryValidation.valid) {
            return categoryValidation;
        }

        updateData.category = categoryValidation.data;
    }

    if (updateData.subCategory !== undefined) {
        const subCategoryValidation = validateSubCategory(updateData.subCategory);

        if (!subCategoryValidation.valid) {
            return subCategoryValidation;
        }

        updateData.subCategory = subCategoryValidation.data;
    }

    if (updateData.transactionDate !== undefined) {
        const dateValidation = validateTransactionDate(updateData.transactionDate);

        if (!dateValidation.valid) {
            return dateValidation;
        }

        updateData.transactionDate = dateValidation.data;
    }

    if (updateData.description !== undefined) {
        const descriptionValidation = validateDescription(updateData.description);

        if (!descriptionValidation.valid) {
            return descriptionValidation;
        }

        updateData.description = descriptionValidation.data;
    }

    return {
        valid: true,
        data: updateData,
    };
};

export {
    validateTransactionCreateInput,
    validateTransactionUpdateInput,
};
