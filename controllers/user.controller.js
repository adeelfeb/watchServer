import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import { Video } from "../models/video.model.js"; // Import Video model
import axios from "axios"; // For external API requests
import config from "../src/conf.js";


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

const registerUser = asyncHandler(async (req, res) => {

    // console.log(req.body)
    // Destructuring the incoming data from req.body
    const { fullname, email, password, username } = req.body;

    // To check for the special empty space character
    const removeInvisibleChars = (str) => {
        return str.replace(
            /[\u200B\u200C\u200E\u200F\u202A-\u202E\u2060\u2061\u2062\u2063\u2064\u2065\u2066\u2067\u2068\u2069\u206A-\u206F\u200D\u200C\u200B\u202F\u205F\u3000\u00A0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u200B\u200C\u200D\uFEFF]/g,
            ""
        );
    };

    // Ensure all fields are filled
    if ([fullname, email, password, username].some((field) => removeInvisibleChars(field)?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // Check if user already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(409, "User Already exists");
    }

    // Ensure avatar is present in req.files if it exists, else use default
    const avatarLocalPath = req.files?.avatar?.[0]?.path || null;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path || null;

    let avatarUrl = "";  // Default avatar URL in case there's no avatar provided
    if (avatarLocalPath) {
        // Upload avatar to Cloudinary if it is provided
        const avatar = await uploadOnCloudinary(avatarLocalPath);

        if (!avatar) {
            throw new ApiError(400, "Avatar upload failed");
        }

        avatarUrl = avatar.url;
    }

    // Upload cover image to Cloudinary if present
    let coverImageUrl = "";
    if (coverImageLocalPath) {
        const coverImage = await uploadOnCloudinary(coverImageLocalPath);
        coverImageUrl = coverImage?.url || "";
    }

    // Create user in the database
    const user = await User.create({
        fullname,
        avatar: avatarUrl || "https://res.cloudinary.com/dk06hi9th/image/upload/v1732198388/zgwzdyhy3nldkk2inxpl.jpg",  // Use default avatar if not provided
        coverImage: coverImageUrl || "https://res.cloudinary.com/dk06hi9th/image/upload/v1732198259/dbkm9wciwhs8njns81de.jpg",  // Use default cover image if not provided
        email,
        password,
        username: username.toLowerCase(),
    });

    // Fetch the created user without sensitive fields
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }


     // Generate a temporary login token after user registration
     const temporaryToken = jwt.sign(
        { userId: user._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: '1h' }  // The token expires after 1 hour
    );

    // Send the temporary token to login the user
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    // Fetch the created user without sensitive fields

    // Send successful response including temporary login token
    return res.status(201).json(new ApiResponse(200, {
        accessToken,
        refreshToken,
        temporaryToken  // Return the temporary token as part of the response
    }, "User registered and logged in successfully"));
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

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken: 1// this can also be used to remove the refreshToken that keeps the user loggedIn
            }
        },
        // { $set: { refreshToken: undefined } },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out"));
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


const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    // console.log("Inside the change password:", req.body)

    // Find the user from the database and ensure it's awaited
    const user = await User.findById(req.user?._id);
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Use the isPasswordCorrect method defined in the schema
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Old password is incorrect");
    }

    // Set the new password and save it
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, "Password changed successfully")
    );
});


const getCurrentUser = asyncHandler(async (req, res)=>{
    // console.log("User Authenticated")
    return res.status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched Successfully"))
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
    uploadVideo
 };
