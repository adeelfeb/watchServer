import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import axios from 'axios'; 
import config from "../src/conf.js";
import { Score } from "../models/score.model.js";
import mongoose from "mongoose";



const getWatchHistory = asyncHandler(async (req, res) => {
  try {
    // console.log("A request has been made")
      const userHistory = await User.findById(req.user._id)
          .select("watchHistory")
          .populate({
              path: "watchHistory",
              select: "title duration createdAt thumbnailUrl videoUrl", // Fetch only required fields
              options: { sort: { createdAt: -1 }, limit: 50 }, // Limit results
          })
          .lean(); // Convert to plain JavaScript object (faster than Mongoose objects)

      if (!userHistory) {
          return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json(
          new ApiResponse(200, userHistory.watchHistory, "Watch History Fetched Successfully")
      );
  } catch (error) {
      res.status(500).json({ message: "Failed to fetch watch history", error });
  }
});

const addVideo = asyncHandler(async (req, res) => {
  const { videoUrl } = req.body;
  const userId = req.user._id;
  const apiUrl = config.externalEndpoints.url1;

  // console.log("Adding video or checking...");

  if (!videoUrl) {
    throw new ApiError(400, "Please provide a valid video URL");
  }

  // Check if video exists in DB
  let video = await Video.findOne({ videoUrl });

  if (!video) {
    // Video doesn't exist → Create a new entry
    video = new Video({ videoUrl });

    try {
      // Fetch video details & save
      await video.fetchVideoDetails();
    } catch (error) {
      console.error("❌ Error fetching video details. Using default values:", error.message);
      // Set default values if fetching fails
      video.thumbnailUrl = "https://havecamerawilltravel.com/wp-content/uploads/2020/01/youtube-thumbnails-size-header-1-800x450.png";
      video.title = "Title Unavailable";
      video.duration = "Unknown";
    }

    await video.save();
  } else if (video.requestSent) {
    // If request is already sent, return immediately
    return res.status(200).json(new ApiResponse(200, video, "Video already in database"));
  }

  // Fetch user & ensure they exist
  const user = await User.findById(userId).populate("watchHistory");
  if (!user) throw new ApiError(404, "User not found");

  // Check if video is in watch history
  const alreadyInHistory = user.watchHistory.some(v => v.videoUrl === videoUrl);

  if (!alreadyInHistory) {
    user.watchHistory.push(video._id);
    await user.save();
  }

  // ✅ Send response to frontend **immediately**
  res.status(201).json(
    new ApiResponse(
      201,
      video,
      alreadyInHistory ? "Video already in watch history" : "Video added successfully and included in watch history"
    )
  );

  // ✅ Use `setImmediate` to handle the external API request in the background
  setImmediate(async () => {
    if (!video.requestSent && apiUrl) {
      try {
        console.log("🔄 Sending video data to external API...", apiUrl);

        // Determine the appropriate server URL based on environment
        const serverUrl = process.env.NODE_ENV === "development"
          ? config.ngrokUrl // Use ngrok in development
          : process.env.RENDER_EXTERNAL_URL; // Use hosting URL in production

        const response = await axios.post(apiUrl, {
          videoId: video._id,
          videoUrl: videoUrl,
          serverUrl: serverUrl // Dynamically set server URL
        });

        if (response.data) {
          console.log("✅ Request successful. Marking as sent.");
          video.requestSent = true;
        } else {
          console.warn("⚠️ External API did not return a valid response.");
          video.requestSent = false; // Allow retry
        }
      } catch (error) {
        console.error("❌ Error sending request. API might be down:", error.message);
        video.requestSent = false; // Allow retry
      }

      await video.save();
    }
  });
});




const getTranscript = asyncHandler(async (req, res) => {
  const videoId = req.query.videoId || req.body.videoId || req.params;
  // console.log("Inside the getTranscript :", videoId);
  
    if (!videoId) {
      throw new ApiError(400, "Video ID is required.");
    }
  
    // Find the video by its ID
    const video = await Video.findById(videoId);
  
    if (!video) {
      throw new ApiError(404, "Video not found.");
    }
  
    // Extract the transcript (default to English for this example)
    const transcript = video.transcript || {};
  
    // If you want to return specific language, you can modify it like this:
    // const { english, hindi, urdu } = video.transcript;
    // In this case, you would return a specific one based on query parameter or user choice.
  
    return res.status(200).json(
      new ApiResponse(200, { transcript: transcript }, "Transcript fetched successfully")
    );
  });


const keyconcept = asyncHandler(async (req, res) => {
  const videoId = req.query.videoId || req.body.videoId || req.params;
  // console.log("Inside the getTranscript :", videoId);
  
    if (!videoId) {
      throw new ApiError(400, "Video ID is required.");
    }
  
    // Find the video by its ID
    const video = await Video.findById(videoId);
  
    if (!video) {
      throw new ApiError(404, "Video not found.");
    }
  
    // Extract the transcript (default to English for this example)
    const keyconcept = video.keyconcept || {};
  
  
    return res.status(200).json(
      new ApiResponse(200, { keyconcept: keyconcept }, "Transcript fetched successfully")
    );
  });


  const getSummary = asyncHandler(async (req, res) => {
    const videoId = req.query.videoId || req.body.videoId || req.params.videoId; // Access the videoId properly
    // console.log("Inside the Summary, Video ID:", videoId);
    if (!videoId) {
      throw new ApiError(400, "Video ID is required.");
    }
  
    // Find the video by its ID
    const video = await Video.findById(videoId);
    // console.log("This is the video:", video)
  
    if (!video) {
      throw new ApiError(404, "Video not found.");
    }
  
    // Extract the summary (default to empty object if not found)
    const summary = video.summary || {};
    // console.log("This is the summary:", summary);
    
    return res.status(200).json(
      new ApiResponse(200, { summary }, "Summary fetched successfully")
    );
});







const getQnas = asyncHandler(async (req, res) => {
  try {
      const videoId = req.query.videoId || req.body.videoId || req.params.videoId;

      if (!videoId) {
          return res.status(400).json({ message: "Video ID is required." });
      }

      // Find video
      const video = await Video.findById(videoId);
      if (!video) {
          return res.status(404).json({ message: "Video not found." });
      }

      // Return QnAs
      return res.status(200).json({
          message: "QnAs fetched successfully",
          qnas: video.qnas || { shortQuestions: [], mcqs: [] },
          videoId
      });
  } catch (error) {
      console.error("Error fetching QnAs:", error.message);
      return res.status(500).json({ message: "Failed to fetch QnAs", error: error.message });
  }
});

const storeAssessment = asyncHandler(async (req, res) => {
  try {
      const videoId = req.query.videoId || req.body.videoId || req.params.videoId;
      const userId = req.user._id || req.query.userId || req.body.userId || req.params.userId;
      const quiz = req.body.quiz;

      console.log("Inside the QnA:", quiz);

      if (!quiz) {
          return res.status(400).json({ message: "Quiz data is required." });
      }
      if (!videoId) {
          return res.status(400).json({ message: "Video ID is required." });
      }
      if (!userId) {
          return res.status(400).json({ message: "User ID is required." });
      }

      // Find video
      const video = await Video.findById(videoId);
      if (!video) {
          return res.status(404).json({ message: "Video not found." });
      }

      // Process MCQ answers
      let mcqScore = 0;
      const mcqAnswers = quiz.mcqAnswers?.map(mcq => {
          const isCorrect = mcq.selectedOption === mcq.correctAnswer; // Assuming correctAnswer is available
          if (isCorrect) mcqScore += 1;
          return { ...mcq, isCorrect };
      }) || [];

      // Process short answers (these will be evaluated later by LLM/chatbot)
      const shortAnswers = quiz.shortAnswers?.map(answer => ({
          ...answer,
          isCorrect: null // Placeholder for LLM evaluation
      })) || [];

      // Process fill-in-the-blanks (assuming evaluation logic)
      let fillInTheBlanksScore = 0;
      const fillInTheBlanks = quiz.fillInTheBlanks?.map(blank => {
          const isCorrect = blank.givenAnswer === blank.correctAnswer; // Assuming correctAnswer is available
          if (isCorrect) fillInTheBlanksScore += 1;
          return { ...blank, isCorrect };
      }) || [];

      const totalScore = mcqScore + fillInTheBlanksScore; // Short answers not included yet

      // Construct score document
      const scoreData = {
          user: userId,
          video: videoId,
          shortAnswers,
          mcqs: mcqAnswers,
          fillInTheBlanks,
          overallScore: totalScore, // Use overallScore instead of score
          scoreIsEvaluated: false, // Set to false initially
      };
      console.log("Score data is stored", scoreData);

      // Save or update the score data
      const updatedScore = await Score.findOneAndUpdate(
          { user: userId, video: videoId }, // Query to find the existing document
          scoreData, // New data to overwrite
          { upsert: true, new: true, runValidators: true } // Options: create if not exists, return updated document
      );

      return res.status(201).json({
          message: "Assessment stored/updated successfully.",
          score: updatedScore,
          status: 201
      });
  } catch (error) {
      console.error("Error storing assessment:", error.message);
      return res.status(500).json({ message: "Failed to store assessment", error: error.message });
  }
});


const getScore = asyncHandler(async (req, res) => {
  try {
      const videoId  = req.params.videoId || req.body.videoId || req.query.videoId;
      const user = req.user || req.query.userId || req.body.userId || req.params.userId;

      if (!videoId) {
          throw new ApiError(400, "Video ID is required");
      }

      // Ensure user is defined and has a valid _id
      if (!user || !user._id) {
          throw new ApiError(400, "User ID is required");
      }

      const videoIndex = user.watchHistory.indexOf(videoId);
      if (videoIndex === -1) {
          throw new ApiError(404, "Video not found in watch history");
      }

      // Corrected query: Use user._id instead of user._Id
      const score = await Score.findOne({ user: user._id, video: videoId });

      if (!score) {
          throw new ApiError(404, "Score not found for the given user and video");
      }

      const shortAnswers = score.shortAnswers.map(q => ({
          question: q.question,
          givenAnswer: q.givenAnswer,
          correctAnswer: q.correctAnswer,
          score: q.score,
      }));

      const mcqs = score.mcqs.map(q => ({
          question: q.question,
          selectedOption: q.selectedOption,
          correctOption: q.correctOption,
          isCorrect: q.isCorrect,
          score: q.score,
      }));

      const fillInTheBlanks = score.fillInTheBlanks.map(q => ({
          sentence: q.sentence,
          givenAnswer: q.givenAnswer,
          correctAnswer: q.correctAnswer,
          score: q.score,
      }));

      const overallScore = score.overallScore;

      // Return the scores and question details, including scoreIsEvaluated
      res.status(200).json(
          new ApiResponse(200, {
              shortAnswers,
              mcqs,
              fillInTheBlanks,
              overallScore,
              scoreIsEvaluated: score.scoreIsEvaluated, // Include score evaluation status
          }, "Scores and question details retrieved successfully")
      );
  } catch (error) {
      if (error instanceof ApiError) {
          res.status(error.statusCode).json({ message: error.message });
      } else {
          res.status(500).json({ message: "Failed to fetch score for the quiz", error: error.message });
      }
  }
});









const deleteHistory = asyncHandler(async (req, res) => {
  try {
      const { videoId } = req.body; // Assuming the videoId is passed in the request body
      const userId = req.user._id; // Get the user ID from the request (authenticated user)

      if (!videoId) {
          throw new ApiError(400, "Video ID is required");
      }

      // Find the user
      const user = await User.findById(userId);
      if (!user) {
          throw new ApiError(404, "User not found");
      }

      // Check if the video exists in the user's watch history
      const videoIndex = user.watchHistory.indexOf(videoId);
      if (videoIndex === -1) {
          throw new ApiError(404, "Video not found in watch history");
      }

      // Remove the video from the watch history
      user.watchHistory.splice(videoIndex, 1);

      // Save the updated user document
      await user.save();

      // Return success response
      res.status(200).json(
          new ApiResponse(200, null, "Video removed from watch history successfully")
      );
  } catch (error) {
      // Handle errors
      if (error instanceof ApiError) {
          res.status(error.statusCode).json({ message: error.message });
      } else {
          res.status(500).json({ message: "Failed to delete video from watch history", error: error.message });
      }
  }
});




export{
    getWatchHistory,
    addVideo,
    getTranscript,
    getSummary,
    getQnas,
    keyconcept,
    storeAssessment,
    deleteHistory,
    getScore
}