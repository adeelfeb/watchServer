import { Router } from "express";
import { addTranscript, addSummary, addQnas, addKeyconcept } from "../controllers/addVideo.controller.js";

const router = Router();


router.route("/addTranscript").post(addTranscript); // Add transcript endpoint
router.route("/addSummary").post(addSummary);// Add Summary Route
router.route("/addQnas").post(addQnas);
router.route("/addKeyconcept").post(addKeyconcept);


export default router;
