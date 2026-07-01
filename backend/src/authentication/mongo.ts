import mongoose from "mongoose";

export async function connectMongo() {
    //first check if already connected ready set one means connected
    if (mongoose.connection.readyState === 1)
        return;

    await mongoose.connect(process.env.MONGO_URI!);
    console.log("Mongo Db connected")

}