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
import mongoose from "mongoose";

const registerUser = asyncHandler(async (req, res) => {
    const { fullname, email, password, username, firebaseUid } = req.body;

    // Validate required fields
    if (!fullname || !email || !username) {
        return res.status(400).json(new ApiResponse(400, null, "Full name, email, and username are required"));
    }

    // Check if user already exists
    const existedUser = await User.findOne({ $or: [{ username }, { email }] });

    if (existedUser) {
        return res.status(409).json(new ApiResponse(409, null, "User already exists. Please use a different email or username."));
    }

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

    if (!createdUser) {
        return res.status(500).json(new ApiResponse(500, null, "Something went wrong while registering the user."));
    }

    // Generate tokens
    const temporaryToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    return res.status(201).json(new ApiResponse(201, { accessToken, refreshToken, temporaryToken }, "User registered and logged in successfully"));
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



const loginUser = asyncHandler(async (req, res)=>{
  const { email, password, username } = req.body;
  // console.log(email,password, username)
  
  if(!(username || email)){
      throw new ApiError(400, "User or email required")
  }

  const user = await User.findOne({
      $or: [{username}, {email}]
  })

  if(!user){
      throw new ApiError(404, "User does not exist")
  }

  const isPasswordValid = await user.isPasswordCorrect(password)

  if(!isPasswordValid){
      throw new ApiError(401, "Invalide user Credentials #Password")
  }


  const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  const options = {
      httpOnly: true,
      secure: true, // Required for HTTPS
      sameSite: 'none', // Required for cross-origin cookies
  };
  

  return res.status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
      new ApiResponse(200,
          {
              accessToken, refreshToken
          },
          "User LoggedIn successfully"
      )
  )

})




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
    const { token: temporaryToken } = req.body;  // Extract token from the request body

    if (!temporaryToken) {
        throw new ApiError(400, "Temporary token is required");  // Ensure the token is provided
    }

    try {
        // Verify the temporary token
        // console.log("Here in the TempToken Login:", temporaryToken);
        const decoded = jwt.verify(temporaryToken, process.env.JWT_SECRET);

        // Extract userId from the decoded token
        const userId = decoded.userId;

        // Fetch the user from the database using the userId
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // Generate new access and refresh tokens for the user
        const accessToken = user.generateAccessToken();  // Assuming generateAccessToken is a method in your User model
        const refreshToken = user.generateRefreshToken();  // Assuming generateRefreshToken is a method in your User model

        // Save the new refresh token in the user's document
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        // Return the generated tokens in the response
        return res.status(200).json(new ApiResponse(200, {
            accessToken,
            refreshToken
        }, "Logged in successfully"));
    } catch (error) {
        console.error("Error during login with temporary token:", error);
        throw new ApiError(500, "Something went wrong while logging in with temporary token");
    }
});




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



const getCurrentUser = asyncHandler(async (req, res) => {
    // console.log("Current user fetched:", req.user._id);
    return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"));
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

const getAllUsers = asyncHandler(async (req, res) => {
    // Optional: Add pagination later if the user list becomes very large
    // const page = parseInt(req.query.page, 10) || 1;
    // const limit = parseInt(req.query.limit, 10) || 50;
    // const skip = (page - 1) * limit;

    // Projection: Select fields needed for the admin user list
    const fieldsToSelect = 'fullname username email avatar isActive isAdmin createdAt authProvider';

    const users = await User.find({}) // Fetch all users for now
        .select(fieldsToSelect)
        // .skip(skip) // Add if paginating
        // .limit(limit) // Add if paginating
        .sort({ createdAt: -1 }) // Show newest users first
        .lean(); // Use lean for performance

    // Optional: Add total count if paginating
    // const totalUsers = await User.countDocuments({});

    return res
        .status(200)
        .json(new ApiResponse(200, users, "Users fetched successfully"));
});

/**
 * @description Toggle the isActive status of a user
 * @route PATCH /api/v1/admin/users/:userId/status
 * @access Private (Admin)
 */
const toggleUserStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const adminUserId = req.user?._id; // Get ID of the admin performing the action

    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid User ID format");
    }

    // Prevent admin from deactivating themselves
    if (adminUserId && adminUserId.toString() === userId) {
        throw new ApiError(403, "Admins cannot change their own active status.");
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Optional: Prevent deactivating other admins (adjust logic if needed)
    // if (user.isAdmin) {
    //    throw new ApiError(403, "Cannot deactivate another admin account.");
    // }

    // Toggle the status
    user.isActive = !user.isActive;

    // Use save with validation disabled for simple toggle, or rely on schema defaults
    await user.save({ validateBeforeSave: false });

    // Return only necessary updated info
    const updatedUserInfo = {
        _id: user._id,
        isActive: user.isActive,
    };

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUserInfo, `User status successfully updated to ${user.isActive ? 'Active' : 'Inactive'}.`));
});

/**
 * @description Delete a user account
 * @route DELETE /api/v1/admin/users/:userId
 * @access Private (Admin)
 */
