import mongoose, { Schema } from "mongoose";
import play from "play-dl"; // Primary library for development
import ytdl from "ytdl-core"; // Primary library for production




// Video Schema
const videoSchema = new Schema(
  {
    videoUrl: { type: String, required: true, unique: true },
    thumbnailUrl: {
      type: String,
      default: "https://havecamerawilltravel.com/wp-content/uploads/2020/01/youtube-thumbnails-size-header-1-800x450.png",
    },
    title: { type: String, default: "Title Unavailable" },
    duration: { type: String, default: "Unknown" },
    transcript: {
      english: [{ timestamp: [Number], text: { type: String, required: true } }],
      original: [{ timestamp: [Number], text: { type: String, required: true } }],
    },
    requestSent: { type: Boolean, default: false },
    summary: {
      english: { type: String, default: "NA" },
      original: { type: String, default: "NA" },
    },
    keyconcept: {
      primary: { type: String, default: "NA" },
      secondary: [{ Question: { type: String, required: true }, Answer: [{ type: String, required: true }] }],
      description: { type: String, default: "No description available yet" },
    },
    description: { type: String, default: "No description Available For Now" },
    qnas: {
      shortQuestions: [{ question: { type: String, required: true }, answer: { type: String } }],
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

// Add fetchVideoDetails as a schema method
videoSchema.methods.fetchVideoDetails = async function () {
  try {
    // console.log("⚡ Fetching video details...");
    const videoDetails = await getYouTubeVideoDetails(this.videoUrl);
    this.thumbnailUrl = videoDetails.thumbnailUrl;
    this.title = videoDetails.title;
    this.duration = videoDetails.duration;
    // console.log("✅ Video details fetched successfully:", videoDetails);
  } catch (error) {
    console.error("❌ Failed to fetch video details:", error.message);
    throw error; // Re-throw to handle in the calling function
  }
};

// Validate YouTube URL
const validateYouTubeUrl = (url) => {
  // console.log("🔍 Validating YouTube URL...");
  const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  if (!match) throw new Error("Invalid YouTube URL: " + url);
  return match[1]; // Extract video ID
};

// Fetch video details using play-dl (development)
const fetchDetailsWithPlayDl = async (url) => {
  // console.log("🔍 Fetching video details using play-dl...");
  const videoId = validateYouTubeUrl(url);
  const videoInfo = await play.video_info(`https://www.youtube.com/watch?v=${videoId}`);

  if (!videoInfo || !videoInfo.video_details) throw new Error("No video details found.");

  return {
    thumbnailUrl: videoInfo.video_details.thumbnails[0]?.url ||
      "https://havecamerawilltravel.com/wp-content/uploads/2020/01/youtube-thumbnails-size-header-1-800x450.png",
    title: videoInfo.video_details.title || "Title Unavailable",
    duration: videoInfo.video_details.durationRaw || "Unknown",
  };
};

// Fetch video details using ytdl (production)
const fetchDetailsWithYtdl = async (url) => {
  // console.log("🔍 Fetching video details using ytdl...");
  const videoId = validateYouTubeUrl(url);
  const videoInfo = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);

  if (!videoInfo || !videoInfo.videoDetails) throw new Error("No video details found.");

  return {
    thumbnailUrl: videoInfo.videoDetails.thumbnails[0]?.url ||
      "https://havecamerawilltravel.com/wp-content/uploads/2020/01/youtube-thumbnails-size-header-1-800x450.png",
    title: videoInfo.videoDetails.title || "Title Unavailable",
    duration: videoInfo.videoDetails.lengthSeconds || "Unknown",
  };
};




// Get YouTube video details (primary: play-dl in development, ytdl in production)
const getYouTubeVideoDetails = async (url) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      // console.log("🔍 Attempting to fetch video details with play-dl...");
      return await fetchDetailsWithPlayDl(url);
    } else {
      // console.log("🔍 Attempting to fetch video details with ytdl...");
      return await fetchDetailsWithYtdl(url);
    }
  } catch (error) {
    // console.error("❌ Primary library failed. Using default values:", error.message);
    // Return default values if fetching fails
    return {
      thumbnailUrl: "https://havecamerawilltravel.com/wp-content/uploads/2020/01/youtube-thumbnails-size-header-1-800x450.png",
      title: "Title Unavailable",
      duration: "Unknown"
    };
  }
};

// Add Video Function

export default getYouTubeVideoDetails;
export const Video = mongoose.model("Video", videoSchema);