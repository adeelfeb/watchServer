
import mongoose, { Schema } from "mongoose";
import ytdl from "ytdl-core"; // Primary library
import { Innertube } from "youtubei.js"; // Fallback library

const videoSchema = new Schema(
  {
    videoUrl: {
      type: String,
      required: true,
      unique: true,
    },
    thumbnailUrl: { type: String },
    title: { type: String },
    duration: { type: String }, // Store duration as a string in minutes:seconds format
    transcript: {
      english: [
        {
          timestamp: { type: [Number] }, // Array of numbers
          text: { type: String, required: true },
        },
      ],
      original: [
        {
          timestamp: [Number], // Array of numbers
          text: { type: String, required: true },
        },
      ],
    },
    requestSent: {
      type: Boolean,
      default: false, // Set to false by default
    },
    summary: {
      english: { type: String, default: "NA" },
      original: { type: String, default: "NA" },
    },
    keyconcept: {
      type: {
        primary: { type: String, default: "NA" }, // Primary key concept
        secondary: [
          {
            Question: { type: String, required: true }, // The question text
            Answer: [{ type: String, required: true }], // Array of answers
          },
        ], // Array of objects for questions and answers
        description: { type: String, default: "No description available yet" }, // Optional description
      },
      default: {}, // Default to an empty object
    },   
    description:{
      type: String,
      default:"No description Available For Now"
    } ,
    qnas: {
      shortQuestions: [
        {
          question: { type: String, required: true },
          answer: { type: String, required: true },
        },
      ],
      mcqs: [
        {
          question: { type: String, required: true },
          options: [{ type: String, required: true }],
          correctAnswer: { type: String, required: true },
        },
      ],
    },
  },
  { timestamps: true }
);

// Add pre-save validation for duration
videoSchema.pre("save", function (next) {
  const [minutes, seconds] = this.duration.split(":").map(Number);

  if (minutes > 20 || (minutes === 20 && seconds > 0)) {
    return next(new Error("Duration is above 20 minutes. Video cannot be saved."));
  }
  next();
});

// Helper Method to fetch video details
videoSchema.methods.fetchVideoDetails = async function () {
  const videoData = await getYouTubeVideoDetails(this.videoUrl);
  this.thumbnailUrl = videoData.thumbnailUrl;
  this.title = videoData.title;
  this.duration = videoData.duration;

  return this.save();
};

// Helper function to get YouTube video details using ytdl-core


// Helper function to get YouTube video details using ytdl-core with fallback
const getYouTubeVideoDetails = async (url) => {
  try {
    // Validate URL format
    validateYouTubeUrl(url);

    // Try fetching details using the fallback method first
    return await fetchDetailsWithYoutubei(url);
  } catch (fallbackError) {
    console.warn("Fallback library failed:", fallbackError.message);

    // If the fallback method fails, try the primary method
    try {
      return await fetchDetailsWithYtdlCore(url);
    } catch (primaryError) {
      console.error("Primary library also failed:", primaryError.message);
      throw new Error("Unable to fetch video details using any library.");
    }
  }
};


// Helper to validate the YouTube URL format
const validateYouTubeUrl = (url) => {
  const isValid = /^https:\/\/www\.youtube\.com\/watch\?v=/.test(url) || 
                  /^https:\/\/youtu\.be\/[\w-]+/.test(url);

  if (!isValid) {
    throw new Error("Invalid YouTube URL: " + url);
  }
};


// Helper to fetch video details using ytdl-core
const fetchDetailsWithYtdlCore = async (url) => {
  try {
    const info = await ytdl.getInfo(url);

    if (!info.videoDetails) {
      throw new Error("Video details are not available. The video might be private or deleted.");
    }

    // Extract video details
    const thumbnailUrl = info.videoDetails.thumbnails?.[0]?.url || "No Thumbnail Available";
    const title = info.videoDetails.title || "Untitled Video";
    const durationInSeconds = parseInt(info.videoDetails.lengthSeconds, 10);

    if (isNaN(durationInSeconds)) {
      throw new Error("Invalid duration in video details.");
    }

    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds % 60;
    const duration = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`; // Format as minutes:seconds

    return { thumbnailUrl, title, duration };
  } catch (error) {
    throw new Error(`Primary method failed: ${error.message}`);
  }
};

// Helper to fetch video details using youtubei.js as fallback
const fetchDetailsWithYoutubei = async (url) => {
  try {
    const youtube = await Innertube.create(); // Initialize the library
    const searchResults = await youtube.search(url, { type: "video" });

    if (!searchResults?.videos?.length) {
      throw new Error("No video details found.");
    }

    const video = searchResults.videos[0];

    // Extract video details
    const thumbnailUrl = video.thumbnails?.[0]?.url || "No Thumbnail Available";
    const title = video.title || "Untitled Video";

    // Extract and format duration
    let duration = "0:00"; // Default duration
    if (video.duration?.text) {
      duration = video.duration.text; // youtubei.js provides duration as a string in minutes:seconds format
    } else if (video.duration?.seconds) {
      const minutes = Math.floor(video.duration.seconds / 60);
      const seconds = video.duration.seconds % 60;
      duration = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`; // Format as minutes:seconds
    }

    return { thumbnailUrl, title, duration };
  } catch (error) {
    throw new Error(`Fallback method failed: ${error.message}`);
  }
};

















export default getYouTubeVideoDetails;



export const Video = mongoose.model("Video", videoSchema);
