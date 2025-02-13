import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";



const addVideo = asyncHandler(async (req, res) => {
    const videoUrl = req.body.videoUrl;
    const userId = req.user._id; // Assuming `req.user` is populated by a middleware like `verifyJWT`

    if (!videoUrl) {
        throw new ApiError(400, "Please provide a valid video URL");
    }

    // Check if the video exists in the database
    let video = await Video.findOne({ videoUrl });

    if (!video) {
        // Video doesn't exist, create a new video entry
        video = new Video({ videoUrl });

        // Fetch video details (from YouTube or another source)
        await video.fetchVideoDetails();

        // Validate video duration
        const [minutes, seconds] = video.duration.split(":").map(Number);
        if (minutes > 20 || (minutes === 20 && seconds > 0)) {
            throw new ApiError(400, "Input duration should be less than 20 minutes");
        }

        // Save the new video to the database
        await video.save();
    }

    // Fetch the user from the database
    const user = await User.findById(userId).populate("watchHistory");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Check if the video is already in the user's watch history
    const alreadyInHistory = user.watchHistory.some(
        (historyItem) => historyItem.videoUrl === videoUrl
    );

    if (alreadyInHistory) {
        return res.status(200).json(
            new ApiResponse(
                201,
                video,
                "Video already in watch history"
            )
        );
    }

    // Add the video to the user's watch history
    user.watchHistory.push(video._id);
    await user.save();

    res.status(201).json(
        new ApiResponse(
            201,
            video,
            "Video added successfully and included in watch history"
        )
    );
});


// const addTranscript = asyncHandler(async (req, res) => {
//     const { id, english, original } = req.body; // Extract ID and possible transcript fields from the request body
//     console.log("Received request body:", req.body );
  
//     try {
//       // Find the video by ID
//     //   console.log("The video ID is:", id);
//       const video = await Video.findById(id);
  
//       if (!video) {
//         return res.status(404).json({ message: "Video not found" });
//       }
  
//       // Validate and update the transcript fields
//       if (english && Array.isArray(english)) {
//         video.transcript.english = english.map((item) => {
//           if (Array.isArray(item.timestamp) && item.text) {
//             return {
//               timestamp: item.timestamp, // Expecting an array
//               text: item.text,
//             };
//           }
//           throw new Error("Invalid format for 'english' transcript: Each item must have an array 'timestamp' and a 'text' field");
//         });
//       }
  
//       if (original && Array.isArray(original)) {
//         video.transcript.original = original.map((item) => {
//           if (Array.isArray(item.timestamp) && item.text) {
//             return {
//               timestamp: item.timestamp, // Expecting an array
//               text: item.text,
//             };
//           }
//           throw new Error("Invalid format for 'original' transcript: Each item must have an array 'timestamp' and a 'text' field");
//         });
//       }
  
//       // Save the updated video
//       await video.save();
  
//       res.status(200).json({
//         message: "Transcript updated successfully",
//       });
//     } catch (error) {
//       console.error("Error updating transcript:", error.message);
//       res.status(500).json({ message: "Failed to update transcript", error: error.message });
//     }
//   });


// const addTranscript = asyncHandler(async (req, res) => {
//     const { id, english, original } = req.body; // Extract ID and transcript fields
//     // console.log("Received request body:", req.body);
  
//     try {
//         // Find the video by ID
//         const video = await Video.findById(id);
  
//         if (!video) {
//             return res.status(404).json({ message: "Video not found" });
//         }

//         // Ensure video.transcript exists
//         if (!video.transcript) {
//             video.transcript = {}; // Initialize transcript object if undefined
//         }

//         // Validate and update the 'english' transcript field
//         if (english && Array.isArray(english)) {
//             video.transcript.english = english
//                 .filter(item => Array.isArray(item.timestamp) && item.text) // Ensure valid format
//                 .map(item => ({
//                     timestamp: item.timestamp,
//                     text: item.text,
//                 }));
//         }

