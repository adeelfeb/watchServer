import { Router } from "express";
import { addTranscript, addSummary, addQnas, addKeyconcept, addVideoDetails, DeleteVideo } from "../controllers/addVideo.controller.js";

const router = Router();


router.route("/addTranscript").post(addTranscript); // Add transcript endpoint
router.route("/addSummary").post(addSummary);// Add Summary Route
router.route("/addQnas").post(addQnas);
router.route("/addKeyconcept").post(addKeyconcept);
router.route("/addVideoDetails").post(addVideoDetails);
router.route("/deleteVideo").delete(DeleteVideo);


export default router;
