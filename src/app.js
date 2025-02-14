// Import required modules
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session'; 
import passport from './passport.js'; // Import Passport
import config from './conf.js'; // Import config.js for env variables
import authRouter from "../router/auth.routes.js"; // Import auth routes

// Create an instance of an Express app
const app = express();

// Middleware to enable Cross-Origin Resource Sharing (CORS)
const allowedOrigins = [
    "http://localhost:5000",
    "http://localhost:3000",
    "http://localhost:5001",
    "http://localhost:5173",
    "https://project-mern-deploy-plum.vercel.app",
    "https://project-mern-deploy-plum.vercel.app",
    "https://project-mern-deploy-plum.vercel.app/login",
    "https://project-mern-deploy-plum.vercel.app/",
    config.corsOrigin,
    config.externalEndpoints,
    process.env.EXTERNAL_VIDEO_ENDPOINT
];


app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
}));


// Handle preflight requests for all routes
app.options("*", (req, res) => {
    res.header("Access-Control-Allow-Origin", req.header("Origin"));
    res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    res.sendStatus(204);
});


// Middleware to parse incoming JSON payloads
app.use(express.json({
    limit: "10mb", // Increase payload limit
}));

// Middleware to parse URL-encoded data
app.use(express.urlencoded({
    extended: true,
    limit: "10mb", // Increase payload limit
}));

// Middleware to serve static files
app.use(express.static("public"));

// Middleware to parse cookies
app.use(cookieParser());

// Session middleware
app.use(session({
    secret: config.sessionSecret, 
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', 
        httpOnly: false,
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
app.use('/api/v1/auth', authRouter); // Mount the auth routes under '/api/v1/auth'

// Default route
app.get("/", (req, res) => {
    res.send(`working`);
});

app.get("/info", (req, res) => {
    const nodeEnv = process.env.NODE_ENV || 'development'; // Default to 'development' if NODE_ENV is not set
    const corsOrigin = allowedOrigins.join(', '); // Convert array to a comma-separated string

    // HTML response with basic technical info
    const htmlResponse = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Server Information</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    padding: 0;
                    background-color: #f4f4f9;
                    color: #333;
                }
                h1 {
                    color: #444;
                }
                .info-container {
                    background: #fff;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    max-width: 600px;
                    margin: 0 auto;
                }
                .info-item {
                    margin-bottom: 15px;
                }
                .info-item strong {
                    display: inline-block;
                    width: 150px;
                    color: #555;
                }
            </style>
        </head>
        <body>
            <div class="info-container">
                <h1>Server Information</h1>
                <div class="info-item">
                    <strong>Node Environment:</strong> ${nodeEnv}
                </div>
                <div class="info-item">
                    <strong>Node Environment:</strong> ${process.env.RENDER_EXTERNAL_URL}
                </div>
                <div class="info-item">
                    <strong>Allowed Origins:</strong> ${corsOrigin}
                </div>
                <div class="info-item">
                    <strong>Technical Info:</strong>
                    <ul>
                        <li>Always validate user input to prevent security vulnerabilities.</li>
                        <li>Use environment variables for sensitive data like API keys.</li>
                        <li>Ensure proper error handling to avoid crashing the server.</li>
                        <li>Use CORS to restrict access to trusted domains.</li>
                        <li>Keep dependencies updated to avoid security risks.</li>
                    </ul>
                </div>
            </div>
        </body>
        </html>
    `;

    res.send(htmlResponse);
});


// Create a new route to allow dynamic CORS origins
app.post("/api/v1/allow-origin", (req, res) => {
    const { url } = req.body;

    // Validate if URL is provided
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    // Check if the URL is already in the allowedOrigins array
    if (allowedOrigins.includes(url)) {
        return res.status(200).json({ message: "URL is already allowed", allowedOrigins });
    }

    // Add the new URL to the allowedOrigins array
    allowedOrigins.push(url);
    
    // Update the environment variable dynamically
    process.env.EXTERNAL_VIDEO_ENDPOINT = url;
    config.externalEndpoints.url1 = `${process.env.EXTERNAL_VIDEO_ENDPOINT}/translate`;

    res.status(201).json({
        message: "URL added successfully!",
        allowedOrigins,
        newExternalEndpoint: config.externalEndpoints.url1
    });
});



// Import routes
import userRouter from "../router/user.routes.js";
import videoRouter from "../router/video.routes.js";

// Declare routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/videos", videoRouter);

// Export the app
export { app };
