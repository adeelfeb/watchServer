import { Pinecone } from "@pinecone-database/pinecone"; // Pinecone SDK
import { removeStopwords } from "stopword"; // Stopwords removal library
import conf from "../src/conf.js"; 

const pc = new Pinecone({
  apiKey: conf.pinecone.apiKey, // Replace with your API key
});

// Define the Pinecone index name
const indexName = "vecotr"; // Corrected typo from "vecotr" to "vector"

// Define the embedding model
const model = "multilingual-e5-large"; // Replace with the model of your choice

// Function to clean text by removing special characters, extra spaces, and stopwords
const cleanText = (text) => {
  // Remove special characters but keep numbers
  const cleaned = text.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  // Split text into words
  const words = cleaned.split(" ");
  // Remove stopwords
  const filtered = removeStopwords(words);
  // Join words back into a string
  return filtered.join(" ");
};

// Function to generate embeddings for a batch of text chunks
const generateEmbeddings = async (chunks) => {
  try {
    const embeddings = await pc.inference.embed(model, chunks, {
      inputType: "passage", // Use "passage" for text chunks
      truncate: "END",
    });
    return embeddings.map((embedding) => embedding.values); // Extract vector values
  } catch (error) {
    console.error("Error generating embeddings:", error.message);
    throw new Error("Embedding generation failed.");
  }
};

// Function to split text into chunks of a given size
const splitTextIntoChunks = (text, chunkSize = 500) => {
  const words = text.split(" ");
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
};

// Function to parse and store vectors in Pinecone
// export const parseAndStoreInPinecone = async (transcript, videoId, userId) => {
//   try {
//     // Step 1: Validate the transcript
//     if (!transcript || transcript.trim() === "") {
//       throw new Error("Transcript is empty or invalid.");
//     }

//     // Step 2: Clean the transcript
//     const cleanedText = cleanText(transcript);
//     // console.log("Transcript cleaned successfully.");

//     // Step 3: Split text into chunks
//     const chunks = splitTextIntoChunks(cleanedText);
//     console.log(`Transcript split into ${chunks.length} chunks.`);

//     // Step 4: Generate embeddings for each chunk
//     const embeddings = await generateEmbeddings(chunks);

//     if (!embeddings || embeddings.length === 0) {
//       throw new Error("Embedding generation failed or produced empty vectors.");
//     }
//     // console.log("Embeddings generated successfully.");

//     // Step 5: Initialize the Pinecone index
//     const index = pc.index(indexName);

//     // Step 6: Save vectors to Pinecone under the user's namespace
//     const namespaceName = `namespace${userId}`;
//     console.log("The namespace is ", namespaceName);

//     const vectors = chunks.map((chunk, idx) => ({
//       id: `${videoId}_chunk_${idx}`, // Unique ID for each chunk
//       values: embeddings[idx],
//       metadata: { videoId, chunk, userId },
//     }));

//     // Upsert vectors in Pinecone
//     await index.namespace(namespaceName).upsert(vectors);

//     console.log(`Saved ${vectors.length} vectors to Pinecone for video ID: ${videoId}`);
//     return videoId;
//   } catch (error) {
//     console.error(`Error processing video with ID: ${videoId}`, error.message);
//     throw new Error("Error during vectorization and Pinecone storage.");
//   }
// };



export const parseAndStoreInPinecone = async (transcript, videoId) => {
  try {
    // Step 1: Validate the transcript
    if (!transcript || transcript.trim() === "") {
      throw new Error("Transcript is empty or invalid.");
    }

    // Step 2: Clean the transcript
    const cleanedText = cleanText(transcript);

    // Step 3: Split text into chunks
    const chunks = splitTextIntoChunks(cleanedText);
    // console.log(`Transcript split into ${chunks.length} chunks.`);

    // Step 4: Generate embeddings for each chunk
    const embeddings = await generateEmbeddings(chunks);

    if (!embeddings || embeddings.length === 0) {
      throw new Error("Embedding generation failed or produced empty vectors.");
    }

    // Step 5: Initialize the Pinecone index
    const index = pc.index(indexName);

    // Step 6: Save vectors to Pinecone (without userId)
    const vectors = chunks.map((chunk, idx) => ({
      id: `${videoId}_chunk_${idx}`, // Unique ID for each chunk
      values: embeddings[idx],
      metadata: { videoId, chunk }, // Removed userId from metadata
    }));

    // Upsert vectors in Pinecone under a generic namespace
    await index.namespace("transcripts").upsert(vectors);

    // console.log(`Saved ${vectors.length} vectors to Pinecone for video ID: ${videoId}`);
    return videoId;
  } catch (error) {
    console.error(`Error processing video with ID: ${videoId}`, error.message);
    throw new Error("Error during vectorization and Pinecone storage.");
  }
};


