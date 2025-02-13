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















