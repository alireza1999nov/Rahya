import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

const transactionSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => randomUUID(),
        },

        type: {
            type: String,
            enum: ['income', 'expense', 'transfer'],
            required: true,
        },

        accountId: {
            type: String,
            required: function () {
                return this.type === 'income' || this.type === 'expense';
            },
        },

        sourceAccountId: {
            type: String,
            required: function () {
                return this.type === 'transfer';
            },
        },

        destinationAccountId: {
            type: String,
            required: function () {
                return this.type === 'transfer';
            },
            validate: {
                validator(value) {
                    if (this.type !== 'transfer' || value == null) {
                        return true;
                    }

                    return value !== this.sourceAccountId;
                },
                message: 'Source and destination accounts must differ',
            },
        },

        amount: {
            type: Number,
            required: true,
            validate: {
                validator(value) {
                    return (
                        Number.isFinite(value) &&
                        value > 0 &&
                        Math.round(value * 10) === value * 10
                    );
                },
                message:
                    'Transaction amount must be positive and have at most one decimal place',
            },
        },

        category: {
            type: String,
            required: function () {
                return this.type === 'income' || this.type === 'expense';
            },
            trim: true,
            validate: {
                validator(value) {
                    return typeof value === 'string' && value.length > 0;
                },
                message: 'Transaction category cannot be empty',
            },
        },

        subCategory: {
            type: String,
            trim: true,
        },

        transactionDate: {
            type: String,
            required: true,
            match: [
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+03:30$/,
                'Transaction date must use YYYY-MM-DDTHH:mm:ss+03:30 format',
            ],
        },

        description: {
            type: String,
            trim: true,
            maxlength: 400,
        },

        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
