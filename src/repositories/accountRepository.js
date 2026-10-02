const accounts = [];

const accountRepository = {
    create(account){
        accounts.push(account);
        return account;
    },

    findByUserId(userId) {
        return accounts.filter(account => account.userId === userId);
    },

    findByUserIdAndName(userId, name) {
        return accounts.find(account => account.userId === userId && account.name === name) ?? null;
    }
};

export default accountRepository;
