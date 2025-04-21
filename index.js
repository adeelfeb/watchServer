import dotenv from "dotenv";
import connectDB from "./src/db/index.js";
import { app } from './src/app.js';
import ngrok from "ngrok"; // Import ngrok
import conf from "./src/conf.js";

dotenv.config({
    path: './.env'
});

// Function to start the server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();
        // console.log("⚙️ MongoDB connected successfully!");

        // Start the server
        const port = process.env.PORT || 8000;
        const server = app.listen(port, () => {
            console.log(`⚙️ Server is running on port: ${port} `);
        });

        // Start ngrok only in development mode
        if (process.env.NODE_ENV === "development") {
            try {
                const ngrokUrl = await ngrok.connect({
                    authtoken: process.env.NGROK_AUTH, // Use the token from .env
                    addr: port, // The port your app is running on
                });
                conf.ngrokUrl = ngrokUrl;
                console.log(`🌐 Ngrok URL stored in conf: ${conf.ngrokUrl}`);

                // Update the callback URL dynamically in your config
                conf.googleAuth.callbackUrl = `${ngrokUrl}/auth/google/callback`; // Use ngrok URL for callback
            } catch (ngrokError) {
                console.error("❌ Error starting ngrok:", ngrokError.message);
            }
        } else {
            console.log("🚀 Running in production mode. Ngrok is not required.");
        }

    } catch (error) {
        console.error("❌ Error starting the server:", error.message);
        process.exit(1);
    }
};

// Start the server
startServer();