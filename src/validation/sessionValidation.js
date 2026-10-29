const validateSessionCredentials = ({ email, password } = {}) => {
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
            email: normalizedEmail,
            password,
        },
    };
};

export default validateSessionCredentials;
