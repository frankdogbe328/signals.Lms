// Chatbot API Integration
// Handles AI backend communication for Frank the Chatbot
// UPDATED: Supports async data access for Supabase integration

const CHATBOT_CONFIG = {
    name: 'Frank',
    motto: 'Knowledge is power',
    // AI Service Configuration
    // Options: 'openai', 'anthropic', 'groq', 'huggingface', 'custom'
    aiService: 'openai', // Change this based on your AI service
    apiKey: '', // Will be set via environment or config
    model: 'gpt-4', // or 'claude-3-opus', 'llama-3.3-70b-versatile', etc.
    temperature: 0.7,
    maxTokens: 1000
};

/**
 * Get system prompt for Frank
 */
async function getSystemPrompt() {
    const user = getChatbotUserContext();
    const context = await getChatbotContext();
    
    let userContext = '';
    if (user) {
        userContext = `\nCurrent User: ${user.name} (${user.type})\n`;
        if (user.class) userContext += `Class: ${user.class}\n`;
        if (user.subjects) userContext += `Subjects: ${user.subjects.join(', ')}\n`;
    }
    
    return `You are Frank, the friendly and helpful AI assistant for Signals Training School LMS.

School Motto: "${CHATBOT_CONFIG.motto}"

Your role is to help students, lecturers, and administrators navigate and use the LMS system effectively.

${userContext}

You have access to the following information:
- User's current context and portal
- Available exams, results, materials, and announcements
- System features and capabilities

Guidelines:
- Be friendly, professional, and helpful
- Use the school motto when appropriate
- Provide accurate, step-by-step instructions
- Reference specific sections and features when helping
- If you don't know something, admit it and suggest contacting support
- Keep responses concise but complete
- Use emojis sparingly and appropriately
- Always prioritize user privacy and data security

Remember: Knowledge is power - help users gain knowledge about the system!`;
}

/**
 * Send message to AI backend
 */
async function sendToAIBackend(message, history = []) {
    try {
        const context = await getChatbotContext();
        const systemPrompt = await getSystemPrompt();
        
        // Prepare messages for AI
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            ...history.map(h => ({
                role: h.type === 'user' ? 'user' : 'assistant',
                content: h.text
            })),
            {
                role: 'user',
                content: message
            }
        ];
        
        // Add context information to user message
        const contextInfo = formatContextForAI(context);
        if (contextInfo) {
            messages[messages.length - 1].content += `\n\n[System Context: ${contextInfo}]`;
        }
        
        // Call appropriate AI service
        switch (CHATBOT_CONFIG.aiService) {
            case 'openai':
                return await callOpenAI(messages);
            case 'anthropic':
                return await callAnthropic(messages);
            case 'groq':
                return await callGroq(messages);
            case 'huggingface':
                return await callHuggingFace(messages); // Assuming implementation exists or using local fallback
            case 'custom':
                return await callCustomAPI(messages);
            default:
                return await callOpenAI(messages); // Default to OpenAI
        }
    } catch (error) {
        console.error('Error calling AI backend:', error);
        throw error;
    }
}

/**
 * Format context for AI consumption
 */
function formatContextForAI(context) {
    if (!context) return null;
    
    const parts = [];
    
    if (context.user) {
        parts.push(`User: ${context.user.name} (${context.user.type})`);
    }
    
    if (context.exams && context.exams.length > 0) {
        parts.push(`${context.exams.length} exam(s) available`);
    }
    
    if (context.results && context.results.length > 0) {
        parts.push(`${context.results.length} result(s) available`);
    }
    
    if (context.materials && context.materials.length > 0) {
        parts.push(`${context.materials.length} material(s) available`);
    }
    
    if (context.announcements && context.announcements.length > 0) {
        parts.push(`${context.announcements.length} announcement(s) available`);
    }
    
    if (context.stats) {
        parts.push(`System: ${context.stats.totalStudents} students, ${context.stats.totalLecturers} lecturers`);
    }
    
    return parts.join('; ');
}

/**
 * Call OpenAI API
 */
async function callOpenAI(messages) {
    if (!CHATBOT_CONFIG.apiKey) {
        // Fallback to local processing if no API key
        return await getLocalResponse(messages[messages.length - 1].content);
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHATBOT_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: CHATBOT_CONFIG.model,
                messages: messages,
                temperature: CHATBOT_CONFIG.temperature,
                max_tokens: CHATBOT_CONFIG.maxTokens
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API error');
        }
        
        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error('OpenAI API error:', error);
        // Fallback to local response
        return await getLocalResponse(messages[messages.length - 1].content);
    }
}

/**
 * Call Groq API (FREE - Fast & Free)
 */
