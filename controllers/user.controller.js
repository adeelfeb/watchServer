import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import { Video } from "../models/video.model.js"; // Import Video model
import axios from "axios"; // For external API requests
import config from "../src/conf.js";
// import admin from "firebase-admin";
import {admin} from '../utils/firebase.js'

import crypto from 'crypto';                    // Built-in Node.js module for crypto
import nodemailer from 'nodemailer';      





const registerUser = asyncHandler(async (req, res) => {
    const { fullname, email, password, username, firebaseUid } = req.body;

    // Validate required fields
    if (!fullname || !email || !username) {
        return res.status(400).json(new ApiResponse(400, null, "Full name, email, and username are required"));
    }
    
    
    const normalizedUsername = username.toLowerCase();
    const normalizedEmail = email.toLowerCase(); // Good practice for email too

    // console.log(`Checking DB for: username='${normalizedUsername}', email='${normalizedEmail}'`);
    // ---

    const [userByUsername, userByEmail] = await Promise.all([
        User.findOne({ username: normalizedUsername }).lean(),
        User.findOne({ email: normalizedEmail }).lean()
    ]);

    
    

    let conflictMessage = null;

    // ... (rest of the conflict checking logic remains the same) ...

    if (userByUsername && userByEmail) {
        if (userByUsername._id.toString() === userByEmail._id.toString()) {
            // This block is correctly triggered if inputs are 'undefined' and the DB has that user
            conflictMessage = "Username and Email are already registered to the same account.";
        } else {
            conflictMessage = "Username is already taken, and the Email is already registered.";
        }
    } else if (userByUsername) {
        conflictMessage = "Username is already taken.";
    } else if (userByEmail) {
        conflictMessage = "Email is already registered.";
    }


    if (conflictMessage) {
        return res.status(409).json(new ApiResponse(409, null, conflictMessage));
    }

    // --- 5. No Conflicts - Proceed with User Creation ---
    // console.log("Username and Email are available. Proceeding with registration...");

    // Handle avatar and cover image upload
    const avatarLocalPath = req.files?.avatar?.[0]?.path || null;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path || null;

    let avatarUrl = "";
    if (avatarLocalPath) {
        const avatar = await uploadOnCloudinary(avatarLocalPath);
        if (!avatar) {
            return res.status(400).json(new ApiResponse(400, null, "Avatar upload failed. Try again."));
        }
        avatarUrl = avatar.url;
    }

    let coverImageUrl = "";
    if (coverImageLocalPath) {
        const coverImage = await uploadOnCloudinary(coverImageLocalPath);
        coverImageUrl = coverImage?.url || "";
    }

    // Create user
    const user = await User.create({
        fullname,
        avatar: avatarUrl || "https://res.cloudinary.com/dk06hi9th/image/upload/v1732198388/zgwzdyhy3nldkk2inxpl.jpg",
        coverImage: coverImageUrl || "https://res.cloudinary.com/dk06hi9th/image/upload/v1732198259/dbkm9wciwhs8njns81de.jpg",
        email,
        password: password || null,
        username: username.toLowerCase(),
        firebaseUid: firebaseUid || undefined, // Prevent storing `null`
        authProvider: firebaseUid ? "google" : "local",
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    // console.log("The created is :", createdUser)

    if (!createdUser) {
        return res.status(500).json(new ApiResponse(500, null, "Something went wrong while registering the user."));
    }

    // Generate tokens
    const temporaryToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    return res.status(201).json(new ApiResponse(201, { accessToken, refreshToken, temporaryToken, createdUser }, "User registered and logged in successfully"));
});




const generateAccessAndRefreshToken = async (userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}



    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Access and Refresh Token")
    }
}





