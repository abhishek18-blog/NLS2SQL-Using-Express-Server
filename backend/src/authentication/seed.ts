import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "./userModel";
import dotenv from "dotenv";

// load .env values so we can read MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD

dotenv.config();

async function seed() {
    // 1. connect to mongoDB
    await mongoose.connect(process.env.MONGO_URI!);

    console.log(
        "Connected to MongoDB"
    );
    // 2. Hash the plain-text password from .env
    // '10' is how many rounds of scrambling it does
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10);

    // 3. Insert the admin user (or update if exists)
    await User.findOneAndUpdate(
        {
            email: process.env.ADMIN_EMAIL
        },  // Search criteria
        {
            email: process.env.ADMIN_EMAIL,
            passwordHash: hashedPassword,
            role: "admin"
        },
        {
            upsert: true, // Create if not exists
            new: true,    // Return the updated/created document
        }
    );
    console.log(`ADMIN USER SEEDED:
               ${process.env.ADMIN_EMAIL}
         `);

    // 4. Disconnect cleanly
    await mongoose.disconnect();
    console.log("done you can now delete seed.ts")

}

// execute seed function
seed().catch(console.error);