import mongoose, { Schema } from "mongoose";

const scoreSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },
    shortAnswers: [
      {
        question: { type: String, required: true },
        givenAnswer: { type: String, required: true },
        correctAnswer: { type: String },
        score: { type: Number, default: 0 },
      },
    ],
    mcqs: [
      {
        question: { type: String, required: true },
        selectedOption: { type: String, required: true },
        correctOption: { type: String },
        isCorrect: { type: Boolean, required: true },
        score: { type: Number, default: 0 },
      },
    ],
    fillInTheBlanks: [
      {
        sentence: { type: String, required: true },
        givenAnswer: { type: String, required: true },
        correctAnswer: { type: String },
        score: { type: Number, default: 0 },
      },
    ],
    overallScore: {
      type: Number,
      min: 0,
    },
    scoreIsEvaluated: {
      type: Boolean,
      default: false, // Initially false until evaluation is completed
    },
  },
  { timestamps: true }
);


export const Score = mongoose.model("Score", scoreSchema);