export const getVectorFromPinecone = async (query, userId) => {
    try {
      const userNamespace = `namespace${userId}`;
      console.log("User namespace:", userNamespace);
  
      const index = pc.index(indexName).namespace(userNamespace);
  
      // Step 1: Clean and preprocess the query text
      const cleanedQuery = cleanText(query);
      if (!cleanedQuery || /[^a-zA-Z0-9\s]/.test(cleanedQuery)) {
        console.warn("Query is empty or invalid. Skipping search.");
        return [];
      }
  
      // Step 2: Generate embeddings for the query text
      const queryVector = await generateEmbeddings([cleanedQuery]);
  
      if (!queryVector || queryVector.length === 0) {
        console.error("Error: Query vector generation failed.");
        return [];
      }
  
      // Step 3: Perform vector similarity search in Pinecone
      const queryResults = await index.query({
        vector: queryVector[0],
        topK: 2, // Number of results to return
        includeMetadata: true,
      });
  
      if (!queryResults || !queryResults.matches || queryResults.matches.length === 0) {
        console.warn("No similarity results found.");
        return [];
      }
  
      // Step 4: Filter results based on similarity threshold
      const threshold = 0.6;
      const filteredResults = queryResults.matches.filter(
        (match) => match.score >= threshold
      );
  
      if (filteredResults.length === 0) {
        console.warn("No valid similarity results above threshold.");
        return [];
      }
  
      // Step 5: Return filtered results (ensuring we fetch relevant metadata)
      return filteredResults.map((match) => ({
        videoId: match.metadata.videoId,
        chunk: match.metadata.chunk, // The text chunk stored in Pinecone
        score: match.score,
      }));
    } catch (error) {
      console.error("Error in getVectorFromPinecone:", error);
      return [];
    }
  };
  








export const getVectorFromPineconeByFileId = async (fileId, query, userId) => {
  try {
    const userNameSpace = `namespace${userId}`;
    // console.log("Inside the get vetor by File Id:", fileId)
    // Initialize the Pinecone index with the specified namespace
    const index = pc.index(indexName).namespace(userNameSpace);

    // Clean the query text
    const cleanedQuery = cleanText(query);

    // Check if the query is empty or contains only random symbols
    if (!cleanedQuery || /[^a-zA-Z0-9\s]/.test(cleanedQuery)) {
      console.warn("Query is empty or contains random symbols. Skipping search.");
      return []; // Handle this case accordingly
    }

    // Generate query embedding for the cleaned query
    const queryVector = await generateEmbeddings([cleanedQuery]); // Generate embedding for the single cleaned query

    if (!queryVector || queryVector.length === 0) {
      console.error("Error: Query vector generation failed.");
      return [];
    }

    // Perform vector similarity search with the query vector
    const queryResults = await index.query({
      vector: queryVector[0], // Pass the single query vector
      topK: 2, // Number of results to return
      includeMetadata: true,
      filter: {
        fileId: fileId, // Filter results by fileId
      },
    });

    if (!queryResults || !queryResults.matches || queryResults.matches.length === 0) {
      console.warn("No similarity results found. Consider revising the query or embeddings.");
      return [];
    }

    // Set a threshold for similarity score (e.g., only accept matches with score > 0.6)
    const threshold = 0.6;
    const filteredResults = queryResults.matches.filter(
      (match) => match.score >= threshold
    );

    if (filteredResults.length === 0) {
      console.warn("No valid similarity results above the threshold.");
      return []; // No valid results above the threshold
    }

    // Return the filtered match data
    return filteredResults; // Send back the filtered data
  } catch (error) {
    console.error("Error in getVectorFromPineconeByFileId:", error);
    return [];
  }
};
