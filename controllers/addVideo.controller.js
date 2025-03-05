import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { parseAndStoreInPinecone } from "./pineConeVectorSaving.controller.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Score } from "../models/score.model.js";



const DeleteVideo = asyncHandler(async (req, res) => {
    const { id } = req.body;
  
    // Validate required fields
    if (!id) {
      return res.status(400).json({ message: "Video ID is required" });
    }
  
    try {
      // Find the video by ID
      const video = await Video.findById(id);
  
      if (!video) {
        return res.status(404).json({
          message: "Video not found",
        });
      }
  
      // Delete the video
      await Video.findByIdAndDelete(id);
  
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


  const addVideoDetails = asyncHandler(async (req, res) => {
    const { id, VideoDetail } = req.body; // Destructure id and videoDetail from the request body
    const { title, thumbnail, duration, video_url } = VideoDetail; // Destructure video details
  
    // console.log("The video details are:", VideoDetail);
  
    // Validate required fields
    if (!id) {
      return res.status(400).json({ message: "Video ID is required" });
    }
  
    // Helper function to convert duration (in seconds) to "mm:ss" format
    const formatDuration = (durationInSeconds) => {
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = durationInSeconds % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };
  
    try {
      let video = await Video.findById(id);
  
      // If the video doesn't exist, create a new one
      if (!video) {
        video = new Video({
          _id: id, // Use the provided ID
          videoUrl: video_url || "https://www.youtube.com/watch?v=default", // Use the provided video URL or a default
          title: title || "Untitled Video", // Use the provided title or a default
          thumbnailUrl: thumbnail || "https://i.ytimg.com/vi/default/hqdefault.jpg", // Use the provided thumbnail or a default
          duration: formatDuration(duration || 0), // Format the duration
        });
      } else {
        // Update existing video details if provided
        video.title = title || video.title;
        video.thumbnailUrl = thumbnail || video.thumbnailUrl;
        video.duration = formatDuration(duration || video.duration); // Format the duration
        video.videoUrl = video_url || video.videoUrl;
      }
  
      // Save the video to the database
      await video.save();
  
      // Respond to the client
      res.status(200).json({
        message: "Video details updated successfully",
        video,
      });
    } catch (error) {
      console.error("Error updating video details:", error.message);
  
      // Send error response
      res.status(500).json({
        message: "Failed to update video details",
        error: error.message,
      });
    }
  });

  

const addTranscript = asyncHandler(async (req, res) => {
    const { id, english, original } = req.body;
  // console.log("inside the transcript:", req.body)
    try {
        const video = await Video.findById(id);

        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }

        if (!video.transcript) {
            video.transcript = {};
        }

        // Save the original transcript to the database
        if (original && Array.isArray(original)) {
            video.transcript.original = original
                .filter(item => Array.isArray(item.timestamp) && item.text)
                .map(item => ({
                    timestamp: item.timestamp,
                    text: item.text,
                }));
        }

        // Save the English transcript to the database
        if (english && Array.isArray(english)) {
            video.transcript.english = english
                .filter(item => Array.isArray(item.timestamp) && item.text)
                .map(item => ({
                    timestamp: item.timestamp,
                    text: item.text,
                }));
        }

        await video.save();
        // console.log("Transcript saved to database.");

        // Respond to the client before running async tasks
        res.status(200).json({
            message: "Transcript updated successfully",
        });

        // Only vectorize the English transcript (skip the original transcript)
        if (!video.transcript.english || video.transcript.english.length === 0) {
            // console.log(`No English transcript for video ID ${id}, skipping vectorization.`);
            return;
        }

        const fullTranscript = video.transcript.english.map(item => item.text).join(" ");

        // Run vectorization in the background using only the English transcript
        parseAndStoreInPinecone(fullTranscript, id)
            .then(() => {
                // console.log(`Transcript for video ID ${id} successfully vectorized and stored in Pinecone.`);
            })
            .catch((error) => {
                console.error(`Error vectorizing transcript for video ID ${id}:`, error.message);
            });

    } catch (error) {
        console.error("Error updating transcript:", error.message);

        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to update transcript", error: error.message });
        }
    }
});



const addSummary = asyncHandler(async (req, res) => {
    const { id, original, english, Summary_eng } = req.body; 
    // console.log("Received Summary:", Summary_eng); 

    try {
        // Find the video by ID
        const video = await Video.findById(id);

        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }

        // Ensure summary field exists
        if (!video.summary) {
            video.summary = { english: '', original: '' };
        }

        // Only update if values exist
        if (Summary_eng) video.summary.english = Summary_eng; // Update english summary
        if (original) video.summary.original = original; // Update original summary
        if (english && !Summary_eng) video.summary.english = english; 


        // Save the updated video
        await video.save();
        // console.log("Done With Summary")


        res.status(200).json({
            message: "Summary updated successfully"
        });
    } catch (error) {
        console.error("Error updating summary:", error); // Log the error for debugging
        res.status(500).json({ message: "Failed to update summary", error: error.message });
    }
});


