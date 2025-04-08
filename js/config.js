// Configuration for API keys and settings
const CONFIG = {
    // Play.HT API credentials
    PLAYHT: {
        userId: "2L5MieT50OVFt6Ot2sr1GLXt5Df2",
        apiKey: "ak-287879502030498ebafdbeb4ffb28f19", // Replace with your Play.HT API Key
        voiceEngine: "PlayDialog",     // PlayHT's recommended voice engine
        defaultVoice: "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json"
    },
    
    // ResponsiveVoice configuration
    RESPONSIVEVOICE: {
        apiKey: "OsNW6zM2", // Using the default free key
        defaultVoice: "US English Female",  // Default voice to use
        fallbackVoice: "UK English Female", // Fallback voice if default is unavailable
        rate: 1,                           // Speech rate (0.5 to 2)
        pitch: 1                           // Speech pitch (0 to 2)
    },
    
    // Gemini API credentials
    GEMINI: {
        apiKey: "AIzaSyBB0-zEwWDSCNYNUduU6Ev0h4nJ1RqBVK0 ", // Replace with your Gemini API Key
        model: "gemini-1.5-flash"            // Using the flash model to avoid rate limits
    },
    
    // App settings
    APP: {
        maxMessages: 50,               // Maximum number of messages to keep in history
        welcomeMessage: "Kumusta? Ako si Jasmine, ang AI assistant mo. Anong pwede kong maitulung sa'yo ngayon?",
        errorMessage: "Oops! Something went wrong, sweetie. Can we try that again? I promise I'll do better next time! 💕"
    }
}; 