const googleAuth = asyncHandler(async (req, res) => {
  // console.log("Inside Google Auth:", req.body);

  const { idToken } = req.body; // Get Firebase ID token from frontend

  if (!idToken) {
      throw new ApiError(400, "ID token is required");
  }

  try {
      // Verify Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      // console.log("the decodedToken:", decodedToken)
      const { uid, email, name, picture } = decodedToken;

      // Check if user already exists in MongoDB
      let user = await User.findOne({ email });

      if (!user) {
          // If user doesn't exist, create new user
          user = await User.create({
              firebaseUid: uid,
              email,
              username: name.replace(/\s+/g, "").toLowerCase(),
              fullname: name,
              avatar: picture,
              authProvider: "google",
          });
      }

      // Generate access and refresh tokens
      const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

      // Set authentication cookies
      const cookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: "none",
      };

      return res
          .status(200)
          .cookie("accessToken", accessToken, cookieOptions)
          .cookie("refreshToken", refreshToken, cookieOptions)
          .json(new ApiResponse(200, { accessToken, refreshToken, user }, "User authenticated successfully"));

  } catch (error) {
      console.error("Google authentication failed:", error);
      throw new ApiError(401, "Invalid or expired ID token");
  }
});




const loginUser = asyncHandler(async (req, res) => {
    const { email, password, username } = req.body;

    // 1. Validate Input
    if (!(username || email)) {
        throw new ApiError(400, "Username or email is required");
    }

    // 2. Find User
    const user = await User.findOne({
        $or: [{ username: username?.toLowerCase() }, { email: email?.toLowerCase() }]
    }).select("+password"); // Temporarily select password if needed for check

    if (!user) {
        throw new ApiError(404, "User not found with the provided credentials.");
    }

    // 3. Check if User is Active
    if (!user.isActive) {
        return res.status(403).json(
            new ApiResponse(403, null, "Your account has been deactivated. Please contact support.")
        );
    }

    // 4. Validate Password
    if (!user.password && user.authProvider !== 'local') {
         throw new ApiError(401, "Login with your social account or set a password first.");
    }
    if (!user.password) {
         throw new ApiError(401, "Password not set for this account.");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid username/email or password.");
    }

    
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    
    const userToSave = await User.findById(user._id); // Refetch without selecting password
    if (!userToSave) throw new ApiError(500, "Failed to retrieve user for saving refresh token.");
    userToSave.refreshToken = refreshToken;
    await userToSave.save({ validateBeforeSave: false }); // Avoid re-running validations if not needed

    
    const loggedInUserDetails = await User.findById(user._id).select("-password -refreshToken");
     if (!loggedInUserDetails) throw new ApiError(500, "Failed to retrieve user details for response.");


    const accessTokenOptions = {
        httpOnly: true, // Prevents client-side JS access
        secure: process.env.NODE_ENV === 'production', // **IMPORTANT**: Only set 'secure' in production (HTTPS)
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // 'None' for cross-origin (needs secure=true), 'Lax' for same-origin or top-level navigation
        maxAge: 1000 * 60 * 15 // 15 minutes (match access token expiry)
    };

    const refreshTokenOptions = {
        ...accessTokenOptions, // Inherit httpOnly, secure, sameSite
        maxAge: 1000 * 60 * 60 * 24 * 10 // 10 days (match refresh token expiry)
    };
    // 9. Send Success Response (Set Cookies and Send User Data)
    return res
        .status(200)
        .cookie("accessToken", accessToken, accessTokenOptions) // Set access token cookie
        .cookie("refreshToken", refreshToken, refreshTokenOptions) // Set refresh token cookie
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUserDetails,
                    // !! REMOVED accessToken from response body - rely on the cookie !!
                    // refreshToken was already correctly omitted from body
                },
                "User logged in successfully"
            )
        );
});


const getCurrentUser = asyncHandler(async (req, res) => {
    // console.log("Current user fetched:", req.user._id);
    return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});