const deleteUserAccount = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const adminUserId = req.user?._id;

    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid User ID format");
    }

    // Prevent admin from deleting themselves
    if (adminUserId && adminUserId.toString() === userId) {
        throw new ApiError(403, "Admins cannot delete their own account.");
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Prevent deleting other admins
    if (user.isAdmin) {
        throw new ApiError(403, "Cannot delete an admin account.");
    }

    // Perform the deletion
    const deletionResult = await User.findByIdAndDelete(userId);

    if (!deletionResult) {
        // Should not happen if findById found the user, but good practice
        throw new ApiError(500, "Failed to delete user after finding them.");
    }

    // TODO: Consider related data cleanup (e.g., videos owned by user if applicable, comments, etc.)
    // This might involve cascading deletes or setting fields to null, depending on your schema design.

    return res
        .status(200)
        .json(new ApiResponse(200, { deletedUserId: userId }, "User account deleted successfully."));
});


const createUser = asyncHandler(async(req, res)=>{
    return
})


const getDashboardStats = asyncHandler(async (req, res) => {


    // 1. Count Total Users
    const totalUserCount = await User.countDocuments();

    // 2. Count Active Users (based on the new `isActive` field)
    const activeUserCount = await User.countDocuments({ isActive: true });

    // 3. Count Total Videos
    const totalVideoCount = await Video.countDocuments();

    // Structure the response data
    const stats = {
        totalUsers: totalUserCount,
        activeUsers: activeUserCount,
        totalVideos: totalVideoCount,
    };

    // Send the response
    return res
        .status(200)
        .json(new ApiResponse(200, stats, "Dashboard stats fetched successfully"));
});






const makeAdmin = asyncHandler(async (req, res) => {
    const { userId } = req.body;

    // 1. Validate input
    if (!userId) {
        throw new ApiError(400, "User ID is required");
    }

    // // 2. Check if requesting user is an admin (or super admin)
    // if (!req.user.isAdmin) {
    //     throw new ApiError(403, "Unauthorized: Only admins can perform this action");
    // }

    // 3. Find the user to be made admin
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // 4. Check if user is already admin
    if (user.isAdmin) {
        throw new ApiError(400, "User is already an admin");
    }

    // 5. Update user to admin
    user.isAdmin = true;
    await user.save({ validateBeforeSave: false });

    // 6. Invalidate any existing tokens (optional but recommended)
    user.refreshToken = undefined;
    await user.save({ validateBeforeSave: false });

    // 7. Return success response
    return res.status(200).json(
        new ApiResponse(200, { user }, "User successfully promoted to admin")
    );
});


const getAllVideos = asyncHandler(async (req, res) => {
    // --- Pagination Parameters ---
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20; // Adjust default limit as needed
    const skip = (page - 1) * limit;

    // --- Sorting Parameters ---
    const sortBy = req.query.sortBy || 'createdAt'; // Default sort by creation date
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1; // Default to descending (newest first)
    const sortOptions = { [sortBy]: sortOrder };

    // --- Filtering (Optional - Example: filter by title search) ---
    // const searchQuery = req.query.query || '';
    const filterCriteria = {};
    // if (searchQuery) {
    //     filterCriteria.title = { $regex: searchQuery, $options: 'i' }; // Case-insensitive search
    // }
    // Add more filters based on status etc. if needed

    // --- Projection (Select only necessary fields for the list) ---
    // Adjust this list based on what your VideoList component *actually* displays
    const fieldsToSelect =
        'title thumbnailUrl videoUrl duration createdAt transcript.english transcript.original summary.english summary.original keyconcept.primary keyconcept.secondary qnas.mcqs qnas.shortQuestions score requestSent';


    try {
        // --- Perform Paginated Query ---
        const videos = await Video.find(filterCriteria)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .select(fieldsToSelect) // Apply projection
            .lean(); // Use .lean() for performance if you don't need Mongoose documents

        // --- Get Total Count for Pagination ---
        // Important: Count documents matching the *same filter* used for the data query
        const totalVideosCount = await Video.countDocuments(filterCriteria);

        // --- Calculate Pagination Metadata ---
        const totalPages = Math.ceil(totalVideosCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // --- Prepare Response ---
        const paginationData = {
            docs: videos, // The actual video data for the page
            totalDocs: totalVideosCount,
            limit: limit,
            page: page,
            totalPages: totalPages,
            hasNextPage: hasNextPage,
            hasPrevPage: hasPrevPage,
            nextPage: hasNextPage ? page + 1 : null,
            prevPage: hasPrevPage ? page - 1 : null,
        };

        // Check if the requested page is valid
        if (page > totalPages && totalVideosCount > 0) {
             throw new ApiError(404, "Page not found");
            // Or alternatively, return the last page:
            // return res.redirect(`/your-endpoint?page=${totalPages}&limit=${limit}...`);
        }


        // Return the paginated data
        return res.status(200).json(
            new ApiResponse(
                200,
                paginationData,
                "Videos fetched successfully"
            )
        );

    } catch (error) {
        console.error("Error fetching videos:", error);
        // Handle specific errors like CastError if needed
        if (error instanceof ApiError) {
             throw error; // Re-throw ApiError
        }
        throw new ApiError(500, "Failed to fetch videos", error.message); // Throw generic error
    }
});

export { 
    createUser,
    toggleUserStatus,
    deleteUserAccount,
    getAllVideos,
    getDashboardStats,
    makeAdmin,
    getAllUsers,
    registerUser,
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
    forgetPassword
 };


