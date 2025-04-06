/**
 * Main Application Script
 * Initializes and coordinates all modules for the voice chat application
 */
document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const toggleMicButton = document.getElementById('toggle-mic');
    const statusIndicator = document.getElementById('status-indicator');
    const voiceSelect = document.getElementById('voice-select');
    const toggleThemeButton = document.getElementById('toggle-theme');
    const toggleLanguageButton = document.getElementById('toggle-language');
    const ttsToggle = document.getElementById('tts-toggle');
    
    let currentUserMessage = '';
    let currentTranscript = '';
    let userMessageElement = null;
    let aiResponseElement = null;
    let audioInitialized = false;
    let permissionsRequested = false;
    let currentLanguage = localStorage.getItem('preferredLanguage') || 'en'; // Default to English
    let microphonePermissionGranted = localStorage.getItem('microphonePermission') === 'granted';
    let ttsEnabled = localStorage.getItem('ttsEnabled') !== 'false'; // Default to enabled
    
    // Initialize managers
    const speechRecognitionManager = new SpeechRecognitionManager(
        handleSpeechResult,
        updateStatus
    );
    
    // Enable silent mode for speech recognition (reduces console logging)
    speechRecognitionManager.toggleSilentMode(true);
    
    const ttsManager = new TextToSpeechManager(updateStatus);
    
    // Initialize the Gemini AI Manager
    const geminiManager = new GeminiAIManager(updateStatus);
    
    // Initialize UI before AI is ready
    updateStatus('initializing', 'Loading AI system...');
    
    try {
        // Initialize GeminiAI with the system prompt (now async)
        await geminiManager.initialize();
        updateStatus('ready', 'AI system loaded successfully');
    } catch (error) {
        console.error('Error initializing AI system:', error);
        updateStatus('error', 'Error loading AI system. Using fallback mode.');
    }
    
    // Set initial TTS toggle state
    ttsToggle.checked = ttsEnabled;
    
    // If we have stored permission, set it immediately
    if (microphonePermissionGranted) {
        speechRecognitionManager.setPermissionGranted(true);
        permissionsRequested = true;
        console.log('Initializing with stored microphone permission: granted');
    }
    
    // Enhanced welcome animation
    setTimeout(() => {
        addWelcomeAnimation();
    }, 500);
    
    // Set up callback to stop TTS when user starts speaking
    speechRecognitionManager.setOnSpeechStartCallback(() => {
        // Stop AI speech immediately when user starts speaking
        if (ttsManager.isPlaying) {
            ttsManager.stopSpeaking();
        }
    });
    
    // Load preferred voice if saved before
    const savedVoice = localStorage.getItem('preferredVoice');
    if (savedVoice) {
        // Will set it when the dropdown is populated
        console.log('Found saved voice preference:', savedVoice);
    }
    
    // Check for existing language preference
    const preferredLanguage = localStorage.getItem('preferredLanguage');
    if (preferredLanguage === 'tl') {
        currentLanguage = 'tl';
        speechRecognitionManager.setLanguage('tl');
        console.log('Setting Filipino language from saved preference');
    } else {
        currentLanguage = 'en';
        localStorage.setItem('preferredLanguage', 'en');
    }
    
    // Add initial message to chat without speaking it immediately
    addAIMessage(CONFIG.APP.welcomeMessage);
    
    // Check for microphone permission
    checkMicrophonePermission();
    
    // Set initial language settings
    if (currentLanguage === 'tl') {
        speechRecognitionManager.setLanguage('tl');
        
        // Set the appropriate voice for Tagalog
        setTimeout(() => {
            for (let i = 0; i < voiceSelect.options.length; i++) {
                if (voiceSelect.options[i].value === 'Filipino Female') {
                    voiceSelect.selectedIndex = i;
                    break;
                }
            }
        }, 500);
    }
    
    // Wait for ResponsiveVoice to load then populate voices
    if (window.responsiveVoice && responsiveVoice.voiceSupport()) {
        responsiveVoice.addEventListener('OnLoad', populateVoiceDropdown);
    } else {
        // If ResponsiveVoice is already loaded or not available
        setTimeout(populateVoiceDropdown, 1000);
    }
    
    // Event Listeners
    toggleMicButton.addEventListener('click', () => {
        // Initialize audio on first user interaction
        if (!audioInitialized) {
            initializeAudio();
        }
        toggleMicrophone();
    });
    
    sendButton.addEventListener('click', () => {
        // Initialize audio on first user interaction
        if (!audioInitialized) {
            initializeAudio();
        }
        sendMessage();
    });
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            // Initialize audio on first user interaction
            if (!audioInitialized) {
                initializeAudio();
            }
            sendMessage();
        }
    });
    
    // Add voice selection change listener
    voiceSelect.addEventListener('change', (e) => {
        const selectedVoice = e.target.value;
        console.log('Voice changed to:', selectedVoice);
        
        // Save the selected voice to localStorage to remember the user's preference
        localStorage.setItem('preferredVoice', selectedVoice);
        
        // Test the selected voice immediately
        if (window.responsiveVoice && ttsEnabled) {
            audioInitialized = true; // Mark as initialized
            responsiveVoice.speak("Voice changed to " + selectedVoice, selectedVoice);
        }
    });
    
    // TTS toggle change listener
    ttsToggle.addEventListener('change', () => {
        ttsEnabled = ttsToggle.checked;
        localStorage.setItem('ttsEnabled', ttsEnabled);
        
        // Show a status update
        updateStatus(
            ttsEnabled ? 'info' : 'inactive', 
            ttsEnabled ? 'Text-to-speech enabled' : 'Text-to-speech disabled'
        );
        
        // If currently speaking, stop it when TTS is disabled
        if (!ttsEnabled && ttsManager.isPlaying) {
            ttsManager.stopSpeaking();
        }
        
        // Test the TTS when enabled
        if (ttsEnabled && window.responsiveVoice) {
            audioInitialized = true; // Mark as initialized
            responsiveVoice.speak("Text to speech is now enabled", voiceSelect.value);
        }
    });
    
    // Optional: Add a button to test the current voice
    const testVoiceButton = document.createElement('button');
    testVoiceButton.innerHTML = '<i class="fas fa-play"></i>';
    testVoiceButton.className = 'p-2 ml-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm';
    testVoiceButton.title = 'Test selected voice';
    testVoiceButton.onclick = () => {
        const currentVoice = voiceSelect.value;
        if (window.responsiveVoice && ttsEnabled) {
            audioInitialized = true; // Mark as initialized
            responsiveVoice.speak("This is a test of the " + currentVoice + " voice.", currentVoice);
        } else if (!ttsEnabled) {
            updateStatus('info', 'Enable TTS to test voice');
        }
    };
    // Insert the test button after the voice dropdown
    voiceSelect.parentNode.insertBefore(testVoiceButton, voiceSelect.nextSibling);
    
    toggleThemeButton.addEventListener('click', toggleTheme);
    
    toggleLanguageButton.addEventListener('click', toggleLanguage);
    
    // Set initial language indicator
    updateLanguageButton();
    
    /**
     * Check for existing microphone permission
     */
    async function checkMicrophonePermission() {
        // First check if we have a stored permission status
        const storedPermission = localStorage.getItem('microphonePermission');
        if (storedPermission === 'granted') {
            console.log('Already have microphone permission based on stored status');
            permissionsRequested = true;
            microphonePermissionGranted = true;
            speechRecognitionManager.setPermissionGranted(true);
            return true;
        }
        
        try {
            // Modern browsers often require a user gesture before accessing media devices,
            // so we'll just check existing permissions without triggering a prompt
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            
            // If we can see labels, permission was already granted
            if (audioInputs.length > 0 && audioInputs[0].label) {
                console.log('Microphone permission already granted');
                permissionsRequested = true;
                microphonePermissionGranted = true;
                speechRecognitionManager.setPermissionGranted(true);
                // Store this for future reference
                localStorage.setItem('microphonePermission', 'granted');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking microphone permissions:', error);
            return false;
        }
    }
    
    /**
     * Request microphone permission explicitly
     * @returns {Promise<boolean>} - Whether permission was granted
     */
    async function requestMicrophonePermission() {
        // If we've already successfully requested permission in this session, don't ask again
        if (permissionsRequested && microphonePermissionGranted) {
            console.log('Permission already granted in this session, not asking again');
            return true;
        }
        
        // Check if we already have a stored permission status
        const storedPermission = localStorage.getItem('microphonePermission');
        if (storedPermission === 'granted') {
            console.log('Using stored microphone permission: granted');
            permissionsRequested = true;
            microphonePermissionGranted = true;
            speechRecognitionManager.setPermissionGranted(true);
            return true;
        }
        
        try {
            updateStatus('info', 'Requesting microphone permission...');
            console.log('Requesting microphone permission');
            
            // Request permission by getting a stream and then stopping it
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: false // Explicitly deny video to make it clear we only want audio
            });
            
            // Stop all tracks to release the microphone
            stream.getTracks().forEach(track => track.stop());
            
            console.log('Microphone permission granted');
            permissionsRequested = true;
            microphonePermissionGranted = true;
            speechRecognitionManager.setPermissionGranted(true);
            
            // Store the permission status for future sessions
            localStorage.setItem('microphonePermission', 'granted');
            
            updateStatus('info', 'Microphone permission granted');
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            localStorage.setItem('microphonePermission', 'denied');
            microphonePermissionGranted = false;
            speechRecognitionManager.setPermissionGranted(false);
            updateStatus('error', 'Microphone permission denied. Voice input will not work.');
            permissionsRequested = true; // Mark as requested even if denied to prevent further requests
            return false;
        }
    }
    
    /**
     * Initialize audio context and play welcome message
     */
    function initializeAudio() {
        audioInitialized = true;
        // No need to initialize AudioContext with ResponsiveVoice
        // Play welcome message after user interaction if TTS is enabled
        if (ttsEnabled) {
            ttsManager.speak(CONFIG.APP.welcomeMessage);
        }
    }
    
    /**
     * Toggles microphone on/off
     */
    async function toggleMicrophone() {
        // First attempt to use any stored/cached permission without prompting
        if (!permissionsRequested || !microphonePermissionGranted) {
            // First check if permission is already stored
            const hasStoredPermission = await checkMicrophonePermission();
            
            // If no permission found in cache/storage, request it explicitly
            if (!hasStoredPermission) {
                const permissionGranted = await requestMicrophonePermission();
                if (!permissionGranted) {
                    updateStatus('error', 'Microphone permission needed for voice input');
                    return;
                }
            }
        }
        
        // Toggle speech recognition
        const isListening = speechRecognitionManager.toggle();
        
        // Update button appearance
        toggleMicButton.innerHTML = isListening ? 
            '<i class="fas fa-microphone-slash"></i>' : 
            '<i class="fas fa-microphone"></i>';
        toggleMicButton.classList.toggle('bg-primary-dark', isListening);
        toggleMicButton.classList.toggle('bg-primary', !isListening);
        
        // Add pulse animation to microphone button when active
        toggleMicButton.classList.toggle('mic-active', isListening);
        
        // Update the status text
        if (isListening) {
            updateStatus('listening', 'Microphone: Active - Jasmine is listening...');
        } else {
            updateStatus('inactive', 'Microphone: Off');
        }
    }
    
    /**
     * Handles speech recognition results
     * @param {string} transcript - The transcript text
     * @param {boolean} isInterim - Whether this is an interim result
     */
    function handleSpeechResult(transcript, isInterim) {
        if (!transcript) return;
        
        if (isInterim) {
            // Update the current transcript for interim results
            currentTranscript = transcript;
            
            // If no user message element exists yet, create one
            if (!userMessageElement) {
                addUserMessageElement(transcript);
            } else {
                // Otherwise, update the existing message
                const messageContent = userMessageElement.querySelector('.message-content');
                messageContent.textContent = transcript;
            }
        } else {
            // For final results, set the current user message
            currentUserMessage = transcript;
            
            // Send the final transcript
            processUserInput(transcript);
        }
    }
    
    /**
     * Send the user message and get AI response
     */
    async function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;
        
        // Clear the input field
        messageInput.value = '';
        
        // Add user message to chat
        addUserMessage(messageText);
        
        // Get AI response
        const response = await geminiManager.generateResponse(messageText);
        
        // Add AI response to chat
        addAIMessage(response);
        
        // Get selected voice
        const selectedVoice = voiceSelect.value;
        
        // Speak the response if TTS is enabled
        if (ttsEnabled) {
            ttsManager.speak(response, selectedVoice);
        }
    }
    
    /**
     * Processes user input and gets AI response
     * @param {string} input - The user's input
     */
    async function processUserInput(input) {
        // Clear any existing user message element (for interim results)
        userMessageElement = null;
        currentTranscript = '';
        
        // Add user message to chat
        addUserMessage(input);
        
        // Generate AI response
        addAIThinkingMessage();
        const response = await geminiManager.generateResponse(input);
        
        // Remove thinking message and add actual response
        removeThinkingMessage();
        addAIMessage(response);
        
        // Get selected voice
        const selectedVoice = voiceSelect.value;
        
        // Speak the response using ResponsiveVoice if TTS is enabled
        if (ttsEnabled) {
            ttsManager.speak(response, selectedVoice);
        }
    }
    
    /**
     * Adds a user message to the chat
     * @param {string} message - The user's message
     */
    function addUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-end mb-4';
        
        // Generate a random time string (for visual purposes only)
        const now = new Date();
        const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                          now.getMinutes().toString().padStart(2, '0');
        
        messageElement.innerHTML = `
            <div class="flex flex-col items-end">
                <div class="message-bubble user-message bg-secondary dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tr-none py-3 px-4 max-w-[80%] shadow-sm">
                    <div class="message-content">${message}</div>
                </div>
                <div class="text-xs text-gray-400 mt-1 mr-2 flex items-center">
                    <span>${timeString}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ml-1 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                </div>
            </div>
        `;
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    /**
     * Adds an AI message to the chat
     * @param {string} message - The AI's message
     */
    function addAIMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex mb-4';
        
        // Generate a random time string (for visual purposes only)
        const now = new Date();
        const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                          now.getMinutes().toString().padStart(2, '0');
        
        // Create AI avatar
        const avatarColors = ['from-primary to-primary-light', 'from-accent to-accent-light'];
        const randomColorClass = avatarColors[Math.floor(Math.random() * avatarColors.length)];
        
        messageElement.innerHTML = `
            <div class="flex flex-col">
                <div class="flex items-end mb-1">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br ${randomColorClass} flex items-center justify-center shadow-sm mr-2 overflow-hidden border-2 border-white dark:border-gray-700">
                        <span class="text-xs text-white font-bold font-display">J</span>
                    </div>
                    <div class="message-bubble ai-message bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-none py-3 px-4 max-w-[80%] shadow-sm">
                        <div class="message-content">${message}</div>
                    </div>
                </div>
                <div class="text-xs text-gray-400 ml-10 flex items-center">
                    <span class="mr-1">${timeString}</span>
                    <span class="text-xs font-light">• Jasmine</span>
                </div>
            </div>
        `;
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    /**
     * Adds a user message element to prepare for speech recognition
     * @param {string} text - Initial text (might be empty or interim)
     */
    function addUserMessageElement(text) {
        userMessageElement = document.createElement('div');
        userMessageElement.className = 'flex justify-end mb-4';
        userMessageElement.innerHTML = `
            <div class="flex flex-col items-end">
                <div class="message-bubble user-message bg-secondary dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tr-none py-3 px-4 max-w-[80%] shadow-sm">
                    <div class="message-content">${text || ''}</div>
                </div>
                <div class="text-xs text-gray-400 mt-1 mr-2 flex items-center">
                    <span class="italic">typing...</span>
                </div>
            </div>
        `;
        chatContainer.appendChild(userMessageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    /**
     * Adds an AI thinking message to the chat
     */
    function addAIThinkingMessage() {
        aiResponseElement = document.createElement('div');
        aiResponseElement.className = 'flex mb-4';
        
        aiResponseElement.innerHTML = `
            <div class="flex flex-col">
                <div class="flex items-end mb-1">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-sm mr-2 overflow-hidden border-2 border-white dark:border-gray-700 relative">
                        <span class="text-xs text-white font-bold font-display">J</span>
                        <div class="absolute inset-0 bg-primary-light opacity-50 animate-pulse rounded-full"></div>
                    </div>
                    <div class="message-bubble ai-message bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-none py-3 px-4 max-w-[80%] shadow-sm">
                        <div class="message-content flex items-center">
                            <span class="mr-2">Jasmine is thinking</span>
                            <div class="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="text-xs text-gray-400 ml-10">
                    <span class="animate-pulse">Processing...</span>
                </div>
            </div>
        `;
        chatContainer.appendChild(aiResponseElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    /**
     * Removes the AI thinking message
     */
    function removeThinkingMessage() {
        if (aiResponseElement) {
            aiResponseElement.remove();
            aiResponseElement = null;
        }
    }
    
    /**
     * Updates the status indicator
     * @param {string} status - The current status
     * @param {string} message - The status message
     */
    function updateStatus(status, message) {
        let statusDot = '';
        let statusColor = '';
        let iconClass = '';
        let bgClass = '';
        
        // Determine the status dot color and icon
        switch (status) {
            case 'listening':
                statusDot = 'bg-green-400';
                statusColor = 'text-green-600 dark:text-green-400';
                iconClass = 'fa-solid fa-headset';
                bgClass = 'bg-green-50 dark:bg-green-900/20';
                break;
            case 'speaking':
                statusDot = 'bg-blue-400';
                statusColor = 'text-blue-600 dark:text-blue-400';
                iconClass = 'fa-solid fa-volume-high';
                bgClass = 'bg-blue-50 dark:bg-blue-900/20';
                break;
            case 'thinking':
                statusDot = 'bg-amber-400';
                statusColor = 'text-amber-600 dark:text-amber-400';
                iconClass = 'fa-solid fa-brain';
                bgClass = 'bg-amber-50 dark:bg-amber-900/20';
                break;
            case 'error':
                statusDot = 'bg-red-400';
                statusColor = 'text-red-600 dark:text-red-400';
                iconClass = 'fa-solid fa-circle-exclamation';
                bgClass = 'bg-red-50 dark:bg-red-900/20';
                break;
            case 'info':
                statusDot = 'bg-indigo-400';
                statusColor = 'text-indigo-600 dark:text-indigo-400';
                iconClass = 'fa-solid fa-circle-info';
                bgClass = 'bg-indigo-50 dark:bg-indigo-900/20';
                break;
            default:
                statusDot = 'bg-gray-400';
                statusColor = 'text-gray-600 dark:text-gray-400';
                iconClass = 'fa-solid fa-circle-dot';
                bgClass = 'bg-gray-50 dark:bg-gray-900/20';
        }
        
        // Update the status indicator with animated dot and improved styling
        statusIndicator.innerHTML = `
            <span class="inline-flex items-center px-2.5 py-1 rounded-full ${bgClass} animate-fade-in">
                <span class="w-2 h-2 ${statusDot} rounded-full mr-2 animate-pulse"></span>
                <i class="${iconClass} ${statusColor} mr-2 text-xs"></i>
                <span class="font-medium text-gray-700 dark:text-gray-300">${message}</span>
            </span>
        `;
        
        // Add a subtle animation to highlight status changes
        statusIndicator.classList.add('animate-pulse-soft');
        setTimeout(() => {
            statusIndicator.classList.remove('animate-pulse-soft');
        }, 1000);
    }
    
    /**
     * Toggles between light and dark theme
     */
    function toggleTheme() {
        document.documentElement.classList.toggle('dark');
        
        // Update theme icon
        const moonIcon = toggleThemeButton.querySelector('.fa-moon');
        const sunIcon = toggleThemeButton.querySelector('.fa-sun');
        
        moonIcon.classList.toggle('hidden');
        sunIcon.classList.toggle('hidden');
    }
    
    // Check for prefers-color-scheme and set theme accordingly
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
        const moonIcon = toggleThemeButton.querySelector('.fa-moon');
        const sunIcon = toggleThemeButton.querySelector('.fa-sun');
        moonIcon.classList.add('hidden');
        sunIcon.classList.remove('hidden');
    }
    
    // Add debug function to test all available voices
    function testAllVoices() {
        if (!window.responsiveVoice) return;
        
        const allVoices = responsiveVoice.getVoices();
        console.log('All available voices:', allVoices);
        
        const testPhrase = "This is a test of the voice system.";
        let delay = 0;
        
        allVoices.forEach(voice => {
            setTimeout(() => {
                console.log(`Testing voice: ${voice.name}`);
                responsiveVoice.speak(testPhrase, voice.name);
            }, delay);
            delay += 3000; // Wait 3 seconds between voices
        });
    }
    
    // Test all voices - Uncomment this line to test all voices
    // setTimeout(testAllVoices, 2000); // Wait 2 seconds after page load before testing
    
    // Populate voice dropdown with available ResponsiveVoice voices
    function populateVoiceDropdown() {
        if (!window.responsiveVoice) {
            console.warn('ResponsiveVoice not available for voice selection');
            return;
        }
        
        // Get available voices
        const voices = responsiveVoice.getVoices();
        console.log('Found ResponsiveVoice voices:', voices.length);
        
        // If no voices found yet, use our preset list
        if (!voices || voices.length === 0) {
            console.log('No voices found from API, using preset list');
            return; // Keep the preset voices in HTML
        }
        
        // Clear existing options
        voiceSelect.innerHTML = '';
        
        // Get the default voice from config
        const defaultVoice = CONFIG.RESPONSIVEVOICE.defaultVoice;
        
        // List of common, reliable voices to ensure we include
        const reliableVoices = [
            'UK English Female',
            'UK English Male',
            'US English Female',
            'US English Male',
            'Australian Female',
            'Filipino Female',
            'French Female',
            'German Female',
            'Italian Female',
            'Japanese Female',
            'Spanish Female',
            'Spanish Male'
        ];
        
        // First add reliable voices
        reliableVoices.forEach(voiceName => {
            if (voices.some(v => v.name === voiceName)) {
                const option = document.createElement('option');
                option.value = voiceName;
                option.textContent = voiceName;
                
                // Set the default voice as selected
                if (voiceName === defaultVoice) {
                    option.selected = true;
                }
                
                // Use saved preference if available
                if (savedVoice && voiceName === savedVoice) {
                    option.selected = true;
                }
                
                voiceSelect.appendChild(option);
            }
        });
        
        // Speak a test message with the default voice to ensure it's working
        setTimeout(() => {
            if (audioInitialized) {
                // Just to ensure the voice system is initialized
                responsiveVoice.cancel();
            }
        }, 500);
        
        console.log(`Populated voice dropdown with ${voiceSelect.options.length} voices`);
    }
    
    /**
     * Toggles between English and Tagalog
     */
    function toggleLanguage() {
        // Switch between English and Tagalog
        currentLanguage = currentLanguage === 'en' ? 'tl' : 'en';
        
        // Save preference
        localStorage.setItem('preferredLanguage', currentLanguage);
        
        // Update button appearance
        updateLanguageButton();
        
        // Update speech recognition language
        speechRecognitionManager.setLanguage(currentLanguage);
        
        // Set appropriate voice based on language
        if (currentLanguage === 'tl') {
            // Set Filipino voice when Tagalog is selected
            for (let i = 0; i < voiceSelect.options.length; i++) {
                if (voiceSelect.options[i].value === 'Filipino Female') {
                    voiceSelect.selectedIndex = i;
                    break;
                }
            }
            
            // If Filipino voice option doesn't exist, use US English Female which handles Tagalog best
            if (voiceSelect.value !== 'Filipino Female') {
                for (let i = 0; i < voiceSelect.options.length; i++) {
                    if (voiceSelect.options[i].value === 'US English Female') {
                        voiceSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            
            // Announce language change if TTS is enabled
            if (audioInitialized && window.responsiveVoice && ttsEnabled) {
                // Use rate 0.9 for better Tagalog pronunciation
                responsiveVoice.speak("Tagalog mode activated. Maaari ka nang magsalita sa Tagalog.", voiceSelect.value, { rate: 0.9 });
            }
            
            // Add a hint message
            addSystemMessage("🇵🇭 Maaari ka nang magsalita sa Tagalog! (You can now speak in Tagalog!)");
        } else {
            // Set English voice when English is selected
            for (let i = 0; i < voiceSelect.options.length; i++) {
                if (voiceSelect.options[i].value === 'US English Female') {
                    voiceSelect.selectedIndex = i;
                    break;
                }
            }
            
            // Announce language change if TTS is enabled
            if (audioInitialized && window.responsiveVoice && ttsEnabled) {
                responsiveVoice.speak("English mode activated.", voiceSelect.value);
            }
            
            // Add a hint message
            addSystemMessage("🇺🇸 Switched to English mode!");
        }
        
        // Save voice preference
        localStorage.setItem('preferredVoice', voiceSelect.value);
    }
    
    /**
     * Updates the language button appearance
     */
    function updateLanguageButton() {
        if (currentLanguage === 'tl') {
            toggleLanguageButton.className = 'p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition transform hover:scale-105 shadow-sm animate-bounce-in';
            toggleLanguageButton.innerHTML = `
                <span class="inline-flex items-center">
                    <img src="https://flagcdn.com/16x12/ph.png" class="mr-1" alt="Philippines flag" />
                    <span class="text-sm font-medium">TL</span>
                </span>
            `;
        } else {
            toggleLanguageButton.className = 'p-2 rounded-full bg-secondary hover:bg-secondary-dark text-primary transition transform hover:scale-105 shadow-sm animate-bounce-in';
            toggleLanguageButton.innerHTML = `
                <span class="inline-flex items-center">
                    <img src="https://flagcdn.com/16x12/us.png" class="mr-1" alt="US flag" />
                    <span class="text-sm font-medium">EN</span>
                </span>
            `;
        }
    }
    
    /**
     * Adds a system message to the chat
     * @param {string} message - The system message
     * @param {string} type - The type of system message (info, success, warning, error)
     */
    function addSystemMessage(message, type = 'info') {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-center mb-4 animate-fade-in';
        
        // Determine the proper styles based on message type
        let bgColor, textColor, iconClass, borderColor, iconBg;
        switch (type) {
            case 'success':
                bgColor = 'bg-green-50 dark:bg-green-900/20';
                textColor = 'text-green-700 dark:text-green-300';
                borderColor = 'border-green-200 dark:border-green-700/30';
                iconClass = 'fa-check-circle text-green-500';
                iconBg = 'bg-green-100 dark:bg-green-800/50';
                break;
            case 'warning':
                bgColor = 'bg-amber-50 dark:bg-amber-900/20';
                textColor = 'text-amber-700 dark:text-amber-300';
                borderColor = 'border-amber-200 dark:border-amber-700/30';
                iconClass = 'fa-exclamation-triangle text-amber-500';
                iconBg = 'bg-amber-100 dark:bg-amber-800/50';
                break;
            case 'error':
                bgColor = 'bg-red-50 dark:bg-red-900/20';
                textColor = 'text-red-700 dark:text-red-300';
                borderColor = 'border-red-200 dark:border-red-700/30';
                iconClass = 'fa-times-circle text-red-500';
                iconBg = 'bg-red-100 dark:bg-red-800/50';
                break;
            default: // info
                bgColor = 'bg-indigo-50 dark:bg-indigo-900/20';
                textColor = 'text-indigo-700 dark:text-indigo-300';
                borderColor = 'border-indigo-200 dark:border-indigo-700/30';
                iconClass = 'fa-info-circle text-indigo-500';
                iconBg = 'bg-indigo-100 dark:bg-indigo-800/50';
        }
        
        messageElement.innerHTML = `
            <div class="relative ${bgColor} border ${borderColor} rounded-lg py-2 px-4 max-w-[90%] shadow-sm flex items-center">
                <div class="absolute -left-1 -top-1 w-8 h-8 ${iconBg} rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-gray-700">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="ml-6">
                    <div class="message-content ${textColor} text-sm font-light">
                        ${message}
                    </div>
                </div>
            </div>
        `;
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    /**
     * Adds an animated welcome message with a system introduction
     */
    function addWelcomeAnimation() {
        // Clear the initial empty state message
        chatContainer.innerHTML = '';
        
        // Add a stylized welcome message
        const welcomeElement = document.createElement('div');
        welcomeElement.className = 'relative flex justify-center mb-6 animate-fade-in';
        welcomeElement.innerHTML = `
            <div class="absolute -top-4 -left-4 w-24 h-24 bg-primary-light/10 rounded-full filter blur-xl animate-pulse-soft"></div>
            <div class="relative bg-gradient-to-r from-primary-light/20 to-accent-light/20 px-6 py-3 rounded-2xl shadow-sm
                        backdrop-blur-sm max-w-[90%] border border-white/10 dark:border-gray-700/30 z-10">
                <div class="text-center">
                    <div class="flex justify-center mb-2">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow mb-2 border-2 border-white dark:border-gray-700">
                            <span class="text-lg text-white font-bold font-display">J</span>
                        </div>
                    </div>
                    <h3 class="text-lg font-display font-semibold text-primary dark:text-primary-light mb-1">Welcome to Jasmine</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-300">Your personal AI assistant is ready to chat!</p>
                    <div class="mt-3 flex space-x-2 justify-center">
                        <button class="bg-primary hover:bg-primary-dark text-white text-xs py-1 px-3 rounded-full transition transform hover:scale-105 shadow-sm" onclick="document.getElementById('toggle-mic').click()">
                            <i class="fas fa-microphone mr-1"></i> Start Speaking
                        </button>
                        <button class="bg-secondary dark:bg-gray-700 hover:bg-secondary-dark dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-3 rounded-full transition transform hover:scale-105 shadow-sm" onclick="document.getElementById('message-input').focus()">
                            <i class="fas fa-keyboard mr-1"></i> Type a Message
                        </button>
                    </div>
                </div>
            </div>
        `;
        chatContainer.appendChild(welcomeElement);
        
        // Add the actual welcome message
        setTimeout(() => {
            addAIMessage(CONFIG.APP.welcomeMessage);
        }, 800);
    }
}); 