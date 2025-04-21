import mongoose from "mongoose";

const vectorDataSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "FileData", required: true }, // Link back to FileData
    vector: { type: Buffer, required: true }, // Use Buffer to store compressed vector
  },
  { timestamps: true }
);

export const VectorData = mongoose.model("VectorData", vectorDataSchema);
