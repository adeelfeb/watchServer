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


// import mongoose from "mongoose";
// import { DB_NAME } from "../constants.js";

// const connectDB = async () => {
//     const dockerURI = "mongodb://admin:password@localhost:27017/";
//     const atlasURI = process.env.MONGODB_URI;

//     try {
//         console.log("🔄 Attempting to connect to MongoDB (Docker)...");
//         const dockerConnection = await mongoose.connect(dockerURI, {
//             dbName: DB_NAME,
//             authSource: "admin", // Required for authentication
//             serverSelectionTimeoutMS: 5000, // Timeout for faster failover
//         });
//         console.log(`✅ Connected to MongoDB Docker at ${dockerConnection.connection.host}`);
//     } catch (dockerError) {
//         console.warn("⚠️ Failed to connect to MongoDB Docker, trying MongoDB Atlas...");

//         try {
//             const atlasConnection = await mongoose.connect(atlasURI, {
//                 dbName: DB_NAME,
//                 serverSelectionTimeoutMS: 5000,
//             });
//             console.log(`✅ Connected to MongoDB Atlas at ${atlasConnection.connection.host}`);
//         } catch (atlasError) {
//             console.error("❌ Both MongoDB Docker and Atlas connections failed.", atlasError);
//             process.exit(1);
//         }
//     }
// };

// export default connectDB;




// import mongoose from "mongoose";
// import { DB_NAME } from "../constants.js";

// const connectDB = async () => {
//     try {
//         const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
//             dbName: DB_NAME, 
//             serverSelectionTimeoutMS: 5000, // Optional timeout adjustment
//         });
//         console.log(`✅ MongoDB connected at HOST: ${connectionInstance.connection.host}`);
//     } catch (error) {
//         console.error("❌ MONGODB connection FAILED ", error);
//         process.exit(1);
//     }
// };

// export default connectDB;
