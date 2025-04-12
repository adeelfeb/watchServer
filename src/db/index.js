import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    const atlasURI = process.env.MONGODB_URI;
    const dockerURI = "mongodb://admin:password@localhost:27017/";

    try {
        // console.log("🔄 Attempting to connect to MongoDB Atlas...");
        const connectionInstance = await mongoose.connect(atlasURI, {
            dbName: DB_NAME,
            serverSelectionTimeoutMS: 5000, // 5 seconds timeout
        });
        console.log(`✅ Connected to MongoDB Atlas at ${connectionInstance.connection.host}`);
    } catch (atlasError) {
        console.warn("⚠️ Failed to connect to MongoDB Atlas, trying Docker container...");

        // Close previous failed connection before retrying
        await mongoose.disconnect();

        try {
            const dockerConnection = await mongoose.connect(dockerURI, {
                dbName: DB_NAME,
                user: "admin",
                pass: "password",
                serverSelectionTimeoutMS: 5000,
            });
            console.log(`✅ Connected to MongoDB Docker at ${dockerConnection.connection.host}`);
        } catch (dockerError) {
            console.error("❌ Both MongoDB Atlas and Docker container connection failed", dockerError);
            process.exit(1);
        }
    }
};

export default connectDB;

