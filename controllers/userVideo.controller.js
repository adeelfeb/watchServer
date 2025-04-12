import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import axios from 'axios'; 
import config from "../src/conf.js";
import { Score } from "../models/score.model.js";
import { ActivityLog } from "../models/activityLog.model.js";
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


const getAllVideos = asyncHandler(async (req, res) => {
  try {
    // Fetch all videos from the database
    const videos = await Video.find({});

    // Check if videos exist
    if (!videos || videos.length === 0) {
      return res.status(404).json({ message: "No videos found" });
    }

    // Return the videos in the response
    res.status(200).json(
      new ApiResponse(200, videos, "Videos fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({ message: "Failed to fetch videos", error: error.message });
  }
});






const addVideo = asyncHandler(async (req, res) => {
  const { videoUrl } = req.body;
  const userId = req.user._id;
  const apiUrl = config.externalEndpoints.url1;

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
      if (process.env.NODE_ENV === "development") {
        await video.fetchVideoDetails();
        const durationInSeconds = parseInt(video.duration, 10);
        if (durationInSeconds > 20) { // Fixed: Changed from 200 to 1200 seconds (20 minutes)
          return res.status(409).json(
            new ApiResponse(409, {}, "Video duration exceeds the predefined limit")
          );
        }
      }
    } catch (error) {
      console.error("❌ Error fetching video details or duration exceeded:", error.message);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json(
          new ApiResponse(error.statusCode, null, error.message)
        );
      }

      // Set default values if fetching fails
      video.thumbnailUrl = "https://havecamerawilltravel.com/wp-content/uploads/2020/01/youtube-thumbnails-size-header-1-800x450.png";
      video.title = "Title Unavailable";
      video.duration = "Unknown";
    }

    await video.save();
  } else if (video.requestSent) {
    // If request is already sent, return immediately
    const user = await User.findById(userId).populate("watchHistory");

    if (!user) throw new ApiError(404, "User not found");
    const alreadyInHistory = user.watchHistory.some(v => v.videoUrl === videoUrl);

    if (!alreadyInHistory) {
      user.watchHistory.push(video._id);
      await user.save();
    }
    return res.status(200).json(
      new ApiResponse(200, video, "Video already in database")
    );
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

  if (!video.requestSent && apiUrl) {
    try {
      // Determine the appropriate server URL based on environment
      const serverUrl = process.env.NODE_ENV === "development"
        ? config.ngrokUrl
        : process.env.RENDER_EXTERNAL_URL;

      const response = await axios.post(apiUrl, {
        videoId: video._id,
        videoUrl: videoUrl,
        serverUrl: serverUrl
      });

      if (response.data && response.data.id) {
        const { id, videoInfo } = response.data;
        const { title, thumbnail, duration, video_url } = videoInfo;

        // Validate required fields
        if (!id) {
          return res.status(400).json(
            new ApiResponse(400, null, "Video ID is required")
          );
        }

        // Helper function to format duration
        const formatDuration = (durationInSeconds) => {
          const minutes = Math.floor(durationInSeconds / 60);
          const seconds = durationInSeconds % 60;
          return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        };

        try {
          // Find or update video
          let videoToUpdate = await Video.findById(id);
          
          if (!videoToUpdate) {
            videoToUpdate = new Video({
              _id: id,
              videoUrl: video_url || "https://www.youtube.com/watch?v=default",
              title: title || "Untitled Video",
              thumbnailUrl: thumbnail || "https://i.ytimg.com/vi/default/hqdefault.jpg",
              duration: formatDuration(duration || 0),
            });
          } else {
            videoToUpdate.title = title || videoToUpdate.title;
            videoToUpdate.thumbnailUrl = thumbnail || videoToUpdate.thumbnailUrl;
            videoToUpdate.duration = formatDuration(duration || videoToUpdate.duration);
            videoToUpdate.videoUrl = video_url || videoToUpdate.videoUrl;
          }

          videoToUpdate.requestSent = true;
          await videoToUpdate.save();

          return res.status(201).json(
            new ApiResponse(201, videoToUpdate, "Saved successfully")
          );
        } catch (error) {
          video.requestSent = false;
          await video.save();
          console.error("Error during video save:", error);
          throw new ApiError(500, "Failed to save video details");
        }
      } else {
        console.warn("⚠️ External API did not return a valid response.");
        video.requestSent = false;
        await video.save();
        throw new ApiError(502, "External API returned invalid response");
      }
    } catch (error) {
      video.requestSent = false;
      await video.save();

      if (error.response?.status === 409) {
        return res.status(409).json(
          new ApiResponse(409, {}, "Video duration exceeds the predefined limit")
        );
      }

      console.error("❌ Error sending request:", error.message);
      throw new ApiError(503, "External service unavailable");
    }
  }

  // If we get here and video.requestSent is true but no API call was made
  return res.status(200).json(
    new ApiResponse(200, video, "Video processing initiated")
  );
});


