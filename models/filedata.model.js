
import mongoose, { Schema } from "mongoose";

const fileDataSchema = new Schema(
  {
    fileUrl: { type: String, required: true },
    fileName: { type: String },
    pineconeVectorId: { type: String, required: false }, // Store the Pinecone vector ID
  },
  { timestamps: true }
);

export const FileData = mongoose.model("FileData", fileDataSchema);
