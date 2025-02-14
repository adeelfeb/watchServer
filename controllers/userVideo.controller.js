import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import axios from 'axios'; // Importing axios
import config from "../src/conf.js";
import { Score } from "../models/score.model.js";



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

  console.log("Adding video or checking...");

  if (!videoUrl) {
      throw new ApiError(400, "Please provide a valid video URL");
  }

  // Check if video exists in DB
  let video = await Video.findOne({ videoUrl });

  if (!video) {
      // Video doesn't exist → Create a new entry
      video = new Video({ videoUrl });

      // Fetch video details & save
      await video.fetchVideoDetails();
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
                  ? config.ngrokUrl         // Use ngrok in development
                  : process.env.RENDER_EXTERNAL_URL; // Use hosting URL in production

              const response = await axios.post(apiUrl, {
                  videoId: video._id,
                  videoUrl: videoUrl,
                  serverUrl: serverUrl  // Dynamically set server URL
              });

              if (response.data) {
                  console.log("✅ Request successful. Marking as sent.");
                  video.requestSent = true;
              } else {
                  console.warn("⚠️ External API did not return a valid response.");
                  video.requestSent = false; // Allow retry
              }
          } catch (error) {
              console.error("❌ Error sending request. API might be down.");
              video.requestSent = false; // Allow retry
          }

          await video.save();
      }
  });
});

// const addVideo = asyncHandler(async (req, res) => {
//   const { videoUrl } = req.body;
//   const userId = req.user._id; 
//   const apiUrl =  config.externalEndpoints.url2;
//   console.log("adding video or checknig")
//   if (!videoUrl) {
//       throw new ApiError(400, "Please provide a valid video URL");
//   }

//   // Check if video exists in DB
//   let video = await Video.findOne({ videoUrl });

//   if (!video) {
//       // Video doesn't exist → Create a new entry
//       video = new Video({ videoUrl });

//       // Fetch video details & save
//       await video.fetchVideoDetails();
//       await video.save();
//   } else if (video.requestSent) {
//       // If request is already sent, return immediately
//       return res.status(200).json(new ApiResponse(200, video, "Video already in database"));
//   }

//   // Fetch user & ensure they exist
//   const user = await User.findById(userId).populate("watchHistory");
//   if (!user) throw new ApiError(404, "User not found");

//   // Check if video is in watch history
//   const alreadyInHistory = user.watchHistory.some(v => v.videoUrl === videoUrl);

//   if (!alreadyInHistory) {
//       user.watchHistory.push(video._id);
//       await user.save();
//   }
//   if(alreadyInHistory){
//     console.log("Video in history")
//   }
//   // ✅ Send response to frontend **before making API request**
//   res.status(201).json(
//       new ApiResponse(
//           201,
//           video,
//           alreadyInHistory ? "Video already in watch history" : "Video added successfully and included in watch history"
//       )
//   );

//   // ✅ Send request to external API **after response**
//   if (!video.requestSent && apiUrl) {
//     try {
//         console.log("🔄 Sending video data to external API...", apiUrl);

//         // Determine the appropriate server URL based on environment
//         const serverUrl = process.env.NODE_ENV === "development" 
//             ? config.ngrokUrl         // Use ngrok in development
//             : process.env.RENDER_HOST_URL ; // Use hosting URL in production

//         const response = await axios.post(apiUrl, {
//             videoId: video._id,
//             videoUrl: videoUrl,
//             serverUrl: serverUrl  // Dynamically set server URL
//         });

//         if (response.data) {
//             console.log("✅ Request successful. Marking as sent.");
//             video.requestSent = true;
//         } else {
//             console.warn("⚠️ External API did not return a valid response.");
//             video.requestSent = false; // Allow retry
//         }
//     } catch (error) {
//         console.error("❌ Error sending request. API might be down.");
//         video.requestSent = false; // Allow retry
//     }

//     await video.save();
// }

// });



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
      new ApiResponse(200, { summary: summary }, "Summary fetched successfully")
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
      });
  } catch (error) {
      console.error("Error fetching QnAs:", error.message);
      return res.status(500).json({ message: "Failed to fetch QnAs", error: error.message });
  }
});




const storeAssessment = asyncHandler(async (req, res) => {
    try {
        const videoId = req.query.videoId || req.body.videoId || req.params.videoId;
        const userId = req.query.userId || req.body.userId || req.params.userId;
        const submission = req.body.submission;

        if (!videoId || !userId || !submission) {
            return res.status(400).json({ message: "Video ID, User ID, and submission data are required." });
        }

        // Find video
        const video = await Video.findById(videoId);
        if (!video) {
            return res.status(404).json({ message: "Video not found." });
        }

        // Construct score document
        const scoreData = {
            user: userId,
            video: videoId,
            shortAnswers: submission.shortAnswers || [],
            mcqs: submission.mcqs || [],
            score: submission.score || 0, // Default to 0 if not provided
        };

        // Save the score data
        const newScore = new Score(scoreData);
        await newScore.save();

        return res.status(201).json({
            message: "Assessment stored successfully",
            score: newScore,
        });
    } catch (error) {
        console.error("Error storing assessment:", error.message);
        return res.status(500).json({ message: "Failed to store assessment", error: error.message });
    }
});




export{
    getWatchHistory,
    addVideo,
    getTranscript,
    getSummary,
    getQnas,
    keyconcept,
    storeAssessment
}