async function callGroq(messages) {
    if (!CHATBOT_CONFIG.apiKey) {
        console.warn('Groq API key not configured, using local responses');
        return await getLocalResponse(messages[messages.length - 1].content);
    }
    
    // Validate messages format
    if (!Array.isArray(messages) || messages.length === 0) {
        console.error('Invalid messages format for Groq API');
        return await getLocalResponse('I apologize, but there was an error processing your message.');
    }
    
    // Validate each message has required fields
    const validMessages = messages.filter(m => m.role && m.content);
    if (validMessages.length === 0) {
        console.error('No valid messages found');
        return await getLocalResponse('I apologize, but there was an error processing your message.');
    }
    
    try {
        const requestBody = {
            model: CHATBOT_CONFIG.model || 'llama-3.3-70b-versatile', // Updated: Using supported model
            messages: validMessages,
            temperature: typeof CHATBOT_CONFIG.temperature === 'number' ? CHATBOT_CONFIG.temperature : 0.7,
            max_tokens: typeof CHATBOT_CONFIG.maxTokens === 'number' ? CHATBOT_CONFIG.maxTokens : 1000
        };
        
        // Validate request body
        if (!requestBody.model || requestBody.model.trim() === '') {
            console.error('Invalid model name for Groq API');
            return await getLocalResponse(messages[messages.length - 1].content);
        }
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHATBOT_CONFIG.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `Groq API error: ${response.status} ${response.statusText}`;
            
            // Check for model deprecation error
            if (errorMessage.includes('decommissioned') || errorMessage.includes('no longer supported')) {
                console.error('Model deprecation detected:', errorMessage);
                console.warn('Please update chatbot-config.js to use a supported model like llama-3.3-70b-versatile');
            }
            
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from Groq API');
        }
        
        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Groq API error:', error);
        console.log('Falling back to local response...');
        return await getLocalResponse(messages[messages.length - 1].content);
    }
}

/**
 * Call Anthropic API
 */
async function callAnthropic(messages) {
    if (!CHATBOT_CONFIG.apiKey) {
        return await getLocalResponse(messages[messages.length - 1].content);
    }
    
    try {
        // Convert messages format for Anthropic
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');
        
        const systemPrompt = systemMessage?.content || await getSystemPrompt();

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CHATBOT_CONFIG.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: CHATBOT_CONFIG.model || 'claude-3-opus-20240229',
                max_tokens: CHATBOT_CONFIG.maxTokens,
                system: systemPrompt,
                messages: conversationMessages.map(m => ({
                    role: m.role,
                    content: m.content
                }))
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Anthropic API error');
        }
        
        const data = await response.json();
        return data.content[0].text.trim();
    } catch (error) {
        console.error('Anthropic API error:', error);
        return await getLocalResponse(messages[messages.length - 1].content);
    }
}

/**
 * Call custom API endpoint
 */
async function callCustomAPI(messages) {
    try {
        const response = await fetch('/api/chatbot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messages,
                config: CHATBOT_CONFIG
            })
        });
        
        if (!response.ok) {
            throw new Error('Custom API error');
        }
        
        const data = await response.json();
        return data.response || data.message || 'I apologize, but I encountered an error.';
    } catch (error) {
        console.error('Custom API error:', error);
        return await getLocalResponse(messages[messages.length - 1].content);
    }
}

/**
 * Local fallback response (enhanced with context)
 */
