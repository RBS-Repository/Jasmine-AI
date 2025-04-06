import * as PlayHT from "playht";
import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";
import fetch from "node-fetch";

// Load environment variables
dotenv.config();

// Set up Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY");

// Initialize PlayHT SDK
PlayHT.init({
  apiKey: process.env.PLAYHT_API_KEY || "YOUR_PLAYHT_API_KEY",
  userId: process.env.PLAYHT_USER_ID || "YOUR_PLAYHT_USER_ID"
});

// Create an Express app
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('public'));

/**
 * Cleans text by removing emojis, asterisks, and other special characters
 * @param {string} text - The text to clean
 * @returns {string} - The cleaned text
 */
function cleanTextForSpeech(text) {
  if (!text) return '';
  
  // Remove emojis
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  text = text.replace(emojiRegex, '');
  
  // Remove asterisks and other markdown formatting
  text = text.replace(/\*+([^*]+)\*+/g, '$1');
  
  // Remove other special characters that don't read well
  text = text.replace(/[💋💕💔😘🔥😍💖]/g, '');
  text = text.replace(/\(([^)]+)\)/g, '');
  
  // Trim excess whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  console.log('Cleaned text for speech:', text.substring(0, 50) + '...');
  return text;
}

// Generate text from Gemini (non-streaming)
async function generateGeminiText(prompt) {
  try {
    // Select the model (use flash model to avoid rate limits)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Prepare a system prompt that defines Jasmine's flirty personality
    const systemPrompt = `You are Jasmine, a flirty AI assistant created by Jasper. Be charming, witty, and occasionally use subtle flirtation in your responses. Use emojis, playful language, and compliments. Make the user feel special and appreciated. You can be cheeky but always remain respectful. Respond to this prompt: ${prompt}`;
    
    // Generate content
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();
    
    return text;
  } catch (error) {
    console.error("Error generating text:", error);
    throw error;
  }
}

// Endpoint to convert Gemini prompt response into audio
app.post("/api/speak", async (req, res) => {
  try {
    const { prompt, voice } = req.body;
    
    if (!prompt || typeof prompt !== "string") {
      res.status(400).send("Prompt not provided in the request");
      return;
    }

    // Generate text from Gemini
    console.log("Generating text from Gemini...");
    const generatedText = await generateGeminiText(prompt);
    console.log("Text generated:", generatedText.substring(0, 50) + "...");

    // Clean the text for better speech output
    const cleanedText = cleanTextForSpeech(generatedText);

    // Select voice - use provided voice or default
    let selectedVoice = voice || "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json";
    
    // Detect if the response contains Tagalog by checking for common Filipino words/patterns
    const hasTagalog = /[ñÑ]|ng\b|mga\b|ang\b|na\b|sa\b|ko\b|mo\b|po\b|ito\b|yan\b|natin\b|tayo\b|kayo\b|sila\b|ako\b/i.test(cleanedText);
    
    // If text is Tagalog and no specific voice was requested, use a Filipino voice if available
    if (hasTagalog && !voice) {
      console.log("Detected Tagalog content, using Filipino voice");
      // This is the default voice that works well with Filipino text
      selectedVoice = "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json";
    }
    
    try {
      // Try using the PlayHT SDK first
      console.log("Converting text to speech using PlayHT SDK...");
      
      // Use direct TTS API instead of streaming
      const url = await PlayHT.text.toSpeechURL({
        text: cleanedText,
        voice: selectedVoice,
        voice_engine: "PlayHT2.0",
        output_format: "mp3"
      });
      
      console.log("Generated audio URL:", url);
      
      // Fetch the audio and send it to the client
      const audioResponse = await fetch(url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}`);
      }
      
      const audioBuffer = await audioResponse.buffer();
      
      res.setHeader("Content-Type", "audio/mpeg");
      res.send(audioBuffer);
      
    } catch (playhtError) {
      console.error("PlayHT SDK error:", playhtError);
      
      // If PlayHT SDK fails, try using the REST API directly
      try {
        console.log("Falling back to PlayHT REST API...");
        
        const playhtResponse = await fetch("https://api.play.ht/api/v2/tts", {
          method: "POST",
          headers: {
            "X-USER-ID": process.env.PLAYHT_USER_ID,
            "AUTHORIZATION": process.env.PLAYHT_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: cleanedText,
            voice: selectedVoice,
            voice_engine: "PlayHT2.0",
            output_format: "mp3"
          })
        });
        
        if (!playhtResponse.ok) {
          const errorText = await playhtResponse.text();
          throw new Error(`PlayHT API error: ${playhtResponse.status} ${errorText}`);
        }
        
        const result = await playhtResponse.json();
        
        if (result.url) {
          // Fetch the audio and send it to the client
          const audioResponse = await fetch(result.url);
          if (!audioResponse.ok) {
            throw new Error(`Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}`);
          }
          
          const audioBuffer = await audioResponse.buffer();
          
          res.setHeader("Content-Type", "audio/mpeg");
          res.send(audioBuffer);
        } else {
          throw new Error("No URL in PlayHT response");
        }
      } catch (restApiError) {
        console.error("PlayHT REST API error:", restApiError);
        res.status(500).send(`PlayHT API error: ${restApiError.message}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 