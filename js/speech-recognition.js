/**
 * Speech Recognition Module
 * Handles voice input from the user using the Web Speech API
 */
class SpeechRecognitionManager {
    constructor(onResultCallback, onStateChangeCallback) {
        this.onResult = onResultCallback;
        this.onStateChange = onStateChangeCallback;
        this.isListening = false;
        this.recognitionActive = false;
        this.permissionGranted = false;
        this.recognitionInitialized = false;
        this.abortManually = false;
        this.userStartedSpeaking = false;
        this.onSpeechStartCallback = null;
        this.silentRestart = true; // Flag to control restart logging
        this.permissionChecked = false; // Track if we've verified permission
        
        // Check for previously stored permission status
        const storedPermission = localStorage.getItem('microphonePermission');
        if (storedPermission === 'granted') {
            this.permissionGranted = true;
            this.permissionChecked = true;
            console.log('Using stored microphone permission status: granted');
        }
        
        // Check if browser supports Speech Recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            // We will initialize the recognition object just once and reuse it
            this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            // Don't create the recognition object until we actually need it
            // This delays any permission prompts until user interaction
        } else {
            console.error('Speech recognition not supported in this browser');
            this.onStateChange('error', 'Speech recognition not supported in this browser');
        }
    }
    
    // Set callback for when user starts speaking
    setOnSpeechStartCallback(callback) {
        this.onSpeechStartCallback = callback;
    }
    
    // Initialize the recognition object only once when needed
    initializeRecognition() {
        if (this.recognitionInitialized || !this.SpeechRecognition) return;
        
        console.log('Initializing speech recognition object');
        this.recognition = new this.SpeechRecognition();
        
        // Set recognition parameters
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US'; // Default language
        this.recognition.maxAlternatives = 1;
        
        // If permission is already granted, set the flag
        if (localStorage.getItem('microphonePermission') === 'granted') {
            this.permissionGranted = true;
            this.permissionChecked = true;
        }
        
        this.setupEventListeners();
        this.recognitionInitialized = true;
    }
    
    setupEventListeners() {
        // Handle speech recognition results
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                    
                    // User has started speaking - trigger callback to stop TTS if needed
                    if (!this.userStartedSpeaking && this.onSpeechStartCallback) {
                        this.userStartedSpeaking = true;
                        this.onSpeechStartCallback();
                        // Silent mode for better UX
                        if (!this.silentRestart) {
                            console.log('User started speaking - stopping AI speech');
                        }
                    }
                }
            }
            
            // Send interim results for display
            if (interimTranscript) {
                this.onResult(interimTranscript, true);
            }
            
            // Send final results when available
            if (finalTranscript) {
                this.onResult(finalTranscript, false);
                // Reset the speech start flag
                this.userStartedSpeaking = false;
            }
        };
        
        // Handle speech recognition starting
        this.recognition.onspeechstart = () => {
            if (!this.silentRestart) {
                console.log('Speech detected - user started speaking');
            }
            
            // Trigger callback to stop TTS if needed
            if (!this.userStartedSpeaking && this.onSpeechStartCallback) {
                this.userStartedSpeaking = true;
                this.onSpeechStartCallback();
            }
        };
        
        // Handle when speech ends
        this.recognition.onspeechend = () => {
            if (!this.silentRestart) {
                console.log('Speech ended');
            }
            this.userStartedSpeaking = false;
        };
        
        // Handle end of speech recognition session
        this.recognition.onend = () => {
            // Only log if not in silent mode
            if (!this.silentRestart) {
                console.log('Speech recognition session ended automatically');
            }
            this.recognitionActive = false;
            
            // Only restart if we're supposed to be listening and not due to an intentional stop
            if (this.isListening && !this.abortManually) {
                // Silent continuation of recognition - this is normal and expected behavior
                // so we don't need to log it unless debugging
                if (!this.silentRestart) {
                    console.log('Continuing voice recognition...');
                }
                
                // Add a small delay before restarting to prevent rapid restart loops
                setTimeout(() => {
                    if (this.isListening && !this.recognitionActive && this.permissionGranted) {
                        try {
                            // Use a different approach to restart without triggering permission prompts
                            if (this.recognition) {
                                // We need to reuse the same recognition object to avoid permission issues
                                this.recognition.start();
                                this.recognitionActive = true;
                                if (!this.silentRestart) {
                                    console.log('Speech recognition continued');
                                }
                            } else {
                                // If recognition object was somehow lost, recreate it
                                this.recognitionInitialized = false;
                                this.initializeRecognition();
                                this.recognition.start();
                            }
                        } catch (error) {
                            console.error('Error continuing speech recognition:', error);
                            // If there was an error starting, wait a moment and try again with a new instance
                            setTimeout(() => {
                                if (this.isListening) {
                                    console.log('Attempting to restart speech recognition with new instance');
                                    this.recognitionInitialized = false;
                                    this.initializeRecognition();
                                    this.recognition.start();
                                    this.recognitionActive = true;
                                }
                            }, 500);
                        }
                    }
                }, 300);
            }
            
            // Reset manual abort flag
            this.abortManually = false;
        };
        
        // Handle when permission is granted
        this.recognition.onaudiostart = () => {
            console.log('Audio capturing started - permission granted');
            this.permissionGranted = true;
            this.permissionChecked = true;
            
            // Store the permission status for next time
            localStorage.setItem('microphonePermission', 'granted');
        };
        
        // Handle errors
        this.recognition.onerror = (event) => {
            // Only log non-abort errors to avoid console spam
            if (event.error !== 'aborted' || !this.abortManually) {
                console.error('Speech recognition error:', event.error);
            }
            
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                this.permissionGranted = false;
                this.permissionChecked = true;
                this.isListening = false;
                localStorage.setItem('microphonePermission', 'denied');
                this.onStateChange('error', 'Microphone permission denied');
            } else if (event.error === 'no-speech') {
                // This is a common error that doesn't need user notification
                if (!this.silentRestart) {
                    console.log('No speech detected');
                }
            } else if (event.error === 'aborted' && this.abortManually) {
                // This is an intentional abort, don't notify the user
                if (!this.silentRestart) {
                    console.log('Speech recognition manually stopped');
                }
            } else if (event.error !== 'aborted') {
                // Only notify for non-abort errors
                this.onStateChange('error', `Recognition error: ${event.error}`);
            }
            
            this.recognitionActive = false;
        };
    }
    
    // Explicitly set permission status (called from app.js)
    setPermissionGranted(granted) {
        this.permissionGranted = granted;
        this.permissionChecked = true;
        if (granted) {
            localStorage.setItem('microphonePermission', 'granted');
        } else {
            localStorage.setItem('microphonePermission', 'denied');
        }
    }
    
    // Start listening for speech
    start() {
        if (!this.SpeechRecognition) return;
        
        // Check if permission is already granted
        if (!this.permissionGranted && this.permissionChecked) {
            console.log('Cannot start speech recognition - permission denied');
            this.onStateChange('error', 'Microphone permission needed for voice input');
            return;
        }
        
        // Initialize recognition if not already done
        if (!this.recognitionInitialized) {
            this.initializeRecognition();
        }
        
        try {
            if (!this.recognitionActive) {
                console.log('Starting speech recognition');
                
                // Store the permission state before starting
                const permissionBeforeStart = this.permissionGranted;
                
                this.recognition.start();
                this.recognitionActive = true;
                
                // If permission was already granted, mark it as persistent to avoid future prompts
                if (permissionBeforeStart) {
                    localStorage.setItem('microphonePermission', 'granted');
                }
            } else {
                if (!this.silentRestart) {
                    console.log('Speech recognition already active');
                }
            }
            
            this.isListening = true;
            this.onStateChange('listening', 'Microphone: On - Listening...');
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            this.onStateChange('error', 'Failed to start speech recognition');
            this.recognitionActive = false;
        }
    }
    
    // Stop listening for speech
    stop() {
        if (!this.recognition || !this.recognitionInitialized) return;
        
        try {
            this.isListening = false;
            
            if (this.recognitionActive) {
                console.log('Stopping speech recognition');
                // Set flag to indicate this is a manual abort (not an error)
                this.abortManually = true;
                this.recognition.stop();
                this.recognitionActive = false;
            }
            
            this.onStateChange('inactive', 'Microphone: Off');
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
        }
    }
    
    // Toggle between silent and verbose logging mode
    toggleSilentMode(silent) {
        this.silentRestart = silent;
    }
    
    // Toggle listening state
    toggle() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
        return this.isListening;
    }
    
    // Check if permission has been granted
    hasPermission() {
        return this.permissionGranted;
    }
    
    // Set the recognition language
    setLanguage(languageCode) {
        if (!this.recognition) return;
        
        const langMap = {
            'en': 'en-US',   // English
            'tl': 'fil-PH'   // Filipino/Tagalog
        };
        
        const recognitionLang = langMap[languageCode] || 'en-US';
        
        if (this.recognition.lang !== recognitionLang) {
            console.log(`Changing recognition language to: ${recognitionLang}`);
            this.recognition.lang = recognitionLang;
            
            // If currently active, restart to apply the new language
            if (this.recognitionActive) {
                this.stop();
                setTimeout(() => this.start(), 300);
            }
        }
    }
} 