const uploadVideo = asyncHandler(async (req, res) => {
    // Check if video file is present
    if (!req.file) {
      throw new ApiError(400, "Video file is required");
    }

    // console.log("inside the uplaod funciton")
  
    // Upload video to Cloudinary
    const videoLocalPath = req.file.path;
    const videoName = req.file.originalname;
    const video = await uploadOnCloudinary(videoLocalPath, "videos"); // Specify folder as "videos"
  
    if (!video) {
      throw new ApiError(500, "Video upload failed");
    }
  
    // Format duration from seconds to mm:ss
    const formatDuration = (durationInSeconds) => {
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = Math.floor(durationInSeconds % 60);
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };
  
    const formattedDuration = formatDuration(video.duration);
  
    // Create a new Video document in MongoDB
    const newVideo = new Video({
      videoUrl: video.url,
      duration: formattedDuration,
      title: videoName,
      requestSent: false, // Initially set to false
    });
  
    // Save the video to MongoDB
    await newVideo.save();
    
    // Fetch the user from the request (assuming the user is authenticated)
    const userId = req.user._id; // Assuming `req.user` contains the authenticated user
    // console.log("done saving the video inside the mongoDB and user id is:", userId)

    const user = await User.findById(userId).populate("watchHistory");
    if (!user) {
      throw new ApiError(404, "User not found");
    }
  
    // Check if the video is already in the user's watch history
    const alreadyInHistory = user.watchHistory.some(
      (v) => v.videoUrl === newVideo.videoUrl
    );
  
    if (!alreadyInHistory) {
      // Add the video to the user's watch history
      user.watchHistory.push(newVideo._id);
      await user.save();
    }
  
    // Send response to frontend immediately
    res.status(201).json(
      new ApiResponse(
        201,
        newVideo,
        alreadyInHistory
          ? "Video already in watch history"
          : "Video uploaded and added to watch history"
      )
    );
  
    // Use `setImmediate` to handle the external API request in the background
    setImmediate(async () => {
      const apiUrl = `${config.externalEndpoints.url1}-video`; // External API URL
        // console.log("external API is:", apiUrl)
      if (apiUrl) {
        try {
          // Determine the appropriate server URL based on environment
          const serverUrl = process.env.NODE_ENV === "development"
            ? config.ngrokUrl // Use ngrok in development
            : process.env.RENDER_EXTERNAL_URL; // Use hosting URL in production
  
          // Send video data to external API
          const response = await axios.post(apiUrl, {
            videoId: newVideo._id,
            videoUrl: newVideo.videoUrl,
            serverUrl: serverUrl,
          });
  
          if (response.data) {
            console.log("✅ Request successful. Marking as sent.");
            newVideo.requestSent = true; // Mark request as successful
          } else {
            console.warn("⚠️ External API did not return a valid response.");
            newVideo.requestSent = false; // Allow retry
          }
        } catch (error) {
          console.error("❌ Error sending request. ", error.message);
          newVideo.requestSent = false; // Allow retry
        }
  
        // Save the updated video document
        await newVideo.save();
      }
    });
  });



  const loginWithTempToken = asyncHandler(async (req, res) => {
    const { temporaryToken } = req.body;  // Extract token from the request body

    if (!temporaryToken) {
        // This check is now working correctly based on your logs
        throw new ApiError(400, "Temporary token is required");
    }

    try {
        // Verify the temporary token
        const decoded = jwt.verify(temporaryToken, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Fetch the user from the database using the userId
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // Generate new access and refresh tokens for the user
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // Save the new refresh token in the user's document
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        const accessTokenOptions = {
            httpOnly: true, // Prevents client-side JS access
            secure: process.env.NODE_ENV === 'production', // **IMPORTANT**: Only set 'secure' in production (HTTPS)
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // 'None' for cross-origin (needs secure=true), 'Lax' for same-origin or top-level navigation
            maxAge: 1000 * 60 * 15 // 15 minutes (match access token expiry)
        };

        const refreshTokenOptions = {
            ...accessTokenOptions, // Inherit httpOnly, secure, sameSite
            maxAge: 1000 * 60 * 60 * 24 * 10 // 10 days (match refresh token expiry)
        };

        // --- CORRECTED ORDER ---
        // 1. Set status
        // 2. Set cookies
        // 3. Send JSON response (this finalizes the response)
        return res
            .status(200)
            .cookie("accessToken", accessToken, accessTokenOptions) // Set cookie 1
            .cookie("refreshToken", refreshToken, refreshTokenOptions) // Set cookie 2
            .json(new ApiResponse(200, { // Send JSON body LAST
                // Optionally return user data if frontend needs it immediately
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    fullname: user.fullname,
                    avatar: user.avatar,
                    isAdmin: user.isAdmin,
                    isActive: user.isActive
                    // add other non-sensitive fields if needed
                },
                // You can still include tokens in the body if your frontend
                // prefers accessing them directly sometimes, alongside the cookies.
                accessToken: accessToken,
                refreshToken: refreshToken
            }, "Logged in successfully"));
        // --- END CORRECTION ---

    } catch (error) {
        console.error("Error during login with temporary token:", error);
        // Make sure no response is sent here if headers might have already been partially sent in the try block
        // (asyncHandler usually prevents double responses from the 'throw' below)
        // If the error is JWT expiration or invalid signature, it's often better to send 401 Unauthorized
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            throw new ApiError(401, error.message || "Invalid or expired temporary token");
        }
        // Otherwise, re-throw the generic error to be caught by global error handler
        throw new ApiError(500, "Something went wrong while logging in with temporary token");
    }
});

