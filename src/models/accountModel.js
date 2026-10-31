import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

const accountSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => randomUUID()
        },

        userId: {
            type: String,
            required: true
        },

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        type: {
            type: String,
            enum: ['cash', 'bank'],
            required: true
        },

        openingBalance: {
            type: Number,
            required: true,
            min: 0,
            validate: {
                validator(value) {
                    return Math.round(value * 10) === value * 10;
                },
                message: 'Opening balance must have at most one decimal place'
            }
        },

        financialRevision: {
            type: Number,
            default: 0,
            min: 0,
            validate: {
                validator(value) {
                    return Number.isSafeInteger(value);
                },
                message: 'Financial revision must be a non-negative integer'
            }
        },

        currency: {
            type: String,
            required: true,
            default: 'Toman'
        },

        description: {
            type: String,
            maxlength: 400
        },

        isDefault: {
            type: Boolean,
            default: false
        },

        isArchived: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

accountSchema.index(
    { userId: 1, name: 1 },
    { unique: true }
);

const Account = mongoose.model('Account', accountSchema);

export default Account;
