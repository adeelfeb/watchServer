import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";




const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullname: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    avatar: {
      type: String,
      required: true,
    },
    coverImage: {
      type: String,
    },
    watchHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    password: {
      type: String,
      validate: {
        validator: function (value) {
          return this.authProvider === "local" ? !!value : true;
        },
        message: "Password is required for local authentication",
      },
    },
    hasPassword: {
      type: Boolean,
      default: false, // Tracks if user has set a password
    },
    refreshToken: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows null values
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true, // Allows null values
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    isActive: {
      type: Boolean,
      default: true, // Users are active by default
      index: true // Index for faster querying of active users
  }
  },
  { timestamps: true }
);




userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error); // Proper error handling
  }
});

// Method to check if the password is correct
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Method to generate an access token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      username: this.username,
      email: this.email,
      fullname: this.fullname,
      isAdmin: this.isAdmin, // Include admin status in token
      isActive: this.isActive 
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};


// Method to generate a refresh token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);