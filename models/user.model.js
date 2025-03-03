// import mongoose, { Schema } from "mongoose";
// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";

// const userSchema = new Schema(
//   {
//     username: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       trim: true,
//       index: true,
//     },
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       trim: true,
//     },
//     fullname: {
//       type: String,
//       required: true,
//       trim: true,
//       index: true,
//     },
//     avatar: {
//       type: String,
//       required: true,
//     },
//     coverImage: {
//       type: String,
//     },
//     watchHistory: [
//       {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "Video",
//       },
//     ],
//     password: {
//       type: String,
//       required: [true, "Password is required"],
//     },
//     refreshToken: {
//       type: String,
//       default: null,
//     },
//     googleId: { // Add this field to store the Google user ID
//       type: String,
//       unique: true, // Ensure this field is unique
//       sparse: true,  // Allow it to be missing in users who sign up with other methods
//     },
//   },
//   { timestamps: true }
// );


// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   try {
//       this.password = await bcrypt.hash(this.password, 10);
//       next();
//   } catch (error) {
//       next(error); // Proper error handling
//   }
// });


// userSchema.methods.isPasswordCorrect = async function (password) {
//   return await bcrypt.compare(password, this.password)
// }


// userSchema.methods.generateAccessToken = function () {
//   return jwt.sign(
//       {
//           _id: this._id,
//           username: this.username,
//           email: this.email,
//           fullname: this.fullname,
//       },
//       process.env.ACCESS_TOKEN_SECRET,
//       {
//           expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
//       }
//   );
// };

// userSchema.methods.generateRefreshToken = function () {
//   return jwt.sign(
//       {
//           _id: this._id,
//       },
//       process.env.REFRESH_TOKEN_SECRET,
//       {
//           expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
//       }
//   );
// };


// export const User = mongoose.model("User", userSchema);



import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// const userSchema = new Schema(
//   {
//     username: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       trim: true,
//       index: true,
//     },
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       trim: true,
//     },
//     fullname: {
//       type: String,
//       required: true,
//       trim: true,
//       index: true,
//     },
//     avatar: {
//       type: String,
//       required: true,
//     },
//     coverImage: {
//       type: String,
//     },
//     watchHistory: [
//       {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "Video",
//       },
//     ],
//     password: {
//       type: String,
//       required: function () {
//         // Password is required only for local authentication
//         return this.authProvider === "local";
//       },
//     },
//     refreshToken: {
//       type: String,
//       default: null,
//     },
//     googleId: {
//       type: String,
//       unique: true,
//       sparse: true, // Allow this field to be null for non-Google users
//     },
//     firebaseUid: {
//       type: String,
//       unique: true,
//       sparse: true, // Allow this field to be null for non-Firebase users
//     },
//     authProvider: {
//       type: String,
//       enum: ["local", "google"], // Track the authentication provider
//       default: "local",
//     },
//   },
//   { timestamps: true }
// );


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