import mongoose, { Schema } from "mongoose";
import ytdl from "ytdl-core"; // Fourth fallback
import { Innertube } from "youtubei.js"; // Third fallback
import ytSearch from "yt-search"; // Second fallback
import play from "play-dl"; // Primary method

const videoSchema = new Schema(
  {
    videoUrl: { type: String, required: true, unique: true },
    thumbnailUrl: { type: String, default: "https://havecamerawilltravel.com/wp-content/uploads/2020/01/youtube-thumbnails-size-header-1-800x450.png" },
    title: { type: String, default: "Title Unavailable" },
    duration: { type: String, default: "Unknown" },
  },
  { timestamps: true }
);

// Add fetchVideoDetails as a schema method
videoSchema.methods.fetchVideoDetails = async function () {
  try {
    const videoDetails = await getYouTubeVideoDetails(this.videoUrl);
    this.thumbnailUrl = videoDetails.thumbnailUrl;
    this.title = videoDetails.title;
    this.duration = videoDetails.duration;
  } catch (error) {
    console.error("Failed to fetch video details:", error);
  }
};

const getYouTubeVideoDetails = async (url) => {
  try {
    validateYouTubeUrl(url);
    return await fetchDetailsWithPlayDl(url);
  } catch (err1) {
    console.warn("play-dl failed:", err1.message);
    try {
      return await fetchDetailsWithYtSearch(url);
    } catch (err2) {
      console.warn("yt-search failed:", err2.message);
      try {
        return await fetchDetailsWithYoutubei(url);
      } catch (err3) {
        console.warn("youtubei.js failed:", err3.message);
        try {
          return await fetchDetailsWithYtdlCore(url);
        } catch (err4) {
          console.warn("ytdl-core failed:", err4.message);
          console.error("All methods failed, returning default data.");
          return {
            thumbnailUrl: "/default-thumbnail.jpg",
            title: "Unavailable Video",
            duration: "Unknown",
          };
        }
      }
    }
  }
};

const validateYouTubeUrl = (url) => {
  const isValid = /^https:\/\/www\.youtube\.com\/watch\?v=/.test(url) || /^https:\/\/youtu\.be\/[\w-]+/.test(url);
  if (!isValid) throw new Error("Invalid YouTube URL: " + url);
};

const fetchDetailsWithPlayDl = async (url) => {
  const videoInfo = await play.video_basic_info(url);
  if (!videoInfo.video_details) throw new Error("No video details found.");
  const durationInSeconds = parseInt(videoInfo.video_details.durationInSec, 10);
  const minutes = Math.floor(durationInSeconds / 60);
  const seconds = durationInSeconds % 60;
  return {
    thumbnailUrl: videoInfo.video_details.thumbnails?.[0]?.url || "/default-thumbnail.jpg",
    title: videoInfo.video_details.title || "Untitled Video",
    duration: `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`,
  };
};

const fetchDetailsWithYtSearch = async (url) => {
  const videoId = new URL(url).searchParams.get("v");
  const searchResult = await ytSearch(videoId);
  if (!searchResult?.videos?.length) throw new Error("No video details found.");
  const video = searchResult.videos[0];
  return {
    thumbnailUrl: video.thumbnail || "/default-thumbnail.jpg",
    title: video.title || "Untitled Video",
    duration: video.timestamp || "Unknown",
  };
};

const fetchDetailsWithYoutubei = async (url) => {
  const youtube = await Innertube.create();
  const searchResults = await youtube.search(url, { type: "video" });
  if (!searchResults?.videos?.length) throw new Error("No video details found.");
  const video = searchResults.videos[0];
  return {
    thumbnailUrl: video.thumbnails?.[0]?.url || "/default-thumbnail.jpg",
    title: video.title || "Untitled Video",
    duration: video.duration?.text || "Unknown",
  };
};

const fetchDetailsWithYtdlCore = async (url) => {
  const info = await ytdl.getInfo(url);
  if (!info.videoDetails) throw new Error("Video details unavailable.");
  const durationInSeconds = parseInt(info.videoDetails.lengthSeconds, 10);
  const minutes = Math.floor(durationInSeconds / 60);
  const seconds = durationInSeconds % 60;
  return {
    thumbnailUrl: info.videoDetails.thumbnails?.[0]?.url || "/default-thumbnail.jpg",
    title: info.videoDetails.title || "Untitled Video",
    duration: `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`,
  };
};

