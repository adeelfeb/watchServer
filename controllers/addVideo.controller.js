import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { parseAndStoreInPinecone } from "./pineConeVectorSaving.controller.js";
import { Default_Youtube_URL } from "../src/constants.js";



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
    
    
    const { title, thumbnailUrl, duration, id } = req.body;
  
    // Validate required fields
    if (!id) {
      return res.status(400).json({ message: "Video ID is required" });
    }
  
    try {
        // console.log("inside add Video Details fucnton")
      let video = await Video.findById(id);
  
      // If the video doesn't exist, create a new one
      if (!video) {
        video = new Video({
          _id: id, // Use the provided ID
          videoUrl: Default_Youtube_URL, // Provide a default or required video URL
          title,
          thumbnailUrl,
          duration,
        });
      } else {
       
        
        video.title = title || video.title; 
        
        video.thumbnailUrl = thumbnailUrl || video.thumbnailUrl; 
        
        video.duration = duration || video.duration; 
        
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
  // console.log("inside the transcript:", english, original)
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
                console.log(`Transcript for video ID ${id} successfully vectorized and stored in Pinecone.`);
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





export {
    addTranscript,
    addSummary,
    addQnas,
    addKeyconcept,
    addAssesment, 
    addVideoDetails,
    DeleteVideo
 };
 