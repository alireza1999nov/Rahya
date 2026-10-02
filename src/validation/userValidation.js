const validateUserInput = ({name}) => {
    if (typeof name !== 'string') {
        return { valid: false, message: 'Name must be a string' };
    }

    const trimmedName = name.trim();
    if (trimmedName === "") {
        return { valid: false, message: 'Name is required' };
    }

    return { valid: true, data: { name: trimmedName } };
}

export default validateUserInput;
