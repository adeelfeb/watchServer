// scripts/updateUserIsActive.js
import mongoose from 'mongoose';
import {User} from '../models/user.model.js'
import { DB_NAME } from '../src/constants.js';


const runUpdate = async () => {
    let connectionSuccessful = false;
    let connectedHost = null;

    // --- Database Connection Attempt (Atlas ONLY) ---
    console.log('🚀 Starting MongoDB Atlas connection process...');
    const atlasURI = "";

    // --- Validate required configuration ---
    if (!atlasURI) {
        console.error("❌ MONGODB_URI (for Atlas) is not defined. Cannot proceed.");
        process.exit(1); // Exit if Atlas URI is missing
    }
    if (!DB_NAME) {
        console.error("❌ DB_NAME constant is not defined or imported correctly. Cannot proceed.");
        process.exit(1); // Exit if DB_NAME is missing
    }

    try {
        // --- Connect to Atlas ---
        console.log("🔄 Attempting to connect to MongoDB Atlas...");
        const connectionInstance = await mongoose.connect(atlasURI, {
            dbName: DB_NAME,
            serverSelectionTimeoutMS: 5000, // Optional: Keep timeout
            // Mongoose 6+ handles useNewUrlParser, etc. automatically
        });
        connectedHost = connectionInstance.connection.host;
        console.log(`✅ Connected successfully to MongoDB Atlas at ${connectedHost}`);
        connectionSuccessful = true; // Mark connection as successful

        // --- Perform Update ---
        // This part now runs directly after successful connection
        console.log(`\n🚀 Proceeding with update on connected host: ${connectedHost}`);
        console.log('Updating existing users without isActive field...');

        const result = await User.updateMany(
            { isActive: { $exists: false } }, // Target users missing the field
            { $set: { isActive: true } }     // Set the field to true
        );

        console.log('✅ Update operation complete.');
        console.log(`   Matched: ${result.matchedCount} users.`);
        console.log(`   Modified: ${result.modifiedCount} users.`);
        if (result.matchedCount === 0) {
            console.log("   (It seems all users already had the 'isActive' field.)");
        } else if (result.modifiedCount < result.matchedCount) {
             console.warn("   Warning: Not all matched users were modified. This might indicate an issue.");
        }

    } catch (error) {
        // Catch errors from the connection attempt or the updateMany itself
        console.error('\n❌ An error occurred during the script execution:');
        // Provide more context if it's a connection error vs. an update error
        if (!connectionSuccessful) {
            console.error('   Failed during database connection phase.');
        } else {
            console.error('   Failed during the database update phase.');
        }
        console.error('   Error details:', error.message);
        process.exit(1); // Exit with failure code

    } finally {
        // --- Ensure disconnection ---
        // Check if mongoose thinks it's connected (readyState 1)
        if (mongoose.connection.readyState === 1) {
            console.log('\n🔌 Disconnecting from MongoDB...');
            await mongoose.disconnect();
            console.log('Database disconnected.');
        } else if (mongoose.connection.readyState !== 0) { // 0 = disconnected
             // Attempt disconnect if in any other state (connecting, disconnecting) just in case
             console.log('\n🔌 Attempting disconnect from non-connected state...');
             await mongoose.disconnect().catch(e => console.warn("Ignoring error during forced disconnect:", e.message));
             console.log('Database disconnected (forced).');
        }
         else {
            console.log('\nℹ️ No active MongoDB connection to disconnect.');
        }
    }
};

// --- Execute the script ---
runUpdate();