//         // Validate and update the 'original' transcript field
//         if (original && Array.isArray(original)) {
//             video.transcript.original = original
//                 .filter(item => Array.isArray(item.timestamp) && item.text) // Ensure valid format
//                 .map(item => ({
//                     timestamp: item.timestamp,
//                     text: item.text,
//                 }));
//         }

//         // Save the updated video document
//         await video.save();
//         console.log("done transcript")
//         res.status(200).json({
//             message: "Transcript updated successfully",
//         });
//     } catch (error) {
//         console.error("Error updating transcript:", error.message);
//         res.status(500).json({ message: "Failed to update transcript", error: error.message });
//     }
// });



const addTranscript = asyncHandler(async (req, res) => {
    const { id, english, original } = req.body; // Extract ID and transcript fields

    try {
        // Find the video by ID
        const video = await Video.findById(id);

        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }

        // Ensure video.transcript exists
        if (!video.transcript) {
            video.transcript = {}; // Initialize transcript object if undefined
        }

        // Validate and update only the 'english' transcript field
        if (english && Array.isArray(english)) {
            video.transcript.english = english
                .filter(item => Array.isArray(item.timestamp) && item.text) // Ensure valid format
                .map(item => ({
                    timestamp: item.timestamp,
                    text: item.text,
                }));
        }

        // Save the updated video document
        await video.save();
        console.log("Transcript saved to database.");

        // Respond to the client immediately
        res.status(200).json({
            message: "Transcript updated successfully",
        });

        // If there's no English transcript, do not vectorize
        if (!video.transcript.english || video.transcript.english.length === 0) {
            console.log(`No English transcript for video ID ${id}, skipping vectorization.`);
            return;
        }

        // Extract the full English transcript text for vectorization
        const fullTranscript = video.transcript.english
            .map(item => item.text)
            .join(" ");

        // Call the vectorization function in the background
        parseAndStoreInPinecone(fullTranscript, id, req.user._id)
            .then(() => {
                console.log(`Transcript for video ID ${id} successfully vectorized and stored in Pinecone.`);
            })
            .catch((error) => {
                console.error(`Error vectorizing transcript for video ID ${id}:`, error.message);
            });

    } catch (error) {
        console.error("Error updating transcript:", error.message);
        res.status(500).json({ message: "Failed to update transcript", error: error.message });
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
        console.log("Done With Summary")


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
  
      if (concept) {
        // Directly store the full concept text as primary for Markdown rendering
        video.keyconcept.primary = concept.trim();
      }
  
      // Save the updated video
      await video.save();
      console.log("done key-concepts")
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
  

// const addKeyconcept = asyncHandler(async (req, res) => {
//     const { id, concept } = req.body;
//     console.log("Received Keyconcept:", req.body);
  
//     try {
//       // Find the video by ID
//       const video = await Video.findById(id);
  
//       if (!video) {
//         return res.status(404).json({ message: "Video not found" });
//       }
  
//       if (concept) {
//         // Store the full text under `primary`
//         video.keyconcept.primary = concept;
  
//         // Regex to extract each concept from the text
//         const conceptMatches = concept.match(/Concept\s*#\d+:\s*([\s\S]*?)(?=\nConcept\s*#\d+:|\nConclusion:|$)/g);
  
//         if (conceptMatches) {
//           video.keyconcept.secondary = conceptMatches.map((text) => {
//             // Extract the first line as the title (question) and the rest as the answer
//             const lines = text.trim().split("\n").filter(Boolean);
//             const question = lines[0].trim();
//             const answer = lines.slice(1).join(" ").trim();
//             return { question, answer: [answer] };
//           });
//         }
//       }
  
//       // Save the updated video
//       await video.save();
  
//       res.status(200).json({
//         message: "Keyconcept updated successfully",
//         keyconcept: video.keyconcept,
//       });
//     } catch (error) {
//       console.error("Error updating keyconcept:", error);
//       res.status(500).json({
//         message: "Failed to update keyconcept",
//         error: error.message,
//       });
//     }
//   });
  





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



// const addQnas = asyncHandler(async (req, res) => {
//     const { id, Questions, mcqs } = req.body;
  
//     if (!id) {
//         return res.status(400).json({ message: "Video ID is required." });
//     }
  
//     console.log("Incoming Q&A data:", req.body);
  
//     try {
//         // Find video
//         const video = await Video.findById(id);
//         if (!video) {
//             return res.status(404).json({ message: "Video not found." });
//         }
  
//         // Ensure `qnas` object exists
//         if (!video.qnas) {
//             video.qnas = { shortQuestions: [], mcqs: [] };
//         }
  
//         // Parse `Questions` safely
//         let parsedQuestions = [];
//         try {
//             parsedQuestions = JSON.parse(Questions);
//             if (!Array.isArray(parsedQuestions)) {
//                 throw new Error("Questions must be an array.");
//             }
//         } catch (error) {
//             console.error("Error parsing Questions:", error.message);
//             return res.status(400).json({ message: "Invalid Questions format." });
//         }
  
//         // Add short questions
//         parsedQuestions.forEach(({ question }) => {
//             if (typeof question === "string" && question.trim() !== "") {
//                 video.qnas.shortQuestions.push({ question, answer: "" });
//             }
//         });
  
//         // Validate and add MCQs
//         if (Array.isArray(mcqs)) {
//             mcqs.forEach(({ question, options, correctAnswer }) => {
//                 if (
//                     typeof question === "string" &&
//                     Array.isArray(options) &&
//                     options.length > 1 &&
//                     options.includes(correctAnswer)
//                 ) {
//                     video.qnas.mcqs.push({ question, options, correctAnswer });
//                 }
//             });
//         } else {
//             console.warn("MCQs data is missing or incorrectly formatted.");
//         }
  
//         // Save the updated video document
//         await video.save();
  
//         return res.status(200).json({
//             message: "Q&A updated successfully",
//             qnas: video.qnas,
//         });
//     } catch (error) {
//         console.error("Error updating Q&A:", error.message);
//         return res.status(500).json({ message: "Failed to update Q&A", error: error.message });
//     }
//   });

const addQnas = asyncHandler(async (req, res) => {
    const { id, Questions, mcqs } = req.body; // Extract video ID and Q&A fields
    console.log("the data revieved:", req.body)
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





// const addQnas = asyncHandler(async (req, res) => {
//     const { id, Questions, mcqs } = req.body; // Extract video ID and possible Q&A fields from the request body
//     console.log("The data to be saved is:", req.body)

//     try {
//         // Find the video by ID
//         const video = await Video.findById(id);

//         if (!video) {
//             return res.status(404).json({ message: "Video not found" });
//         }

//         // Validate and add short questions if provided
//         if (shortQuestions && Array.isArray(shortQuestions)) {
//             shortQuestions.forEach(({ question, answer }) => {
//                 if (question && answer) {
//                     video.qnas.shortQuestions.push({ question, answer });
//                 }
//             });
//         }

//         // Validate and add MCQs if provided
//         if (mcqs && Array.isArray(mcqs)) {
//             mcqs.forEach(({ question, options, correctAnswer }) => {
//                 if (question && options && correctAnswer && Array.isArray(options)) {
//                     video.qnas.mcqs.push({ question, options, correctAnswer });
//                 }
//             });
//         }

//         // Save the updated video
//         await video.save();

//         res.status(200).json({
//             message: "Q&A updated successfully",
//         });
//     } catch (error) {
//         res.status(500).json({ message: "Failed to update Q&A", error });
//     }
// });




export { addVideo,
    addTranscript,
    addSummary,
    addQnas,
    addKeyconcept,
    addAssesment
 };
 