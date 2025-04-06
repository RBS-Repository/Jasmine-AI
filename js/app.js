/**
 * Main Application Script
 * Initializes and coordinates all modules for the voice chat application
 */
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const toggleMicButton = document.getElementById('toggle-mic');
    const statusIndicator = document.getElementById('status-indicator');
    const voiceSelect = document.getElementById('voice-select');
    const toggleThemeButton = document.getElementById('toggle-theme');
    const toggleLanguageButton = document.getElementById('toggle-language');
    
    let currentUserMessage = '';
    let currentTranscript = '';
    let userMessageElement = null;
    let aiResponseElement = null;
    let audioInitialized = false;
    let permissionsRequested = false;
    let currentLanguage = localStorage.getItem('preferredLanguage') || 'en'; // Default to English
    let microphonePermissionGranted = localStorage.getItem('microphonePermission') === 'granted';
    
    // Initialize managers
    const speechRecognitionManager = new SpeechRecognitionManager(
        handleSpeechResult,
        updateStatus
    );
    
    // Enable silent mode for speech recognition (reduces console logging)
    speechRecognitionManager.toggleSilentMode(true);
    
    const ttsManager = new TextToSpeechManager(updateStatus);
    
    const geminiManager = new GeminiAIManager(updateStatus);
    geminiManager.initialize();
    
    // If we have stored permission, set it immediately
    if (microphonePermissionGranted) {
        speechRecognitionManager.setPermissionGranted(true);
        permissionsRequested = true;
        console.log('Initializing with stored microphone permission: granted');
    }
    
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
        if (window.responsiveVoice) {
            audioInitialized = true; // Mark as initialized
            responsiveVoice.speak("Voice changed to " + selectedVoice, selectedVoice);
        }
    });
    
    // Optional: Add a button to test the current voice
    const testVoiceButton = document.createElement('button');
    testVoiceButton.innerHTML = '<i class="fas fa-play"></i>';
    testVoiceButton.className = 'p-2 ml-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm';
    testVoiceButton.title = 'Test selected voice';
    testVoiceButton.onclick = () => {
        const currentVoice = voiceSelect.value;
        if (window.responsiveVoice) {
            audioInitialized = true; // Mark as initialized
            responsiveVoice.speak("This is a test of the " + currentVoice + " voice.", currentVoice);
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
        // Play welcome message after user interaction
        ttsManager.speak(CONFIG.APP.welcomeMessage);
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
        
        // Speak the response
        ttsManager.speak(response, selectedVoice);
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
        
        // Speak the response using ResponsiveVoice
        ttsManager.speak(response, selectedVoice);
    }
    
    /**
     * Adds a user message element to prepare for speech recognition
     * @param {string} text - Initial text (might be empty or interim)
     */
    function addUserMessageElement(text) {
        userMessageElement = document.createElement('div');
        userMessageElement.className = 'flex justify-end mb-4';
        userMessageElement.innerHTML = `
            <div class="message-bubble user-message bg-secondary text-gray-800 rounded-2xl rounded-tr-none py-3 px-4 max-w-[80%] shadow-sm">
                <div class="message-content">${text || ''}</div>
            </div>
        `;
        chatContainer.appendChild(userMessageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    /**
     * Adds a user message to the chat
     * @param {string} message - The user's message
     */
    function addUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-end mb-4';
        messageElement.innerHTML = `
            <div class="message-bubble user-message bg-secondary text-gray-800 rounded-2xl rounded-tr-none py-3 px-4 max-w-[80%] shadow-sm">
                <div class="message-content">${message}</div>
            </div>
        `;
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    /**
     * Adds an AI thinking message to the chat
     */
    function addAIThinkingMessage() {
        aiResponseElement = document.createElement('div');
        aiResponseElement.className = 'flex mb-4';
        aiResponseElement.innerHTML = `
            <div class="message-bubble ai-message bg-white text-gray-800 rounded-2xl rounded-tl-none py-3 px-4 max-w-[80%] shadow-sm">
                <div class="message-content flex items-center">
                    <span class="mr-2">Jasmine is thinking</span>
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
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
     * Adds an AI message to the chat
     * @param {string} message - The AI's message
     */
    function addAIMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex mb-4';
        messageElement.innerHTML = `
            <div class="message-bubble ai-message bg-white text-gray-800 rounded-2xl rounded-tl-none py-3 px-4 max-w-[80%] shadow-sm">
                <div class="message-content">${message}</div>
            </div>
        `;
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
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
        
        // Determine the status dot color and icon
        switch (status) {
            case 'listening':
                statusDot = 'bg-green-400';
                statusColor = 'text-green-600';
                iconClass = 'fa-solid fa-headset';
                break;
            case 'speaking':
                statusDot = 'bg-blue-400';
                statusColor = 'text-blue-600';
                iconClass = 'fa-solid fa-volume-high';
                break;
            case 'thinking':
                statusDot = 'bg-yellow-400';
                statusColor = 'text-yellow-600';
                iconClass = 'fa-solid fa-brain';
                break;
            case 'error':
                statusDot = 'bg-red-400';
                statusColor = 'text-red-600';
                iconClass = 'fa-solid fa-circle-exclamation';
                break;
            case 'info':
                statusDot = 'bg-indigo-400';
                statusColor = 'text-indigo-600';
                iconClass = 'fa-solid fa-circle-info';
                break;
            default:
                statusDot = 'bg-gray-400';
                statusColor = 'text-gray-600';
                iconClass = 'fa-solid fa-circle-dot';
        }
        
        // Update the status indicator with animated dot
        statusIndicator.innerHTML = `
            <span class="inline-flex items-center">
                <span class="w-2 h-2 ${statusDot} rounded-full mr-2 animate-pulse"></span>
                <i class="${iconClass} ${statusColor} mr-2 text-xs"></i>
                <span class="font-medium">${message}</span>
            </span>
        `;
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
            
            // Announce language change
            if (audioInitialized && window.responsiveVoice) {
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
            
            // Announce language change
            if (audioInitialized && window.responsiveVoice) {
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
     */
    function addSystemMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-center mb-4 animate-fade-in';
        messageElement.innerHTML = `
            <div class="bg-secondary-light text-gray-500 rounded-full py-2 px-4 max-w-[80%] text-sm font-light shadow-sm">
                <div class="message-content">${message}</div>
            </div>
        `;
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}); 