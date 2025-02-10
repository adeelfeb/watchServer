// import mongoose from "mongoose";
// import { DB_NAME } from "../constants.js";


// const connectDB = async () => {
//     try {
//         const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
  
//         // console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
//     } catch (error) {
//         console.log("MONGODB connection FAILED ", error);
//         process.exit(1)
//     }
// }

// export default connectDB                 



// import mongoose from "mongoose";
// import { DB_NAME } from "../constants.js";

// const connectDB = async () => {
//     try {
//         const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
//             dbName: DB_NAME,
//             useNewUrlParser: true,
//             useUnifiedTopology: true,
//             serverSelectionTimeoutMS: 5000, // Optional timeout adjustment
//         });
//         console.log(`MongoDB connected at HOST: ${connectionInstance.connection.host}`);
//     } catch (error) {
//         console.log("MONGODB connection FAILED ", error);
//         process.exit(1);
//     }
// };

// export default connectDB;




import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
            dbName: DB_NAME, 
            serverSelectionTimeoutMS: 5000, // Optional timeout adjustment
        });
        console.log(`✅ MongoDB connected at HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.error("❌ MONGODB connection FAILED ", error);
        process.exit(1);
    }
};

export default connectDB;
