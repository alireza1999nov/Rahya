const users = [];

const userRepository = {
    create(user) {
        users.push(user);
        return user;
    }
};

export default userRepository;
