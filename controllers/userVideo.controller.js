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
  const userId = req.user?._id; // Safely access user ID from authenticated request
  const apiUrl = config.externalEndpoints?.url1; // Safely access API URL

  // --- Basic Input Validation ---
  if (!userId) {
    // This case should ideally be prevented by the auth middleware, but good to double-check
    console.error("❌ AddVideo Error: User ID not found in request. Auth middleware issue?");
    return res.status(401).json(new ApiResponse(401, null, "User authentication failed"));
  }

  if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
    console.warn("⚠️ AddVideo Warning: Invalid or missing video URL provided.");
    // Respond directly with 400 Bad Request
    return res.status(400).json(new ApiResponse(400, null, "Please provide a valid video URL"));
  }

  // --- Video Existence Check and Initial Handling ---
  let video;
  try {
    video = await Video.findOne({ videoUrl });
  } catch (dbError) {
    console.error("❌ AddVideo DB Error: Failed searching for video.", dbError);
    return res.status(500).json(new ApiResponse(500, null, "Database error checking for video"));
  }

  if (!video) {
    // --- Video doesn't exist: Create and Fetch Details ---
    video = new Video({ videoUrl });

    try {
      // Fetch video details only in development for duration check (optional)
      if (process.env.NODE_ENV === "development") {
        await video.fetchVideoDetails(); // Assume this method might throw specific errors
        const durationInSeconds = parseInt(video.duration, 10);
        const MAX_DURATION = 1200; // 20 minutes in seconds

        if (!isNaN(durationInSeconds) && durationInSeconds > MAX_DURATION) {
          console.warn(`⚠️ AddVideo Warning: Video duration (${durationInSeconds}s) exceeds limit (${MAX_DURATION}s).`);
          // Respond directly with 409 Conflict (or 400 Bad Request)
          return res.status(409).json(
            new ApiResponse(409, { videoUrl: video.videoUrl }, "Video duration exceeds the 20-minute limit")
          );
        }
      }
    } catch (fetchError) {
      // Log the error but proceed with defaults if fetching fails
      console.error("⚠️ AddVideo Warning: Error fetching video details, proceeding with defaults.", fetchError.message);
      // Set default values if fetching failed or was skipped
      video.thumbnailUrl = video.thumbnailUrl || "https://havecamerawilltravel.com/wp-content/uploads/2020/01/youtube-thumbnails-size-header-1-800x450.png";
      video.title = video.title || "Title Unavailable";
      video.duration = video.duration || "Unknown";
      // Do not return here, just use defaults and save later
    }

    try {
      await video.save();
      // console.log(`ℹ️ AddVideo Info: New video entry created for URL: ${videoUrl}`);
    } catch (dbError) {
      console.error("❌ AddVideo DB Error: Failed to save new video entry.", dbError);
      return res.status(500).json(new ApiResponse(500, null, "Database error saving new video"));
    }

  } else if (video.requestSent) {
    // --- Video exists and request already sent ---
    // console.log(`ℹ️ AddVideo Info: Request previously sent for video URL: ${videoUrl}`);
    try {
      // Still add to user's watch history if not already there
      const user = await User.findById(userId); // No need to populate here initially
      if (!user) {
        console.error(`❌ AddVideo Error: User ${userId} not found despite being authenticated.`);
        return res.status(404).json(new ApiResponse(404, null, "Authenticated user not found"));
      }
      // Check if video._id is already in watchHistory (more efficient)
      if (!user.watchHistory.includes(video._id)) {
        user.watchHistory.push(video._id);
        await user.save();
        // console.log(`ℹ️ AddVideo Info: Added existing video ${video._id} to user ${userId}'s history.`);
      }
      // Respond directly with 200 OK
      return res.status(200).json(
        new ApiResponse(200, video, "Video processing previously initiated")
      );
    } catch (dbError) {
      console.error("❌ AddVideo DB Error: Failed checking/updating user history for existing video.", dbError);
      // Don't halt processing, but maybe log it. Respond as if successful.
      return res.status(200).json(
        new ApiResponse(200, video, "Video processing previously initiated (history update might have failed)")
      );
    }
  }

  // --- Add to User Watch History (if not already done) ---
  // This section runs if video existed but request wasn't sent OR if it was just created.
  try {
    const user = await User.findById(userId);
    if (!user) {
      // Should have been caught earlier if requestSent was true, but handle defensively
      console.error(`❌ AddVideo Error: User ${userId} not found despite being authenticated.`);
      return res.status(404).json(new ApiResponse(404, null, "Authenticated user not found"));
    }
    if (!user.watchHistory.includes(video._id)) {
      user.watchHistory.push(video._id);
      await user.save();
      // console.log(`ℹ️ AddVideo Info: Added video ${video._id} to user ${userId}'s history.`);
    }
  } catch (dbError) {
    console.error("❌ AddVideo DB Error: Failed adding video to user history.", dbError);
    // Decide if this is critical. Maybe proceed but log the error?
    // Proceeding for now, but might want to return 500 depending on requirements.
  }

  // --- Send Request to External API ---
  if (!video.requestSent && apiUrl) {
    try {
      const serverUrl = process.env.NODE_ENV === "development"
        ? config.ngrokUrl // Ensure ngrokUrl is in config
        : process.env.RENDER_EXTERNAL_URL; // Ensure this is set in production

      if (!serverUrl) {
         console.error("❌ AddVideo Config Error: Server callback URL (ngrok or RENDER_EXTERNAL_URL) is not defined.");
         return res.status(500).json(new ApiResponse(500, null, "Server configuration error: Callback URL missing"));
      }

      // console.log(`ℹ️ AddVideo Info: Sending request to external API (${apiUrl}) for video ${video._id}`);
      const response = await axios.post(apiUrl, {
        videoId: video._id.toString(), // Ensure ID is sent as string if needed
        videoUrl: video.videoUrl,
        serverUrl: serverUrl
      }, { timeout: 10000 }); // Add a timeout

      // --- Process External API Response ---
      if (response.data && response.data.id && response.data.videoInfo) {
        const { id, videoInfo } = response.data;
        const { title, thumbnail, duration, video_url } = videoInfo;

        // Helper function to format duration
        const formatDuration = (seconds) => {
            if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return "00:00";
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        };

        try {
          // Update the video document with details from the external API
          // Note: Using findByIdAndUpdate is often more concise
          const updatedVideo = await Video.findByIdAndUpdate(
            video._id, // Use the ID of the video we've been working with
            {
              title: title || video.title, // Keep existing if new is null/undefined
              thumbnailUrl: thumbnail || video.thumbnailUrl,
              duration: formatDuration(duration) || video.duration,
              // videoUrl: video_url || video.videoUrl, // Usually don't update the original URL
              requestSent: true // Mark request as successfully sent
            },
            { new: true } // Return the updated document
          );

          if (!updatedVideo) {
             // This would be unusual if we just found/created it
             console.error(`❌ AddVideo DB Error: Failed to find video ${video._id} for update after API call.`);
             return res.status(404).json(new ApiResponse(404, null, "Video not found during update"));
          }

          console.log(`✅ AddVideo Success: Request sent and video ${updatedVideo._id} marked.`);
          // Respond directly with 201 Created (or 200 OK if preferred)
          return res.status(201).json(
            new ApiResponse(201, updatedVideo, "Video processing initiated successfully")
          );

        } catch (dbError) {
          console.error("❌ AddVideo DB Error: Failed to update video after successful API call.", dbError);
          // Don't reset requestSent, as the external API *did* process it. The failure is internal.
          return res.status(500).json(
            new ApiResponse(500, null, "Failed to update video details in database after successful external processing.")
          );
        }
      } else {
        // --- External API returned invalid data ---
        console.warn("⚠️ AddVideo Warning: External API did not return a valid response structure or required 'id'.", response.data);
        // Don't mark requestSent as true
        return res.status(502).json(
          new ApiResponse(502, null, "External API returned an invalid or incomplete response")
        );
      }
    } catch (error) {
      // --- Error during Axios request ---
      // Reset requestSent flag as the call failed
      try {
        video.requestSent = false;
        await video.save();
      } catch (saveError) {
         console.error("❌ AddVideo DB Error: Failed to reset requestSent flag after API call error.", saveError);
         // Continue to report the original API error
      }

      if (error.response) {
        // The request was made and the server responded with a status code outside 2xx
        console.error(`❌ AddVideo API Error: External API responded with status ${error.response.status}`, error.response.data);
        const statusCode = error.response.status;
        let message = `External service error (Status ${statusCode})`;
        if (statusCode === 409) {
            message = "Video duration may exceed the limit set by the external service";
        } else if (error.response.data?.message) {
            message = error.response.data.message; // Use message from external API if available
        }
        return res.status(statusCode).json(new ApiResponse(statusCode, null, message));

      } else if (error.request) {
        // The request was made but no response was received (e.g., timeout, network error)
        console.error("❌ AddVideo Network Error: No response received from external API.", error.message);
        return res.status(504).json(new ApiResponse(504, null, "External service timed out or is unreachable"));
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("❌ AddVideo Client Error: Error setting up request to external API.", error.message);
        return res.status(500).json(new ApiResponse(500, null, "Internal error preparing request for external service"));
      }
    }
  } else if (video.requestSent) {
     // This case should ideally be caught by the 'else if (video.requestSent)' block earlier.
     // If we reach here, it implies apiUrl was not provided but request was marked sent.
    //  console.log(`ℹ️ AddVideo Info: Video ${video._id} already marked as requestSent, no external API URL configured or needed.`);
     return res.status(200).json(
         new ApiResponse(200, video, "Video processing previously initiated or external API skipped")
     );
  } else {
      // Case: !video.requestSent AND !apiUrl (External API not configured)
      console.warn("⚠️ AddVideo Warning: External API URL not configured. Cannot send processing request.");
      return res.status(501).json(
          new ApiResponse(501, video, "External processing service is not configured")
      );
  }

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