const getTranscript = asyncHandler(async (req, res) => {
  const videoId = req.query.videoId || req.body.videoId || req.params?.videoId;

  if (!videoId) {
    throw new ApiError(400, "Video ID is required.");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found.");
  }

  // If transcript is missing and request hasn't been sent, trigger external API call
  if (!video.requestSent) {
    // console.log("No transcript available sending request since  not sent before")
    try {
      const apiUrl = config.externalEndpoints.url1;
      const serverUrl = process.env.NODE_ENV === "development"
        ? config.ngrokUrl
        : process.env.RENDER_EXTERNAL_URL;

      console.log("No transcript available sending request since not sent before")

      const response = await axios.post(apiUrl, {
        videoId: video._id,
        videoUrl: video.videoUrl,
        serverUrl: serverUrl,
      });

      video.requestSent = true;
      await video.save();

      console.log("✅ External request sent from getTranscript");
    } catch (err) {
      console.error("❌ Error sending request from getTranscript:", err.message);
      // Not throwing error so the frontend still gets something back
    }
  }

  const transcript = video.transcript || {};

  return res.status(200).json(
    new ApiResponse(200, { transcript }, "Transcript fetched successfully")
  );
});




const getVideoDetails = asyncHandler(async (req, res) => {
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
    const title = video.title || {};
    const duration = video.duration || {}
  
    return res.status(200).json(
      new ApiResponse(200, { 
        title,
        duration }, "Transcript fetched successfully")
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
    const userId = req.user._id;

    if (!videoId) {
      return res.status(400).json({ message: "Video ID is required." });
    }

    // Check if the user has already taken the quiz for this video
    const existingScore = await Score.findOne({ user: userId, video: videoId });

    if (existingScore) {
      return res.status(269).json({
        message: "You have already taken this quiz.",
        status: 269,
        scoreIsEvaluated: existingScore.scoreIsEvaluated, // Optionally return the user's score
      });
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
      videoId,
    });
  } catch (error) {
    console.error("Error fetching QnAs:", error.message);
    return res.status(500).json({ message: "Failed to fetch QnAs", error: error.message });
  }
});



