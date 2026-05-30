// Chatbot Frontend Component - Frank the LMS Assistant
// Integrated with AI backend
// UPDATED: Handles async responses for Supabase integration

let chatbotOpen = false;
let chatHistory = [];

// Initialize chatbot
document.addEventListener('DOMContentLoaded', function() {
    initializeChatbot();
});

function initializeChatbot() {
    // Check if chatbot container exists
    const chatbotContainer = document.getElementById('chatbot-container');
    if (!chatbotContainer) return;
    
    // Add welcome message from Frank
    const welcomeMessage = 'Hello! I\'m Frank, your LMS assistant. Knowledge is power! How can I help you today?';
    addMessage('bot', welcomeMessage);
    
    // Setup form submission
    const chatForm = document.getElementById('chatbot-form');
    if (chatForm) {
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const input = document.getElementById('chatbot-input');
            if (input && input.value.trim()) {
                sendMessage(input.value.trim());
                input.value = '';
            }
        });
    }
    
    // Allow Enter key to send (Shift+Enter for new line)
    const chatInput = document.getElementById('chatbot-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    }
}

// Toggle chatbot window
window.toggleChatbot = function() {
    chatbotOpen = !chatbotOpen;
    const chatbotContainer = document.getElementById('chatbot-container');
    const chatbotWindow = document.getElementById('chatbot-window');
    const chatbotButton = document.getElementById('chatbot-button');
    
    if (!chatbotContainer || !chatbotWindow || !chatbotButton) return;
    
    if (chatbotOpen) {
        chatbotWindow.style.display = 'flex';
        chatbotButton.style.display = 'none';
        // Focus on input when opening
        setTimeout(() => {
            const input = document.getElementById('chatbot-input');
            if (input) input.focus();
        }, 100);
        // Scroll to bottom
        scrollChatToBottom();
    } else {
        chatbotWindow.style.display = 'none';
        chatbotButton.style.display = 'flex';
    }
};

// Close chatbot
window.closeChatbot = function() {
    chatbotOpen = false;
    const chatbotWindow = document.getElementById('chatbot-window');
    const chatbotButton = document.getElementById('chatbot-button');
    
    if (chatbotWindow) chatbotWindow.style.display = 'none';
    if (chatbotButton) chatbotButton.style.display = 'flex';
};

// Send message
function sendMessage(message) {
    if (!message.trim()) return;
    
    // Add user message
    addMessage('user', message);
    
    // Process message (placeholder for future AI integration)
    processMessage(message);
}