const addKeyconcept = asyncHandler(async (req, res) => {
    const { id, concept } = req.body;
    // console.log("Received Keyconcept:", req.body);
  
    try {
      // Find the video by ID
      const video = await Video.findById(id);
  
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
  
      if (concept.keyconcept.primary) {
        // Directly store the full concept text as primary for Markdown rendering
        video.keyconcept.primary = concept.keyconcept.primary.trim();
      }
      else{
        video.keyconcept.primary = concept.trim()
      }
  
      // Save the updated video
      await video.save();
      // console.log("done key-concepts")
      res.status(200).json({
        message: "Keyconcept updated successfully",
        keyconcept: video.keyconcept,
      });
    } catch (error) {
      console.error("Error updating keyconcept:", error);
      res.status(500).json({
        message: "Failed to update keyconcept",
        error: error.message,
      });
    }
  });
  

  


const addAssesment = asyncHandler(async (req, res) => {
  const { id, description } = req.body; // Assuming you're only sending primary and description

  try {
      // Find the video by ID
      const video = await Video.findById(id);

      if (!video) {
          return res.status(404).json({ message: "Video not found" });
      }

      
      

      // Update the primary and description fields in the keyconcept type
     
      if (description) {
        // console.log("the keyconcept send was like this:", description)
        video.description = description;
      }

      // Save the updated video
      await video.save();

      res.status(200).json({
          message: "Keyconcept updated successfully",
          keyconcept: video.description, // Include updated keyconcept in response
      });
  } catch (error) {
      console.error("Error updating keyconcept:", error); // Log error for debugging
      res.status(500).json({
          message: "Failed to update keyconcept",
          error: error.message,
      });
  }
});