// const loginWithTempToken = asyncHandler(async (req, res) => {
//     const {temporaryToken } = req.body;  // Extract token from the request body
//     console.log("Received request body in loginWithTempToken:", req.body);
//     console.log("Extracted temporaryToken:", temporaryToken);

//     if (!temporaryToken) {
//         throw new ApiError(400, "Temporary token is required");  // Ensure the token is provided
//     }

//     try {
//         // Verify the temporary token
//         // console.log("Here in the TempToken Login:", temporaryToken);
//         const decoded = jwt.verify(temporaryToken, process.env.JWT_SECRET);

//         // Extract userId from the decoded token
//         const userId = decoded.userId;

//         // Fetch the user from the database using the userId
//         const user = await User.findById(userId);
//         if (!user) {
//             throw new ApiError(404, "User not found");
//         }

//         // Generate new access and refresh tokens for the user
//         const accessToken = user.generateAccessToken();  // Assuming generateAccessToken is a method in your User model
//         const refreshToken = user.generateRefreshToken();  // Assuming generateRefreshToken is a method in your User model

//         // Save the new refresh token in the user's document
//         user.refreshToken = refreshToken;
//         await user.save({ validateBeforeSave: false });

//         const accessTokenOptions = {
//             httpOnly: true, // Prevents client-side JS access
//             secure: process.env.NODE_ENV === 'production', // **IMPORTANT**: Only set 'secure' in production (HTTPS)
//             sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // 'None' for cross-origin (needs secure=true), 'Lax' for same-origin or top-level navigation
//             maxAge: 1000 * 60 * 15 // 15 minutes (match access token expiry)
//         };
    
//         const refreshTokenOptions = {
//             ...accessTokenOptions, // Inherit httpOnly, secure, sameSite
//             maxAge: 1000 * 60 * 60 * 24 * 10 // 10 days (match refresh token expiry)
//         };

//         // Return the generated tokens in the response
//         return res
//         .status(200)
//         .cookie("accessToken", accessToken, accessTokenOptions) // Set access token cookie
//         .cookie("refreshToken", refreshToken, refreshTokenOptions) // Set refresh token cookie
//         .json(
//             new ApiResponse(
//                 200,
//                 {
//                     user: loggedInUserDetails,
//                     // !! REMOVED accessToken from response body - rely on the cookie !!
//                     // refreshToken was already correctly omitted from body
//                 },
//                 "User logged in successfully"
//             )
//         );
//     } catch (error) {
//         console.error("Error during login with temporary token:", error);
//         throw new ApiError(500, "Something went wrong while logging in with temporary token");
//     }
// });




