const validateAccountInput = ({name, type, openingBalance, description}) => {

    if (typeof name !== 'string') {
        return {
            valid: false,
            message: 'Account name must be a string'
        };
    };

    const trimmedName = name.trim();

    if (trimmedName === "") {
        return {
            valid: false,
            message: 'Account name is required'
        };
    }

    if (trimmedName.length > 100) {
        return {
            valid: false,
            message: 'Account name must be at most 100 characters'
        };
    };

    if (typeof type !== 'string') {
        return {
            valid: false,
            message: 'Account type must be a string'
        };
    };

    const normalizedType = type.trim().toLowerCase();
    if (!['cash', 'bank'].includes(normalizedType)) {
        return {
            valid: false,
            message: 'Account type must be "cash" or "bank"'
        };
    };

    if (!Number.isFinite(openingBalance)) {
        return {
            valid: false,
            message: 'Opening balance must be a number'
        };
    };

    if (openingBalance < 0) {
        return {
            valid: false,
            message: 'Opening balance must be a non-negative number'
        };
    };

    if (Math.round(openingBalance * 10) !== openingBalance * 10) {
        return {
            valid: false,
            message: 'Opening balance must be a number with at most one decimal place'
        };
    };

    if (description !== undefined && typeof description !== 'string') {
        return {
            valid: false,
            message: 'Description must be a string'
        };
    };

    if (description !== undefined && description.length > 400) {
        return {
            valid: false,
            message: 'Description must be at most 400 characters'
        };
    };

    return {
        valid: true,
        data: {
            name: trimmedName,
            type: normalizedType,
            openingBalance,
            ...(description !== undefined && { description })
        }
    };
}

export default validateAccountInput;
