import mongoose, { Schema } from "mongoose";

const activityLogSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            // Can be null for system actions
        },
        // Optional: Denormalize username for easier display, but needs updating if user changes username
        username: {
            type: String,
            trim: true,
        },
        action: {
            type: String, // e.g., "User registered", "Video uploaded", "Rule updated", "Comment posted"
            required: true,
            trim: true
        },
        // Optional: Link to the specific entity related to the action
        entityId: {
            type: Schema.Types.ObjectId,
        },
        entityType: {
            type: String, // e.g., "Video", "User", "Comment", "Rule"
            trim: true,
        },
        // Optional: Store extra details if needed
        details: {
            type: Schema.Types.Mixed
        }
    },
    {
        timestamps: true // Adds createdAt and updatedAt automatically (use createdAt as the activity time)
    }
);

// Index for efficient sorting/querying by time
activityLogSchema.index({ createdAt: -1 });
// Optional index if you query by user often
activityLogSchema.index({ userId: 1 });


export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);