const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $unset: { refreshToken: 1 } },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/',
        domain: process.env.COOKIE_DOMAIN || 'localhost' // Match exactly what was set on login
    };

    // Clear both tokens
    res
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      // Add these headers to prevent caching
      .set('Cache-Control', 'no-store, no-cache, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .status(200)
      .json(new ApiResponse(200, {}, "User logged out"));
});




const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    // Validate refresh token presence
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request: Refresh token is missing");
    }

    try {
        // Decode the incoming refresh token
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        // Fetch the user using the decoded token's ID
        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(401, "Invalid refresh token: User not found");
        }

        // Verify that the refresh token matches the one stored for the user
        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token expired or has been used");
        }

        // Generate new access and refresh tokens
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshToken(user._id);

        // Update user's refresh token in the database
        user.refreshToken = newRefreshToken;
        await user.save();

        // Set cookies for the new tokens
        const cookieOptions = {
            secure: true,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        };

        res.cookie("accessToken", newAccessToken, cookieOptions);
        res.cookie("refreshToken", newRefreshToken, cookieOptions);

        // Return tokens in the response
        return res.status(200).json(
            new ApiResponse(200, { accessToken: newAccessToken, refreshToken: newRefreshToken }, "Access token refreshed")
        );
    } catch (error) {
        throw new ApiError(401, error.message || "Invalid refresh token");
    }
});



const checkPassword = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id);
    // console.log("inside the check funciton")
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Determine if the user has a password set
    const hasPassword = !!user.password; 

    if (!hasPassword) {
        // console.log("has password is false:", hasPassword)
        return res.status(202).json(new ApiResponse(202, "No password set", { hasPassword: false }));
    }
    // console.log("has password is true:", hasPassword)


    return res.status(200).json(new ApiResponse(200, "Password available", { hasPassword: true }));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id);
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // If user has no password, allow setting it directly
    if (!user.password) {
        user.password = newPassword;
        user.hasPassword = true; // Ensure this field is updated
        await user.save({ validateBeforeSave: false });

        return res.status(200).json(new ApiResponse(200, "Password set successfully", { hasPassword: true }));
    }
    
    // Verify old password before allowing change
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Old password is incorrect");
    }
    
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, "Password changed successfully", { hasPassword: true }));
});





// --- Helper Function for Email Sending (Optional but Recommended) ---
const sendEmail = async (options) => {
    // 1. Create a transporter (object that sends email)
    //    Configure based on your chosen service (using .env variables)
    const transporter = nodemailer.createTransport({
        // service: process.env.EMAIL_SERVICE, // Can use service name for common ones (like 'gmail')
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports like 587
        auth: {
            user: process.env.EMAIL_USER, // Your email address
            pass: process.env.EMAIL_PASS, // Your email password or app password
        },
        // For local development with self-signed certs, you might need:
        // tls: { rejectUnauthorized: false }
    });

    // 2. Define the email options
    const mailOptions = {
        from: process.env.EMAIL_FROM, // Sender address (defined in .env)
        to: options.email,            // Recipient address
        subject: options.subject,     // Subject line
        text: options.message,        // Plain text body
        // html: '<b>Hello world?</b>' // You can also add HTML content
    };

    // 3. Actually send the email
    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully.');
    } catch (error) {
        console.error('Error sending email:', error);
        
    }
};
// --- End Helper Function ---


