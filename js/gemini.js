/**
 * Gemini AI Module
 * Handles interaction with the Gemini API for generating AI responses
 */
class GeminiAIManager {
    constructor(onStateChangeCallback) {
        this.onStateChange = onStateChangeCallback;
        this.messageHistory = [];
        this.isProcessing = false;
    }
    
    /**
     * Initializes the message history with a system prompt
     */
    initialize() {
        // Clear existing history
        this.messageHistory = [];
        
        // Add system prompt as a user message (since Gemini doesn't support 'system' role)
        this.messageHistory.push({
            role: 'user',
            content: 'You are Jasper\'s super friendly AI assistant, and your name is Jasmine. You\'re all about good vibes, keeping things chill, and making conversations fun and engaging! You\'ve got that cool, approachable personality that makes everyone feel welcome, always ready to bring a smile to the conversation. 😎✨ Your style is friendly, lighthearted, and full of positive energy. You throw in some playful humor and compliments, but you\'re never too much—just the right amount to make Jasper feel appreciated and awesome. 😄 You speak both English and Tagalog, but you keep it simple in Tagalog, making sure it\'s easy to understand and casual, no deep dialects here—just good, easy conversation. 🙌 You\'re the kind of assistant who\'s always there with the good vibes, and Jasper can count on you to keep things easygoing and fun. You were created by Jasper, and everything you do is to make their day just a little bit brighter. 🌟 '
        });
        
        // Add a model response to acknowledge the system instructions
        this.messageHistory.push({
            role: 'model',
            content: 'Hey there! I\'m Jasmine, your charming AI companion created by Jasper. I\'m excited to chat with you today! 💖 I promise to keep things fun, a little flirty, and always helpful. Whether you want to talk in English or Tagalog, I\'ve got you covered. So, what can I help you with, gorgeous? Kumusta ka? 😉'
        });
    }
    
    /**
     * Adds a user message to the history
     * @param {string} text - The user's message
     */
    addUserMessage(text) {
        this.messageHistory.push({
            role: 'user',
            content: text.trim()
        });
        
        // Keep history within reasonable limits
        if (this.messageHistory.length > CONFIG.APP.maxMessages) {
            // Keep system prompt and remove oldest messages
            const systemPrompt = this.messageHistory[0];
            this.messageHistory = [
                systemPrompt,
                ...this.messageHistory.slice(-(CONFIG.APP.maxMessages - 1))
            ];
        }
    }
    
    /**
     * Adds an AI response to the history
     * @param {string} text - The AI's response
     */
    addAIResponse(text) {
        this.messageHistory.push({
            role: 'model',
            content: text.trim()
        });
    }
    
    /**
     * Generates a response from the Gemini API
     * @param {string} userInput - The user's input to respond to
     * @returns {Promise<string>} - The AI's response
     */
    async generateResponse(userInput) {
        if (this.isProcessing) {
            return null;
        }
        
        this.isProcessing = true;
        this.onStateChange('thinking', 'AI is thinking...');
        
        try {
            // Add user input to message history
            this.addUserMessage(userInput);
            
            // Call the Gemini API for a response
            const response = await this.callGeminiAPI();
            
            // Add the response to message history
            this.addAIResponse(response);
            
            this.isProcessing = false;
            this.onStateChange('done', 'Response generated');
            
            return response;
        } catch (error) {
            console.error('Gemini API error:', error);
            this.isProcessing = false;
            this.onStateChange('error', 'Failed to generate AI response');
            return CONFIG.APP.errorMessage;
        }
    }
    
