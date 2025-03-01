// import { v2 as cloudinary } from "cloudinary";
// import fs from 'fs/promises'; // Use the async fs module

// // Configuration
// cloudinary.config({ 
//     cloud_name: process.env.CLOUDINARY_NAME, 
//     api_key: process.env.CLOUDINARY_API_KEY, 
//     api_secret: process.env.CLOUDINARY_API_SECRET 
// });

// // Upload function
// const uploadOnCloudinary = async (localFilePath) => {
//     try {
//         if (!localFilePath) return null;

//         // Uploading the file to Cloudinary
//         const response = await cloudinary.uploader.upload(localFilePath, {
//             resource_type: "auto",
//         });

//         // console.log("File Uploaded Successfully:", response);
//         // Use async unlink instead of unlinkSync
//         await fs.unlink(localFilePath);
//         // console.log(response)
//         return response;

//     } catch (error) {
//         console.error("Error uploading to Cloudinary:", error);

//         // Clean up local file if an error occurs
//         try {
//             await fs.unlink(localFilePath); // Use async unlink here as well
//             console.log("Local file deleted after failure:", localFilePath);
//         } catch (cleanupError) {
//             console.error("Error deleting local file:", cleanupError);
//         }

//         throw error; // Re-throw error to inform calling code
//     }
// };

// export { uploadOnCloudinary };




import { v2 as cloudinary } from "cloudinary";
import fs from 'fs/promises'; // Use the async fs module

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Upload function
const uploadOnCloudinary = async (localFilePath, folder = "videos") => {
    try {
        if (!localFilePath) return null;

        // Uploading the file to Cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto", // Automatically detect resource type (image/video)
            folder: folder, // Organize files into folders
        });

        // Extract video-specific details
        const videoDetails = {
            url: response.secure_url, // Secure URL for the uploaded video
            duration: response.duration, // Duration of the video (in seconds)
            thumbnail: response.thumbnail_url, // Thumbnail URL for the video
            title: response.public_id, // Public ID of the video (can be used as a title)
            format: response.format, // Video format (e.g., mp4)
            width: response.width, // Video width
            height: response.height, // Video height
        };

        // Clean up local file after successful upload
        await fs.unlink(localFilePath);
        // console.log("Local file deleted after successful upload:", localFilePath);

        return videoDetails; // Return video-specific details

    } catch (error) {
        console.error("Error uploading to Cloudinary:", error);

        // Clean up local file if an error occurs
        try {
            await fs.unlink(localFilePath);
            console.log("Local file deleted after failure:", localFilePath);
        } catch (cleanupError) {
            console.error("Error deleting local file:", cleanupError);
        }

        throw error; // Re-throw error to inform calling code
    }
};

export { uploadOnCloudinary };