const storeAssessment = asyncHandler(async (req, res) => {
  try {
    const videoId = req.body.videoId || req.params.videoId || req.query.videoId;
    const userId = req.user?._id || req.body.userId || req.params.userId || req.query.userId;
    const quiz = req.body.quiz;

    // console.log("Inside store assessment:", quiz);

    if (!quiz) return res.status(400).json({ message: "Quiz data is required." });
    if (!videoId) return res.status(400).json({ message: "Video ID is required." });
    if (!userId) return res.status(400).json({ message: "User ID is required." });

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: "Video not found." });

    // Initialize scores and arrays
    let mcqScore = 0;
    let mcqAnswers = []; // Default value for MCQs
    let fillInTheBlanksScore = 0;
    let fillInTheBlanks = []; // Default value for fill-in-the-blanks

    // Process MCQs if provided
    if (quiz.mcqAnswers && quiz.mcqAnswers.length > 0) {
      mcqAnswers = quiz.mcqAnswers.map(mcq => {
        const isCorrect = mcq.selectedOption === mcq.correctAnswer;
        if (isCorrect) mcqScore += 1;
        return {
          question: mcq.question,
          selectedOption: mcq.selectedOption,
          correctOption: mcq.correctAnswer || "Not provided",
          isCorrect,
          score: isCorrect ? 1 : 0,
        };
      });
    }

    // Process short answers (always required)
    const shortAnswers = quiz.shortAnswers?.map(answer => ({
      question: answer.question,
      givenAnswer: answer.givenAnswer,
      correctAnswer: answer.correctAnswer || "Not provided",
      score: 0,
      scoreIsEvaluated: false, // Mark for later evaluation
    })) || [];

    // Process fill-in-the-blanks if provided
    if (quiz.fillInTheBlanks && quiz.fillInTheBlanks.length > 0) {
      const normalizeAnswer = (answer) => {
        if (!answer) return "";
        return String(answer)
          .toLowerCase()
          .trim()
          .replace(/\s+/g, " ") // Replace multiple spaces with a single space
          .replace(/[^\w\s]/g, ""); // Remove punctuation
      };

      fillInTheBlanks = quiz.fillInTheBlanks.map(blank => {
        const isCorrect = normalizeAnswer(blank.givenAnswer) === normalizeAnswer(blank.correctAnswer);
        if (isCorrect) fillInTheBlanksScore += 1;
        return {
          sentence: blank.question,
          givenAnswer: blank.givenAnswer,
          correctAnswer: blank.correctAnswer || "Not provided",
          isCorrect,
          score: isCorrect ? 1 : 0,
        };
      });
    }

    // Calculate total score
    const totalScore = mcqScore + fillInTheBlanksScore;

    // Prepare score data
    const scoreData = {
      user: userId,
      video: videoId,
      shortAnswers,
      mcqs: mcqAnswers,
      fillInTheBlanks,
      overallScore: totalScore,
      scoreIsEvaluated: false,
    };

    // Update or create the score record
    const updatedScore = await Score.findOneAndUpdate(
      { user: userId, video: videoId },
      scoreData,
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(201).json({
      message: "Assessment stored/updated successfully.",
      score: updatedScore,
      status: 201,
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
          aiEvaluation: q.aiEvaluation
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
              userId: user._id,
              videoId: videoId
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






const DeleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  
  // Validate required fields
  // console.log("the request data is:", req.body)
  if (!videoId) {
    return res.status(400).json({ message: "Video ID is required" });
  }

  try {
    // Find the video by ID
    const video = await Video.findById(videoId);

    if (!video) {
      return res.status(404).json({
        message: "Video not found",
      });
    }

    // Delete the video
    await Video.findByIdAndDelete(videoId);

    // Respond to the client
    res.status(200).json({
      message: "Video deleted successfully",
      deletedVideo: video, // Returning the deleted video data (optional)
    });
  } catch (error) {
    console.error("Error Deleting Video:", error.message);

    // Send error response
    res.status(500).json({
      message: "Failed to delete video",
      error: error.message,
    });
  }
});




const DeleteVideos = asyncHandler(async (req, res) => {
  const { videoIds } = req.body;
  
  // Validate required fields
  if (!videoIds || !Array.isArray(videoIds)) {
    return res.status(400).json({ message: "Video IDs array is required" });
  }

  try {
    // Delete the videos
    const result = await Video.deleteMany({ _id: { $in: videoIds } });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "No videos found to delete",
      });
    }

    // Respond to the client
    res.status(200).json({
      message: "Videos deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error Deleting Videos:", error.message);

    // Send error response
    res.status(500).json({
      message: "Failed to delete videos",
      error: error.message,
    });
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
    getScore,
    DeleteVideo,
    getAllVideos,
    DeleteVideos,
    getVideoDetails
}