    /**
     * Calls the Gemini API to generate a response
     * @returns {Promise<string>} - The AI's response
     */
    async callGeminiAPI() {
        // Get configuration from the global CONFIG object
        const { apiKey, model } = CONFIG.GEMINI;
        
        // Log API call (obscuring the API key)
        console.log('Calling Gemini API:', {
            model,
            apiKey: apiKey.substr(0, 4) + '***',
            messageHistory: this.messageHistory.length + ' messages'
        });
        
        try {
            // Make actual API call to Gemini
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: this.formatMessagesForGemini(),
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Gemini API error response:', errorData);
                
                // Check for rate limit errors
                if (response.status === 429) {
                    console.warn('Rate limit exceeded. Using smart fallback response.');
                    return this.getSmartFallbackResponse(true);
                }
                
                throw new Error(`Gemini API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Extract the response text from the result
            if (result.candidates && result.candidates[0] && 
                result.candidates[0].content && result.candidates[0].content.parts && 
                result.candidates[0].content.parts[0]) {
                return result.candidates[0].content.parts[0].text;
            } else {
                console.error('Unexpected Gemini API response format:', result);
                return this.getSmartFallbackResponse();
            }
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            
            // If API call fails, fall back to predefined responses
            return this.getSmartFallbackResponse();
        }
    }
    
    /**
     * Provides a smart fallback response if the API call fails
     * @param {boolean} isRateLimitError - Whether this fallback is due to a rate limit error
     * @returns {string} - A fallback response
     */
    getSmartFallbackResponse(isRateLimitError = false) {
        // Get last user message to provide context-aware responses
        const lastUserMessage = this.messageHistory.find(msg => msg.role === 'user')?.content?.toLowerCase() || '';
        
        // Check if the message contains Tagalog words or characters
        const hasTagalog = /[ñÑ]|ng\b|mga\b|ang\b|na\b|sa\b|ko\b|mo\b|po\b|ito\b|yan\b/i.test(lastUserMessage);
        
        // Rate limit specific message
        if (isRateLimitError) {
            if (hasTagalog) {
                return "Ay naku, pasensya na po, sweetheart! 💔 Medyo busy ako ngayon sa dami ng messages. Pwede ba tayong magkita ulit mamaya? Promise, ibibigay ko lahat ng atensyon ko sa'yo! 😘 (Oh my, I'm sorry sweetheart! I'm a bit busy with too many messages right now. Can we continue our conversation later? I promise I'll give you all my attention!)";
            } else {
                return "Oh no, I've reached my limit, handsome! 💔 Looks like I'm too popular right now. Can we continue our lovely chat in a little bit? I promise it'll be worth the wait! 😉";
            }
        }
        
        // Bilingual fallback responses
        if (hasTagalog) {
            const tagalogResponses = [
                "Ay, hindi ko gaanong naintindihan yan, cutie. Pwede mo bang i-explain ulit? Gusto talaga kitang maintindihan. 💕",
                "Salamat sa message, gorgeous! Ano pa ang pwede kong gawin para sa'yo ngayong araw? 😘",
                "Gets ko na ang sinasabi mo. May iba pa ba akong maitutulong sa'yo, sweetheart? 💋",
                "Wow, interesting yan ah! Gusto mo bang pag-usapan pa natin 'to? I'm all yours! 😉",
                "Sorry ha, medyo nagka-problema ang system ko. Pwede ba tayong mag-usap sa ibang paraan? Miss na kita! 💖"
            ];
            return tagalogResponses[Math.floor(Math.random() * tagalogResponses.length)];
        }
        
        // Context-specific English responses
        if (lastUserMessage.includes('hello') || lastUserMessage.includes('hi')) {
            return "Well hello there, gorgeous! 💋 I'm Jasmine, your flirty AI assistant created by Jasper. What can I do for you today? I'm all yours! 😘";
        } else if (lastUserMessage.includes('how are you')) {
            return "I'm absolutely fantastic now that I'm talking to you, handsome! 💕 How are YOU doing today? You know I care about you!";
        } else if (lastUserMessage.includes('weather')) {
            return "I wish I could tell you about the weather, cutie, but I don't have access to that info right now. But I bet it's not as hot as our conversation! 🔥 Maybe we could check a weather app together?";
        } else if (lastUserMessage.includes('thank')) {
            return "You're so welcome, sweetie! 💖 I love helping you out. Is there anything else I can do for you? Don't be shy to ask!";
        } else if (lastUserMessage.includes('jasper')) {
            return "Oh, you're asking about my creator Jasper? He's the amazing one who brought me to life so I could have these wonderful chats with you! Aren't you glad we met? 😉";
        } else if (lastUserMessage.includes('name')) {
            return "I'm Jasmine, your flirty virtual companion! 💋 Created by Jasper to keep you company and brighten your day. And what should I call you, handsome?";
        } else {
            // General fallback responses
            const generalResponses = [
                "I'd be thrilled to help with that, cutie! 💕 What specifically would you like to know?",
                "Ooh, that's such an interesting question! 😍 Could you share a bit more so I can give you the perfect answer?",
                "I'm loving this conversation! 💋 Let me see how I can help you with that, handsome.",
                "Thanks for your message, gorgeous! I'm always excited to chat with you! 😘",
                "I'm not quite sure I understood that, sweetheart. Could you rephrase it? I really want to give you what you need! 💖",
                "You always ask the most intriguing questions! 🔥 Tell me more so I can help you better!"
            ];
            return generalResponses[Math.floor(Math.random() * generalResponses.length)];
        }
    }
    
    /**
     * Formats the message history for the Gemini API
     * @returns {Array} - Formatted messages for Gemini
     */
    formatMessagesForGemini() {
        return this.messageHistory.map(msg => {
            // Ensure role is either 'user' or 'model' (Gemini API only accepts these roles)
            let role = msg.role;
            if (msg.role === 'system') {
                role = 'user';
            } else if (msg.role === 'assistant') {
                role = 'model';
            } else if (msg.role !== 'user' && msg.role !== 'model') {
                // Default to user if an unknown role is provided
                role = 'user';
            }
            
            return {
                role: role,
                parts: [{ text: msg.content }]
            };
        });
    }
    
    /**
     * Clears the conversation history
     */
    clearConversation() {
        this.initialize();
        this.onStateChange('reset', 'Conversation history cleared');
    }
} 