const forgetPassword1 = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        // Use ApiError if you have it, otherwise just send status
        // throw new ApiError(400, "Please provide Email");
        return res.status(400).json(new ApiResponse(400, {}, "Please provide Email"));
    }

    // 1. Find user by email
    const user = await User.findOne({ email });

    // IMPORTANT: Security Measure!
    // Even if the user is NOT found, send a generic success response.
    // This prevents attackers from guessing which emails are registered.
    if (!user) {
        console.log(`Password reset requested for non-existent email: ${email}`);
        return res.status(200).json(new ApiResponse(200, {}, "If your email is registered, you will receive a password reset link."));
    }

    // 2. Generate a random reset token
    const resetToken = crypto.randomBytes(32).toString('hex'); // Generate secure token

    // 3. Hash the token and set it on the user model (store the hash, not the plain token)
    //    The token sent to the user is the plain one. We compare its hash later.
    user.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // 4. Set token expiry (e.g., 10 minutes)
    user.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    try {
        // Save the user with the token and expiry date
        await user.save({ validateBeforeSave: false }); // Skip validation if needed for temp fields

        // 5. Create the reset URL (points to your frontend)
        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`; // Pass the PLAIN token

        // 6. Prepare the email message
        const message = `
You are receiving this email because you (or someone else) have requested the reset of a password for your account.
Please click on the following link, or paste this into your browser to complete the process:
${resetURL}
This link will expire in 10 minutes.
If you did not request this, please ignore this email and your password will remain unchanged.
`;

        // 7. Send the email using the helper function
        await sendEmail({
            email: user.email,
            subject: 'Your Password Reset Token (valid for 10 min)',
            message,
        });

        // 8. Send success response to the client
        return res.status(200).json(new ApiResponse(200, {}, "Password reset token sent to email successfully."));

    } catch (err) {
        console.error("Error during password reset process:", err);
        // Clear the token fields if saving failed or email sending failed critically
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpires = undefined;
        // Try to save the cleared fields (optional, depends on error handling strategy)
        try {
            await user.save({ validateBeforeSave: false });
        } catch (saveError) {
            console.error("Error clearing reset token after failure:", saveError);
        }

        // Use ApiError or standard response
        // throw new ApiError(500, "There was an error sending the password reset email. Please try again later.");
        return res.status(500).json(new ApiResponse(500, { error: err.message }, "Error sending password reset email."));
    }
});




const forgetPassword = asyncHandler(async (req, res)=>{
    const {email} = req.body
    if(!email){
        return res.status(401).json(new ApiResponse(401, {}, "Please provide Email"))
    }
    console.log("User mail recieved:", email)
    return res.status(200)
    .json(new ApiResponse(200, {}, "Mail sent successfully"))
})



const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body;
  
    // Create an object to hold the fields that need to be updated
    const updateFields = {};
  
    // Only add fields to the update object if they are provided in the request
    if (fullname) {
      updateFields.fullname = fullname;
    }
    if (email) {
      // Check if the email is already in use by another user
      const existingUser = await User.findOne({ email });
  
      if (existingUser && existingUser._id.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "The email address is already in use.");
      }
  
      updateFields.email = email;
    }
  
    // If no fields were provided, throw an error
    if (Object.keys(updateFields).length === 0) {
      throw new ApiError(400, "At least one field (fullname or email) is required.");
    }
  
    // Perform the update operation with the dynamically created fields
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: updateFields,
      },
      { new: true }
    )
      .select("-password"); // You can also exclude other fields like refreshToken here if needed
  
    // Return the updated user details in the response
    return res.status(200).json(new ApiResponse(200, user, "Account details updated successfully"));
  });
  



  

const updateUserAvatar = asyncHandler(async(req, res)=>{
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400, "File is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400, "Error while Uploading Avatar")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200).
    json(new ApiResponse(200, user, "Avatar Image Updated Successfully"))
})

const updateUserCoverImage = asyncHandler(async(req, res)=>{
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400, "File is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400, "Error while Uploading Cover Image")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200).
    json(new ApiResponse(200, user, "Cover Image Updated Successfully"))
})






export { registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    loginWithTempToken,
    uploadVideo,
    googleAuth,
    checkPassword,
    forgetPassword,
    forgetPassword1
 };
