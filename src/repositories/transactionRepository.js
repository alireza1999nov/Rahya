import Transaction from '../models/transactionModel.js';

const toTransaction = (document) => {
    if (!document) {
        return null;
    }

    const transaction =
        typeof document.toObject === 'function'
            ? document.toObject()
            : document;

    const { _id, id: existingId, ...data } = transaction;

    return {
        ...data,
        id: _id ?? existingId,
    };
};

const transactionRepository = {
    async create(transaction) {
        const { id, _id, ...transactionData } = transaction;

        const createdTransaction = await Transaction.create({
            ...transactionData,
            ...(id !== undefined ? { _id: id } : {}),
        });

        return toTransaction(createdTransaction);
    },

    async findByRelatedAccountId(accountId) {
        const transactions = await Transaction.find({
            $or: [
                { accountId },
                { sourceAccountId: accountId },
                { destinationAccountId: accountId },
            ],
            deletedAt: null,
        }).lean();

        return transactions.map(toTransaction);
    },

    async findById(transactionId) {
        const transaction = await Transaction.findOne({
            _id: transactionId,
            deletedAt: null,
        }).lean();

        return toTransaction(transaction);
    },

    async update(transactionId, updates) {
        const updatedTransaction = await Transaction.findOneAndUpdate(
            {
                _id: transactionId,
                deletedAt: null,
            },
            {
                $set: updates,
            },
            {
                returnDocument: 'after',
                runValidators: true,
            },
        ).lean();

        return toTransaction(updatedTransaction);
    },

    async delete(transactionId) {
        const deletedTransaction = await Transaction.findOneAndUpdate(
            {
                _id: transactionId,
                deletedAt: null,
            },
            {
                $set: {
                    deletedAt: new Date(),
                },
            },
            {
                returnDocument: 'after',
            },
        ).lean();

        return toTransaction(deletedTransaction);
    },
};

export default transactionRepository;
