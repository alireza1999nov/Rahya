import {randomUUID} from 'node:crypto';
import validateUserInput from '../validation/userValidation.js';

const createUser = ({name}, userRepository) => {
    const validation = validateUserInput({ name });

    if (!validation.valid) {
        return validation;
    }

    const now = new Date();

    const user = {
        id: randomUUID(),
        name: validation.data.name,
        createdAt: now,
        updatedAt: now
    };
    return {valid: true, data: userRepository.create(user)};
};

export default createUser;
