# Voice Chat with Play.HT and Gemini

A web-based voice chat application that combines the power of Google's Gemini AI with Play.HT's realistic text-to-speech technology. Speak naturally with an AI assistant that responds with a lifelike voice.

## Features

- **Voice Recognition**: Speak naturally to the AI using your device's microphone
- **Realistic Text-to-Speech**: AI responses are spoken aloud using Play.HT's high-quality voices
- **AI-Powered Responses**: Google's Gemini AI generates intelligent and contextual responses
- **Beautiful UI**: Clean, responsive interface with light/dark mode support
- **Real-time Feedback**: Visual indicators for listening, thinking, and speaking states
- **Voice Selection**: Choose from multiple voice options for the AI

## Setup Instructions

1. **Clone the repository**

```bash
git clone https://your-repository-url.git
cd voice-chat
```

2. **Configure API Keys**

Edit the `js/config.js` file and replace the placeholder API keys with your own:

```javascript
// Play.HT API credentials
PLAYHT: {
    userId: "YOUR_PLAYHT_USER_ID", // Replace with your Play.HT User ID
    apiKey: "YOUR_PLAYHT_API_KEY", // Replace with your Play.HT API Key
    // ...
},

// Gemini API credentials
GEMINI: {
    apiKey: "YOUR_GEMINI_API_KEY", // Replace with your Gemini API Key
    // ...
}
```

3. **Run the application**

You can use any local web server to run the application. For example, with Python:

```bash
# If you have Python 3 installed
python -m http.server

# If you have Python 2 installed
python -m SimpleHTTPServer
```

Or with Node.js:

```bash
# Install http-server if you haven't already
npm install -g http-server

# Run the server
http-server
```

4. **Open in a browser**

Open your browser and navigate to:

```
http://localhost:8000
```

## How to Use

1. **Start a conversation**:
   - Click the microphone button and start speaking, or
   - Type your message in the input field and press Enter or click the send button

2. **Listen to the AI response**:
   - The AI will process your input and respond both in text and speech
   - You can change the AI's voice from the dropdown menu

3. **Change theme**:
   - Click the sun/moon icon to toggle between light and dark mode

## API Requirements

### Play.HT

To use this application, you'll need:
- A Play.HT account (sign up at [play.ht](https://play.ht/))
- User ID and API Key from your Play.HT dashboard

### Gemini

You'll also need:
- A Google AI Studio account for Gemini API access
- An API key for Gemini (obtain from [ai.google.dev](https://ai.google.dev/))

## Limitations

- Speech recognition requires browser support (works in Chrome, Edge, Safari, etc.)
- For best performance, use a recent version of Chrome or Edge
- Internet connection required for API calls
- Usage may be subject to API rate limits and quotas

## License

MIT

## Acknowledgements

- [Play.HT](https://play.ht/) for the text-to-speech API
- [Google Gemini](https://ai.google.dev/) for the AI conversation API
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Font Awesome](https://fontawesome.com/) for icons #   J a s m i n e - A I 
 
 #   J a s m i n e - A I 
 
 #   J a s m i n e - A I 
 
 