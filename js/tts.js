/**
 * Text-to-Speech Module using ResponsiveVoice
 * Handles converting text to speech using the ResponsiveVoice library
 */
class TextToSpeechManager {
    constructor(onStateChangeCallback) {
        this.onStateChange = onStateChangeCallback;
        this.isPlaying = false;
        this.queue = [];
        this.processingQueue = false;
        
        // Check if ResponsiveVoice is available
        this.isResponsiveVoiceAvailable = typeof responsiveVoice !== 'undefined';
        
        if (!this.isResponsiveVoiceAvailable) {
            console.error('ResponsiveVoice library not found. Make sure to include the ResponsiveVoice script in your HTML.');
        } else {
            // Set up ResponsiveVoice callbacks
            responsiveVoice.addEventListener('OnLoad', () => {
                console.log('ResponsiveVoice loaded successfully');
            });
        }
    }
    
    /**
     * Cleans text by removing emojis, asterisks and special characters
     * @param {string} text - The text to clean
     * @returns {string} - The cleaned text
     */
    cleanTextForSpeech(text) {
        if (!text) return '';
        
        // Remove emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
        text = text.replace(emojiRegex, '');
        
        // Remove asterisks and other markdown formatting
        text = text.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
        text = text.replace(/\*([^*]+)\*/g, '$1');     // Italic
        text = text.replace(/\_\_([^_]+)\_\_/g, '$1'); // Underline
        text = text.replace(/\_([^_]+)\_/g, '$1');     // Italic with underscore
        
        // Remove other special characters that don't read well
        text = text.replace(/[💋💕💔😘🔥😍💖]/g, '');
        text = text.replace(/\(([^)]+)\)/g, ''); // Remove text in parentheses
        
        // Trim excess whitespace
        text = text.replace(/\s+/g, ' ').trim();
        
