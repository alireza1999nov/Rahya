import User from "../models/userModel.js";

const userRepository = {
    async create(userData) {
        const user = await User.create(userData);
        return user;
    },

    async findById(userId) {
        return User.findById(userId);
    }
};

export default userRepository;
