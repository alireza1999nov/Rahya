const validateUserInput = ({ name, email, password } = {}) => {
    if (typeof name !== 'string') {
        return { valid: false, message: 'Name must be a string' };
    }

    const trimmedName = name.trim();
    if (trimmedName === '') {
        return { valid: false, message: 'Name is required' };
    }

    if (typeof email !== 'string') {
        return { valid: false, message: 'Email must be a string' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === '') {
        return { valid: false, message: 'Email is required' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return { valid: false, message: 'Email is invalid' };
    }

    if (typeof password !== 'string') {
        return { valid: false, message: 'Password must be a string' };
    }

    if (password.length === 0) {
        return { valid: false, message: 'Password is required' };
    }

    return {
        valid: true,
        data: {
            name: trimmedName,
            email: normalizedEmail,
            password
        }
    };
};

export default validateUserInput;
