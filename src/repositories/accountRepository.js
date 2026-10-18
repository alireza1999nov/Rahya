import Account from '../models/accountModel.js';

const accountRepository = {
    async create(account) {
        return Account.create({
            _id: account.id,
            userId: account.userId,
            name: account.name,
            type: account.type,
            openingBalance: account.openingBalance,
            currency: account.currency,
            ...(account.description !== undefined && {
                description: account.description
            }),
            isDefault: account.isDefault,
            isArchived: account.isArchived
        });
    },

    async findByUserId(userId) {
        return Account.find({ userId }).lean();
    },

    async findByUserIdAndName(userId, name) {
        return Account.findOne({ userId, name }).lean();
    },

    async findById(accountId) {
        return Account.findById(accountId).lean();
    }
};

export default accountRepository;
