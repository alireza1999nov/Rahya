import mongoose from 'mongoose';

const connectDatabase = async () => {
    const databaseUri = process.env.MONGODB_URI;

    if (!databaseUri) {
        throw new Error(
            "MONGODB_URI environment variable is required"
        );
    }

    await mongoose.connect(databaseUri);
    console.log("MongoDB connected successfully")
}

export default connectDatabase;