// Add message to chat
function addMessage(type, text) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message chatbot-message-${type}`;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="chatbot-message-content">
            ${type === 'bot' ? '<div class="chatbot-avatar">🤖</div>' : ''}
            <div class="chatbot-text">
                <p>${escapeHtml(text)}</p>
                <span class="chatbot-timestamp">${timestamp}</span>
            </div>
            ${type === 'user' ? '<div class="chatbot-avatar">👤</div>' : ''}
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    // Store in history
    chatHistory.push({ type, text, timestamp: new Date().toISOString() });
    
    // Scroll to bottom
    scrollChatToBottom();
}

// Process message with AI backend integration
async function processMessage(message) {
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Try AI backend first (if configured)
        if (typeof sendToAIBackend === 'function') {
            try {
                const response = await sendToAIBackend(message, chatHistory.slice(-10)); // Last 10 messages for context
                hideTypingIndicator();
                addMessage('bot', response);
                return;
            } catch (error) {
                console.warn('AI backend error, falling back to local response:', error);
                // Fall through to local response
            }
        }
        
        // Fallback to local response
        setTimeout(async () => {
            hideTypingIndicator();
            const response = await getResponse(message);
            addMessage('bot', response);
        }, 500 + Math.random() * 500); // Shorter delay for local responses
        
    } catch (error) {
        console.error('Error processing message:', error);
        hideTypingIndicator();
        addMessage('bot', 'I apologize, but I encountered an error. Please try again or contact support.');
    }
}

// Get local fallback response (enhanced with context)
async function getResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Use local fallback from chatbot-api.js if available
    if (typeof getLocalResponse === 'function') {
        return await getLocalResponse(message);
    }
    
    // Basic keyword responses (fallback)
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        return 'Hello! I\'m Frank, your LMS assistant. Knowledge is power! How can I help you today?';
    }
    
    if (lowerMessage.includes('help')) {
        return 'I\'m Frank, here to help! Knowledge is power!\n\nYou can ask me about:\n- Course information\n- Exam schedules\n- Results\n- Materials\n- General questions\n\nAI features are being enhanced for better assistance!';
    }
    
    if (lowerMessage.includes('exam') || lowerMessage.includes('quiz')) {
        return 'You can find all available exams and quizzes in the "Exams & Quizzes" section of your dashboard. Check the schedule for exam dates and times.';
    }
    
    if (lowerMessage.includes('result') || lowerMessage.includes('score') || lowerMessage.includes('grade')) {
        return 'You can view your results in the "My Results" section. Results are released by your lecturers after grading.';
    }
    
    if (lowerMessage.includes('material') || lowerMessage.includes('resource') || lowerMessage.includes('course material')) {
        return 'Course materials are available in the "Course Materials" section. Your lecturers upload materials for each subject.';
    }
    
    if (lowerMessage.includes('password') || lowerMessage.includes('reset')) {
        return 'To reset your password, click "Forgot Password?" on the login page. You\'ll need your username/email and registered telephone number.';
    }
    
    if (lowerMessage.includes('class') || lowerMessage.includes('schedule')) {
        return 'You can view your class schedule and upcoming events in the "Calendar" section of your dashboard.';
    }
    
    if (lowerMessage.includes('announcement')) {
        return 'Check the "Announcements" section for important updates and messages from your lecturers and administrators.';
    }
    
    if (lowerMessage.includes('progress')) {
        return 'View your academic progress, performance trends, and subject-wise breakdown in the "My Progress" section.';
    }
    
    if (lowerMessage.includes('thank')) {
        return 'You\'re welcome! Knowledge is power - feel free to ask if you need any more assistance!';
    }
    
    if (lowerMessage.includes('name') || lowerMessage.includes('who are you')) {
        return 'I\'m Frank, your friendly LMS assistant! Knowledge is power - I\'m here to help you navigate and use the Signals Training School LMS effectively.';
    }
    
    if (lowerMessage.includes('motto')) {
        return 'Our school motto is: "Knowledge is power" - This reflects our commitment to empowering students through knowledge and education.';
    }
    
    // Default response
    return `Thank you for your message! I'm Frank, and I'm here to help. Knowledge is power!\n\nFor now, I can help with basic questions. Advanced AI features are being enhanced!\n\nYou can:\n- Browse your dashboard sections\n- Check the FAQ section\n- Contact your lecturers or administrators\n\nYour message: "${message}"\n\nWould you like help with something specific?`;
}

// Show typing indicator
function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.id = 'chatbot-typing';
    typingDiv.className = 'chatbot-message chatbot-message-bot';
    typingDiv.innerHTML = `
        <div class="chatbot-message-content">
            <div class="chatbot-avatar">🤖</div>
            <div class="chatbot-text">
                <div class="chatbot-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(typingDiv);
    scrollChatToBottom();
}

// Hide typing indicator
function hideTypingIndicator() {
    const typingDiv = document.getElementById('chatbot-typing');
    if (typingDiv) {
        typingDiv.remove();
    }
}

// Scroll chat to bottom
function scrollChatToBottom() {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Clear chat history
window.clearChatbot = function() {
    if (confirm('Are you sure you want to clear the chat history?')) {
        const messagesContainer = document.getElementById('chatbot-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            chatHistory = [];
            // Add welcome message again from Frank
            addMessage('bot', 'Chat cleared! I\'m Frank, your LMS assistant. Knowledge is power! How can I help you today?');
        }
    }
};

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Export function for AI integration (now uses backend)
window.sendToAI = async function(message) {
    if (typeof sendToAIBackend === 'function') {
        try {
            return await sendToAIBackend(message, chatHistory.slice(-10));
        } catch (error) {
            console.error('AI backend error:', error);
            return await getResponse(message);
        }
    }
    return await getResponse(message);
};