        console.log('Cleaned text for speech:', text);
        return text;
    }
    
    /**
     * Speaks the given text using selected voice
     * @param {string} text - Text to speak
     * @param {string} voice - Voice to use
     * @param {boolean} skipWelcomeCheck - Force speaking regardless of welcome message status
     */
    speak(text, voice, skipWelcomeCheck = false) {
        // Clean text before speaking
        const cleanedText = this.cleanTextForSpeech(text);
        
        // Check if this is a welcome message - if so, don't speak it
        // isWelcomeMessage is a global variable set in app.js
        if (!skipWelcomeCheck && window.isWelcomeMessage === true) {
            console.log('Skipping TTS for welcome message');
            // Reset the flag for future messages
            window.isWelcomeMessage = false;
            return;
        }
        
        // If currently speaking, stop the current speech
        if (this.isPlaying) {
            this.stopSpeaking();
        }
        
        if (!this.isResponsiveVoiceAvailable) {
            console.error('ResponsiveVoice not available');
            this.onStateChange('error', 'Speech synthesis not available');
            return;
        }
        
        this.isPlaying = true;
        this.onStateChange('speaking', 'AI is speaking...');
        
        try {
            // Use direct voice name from dropdown - no need for mapping since 
            // we're now using exact ResponsiveVoice voice names in the dropdown
            const voiceName = voice || CONFIG.RESPONSIVEVOICE.defaultVoice;
            console.log('Speaking with voice:', voiceName);
            
            // Use ResponsiveVoice to speak
            this.speakWithResponsiveVoice(cleanedText, voiceName);
        } catch (error) {
            console.error('TTS error:', error);
            this.isPlaying = false;
            this.onStateChange('error', 'Failed to generate speech');
            this.processQueue();
        }
    }
    
    /**
     * Map Play.HT voice IDs to ResponsiveVoice voice names
     * @param {string} playhtVoice - The Play.HT voice ID
     * @returns {string} - ResponsiveVoice voice name
     */
    mapVoiceToResponsiveVoice(playhtVoice) {
        // Get config
        const { defaultVoice, fallbackVoice } = CONFIG.RESPONSIVEVOICE;
        
        // Default to configuration default voice
        if (!playhtVoice) return defaultVoice;
        
        // You can add more mappings here if needed
        const voiceMap = {
            // Map your existing voices to ResponsiveVoice voices
            's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json': defaultVoice,
            // Add more mappings as needed
        };
        
        return voiceMap[playhtVoice] || defaultVoice;
    }
    
    /**
     * Use ResponsiveVoice to speak text
     * @param {string} text - The text to speak
     * @param {string} voiceName - The ResponsiveVoice voice name
     */
    speakWithResponsiveVoice(text, voiceName) {
        // Get configuration settings
        const { rate, pitch } = CONFIG.RESPONSIVEVOICE;
        
        // Set up parameters
        const parameters = {
            pitch: pitch,
            rate: rate,
            volume: 1,
            onstart: () => {
                console.log('ResponsiveVoice started speaking with voice:', voiceName);
                this.isPlaying = true;
            },
            onend: () => {
                console.log('ResponsiveVoice finished speaking');
                this.isPlaying = false;
                this.processQueue();
            },
            onerror: (error) => {
                console.error('ResponsiveVoice error:', error);
                this.isPlaying = false;
                this.onStateChange('error', 'Speech synthesis error');
                this.processQueue();
            }
        };
        
        // Make sure responsiveVoice is available
        if (!window.responsiveVoice || !window.responsiveVoice.speak) {
            console.error("ResponsiveVoice not available for speaking");
            this.isPlaying = false;
            this.processQueue();
            return;
        }
        
        // Ensure voiceName is a string that ResponsiveVoice can use
        let finalVoiceName = voiceName;
        if (!finalVoiceName || typeof finalVoiceName !== 'string') {
            console.warn('Invalid voice name, using default:', voiceName);
            finalVoiceName = CONFIG.RESPONSIVEVOICE.defaultVoice;
        }
        
        // Improved handling for Filipino voice
        if (finalVoiceName === 'Filipino Female') {
            console.log('Using optimized voice for Filipino/Tagalog text');
            
            // Check if text contains Tagalog words by testing for common Filipino characters/words
            const hasTagalogCharacters = /[ñÑ]|ng\b|mga\b|ang\b|na\b|sa\b|ko\b|mo\b|po\b|ito\b|yan\b/i.test(text);
            
            // For Tagalog text, US English Female has better pronunciation than Indonesian
            finalVoiceName = 'Filipino Female';
            
            // Use a slightly slower rate for Filipino text to improve pronunciation
            if (hasTagalogCharacters) {
                parameters.rate = 0.9;
            }
        }
        
        // Only use English voices to ensure better compatibility
        const preferredVoices = [
            'Filipino Female',
            'Filipino Female',
            'Filipino Female'
        ];
        
        if (!preferredVoices.includes(finalVoiceName)) {
            console.warn(`Voice ${finalVoiceName} not in preferred list, using US English Female`);
            finalVoiceName = 'Filipino Female';
        }
        
        // If the text is empty after cleaning, just skip speaking
        if (!text || text.trim() === '') {
            console.log('Nothing to speak after cleaning text');
            this.isPlaying = false;
            this.processQueue();
            return;
        }
        
        // Start speaking
        try {
            console.log(`Speaking text in ${finalVoiceName} voice:`, text.substring(0, 50) + '...');
            window.responsiveVoice.speak(text, finalVoiceName, parameters);
        } catch (error) {
            console.error("Error calling ResponsiveVoice:", error);
            this.isPlaying = false;
            this.processQueue();
        }
    }
    
    /**
     * Process the next item in the speech queue
     */
    processQueue() {
        if (this.processingQueue || this.queue.length === 0) return;
        
        this.processingQueue = true;
        const nextItem = this.queue.shift();
        this.processingQueue = false;
        
        if (nextItem) {
            this.speak(nextItem.text, nextItem.voice);
        }
    }
    
    /**
     * Stops current speech and clears the queue
     */
    stopSpeaking() {
        if (this.isResponsiveVoiceAvailable) {
            responsiveVoice.cancel();
        }
        
        this.isPlaying = false;
        this.queue = [];
        this.onStateChange('inactive', 'Speech stopped');
    }
    
    /**
     * Get a list of available ResponsiveVoice voices
     * @returns {Array} - List of voice names
     */
    getAvailableVoices() {
        if (!this.isResponsiveVoiceAvailable) {
            return [];
        }
        
        // Get all available voices
        return responsiveVoice.getVoices().map(voice => voice.name);
    }
} 