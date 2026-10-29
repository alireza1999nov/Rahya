import argon2 from 'argon2';
import validateUserInput from '../validation/userValidation.js';

const createUser = async (input, userRepository) => {
    const validation = validateUserInput(input);

    if (!validation.valid) {
        return validation;
    }

    const passwordHash = await argon2.hash(validation.data.password, {
        type: argon2.argon2id
    });

    const createdUser = await userRepository.create({
        name: validation.data.name,
        email: validation.data.email,
        passwordHash,
        emailVerifiedAt: null,
        status: 'active'
    });

    return {
        valid: true,
        data: {
            id: createdUser.id ?? createdUser._id,
            name: createdUser.name,
            email: createdUser.email,
            emailVerifiedAt: createdUser.emailVerifiedAt,
            status: createdUser.status,
            createdAt: createdUser.createdAt,
            updatedAt: createdUser.updatedAt
        }
    };
};

export default createUser;