async function getLocalResponse(message) {
    const lowerMessage = message.toLowerCase();
    const context = await getChatbotContext();
    
    // Enhanced keyword matching with context awareness
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        return `Hello! I'm ${CHATBOT_CONFIG.name}, your LMS assistant. ${CHATBOT_CONFIG.motto}! How can I help you today?`;
    }
    
    if (lowerMessage.includes('help')) {
        let helpText = `I'm ${CHATBOT_CONFIG.name}, here to help! ${CHATBOT_CONFIG.motto}\n\n`;
        if (context && context.user) {
            if (context.user.type === 'student') {
                helpText += 'As a student, you can ask me about:\n';
                helpText += '- Taking exams\n';
                helpText += '- Viewing results\n';
                helpText += '- Accessing materials\n';
                helpText += '- Checking announcements\n';
                helpText += '- Your progress\n';
                if (context.exams && context.exams.length > 0) {
                    helpText += `\nYou have ${context.exams.length} exam(s) available.`;
                }
            } else if (context.user.type === 'lecturer') {
                helpText += 'As a lecturer, you can ask me about:\n';
                helpText += '- Creating exams\n';
                helpText += '- Uploading materials\n';
                helpText += '- Viewing results\n';
                helpText += '- Creating announcements\n';
                helpText += '- Managing your exams\n';
            } else if (context.user.type === 'admin') {
                helpText += 'As an admin, you can ask me about:\n';
                helpText += '- Managing classes and courses\n';
                helpText += '- Managing users\n';
                helpText += '- Releasing results\n';
                helpText += '- System settings\n';
            }
        } else {
            helpText += 'You can ask me about:\n';
            helpText += '- Course information\n';
            helpText += '- Exam schedules\n';
            helpText += '- Results\n';
            helpText += '- Materials\n';
            helpText += '- General questions\n';
        }
        helpText += '\n\nAI features are being enhanced. For now, I can help with basic questions!';
        return helpText;
    }
    
    if (lowerMessage.includes('exam') || lowerMessage.includes('quiz')) {
        let response = 'You can find all available exams and quizzes in the "Exams & Quizzes" section. ';
        if (context && context.exams && context.exams.length > 0) {
            const activeExams = context.exams.filter(e => e.status === 'active');
            const upcomingExams = context.exams.filter(e => e.status === 'upcoming');
            if (activeExams.length > 0) {
                response += `You have ${activeExams.length} active exam(s) right now! `;
            }
            if (upcomingExams.length > 0) {
                response += `You have ${upcomingExams.length} upcoming exam(s). `;
            }
        }
        response += 'Check the schedule for exam dates and times.';
        return response;
    }
    
    if (lowerMessage.includes('result') || lowerMessage.includes('score') || lowerMessage.includes('grade')) {
        let response = 'You can view your results in the "My Results" section. ';
        if (context && context.results && context.results.length > 0) {
            response += `You have ${context.results.length} released result(s). `;
        }
        response += 'Results are released by your lecturers after grading.';
        return response;
    }
    
    if (lowerMessage.includes('material') || lowerMessage.includes('resource') || lowerMessage.includes('course material')) {
        let response = 'Course materials are available in the "Course Materials" section. ';
        if (context && context.materials && context.materials.length > 0) {
            response += `You have ${context.materials.length} material(s) available. `;
        }
        response += 'Your lecturers upload materials for each subject.';
        return response;
    }
    
    if (lowerMessage.includes('password') || lowerMessage.includes('reset')) {
        return 'To reset your password, click "Forgot Password?" on the login page. You\'ll need your username/email and registered telephone number.';
    }
    
    if (lowerMessage.includes('class') || lowerMessage.includes('schedule')) {
        return 'You can view your class schedule and upcoming events in the "Calendar" section of your dashboard.';
    }
    
    if (lowerMessage.includes('announcement')) {
        let response = 'Check the "Announcements" section for important updates. ';
        if (context && context.announcements && context.announcements.length > 0) {
            response += `You have ${context.announcements.length} announcement(s). `;
        }
        response += 'These are messages from your lecturers and administrators.';
        return response;
    }
    
    if (lowerMessage.includes('progress')) {
        let response = 'View your academic progress in the "My Progress" section. ';
        if (context && context.progress) {
            response += `You've completed ${context.progress.totalExams} exam(s) with an average score of ${context.progress.averageScore}%. `;
        }
        response += 'You can see performance trends and subject-wise breakdown there.';
        return response;
    }
    
    if (lowerMessage.includes('thank')) {
        return `You're welcome! ${CHATBOT_CONFIG.motto} - Feel free to ask if you need any more assistance!`;
    }
    
    if (lowerMessage.includes('name') || lowerMessage.includes('who are you')) {
        return `I'm ${CHATBOT_CONFIG.name}, your friendly LMS assistant! ${CHATBOT_CONFIG.motto} - I'm here to help you navigate and use the Signals Training School LMS effectively.`;
    }
    
    if (lowerMessage.includes('motto') || lowerMessage.includes('motto')) {
        return `Our school motto is: "${CHATBOT_CONFIG.motto}" - This reflects our commitment to empowering students through knowledge and education.`;
    }
    
    // Default response with context
    let defaultResponse = `Thank you for your message! I'm ${CHATBOT_CONFIG.name}, and I'm here to help. ${CHATBOT_CONFIG.motto}\n\n`;
    defaultResponse += 'For now, I can help with basic questions. Advanced AI features are being enhanced!\n\n';
    defaultResponse += 'You can:\n';
    defaultResponse += '- Browse your dashboard sections\n';
    defaultResponse += '- Check the FAQ section\n';
    defaultResponse += '- Contact your lecturers or administrators\n\n';
    defaultResponse += `Your message: "${message}"\n\n`;
    defaultResponse += 'Would you like help with something specific?';
    
    return defaultResponse;
}

/**
 * Configure chatbot API
 */
function configureChatbotAPI(config) {
    Object.assign(CHATBOT_CONFIG, config);
}

/**
 * Get chatbot configuration
 */
function getChatbotConfig() {
    return { ...CHATBOT_CONFIG };
}

// Export functions
window.sendToAIBackend = sendToAIBackend;
window.configureChatbotAPI = configureChatbotAPI;
window.getChatbotConfig = getChatbotConfig;
window.getSystemPrompt = getSystemPrompt;
