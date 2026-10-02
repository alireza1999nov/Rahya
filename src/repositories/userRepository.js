const users = [];

const userRepository = {
    create(user) {
        users.push(user);
        return user;
    },
    findById(userId) {
        return users.find(user => user.id === userId) ?? null;
    }
};

export default userRepository;
