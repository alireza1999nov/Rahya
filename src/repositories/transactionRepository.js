import mongoose from 'mongoose';
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
    async withTransaction(operation) {
        const session = await mongoose.startSession();

        try {
            return await session.withTransaction(() => operation(session));
        } finally {
            await session.endSession();
        }
    },

    async create(transaction, session) {
        const { id, _id, ...transactionData } = transaction;

        const [createdTransaction] = await Transaction.create(
            [{
                ...transactionData,
                ...(id !== undefined ? { _id: id } : {}),
            }],
            session ? { session } : {},
        );

        return toTransaction(createdTransaction);
    },

    async findByRelatedAccountId(accountId, session) {
        const query = Transaction.find({
            $or: [
                { accountId },
                { sourceAccountId: accountId },
                { destinationAccountId: accountId },
            ],
            deletedAt: null,
        });

        if (session) {
            query.session(session);
        }

        const transactions = await query.lean();

        return transactions.map(toTransaction);
    },

    async findById(transactionId, session) {
        const query = Transaction.findOne({
            _id: transactionId,
            deletedAt: null,
        });

        if (session) {
            query.session(session);
        }

        const transaction = await query.lean();

        return toTransaction(transaction);
    },

    async update(transactionId, updates, session) {
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
                session,
            },
        ).lean();

        return toTransaction(updatedTransaction);
    },

    async delete(transactionId, session) {
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
                session,
            },
        ).lean();

        return toTransaction(deletedTransaction);
    },
};

export default transactionRepository;
