import {Router} from "express"
import { registerUser,loginWithTempToken,  loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controller.js"
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { getWatchHistory, addVideo, getTranscript, getSummary, getQnas, keyconcept } from "../controllers/userVideo.controller.js"

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
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar )
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)
router.route("/addVideo").post(verifyJWT, addVideo); // Add video endpoint


// Video-related routes (with JWT verification)
router.route("/transcript").get(verifyJWT, getTranscript);  // Get transcript for a video
router.route("/summary").get(verifyJWT, getSummary);      // Get summary for a video
router.route("/qnas").get(verifyJWT, getQnas);  
router.route("/keyconcept").get(verifyJWT, keyconcept);  


// router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/history").get(verifyJWT, getWatchHistory)
router.route("/refreshToken").get(verifyJWT, refreshAccessToken)

export default router