export default getYouTubeVideoDetails;
export const Video = mongoose.model("Video", videoSchema);



















////////////////////////////////////////////------------------------------------------------------------------------------------------------------------------------------------------------



// import mongoose, { Schema } from "mongoose";
// import ytdl from "ytdl-core"; // Primary library
// import { Innertube } from "youtubei.js"; // Fallback library

// const videoSchema = new Schema(
//   {
//     videoUrl: { type: String, required: true, unique: true },
//     thumbnailUrl: { type: String, default: "/default-thumbnail.jpg" },
//     title: { type: String, default: "Title Unavailable" },
//     duration: { type: String, default: "Unknown" },
//     transcript: {
//       english: [{ timestamp: [Number], text: { type: String, required: true } }],
//       original: [{ timestamp: [Number], text: { type: String, required: true } }],
//     },
//     requestSent: { type: Boolean, default: false },
//     summary: {
//       english: { type: String, default: "NA" },
//       original: { type: String, default: "NA" },
//     },
//     keyconcept: {
//       primary: { type: String, default: "NA" },
//       secondary: [{ Question: { type: String, required: true }, Answer: [{ type: String, required: true }] }],
//       description: { type: String, default: "No description available yet" },
//     },
//     description: { type: String, default: "No description Available For Now" },
//     qnas: {
//       shortQuestions: [{ question: { type: String, required: true }, answer: { type: String, required: true } }],
//       mcqs: [
//         {
//           question: { type: String, required: true },
//           options: [{ type: String, required: true }],
//           correctAnswer: { type: String, required: true },
//         },
//       ],
//     },
//   },
//   { timestamps: true }
// );

// // Pre-save validation to limit duration to 20 minutes
// videoSchema.pre("save", function (next) {
//   if (this.duration !== "Unknown") {
//     const [minutes, seconds] = this.duration.split(":").map(Number);
//     if (minutes > 20 || (minutes === 20 && seconds > 0)) {
//       return next(new Error("Duration is above 20 minutes. Video cannot be saved."));
//     }
//   }
//   next();
// });

// // Fetch video details
// videoSchema.methods.fetchVideoDetails = async function () {
//   const videoData = await getYouTubeVideoDetails(this.videoUrl);
//   this.thumbnailUrl = videoData.thumbnailUrl;
//   this.title = videoData.title;
//   this.duration = videoData.duration;
//   return this.save();
// };

// // Fetch video details with robust error handling
// const getYouTubeVideoDetails = async (url) => {
//   try {
//     validateYouTubeUrl(url);

//     // Try using youtubei.js first
//     return await fetchDetailsWithYoutubei(url);
//   } catch (fallbackError) {
//     console.warn("Fallback library failed:", fallbackError.message);

//     try {
//       return await fetchDetailsWithYtdlCore(url);
//     } catch (primaryError) {
//       console.error("Both libraries failed:", primaryError.message);

//       // Return default values instead of throwing an error
//       return {
//         thumbnailUrl: "/default-thumbnail.jpg",
//         title: "Unavailable Video",
//         duration: "Unknown",
//       };
//     }
//   }
// };

// // Validate YouTube URL
// const validateYouTubeUrl = (url) => {
//   const isValid = /^https:\/\/www\.youtube\.com\/watch\?v=/.test(url) || /^https:\/\/youtu\.be\/[\w-]+/.test(url);
//   if (!isValid) {
//     throw new Error("Invalid YouTube URL: " + url);
//   }
// };

// // Fetch details using ytdl-core
// const fetchDetailsWithYtdlCore = async (url) => {
//   try {
//     const info = await ytdl.getInfo(url);
//     const thumbnailUrl = info.videoDetails.thumbnails?.[0]?.url || "/default-thumbnail.jpg";
//     const title = info.videoDetails.title || "Untitled Video";
//     const durationInSeconds = parseInt(info.videoDetails.lengthSeconds, 10);

//     if (isNaN(durationInSeconds)) throw new Error("Invalid duration in video details.");

//     const minutes = Math.floor(durationInSeconds / 60);
//     const seconds = durationInSeconds % 60;
//     const duration = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

//     return { thumbnailUrl, title, duration };
//   } catch (error) {
//     throw new Error(`ytdl-core failed: ${error.message}`);
//   }
// };

