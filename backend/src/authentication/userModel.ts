import mongoose from "mongoose";

//Typescript interface defines the shape of a user document
export interface IUser {
    email: string;
    passwordHash: string;
    role: 'admin' | 'user';
    createdAt: Date;
}
// mongoose schema - maps the interface to actual mongoDB fileds
const userSchema = new mongoose.Schema<IUser>({
    email: {
        type: String,
        required: true,
        unique: true
    },

    passwordHash: {
        type: String,
        required: true
    },

    role: {
        type: String,
        enum: ["admin", "user"],
        default: "user"
    },

    createdAt: {
        type: Date,
        default: Date.now
    },
});

// This creates the "users" collection in MongoDB
// Mongoose auto-pluralizes + lowercases: "User" → "users"

export const User = mongoose.model<IUser>(
    "User", userSchema
);