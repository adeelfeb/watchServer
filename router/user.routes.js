import { Router } from "express";
import { registerUser, loginWithTempToken, loginUser, logoutUser,uploadVideo,  refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getWatchHistory, addVideo, getTranscript, getSummary, getQnas, keyconcept, storeAssessment, deleteHistory, getScore, DeleteVideo, getAllVideos, DeleteVideos } from "../controllers/userVideo.controller.js";
import { addFileData, getFileHistory, getVectorData } from "../controllers/userFileData.controller.js";
import { insertChat, getChatHistory } from "../controllers/userChat.controller.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js"; // Import asyncHandler
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import multer from "multer"; // Import multer

const router = Router();

// Route to handle video upload
router.route("/upload-video").post(verifyJWT, 
    upload.single("video"), // Use Multer middleware to handle single file upload
    uploadVideo
);

// Error handling middleware for Multer errors
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Handle Multer errors (e.g., file size exceeded)
        return res.status(400).json(
            new ApiResponse(400, null, err.message)
        );
    } else if (err) {
        // Handle other errors
        return res.status(500).json(
            new ApiResponse(500, null, err.message)
        );
    }
    next();
});

    
    router.route("/register").post(
        upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
        ]),
        registerUser)
router.route("/login").post(loginUser)
router.route("/login-with-temp-token").post(loginWithTempToken)
// These routes are secure since using verifyJWT thingi is being used
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/change-password").patch(verifyJWT, changeCurrentPassword)
router.route("/current-user").post(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)
router.route("/update-avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar )
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)
router.route("/addVideo").post(verifyJWT, addVideo); // Add video endpoint


// Video-related routes (with JWT verification)
router.route("/transcript").get(verifyJWT, getTranscript);  // Get transcript for a video
router.route("/summary").get(verifyJWT, getSummary);      // Get summary for a video
router.route("/qnas").get(verifyJWT, getQnas);  
router.route("/keyconcept").get(verifyJWT, keyconcept);  

//assesment route submission
router.route("/qnas").post(verifyJWT, storeAssessment);  
router.route("/score").get(verifyJWT, getScore);  
router.route("/delete-videos").delete(verifyJWT, DeleteVideos);  
router.route("/delete-video").delete(verifyJWT, DeleteVideo);  

router.route("/getAllVideo").get(verifyJWT, getAllVideos);



// New route for file upload and saving the uplaoded url of file and the specific encoded data
router.route("/add-file-data").post(verifyJWT, addFileData);
router.route("/get-vector").post(verifyJWT, getVectorData);
router.route("/get-file-history").post(verifyJWT, getFileHistory);
router.route("/insert-chat").post(verifyJWT, insertChat);
router.route("/get-chat-history").post(verifyJWT, getChatHistory);



// router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/history").get(verifyJWT, getWatchHistory)
router.route("/delete-from-history").delete(verifyJWT, deleteHistory)
router.route("/refreshToken").get(verifyJWT, refreshAccessToken)





export default router