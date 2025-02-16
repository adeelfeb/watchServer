// import { ApiError } from "../utils/ApiError.js";
// import jwt from "jsonwebtoken";
// import { User } from "../models/user.model.js";

// export const verifyJWT = async (req, res, next) => {
//     try {
//         const userdata = req.header("Authorization")?.replace("Bearer ", "");
//         // console.log("The user is here: ",userdata)
        

//         const token =
//             req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

//         if (!token) {
//             throw new ApiError(401, "Token not provided");
//         }

//         // Verify the token
//         const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

//         // Find user in the database
//         const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

//         if (!user) {
//             throw new ApiError(401, "Invalid token");
//         }

//         // Attach user to request object
//         req.user = user;

//         next(); // Proceed to the next middleware
//     } catch (error) {
//         // Pass the error to the error handling middleware
//         next(new ApiError(401, error.message || "Invalid Access Token"));
//     }
// };


import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json({ message: "Token not provided" });
        }

        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        } catch (error) {
            // If JWT is expired, return a response without logging
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({ message: "Token expired" });
            }
            return res.status(401).json({ message: "Invalid token" });
        }

        // Find user in the database
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            return res.status(401).json({ message: "Invalid token" });
        }

        // Attach user to request object
        req.user = user;

        next(); // Proceed to the next middleware
    } catch (error) {
        next(new ApiError(500, "Internal Server Error"));
    }
};
