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
        aiEvaluation: { type: String },
        correctAnswer: { type: String, default: "Not provided" }, // Optional field with default value
        score: { type: Number, default: 0 }, // Score assigned by LLM
      },
    ],
    mcqs: [
      {
        question: { type: String, required: true },
        selectedOption: { type: String, required: true },
        correctOption: { type: String, default: "Not provided" }, 
        isCorrect: { type: Boolean, required: true }, // Whether the selected option is correct
        score: { type: Number, default: 0 }, // Score for MCQ (1 if correct, 0 otherwise)
      },
    ],
    fillInTheBlanks: [
      {
        sentence: { type: String, required: true }, // The sentence with the blank
        givenAnswer: { type: String, required: true }, // User's answer
        correctAnswer: { type: String, default: "Not provided" }, // Optional field with default value
        isCorrect: { type: Boolean, required: true }, // Whether the answer is correct
        score: { type: Number, default: 0 }, // Score for fill-in-the-blank (1 if correct, 0 otherwise)
      },
    ],
    overallScore: {
      type: Number,
      min: 0,
      default: 0, // Total score (MCQs + fill-in-the-blanks)
    },
    scoreIsEvaluated: {
      type: Boolean,
      default: false, // Initially false until evaluation is completed
    },
  },
  { timestamps: true }
);

export const Score = mongoose.model("Score", scoreSchema);