const addQnas = asyncHandler(async (req, res) => {
    const { id, Questions, mcqs } = req.body; // Extract video ID and Q&A fields
    // console.log("the data revieved:", req.body)
    try {
        // Find the video by ID
        const video = await Video.findById(id);

        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }

        // Ensure `video.qnas` exists
        if (!video.qnas) {
            video.qnas = { shortQuestions: [], mcqs: [] };
        }

        // **Fix: Properly Parse `Questions` JSON String**
        let parsedQuestions = [];
        try {
            parsedQuestions = JSON.parse(Questions); // Directly parse without wrapping in []
        } catch (error) {
            console.error("Error parsing Questions:", error.message);
            return res.status(400).json({ message: "Invalid Questions format" });
        }

        // Validate and add short questions if provided
        console.log("Before adding QnAs");
        if (parsedQuestions && Array.isArray(parsedQuestions)) {
            parsedQuestions.forEach(({ question, answer }) => {
                console.log("Question:", question, "Answer:", answer);
                if (question) {
                    video.qnas.shortQuestions.push({ question, answer: answer || "" }); // Save answer if exists, else empty
                }
            });
        }

        // Validate and add MCQs if provided
        if (mcqs && Array.isArray(mcqs)) {
            mcqs.forEach(({ question, options, correctAnswer }) => {
                if (question && options && correctAnswer && Array.isArray(options)) {
                    video.qnas.mcqs.push({ question, options, correctAnswer });
                }
            });
        }

        // Save the updated video
        await video.save();
        console.log("done QNA")
        res.status(200).json({
            message: "Q&A updated successfully",
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to update Q&A", error: error.message });
    }
});


const addFormatedQnas = asyncHandler(async (req, res) => {
  const { id, formattedQuizData } = req.body; // Extract video ID and formatted quiz data

  try {
      // Find the video by ID
      const video = await Video.findById(id);

      if (!video) {
          return res.status(404).json({ message: "Video not found" });
      }

      // Ensure `video.qnas` exists
      if (!video.qnas) {
          video.qnas = { shortAnswers: [], mcqs: [], fillInTheBlanks: [] };
      }

      // Clear existing Q&A data (optional, depending on your use case)
      video.qnas.shortAnswers = [];
      video.qnas.mcqs = [];
      video.qnas.fillInTheBlanks = [];

      // Add formatted quiz data to the video
      
      if (formattedQuizData.qnas) {
          const { shortQuestions, mcqs, fillInTheBlanks } = formattedQuizData.qnas;

          // Add short questions
          if (shortQuestions && shortQuestions.length > 0) {
              video.qnas.shortQuestions = shortQuestions.map((q) => ({
                  question: q.question,
                  correctAnswer: q.answer || "Not provided", // Use default if answer is missing
              }));
          }

          // Add MCQs
          if (mcqs && mcqs.length > 0) {
              video.qnas.mcqs = mcqs.map((q) => ({
                  question: q.question,
                  correctOption: q.correctAnswer || "Not provided", // Use default if correctAnswer is missing
                  options: q.options || ["Not provided"], // Use default if options are missing
              }));
          }

          // Add fill-in-the-blanks
          if (fillInTheBlanks && fillInTheBlanks.length > 0) {
              video.qnas.fillInTheBlanks = fillInTheBlanks.map((q) => ({
                  sentence: q.sentence,
                  correctAnswer: q.missingWord || "Not provided", // Use default if missingWord is missing
              }));
          }
      }

      // Save the updated video
      await video.save();

      res.status(200).json({
          message: "Q&A updated successfully",
          data: video.qnas, // Optionally return the updated Q&A data
      });
  } catch (error) {
      res.status(500).json({ message: "Failed to update Q&A", error: error.message });
  }
});


const setScore = asyncHandler(async (req, res) => {
  try {
    const { userId, videoId, evaluation } = req.body;

    // Validate required fields
    if (!userId || !videoId || !evaluation) {
      throw new ApiError(400, "Missing required fields: userId, videoId, or evaluation.");
    }

    // Process the evaluation array
    const shortAnswers = [];
    const mcqs = [];
    const fillInTheBlanks = [];
    let overallScore = 0;

    evaluation.forEach((item) => {
      if (item.type === "shortAnswer") {
        shortAnswers.push({
          question: item.question,
          givenAnswer: item.userAnswer,
          correctAnswer: item.correctAnswer,
          score: item.score || 0, // Default to 0 if score is not provided
          aiEvaluation: item.evaluation, 
        });
        overallScore += item.score || 0; // Add to overall score
      } else if (item.type === "mcq") {
        mcqs.push({
          question: item.question,
          selectedOption: item.userAnswer,
          correctOption: item.correctAnswer,
          isCorrect: item.isCorrect,
          score: item.score, // 1 if correct, 0 otherwise
        });
        overallScore += item.isCorrect ? 1 : 0; // Add to overall score
      } else if (item.type === "fillInTheBlank") {
        fillInTheBlanks.push({
          sentence: item.question,
          givenAnswer: item.userAnswer,
          correctAnswer: item.correctAnswer,
          isCorrect: item.isCorrect,
          score: item.score, // 1 if correct, 0 otherwise
        });
        overallScore += item.isCorrect ? 1 : 0; // Add to overall score
      }
    });

    // Find or create the score document
    let scoreDocument = await Score.findOne({ user: userId, video: videoId });

    if (!scoreDocument) {
      // Create a new score document if it doesn't exist
      scoreDocument = new Score({
        user: userId,
        video: videoId,
        shortAnswers,
        mcqs,
        fillInTheBlanks,
        overallScore,
        scoreIsEvaluated: true, // Mark evaluation as complete
      });
    } else {
      // Update the existing score document
      scoreDocument.shortAnswers = shortAnswers;
      scoreDocument.mcqs = mcqs;
      scoreDocument.fillInTheBlanks = fillInTheBlanks;
      scoreDocument.overallScore = overallScore;
      scoreDocument.scoreIsEvaluated = true; // Mark evaluation as complete
    }

    // Save the score document
    await scoreDocument.save();

    res.status(200).json(
      new ApiResponse(200, scoreDocument, "Score evaluation has been stored successfully.")
    );
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Failed to store score evaluation", error: error.message });
    }
  }
});

export {
    addTranscript,
    addFormatedQnas,
    addSummary,
    addQnas,
    addKeyconcept,
    addAssesment, 
    addVideoDetails,
    DeleteVideo,
    setScore
 };
 