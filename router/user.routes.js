import {Router} from "express"
import { registerUser,loginWithTempToken,  loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controller.js"
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { getWatchHistory, addVideo, getTranscript, getSummary, getQnas, keyconcept, storeAssessment } from "../controllers/userVideo.controller.js"
import { addFileData, getFileHistory, getVectorData } from "../controllers/userFileData.controller.js";
import { insertChat, getChatHistory } from "../controllers/userChat.controller.js"; 

const router = Router()

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
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
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
router.route("/add-assesment").post(verifyJWT, storeAssessment);  



// New route for file upload and saving the uplaoded url of file and the specific encoded data
router.route("/add-file-data").post(verifyJWT, addFileData);
router.route("/get-vector").post(verifyJWT, getVectorData);
router.route("/get-file-history").post(verifyJWT, getFileHistory);
router.route("/insert-chat").post(verifyJWT, insertChat);
router.route("/get-chat-history").post(verifyJWT, getChatHistory);



// router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/history").get(verifyJWT, getWatchHistory)
router.route("/refreshToken").get(verifyJWT, refreshAccessToken)





export default router