// // Fetch details using youtubei.js
// const fetchDetailsWithYoutubei = async (url) => {
//   try {
//     const youtube = await Innertube.create();
//     const searchResults = await youtube.search(url, { type: "video" });

//     if (!searchResults?.videos?.length) throw new Error("No video details found.");

//     const video = searchResults.videos[0];
//     const thumbnailUrl = video.thumbnails?.[0]?.url || "/default-thumbnail.jpg";
//     const title = video.title || "Untitled Video";
//     const duration = video.duration?.text || "Unknown";

//     return { thumbnailUrl, title, duration };
//   } catch (error) {
//     throw new Error(`youtubei.js failed: ${error.message}`);
//   }
// };

// export default getYouTubeVideoDetails;
// export const Video = mongoose.model("Video", videoSchema);








////////////////////////////////////////////------------------------------------------------------------------------------------------------------------------------------------------------


// import mongoose, { Schema } from "mongoose";
// import ytdl from "ytdl-core"; // Primary library
// import { Innertube } from "youtubei.js"; // Fallback library

// const videoSchema = new Schema(
//   {
//     videoUrl: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     thumbnailUrl: { type: String },
//     title: { type: String },
//     duration: { type: String }, // Store duration as a string in minutes:seconds format
//     transcript: {
//       english: [
//         {
//           timestamp: { type: [Number] }, // Array of numbers
//           text: { type: String, required: true },
//         },
//       ],
//       original: [
//         {
//           timestamp: [Number], // Array of numbers
//           text: { type: String, required: true },
//         },
//       ],
//     },
//     requestSent: {
//       type: Boolean,
//       default: false, // Set to false by default
//     },
//     summary: {
//       english: { type: String, default: "NA" },
//       original: { type: String, default: "NA" },
//     },
//     keyconcept: {
//       type: {
//         primary: { type: String, default: "NA" }, // Primary key concept
//         secondary: [
//           {
//             Question: { type: String, required: true }, // The question text
//             Answer: [{ type: String, required: true }], // Array of answers
//           },
//         ], // Array of objects for questions and answers
//         description: { type: String, default: "No description available yet" }, // Optional description
//       },
//       default: {}, // Default to an empty object
//     },
//     description: {
//       type: String,
//       default: "No description Available For Now",
//     },
//     qnas: {
//       shortQuestions: [
//         {
//           question: { type: String, required: true },
//           answer: { type: String, required: true },
//         },
//       ],
//       mcqs: [
//         {
//           question: { type: String, required: true },
//           options: [{ type: String, required: true }],
//           correctAnswer: { type: String, required: true },
//         },
//       ],
//     },
//   },
//   { timestamps: true }
// );

// // Add pre-save validation for duration
// videoSchema.pre("save", function (next) {
//   const [minutes, seconds] = this.duration.split(":").map(Number);

//   if (minutes > 20 || (minutes === 20 && seconds > 0)) {
//     return next(new Error("Duration is above 20 minutes. Video cannot be saved."));
//   }
//   next();
// });

// // Helper Method to fetch video details
// videoSchema.methods.fetchVideoDetails = async function () {
//   try {
//     const videoData = await getYouTubeVideoDetails(this.videoUrl);
//     this.thumbnailUrl = videoData.thumbnailUrl;
//     this.title = videoData.title;
//     this.duration = videoData.duration;

//     return this.save();
//   } catch (error) {
//     console.error("Error fetching video details:", error.message);
//     // Fallback to default data if fetching fails
//     this.thumbnailUrl = "https://via.placeholder.com/640x360";
//     this.title = "Untitled Video";
//     this.duration = "0:00";
//     return this.save();
//   }
// };

// // Helper function to get YouTube video details using ytdl-core with fallback
// const getYouTubeVideoDetails = async (url) => {
//   try {
//     // Validate URL format
//     validateYouTubeUrl(url);

//     // Try fetching details using the primary method first
//     return await fetchDetailsWithYtdlCore(url);
//   } catch (primaryError) {
//     console.warn("Primary library failed:", primaryError.message);

//     // If the primary method fails, try the fallback method
//     try {
//       return await fetchDetailsWithYoutubei(url);
//     } catch (fallbackError) {
//       console.error("Fallback library also failed:", fallbackError.message);
//       // If both methods fail, return default data
//       return {
//         thumbnailUrl: "https://via.placeholder.com/640x360",
//         title: "Untitled Video",
//         duration: "0:00",
//       };
//     }
//   }
// };

