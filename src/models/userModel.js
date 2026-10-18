import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const userSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => randomUUID()
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            trim: true,
            lowercase:true,
            unique: true
        },

        passwordHash: {
            type: String,
            required: true,
            select: false
        },

        emailVerifiedAt: {
            type: Date,
            default: null
        },

        status: {
            type: String,
            enum: ['pendingVerification', 'active', 'deactivated'],
            default: 'pendingVerification',
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

const User = mongoose.model('User', userSchema);

export default User;
