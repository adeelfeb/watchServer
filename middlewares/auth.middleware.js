// import { ApiError } from "../utils/ApiError.js";
// import jwt from "jsonwebtoken";
// import { User } from "../models/user.model.js";

// const verifyTokenAsync = (token, secret) => {
//     return new Promise((resolve, reject) => {
//         jwt.verify(token, secret, (err, decoded) => {
//             if (err) reject(err);
//             else resolve(decoded);
//         });
//     });
// };

// export const verifyJWT = async (req, res, next) => {
//     try {
//         const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

//         if (!token) {
//             return res.status(401).json({ message: "Token not provided" });
//         }

//         const decodedToken = await verifyTokenAsync(token, process.env.ACCESS_TOKEN_SECRET);
//         const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

//         if (!user) {
//             return res.status(401).json({ message: "Invalid token" });
//         }

//         req.user = user;
//         next();
//     } catch (error) {
//         if (error.name === "TokenExpiredError") {
//             return res.status(401).json({ message: "Token expired" });
//         }
//         next(new ApiError(500, "Internal Server Error"));
//     }
// };


import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

// Verify JWT token and fetch user data
export const verifyJWT = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json({ message: "Token not provided" });
        }

        const decodedToken = await verifyTokenAsync(token, process.env.ACCESS_TOKEN_SECRET);

        // Fetch user from database
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
        if (!user) {
            return res.status(401).json({ message: "Invalid token" });
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        console.error("Error in verifyJWT:", error);
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token expired" });
        }
        next(new ApiError(500, "Internal Server Error"));
    }
};

// Asynchronous token verification
const verifyTokenAsync = (token, secret) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, (err, decoded) => {
            if (err) reject(err);
            else resolve(decoded);
        });
    });
};



// // export const verifyJWT = async (req, res, next) => {
// //     try {
// //         const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

// //         if (!token) {
// //             return res.status(401).json({ message: "Token not provided" });
// //         }

// //         let decodedToken;
// //         try {
// //             decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
// //         } catch (error) {
// //             // If JWT is expired, return a response without logging
// //             if (error.name === "TokenExpiredError") {
// //                 return res.status(401).json({ message: "Token expired" });
// //             }
// //             return res.status(401).json({ message: "Invalid token" });
// //         }

// //         // Find user in the database
// //         const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

// //         if (!user) {
// //             return res.status(401).json({ message: "Invalid token" });
// //         }

// //         // Attach user to request object
// //         req.user = user;

// //         next(); // Proceed to the next middleware
// //     } catch (error) {
// //         next(new ApiError(500, "Internal Server Error"));
// //     }
// // };



