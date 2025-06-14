# 📽️ YouTube Video Summarizer Backend 🎬

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white) ![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)

## 🚀 Project Overview
This is the backend server for the **YouTube Video Summarizer** project. It handles:
- 📌 **User Authentication & Session Management** (Login, Register, JWT, Password Change)
- 🎥 **Processing YouTube Video URLs** and sending them to a Flask API
- 📜 **Fetching and Serving Transcripts, Summaries, QnAs, and Key Concepts**
- 🔐 **JWT-protected APIs for Secure Access**
- 📂 **Uploading User Avatars & Cover Images**
- 📊 **Watch History & Video Tracking**


## 🛠️ Installation & Setup

1️⃣ **Clone the repository**
```sh
 git clone https://github.com/adeelfeb/watchServer
 cd yourRepoName
```

2️⃣ **Install dependencies**
```sh
 npm install
```

3️⃣ **Create a `.env` file and add the following environment variables:**

check **conf.js** inside the /src/conf.js folder


4️⃣ **Run the backend server**
```sh
 npm run dev
```

---

## 🎯 Features
✅ Secure authentication & authorization using JWT
✅ Multer file upload handling (avatars, cover images)
✅ Middleware for protected routes
✅ Integration with Flask API for transcript processing
✅ Dynamic CORS origin handling
✅ Express-session & Passport.js for session management
✅ Error handling & logging

---


## 🏗️ Tech Stack
- **Backend Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT-based authentication
- **Storage**: Multer for handling file uploads
- **API Integration**: Flask API for processing video transcripts
- **Session Management**: Express-session & Passport.js

---

## 📌 API Routes

### 🔑 **Authentication Routes** (`/api/v1/users`)
| Route | Method | Description | Auth Required |
|--------|--------|-------------|--------------|
| `/register` | `POST` | Register a new user with profile images | ❌ |
| `/login` | `POST` | Login with credentials | ❌ |
| `/login-with-temp-token` | `POST` | Login using a temporary token | ❌ |
| `/logout` | `POST` | Logout user | ✅ |
| `/change-password` | `POST` | Change current password | ✅ |
| `/current-user` | `POST` | Get the current logged-in user details | ✅ |
| `/update-account` | `PATCH` | Update user account details | ✅ |
| `/avatar` | `PATCH` | Update user avatar | ✅ |
| `/cover-image` | `PATCH` | Update user cover image | ✅ |

### 🎥 **Video Processing Routes** (`/api/v1/videos`)
| Route | Method | Description | Auth Required |
|--------|--------|-------------|--------------|
| `/addVideo` | `POST` | Add a video for processing | ✅ |
| `/transcript` | `GET` | Get transcript for a video | ✅ |
| `/summary` | `GET` | Get summary of the video | ✅ |
| `/qnas` | `GET` | Get question-and-answer pairs for the video | ✅ |
| `/keyconcept` | `GET` | Extract key concepts from the video | ✅ |
| `/history` | `GET` | Retrieve user's watch history | ✅ |
| `/refreshToken` | `GET` | Refresh JWT token | ✅ |

### 📜 **Adding Processed Video Data** (`/api/v1/process`)
| Route | Method | Description |
|--------|--------|-------------|
| `/addTranscript` | `POST` | Add a transcript for a video |
| `/addSummary` | `POST` | Add a summary for a video |
| `/addQnas` | `POST` | Add Q&A for a video |
| `/addKeyconcept` | `POST` | Add key concepts for a video |
| `/addAssesment` | `POST` | Add assessment questions for a video |

---


## 🏗️ Folder Structure
```
backend/
│── controllers/        # API controllers
│── db/                # Database connection
│── middlewares/       # Authentication, file uploads, etc.
│── models/            # Mongoose models
│── routes/            # Express routes
│── utils/             # Utility functions
│── app.js             # Main Express app
│── server.js          # Server entry point
│── .env               # Environment variables
```

---

## 🤝 Contributing
🚀 Contributions are welcome! Feel free to submit PRs or open issues.

---


🔥 Built with ❤️ and JavaScript!

