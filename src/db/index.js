import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    const atlasURI = process.env.MONGODB_URI; // it will be like this MONGODB_URI=mongodb+srv://user:temp@cluster1.5zf3c.mongodb.net in the .env file
    const local_MongoDB_URL = "mongodb://127.0.0.1:27017/";

    try {
        // console.log("🔄 Attempting to connect to MongoDB Atlas...");
        const connectionInstance = await mongoose.connect(atlasURI, {
            dbName: DB_NAME,
            serverSelectionTimeoutMS: 5000, // 5 seconds timeout
        });
        console.log(`✅ Connected to MongoDB Atlas at ${connectionInstance.connection.host}`);
    } catch (atlasError) {
        console.warn("⚠️ Failed to connect to MongoDB Atlas, trying local connection...");

        // Close previous failed connection before retrying
        await mongoose.disconnect();

        try {
            const localConnection = await mongoose.connect(local_MongoDB_URL, {
                dbName: DB_NAME,
                serverSelectionTimeoutMS: 5000,
            });
            console.log(`✅ Connected to MongoDB local at ${localConnection.connection.host}`);
        } catch (LocalError) {
            console.error("❌ Both MongoDB Atlas and local connection failed: ", LocalError);
            process.exit(1);
        }
    }
};

export default connectDB;

