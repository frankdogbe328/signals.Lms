// Frank Chatbot Configuration
// ⚠️ DO NOT COMMIT THIS FILE TO GIT!
// Add chatbot-config.js to .gitignore

// Configure Frank with Groq API (FREE)
if (typeof configureChatbotAPI === 'function') {
    configureChatbotAPI({
        aiService: 'groq',
        apiKey: '',  // Set your Groq API key here (get one free at console.groq.com)
        model: 'llama-3.3-70b-versatile', // Updated: Using supported model (replaced deprecated llama-3.1-70b-versatile)
        temperature: 0.7,
        maxTokens: 1000
    });
    
    console.log('✅ Frank configured with Groq API (llama-3.3-70b-versatile)!');
} else {
    console.warn('⚠️ configureChatbotAPI function not found. Make sure chatbot-api.js is loaded first.');
}