// // Helper to validate the YouTube URL format
// const validateYouTubeUrl = (url) => {
//   const isValid =
//     /^https:\/\/www\.youtube\.com\/watch\?v=/.test(url) ||
//     /^https:\/\/youtu\.be\/[\w-]+/.test(url);

//   if (!isValid) {
//     throw new Error("Invalid YouTube URL: " + url);
//   }
// };

// // Helper to fetch video details using ytdl-core
// const fetchDetailsWithYtdlCore = async (url) => {
//   try {
//     const info = await ytdl.getInfo(url);

//     if (!info.videoDetails) {
//       throw new Error("Video details are not available. The video might be private or deleted.");
//     }

//     // Extract video details
//     const thumbnailUrl = info.videoDetails.thumbnails?.[0]?.url || "No Thumbnail Available";
//     const title = info.videoDetails.title || "Untitled Video";
//     const durationInSeconds = parseInt(info.videoDetails.lengthSeconds, 10);

//     if (isNaN(durationInSeconds)) {
//       throw new Error("Invalid duration in video details.");
//     }

//     const minutes = Math.floor(durationInSeconds / 60);
//     const seconds = durationInSeconds % 60;
//     const duration = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`; // Format as minutes:seconds

//     return { thumbnailUrl, title, duration };
//   } catch (error) {
//     throw new Error(`Primary method failed: ${error.message}`);
//   }
// };

// // Helper to fetch video details using youtubei.js as fallback
// const fetchDetailsWithYoutubei = async (url) => {
//   try {
//     const youtube = await Innertube.create(); // Initialize the library
//     const searchResults = await youtube.search(url, { type: "video" });

//     if (!searchResults?.videos?.length) {
//       throw new Error("No video details found.");
//     }

//     const video = searchResults.videos[0];

//     // Extract video details
//     const thumbnailUrl = video.thumbnails?.[0]?.url || "No Thumbnail Available";
//     const title = video.title || "Untitled Video";

//     // Extract and format duration
//     let duration = "0:00"; // Default duration
//     if (video.duration?.text) {
//       duration = video.duration.text; // youtubei.js provides duration as a string in minutes:seconds format
//     } else if (video.duration?.seconds) {
//       const minutes = Math.floor(video.duration.seconds / 60);
//       const seconds = video.duration.seconds % 60;
//       duration = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`; // Format as minutes:seconds
//     }

//     return { thumbnailUrl, title, duration };
//   } catch (error) {
//     throw new Error(`Fallback method failed: ${error.message}`);
//   }
// };

// export const Video = mongoose.model("Video", videoSchema);

















// import mongoose, { Schema } from "mongoose";
// import ytdl from "ytdl-core"; // Primary library
// import { Innertube } from "youtubei.js"; // Fallback library

// const videoSchema = new Schema(
//   {
//     videoUrl: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     thumbnailUrl: { type: String },
//     title: { type: String },
//     duration: { type: String }, // Store duration as a string in minutes:seconds format
//     transcript: {
//       english: [
//         {
//           timestamp: { type: [Number] }, // Array of numbers
//           text: { type: String, required: true },
//         },
//       ],
//       original: [
//         {
//           timestamp: [Number], // Array of numbers
//           text: { type: String, required: true },
//         },
//       ],
//     },
//     requestSent: {
//       type: Boolean,
//       default: false, // Set to false by default
//     },
//     summary: {
//       english: { type: String, default: "NA" },
//       original: { type: String, default: "NA" },
//     },
//     keyconcept: {
//       type: {
//         primary: { type: String, default: "NA" }, // Primary key concept
//         secondary: [
//           {
//             Question: { type: String, required: true }, // The question text
//             Answer: [{ type: String, required: true }], // Array of answers
//           },
//         ], // Array of objects for questions and answers
//         description: { type: String, default: "No description available yet" }, // Optional description
//       },
//       default: {}, // Default to an empty object
//     },   
//     description:{
//       type: String,
//       default:"No description Available For Now"
//     } ,
//     qnas: {
//       shortQuestions: [
//         {
//           question: { type: String, required: true },
//           answer: { type: String, required: true },
//         },
//       ],
//       mcqs: [
//         {
//           question: { type: String, required: true },
//           options: [{ type: String, required: true }],
//           correctAnswer: { type: String, required: true },
//         },
//       ],
//     },
//   },
//   { timestamps: true }
// );

