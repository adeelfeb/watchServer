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
    
    config.corsOrigin
];


// app.use(cors({
//     origin: '*', // Temporary: Allow all origins
//     credentials: false,
// }));


// Middleware to enable Cross-Origin Resource Sharing (CORS)
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps or curl requests)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true, // Allow cookies if needed
    allowedHeaders: ['X-Requested-With', 'Content-Type', 'Authorization'],
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
        httpOnly: true,
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
app.use('/api/v1/auth', authRouter); // Mount the auth routes under '/api/v1/auth'

// Default route
app.get("/", (req, res) => {
    res.send("Welcome to the API Server! Use /api/v1 for accessing routes.");
});

// Import routes
import userRouter from "../router/user.routes.js";
import videoRouter from "../router/video.routes.js";

// Declare routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/videos", videoRouter);

// Export the app
export { app };