// // Add pre-save validation for duration
// videoSchema.pre("save", function (next) {
//   const [minutes, seconds] = this.duration.split(":").map(Number);

//   if (minutes > 20 || (minutes === 20 && seconds > 0)) {
//     return next(new Error("Duration is above 20 minutes. Video cannot be saved."));
//   }
//   next();
// });

// // Helper Method to fetch video details
// videoSchema.methods.fetchVideoDetails = async function () {
//   const videoData = await getYouTubeVideoDetails(this.videoUrl);
//   this.thumbnailUrl = videoData.thumbnailUrl;
//   this.title = videoData.title;
//   this.duration = videoData.duration;

//   return this.save();
// };

// // Helper function to get YouTube video details using ytdl-core


// // Helper function to get YouTube video details using ytdl-core with fallback
// const getYouTubeVideoDetails = async (url) => {
//   try {
//     // Validate URL format
//     validateYouTubeUrl(url);

//     // Try fetching details using the fallback method first
//     return await fetchDetailsWithYoutubei(url);
//   } catch (fallbackError) {
//     console.warn("Fallback library failed:", fallbackError.message);

//     // If the fallback method fails, try the primary method
//     try {
//       return await fetchDetailsWithYtdlCore(url);
//     } catch (primaryError) {
//       console.error("Primary library also failed:", primaryError.message);
//       throw new Error("Unable to fetch video details using any library.");
//     }
//   }
// };


// // Helper to validate the YouTube URL format
// const validateYouTubeUrl = (url) => {
//   const isValid = /^https:\/\/www\.youtube\.com\/watch\?v=/.test(url) || 
//                   /^https:\/\/youtu\.be\/[\w-]+/.test(url);

//   if (!isValid) {
//     throw new Error("Invalid YouTube URL: " + url);
//   }
// };


// // Helper to fetch video details using ytdl-core
// const fetchDetailsWithYtdlCore = async (url) => {
//   try {
//     const info = await ytdl.getInfo(url);

//     if (!info.videoDetails) {
//       throw new Error("Video details are not available. The video might be private or deleted.");
//     }

//     // Extract video details
//     const thumbnailUrl = info.videoDetails.thumbnails?.[0]?.url || "No Thumbnail Available";
//     const title = info.videoDetails.title || "Untitled Video";
//     const durationInSeconds = parseInt(info.videoDetails.lengthSeconds, 10);

//     if (isNaN(durationInSeconds)) {
//       throw new Error("Invalid duration in video details.");
//     }

//     const minutes = Math.floor(durationInSeconds / 60);
//     const seconds = durationInSeconds % 60;
//     const duration = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`; // Format as minutes:seconds

//     return { thumbnailUrl, title, duration };
//   } catch (error) {
//     throw new Error(`Primary method failed: ${error.message}`);
//   }
// };

// // Helper to fetch video details using youtubei.js as fallback
// const fetchDetailsWithYoutubei = async (url) => {
//   try {
//     const youtube = await Innertube.create(); // Initialize the library
//     const searchResults = await youtube.search(url, { type: "video" });

//     if (!searchResults?.videos?.length) {
//       throw new Error("No video details found.");
//     }

//     const video = searchResults.videos[0];

//     // Extract video details
//     const thumbnailUrl = video.thumbnails?.[0]?.url || "No Thumbnail Available";
//     const title = video.title || "Untitled Video";

//     // Extract and format duration
//     let duration = "0:00"; // Default duration
//     if (video.duration?.text) {
//       duration = video.duration.text; // youtubei.js provides duration as a string in minutes:seconds format
//     } else if (video.duration?.seconds) {
//       const minutes = Math.floor(video.duration.seconds / 60);
//       const seconds = video.duration.seconds % 60;
//       duration = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`; // Format as minutes:seconds
//     }

//     return { thumbnailUrl, title, duration };
//   } catch (error) {
//     throw new Error(`Fallback method failed: ${error.message}`);
//   }
// };

















// export default getYouTubeVideoDetails;



// export const Video = mongoose.model("Video", videoSchema);
