// Exam Security and Proctoring Module
// Implements: Browser Lockdown, Keyboard Blocking, Question Randomization,
// Plagiarism Checking, Response Pattern Analysis, and Auto-Proctoring

let examSecurity = {
    isActive: false,
    randomizedQuestions: [],
    originalQuestionOrder: [],
    proctoringData: {
        tabSwitches: 0,
        copyAttempts: 0,
        pasteAttempts: 0,
        rightClickAttempts: 0,
        focusEvents: 0,
        unauthorizedKeys: [],
        suspiciousPatterns: [],
        responseTimes: [],
        startTime: null,
        lastActivity: null
    },
    answerPatterns: {},
    timeLimit: null,
    autoSubmitTimer: null
};

// Initialize exam security (alias for compatibility)
function initializeExamSecurity(exam) {
    if (exam && exam.questions) {
        initExamSecurity(exam, exam.questions);
    }
}

// Initialize exam security
function initExamSecurity(exam, questions) {
    examSecurity.isActive = true;
    examSecurity.proctoringData.startTime = new Date();
    examSecurity.proctoringData.lastActivity = new Date();
    
    // Ensure questions is an array
    if (!questions || !Array.isArray(questions)) {
        console.error('Invalid questions array:', questions);
        questions = exam.questions || [];
    }
    
    // Validate questions have required fields
    const validQuestions = questions.filter(q => {
        if (!q || !q.question || q.question.trim() === '') {
            console.warn('Invalid question found (missing question text):', q);
            return false;
        }
        return true;
    });
    
    if (validQuestions.length === 0) {
        console.error('No valid questions found after filtering:', questions);
        alert('Error: Exam has no valid questions. Please contact your lecturer.');
        return;
    }
    
    console.log('=== EXAM SECURITY INITIALIZATION ===');
    console.log('Total questions received:', questions.length);
    console.log('Valid questions after filtering:', validQuestions.length);
    console.log('First question sample:', validQuestions[0]);
    
    // Use questions with stable mapping for randomization
    examSecurity.originalQuestionOrder = validQuestions.map((q, idx) => ({
        ...q,
        originalIndex: idx
    }));
    
    // Enable randomization
    examSecurity.randomizedQuestions = shuffleArray([...examSecurity.originalQuestionOrder]);
    
    console.log('Questions randomized for student:', {
        originalCount: examSecurity.originalQuestionOrder.length,
        randomizedCount: examSecurity.randomizedQuestions.length,
        isRandomized: JSON.stringify(examSecurity.originalQuestionOrder.map(q => q.originalIndex)) !== 
                     JSON.stringify(examSecurity.randomizedQuestions.map(q => q.originalIndex)),
        firstQuestionOriginalIndex: examSecurity.randomizedQuestions[0]?.originalIndex
    });
    
    // Calculate time limit
    const startTime = new Date(exam.startTime);
    const endTime = new Date(startTime.getTime() + exam.duration * 60 * 1000);
    examSecurity.timeLimit = endTime;
    examSecurity.examId = exam.id; // Store examId for logging
    examSecurity.examTitle = exam.title; // Store title for logging
    
    // Log exam start
    if (typeof window.logAction === 'function') {
        window.logAction('EXAM_START', `Started exam: ${exam.title} (${exam.id})`, { 
            examId: exam.id, 
            startTime: new Date().toISOString() 
        });
    }
    
    // Enable all security features
    enableBrowserLockdown();
    enableKeyboardBlocking();
    enableProctoring();
    enableTabSwitchDetection();
    enableCopyPasteBlocking();
    enableRightClickBlocking();
    enableDevToolsBlocking();
    enableFullscreenMode();
    
    // Start auto-submit timer
    startAutoSubmitTimer(exam);
    
    // Initialize response pattern tracking
    initResponsePatternTracking();
}

// Right-Click Blocking (defined early to avoid hoisting issues)
function enableRightClickBlocking() {
    // Prevent right-click context menu
    document.addEventListener('contextmenu', preventContextMenu);
    // Prevent text selection (also helps prevent copying)
    document.addEventListener('selectstart', preventTextSelection);
    // Prevent drag and drop
    document.addEventListener('dragstart', preventDrag);
    document.addEventListener('drop', preventDrop);
}

// Shuffle array for question randomization
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get randomized question at index
function getRandomizedQuestion(index) {
    if (index >= 0 && index < examSecurity.randomizedQuestions.length) {
        return examSecurity.randomizedQuestions[index];
    }
    return null;
}

// Get original question index from randomized index
function getOriginalQuestionIndex(randomizedIndex) {
    const randomizedQ = examSecurity.randomizedQuestions[randomizedIndex];
    if (randomizedQ && randomizedQ.originalIndex !== undefined) {
        return randomizedQ.originalIndex;
    }
    // Fallback to searching by ID or text if originalIndex is missing
    return examSecurity.originalQuestionOrder.findIndex(q => 
        (q.id && q.id === randomizedQ.id) || (q.question === randomizedQ.question)
    );
}

// Browser Lockdown - Prevent tab switching, minimize, etc.
function enableBrowserLockdown() {
    // Prevent tab switching
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Mobile specific: pagehide fires when switching apps or returning to home screen
    window.addEventListener('pagehide', handlePageHide);
    
    // Prevent window blur
    window.addEventListener('blur', handleWindowBlur);
    
    // Prevent minimize
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Disable context menu
    document.addEventListener('contextmenu', preventContextMenu);
    
    // Disable text selection (but allow typing in inputs)
    document.addEventListener('selectstart', preventTextSelection);
}

function handleVisibilityChange() {
    if (document.hidden && examSecurity.isActive) {
        examSecurity.proctoringData.tabSwitches++;
        examSecurity.proctoringData.blurEvents++;
        recordSuspiciousActivity('Tab switch / Minimization detected');
        
        // Throw fatal error and submit immediately
        showSecurityWarning('⛔ Exam Terminated: You navigated away from the exam window!');
        if (typeof submitExam === 'function') {
            submitExam();
            examSecurity.isActive = false;
        }
    } else if (!document.hidden && examSecurity.isActive) {
        examSecurity.proctoringData.focusEvents++;
        examSecurity.proctoringData.lastActivity = new Date();
    }
}

function handlePageHide(e) {
    if (examSecurity.isActive) {
        recordSuspiciousActivity('App switch / Page hide detected');
        
        showSecurityWarning('⛔ Exam Terminated: You navigated away from the exam window!');
        if (typeof submitExam === 'function') {
            submitExam();
            examSecurity.isActive = false;
        }
    }
}

let blurGraceTimer = null;
function handleWindowBlur(e) {
    if (examSecurity.isActive) {
        examSecurity.proctoringData.blurEvents++;
        recordSuspiciousActivity('Window blur detected');
        
        // Give 3 seconds grace period for accidental blurs (notifications, keyboards)
        blurGraceTimer = setTimeout(() => {
            if (examSecurity.isActive && !document.hasFocus()) {
                showSecurityWarning('⛔ Exam Terminated: You remained outside the exam window for too long!');
                if (typeof submitExam === 'function') {
                    submitExam();
                    examSecurity.isActive = false;
                }
            }
        }, 3000);
    }
}

window.addEventListener('focus', () => {
    if (blurGraceTimer) {
        clearTimeout(blurGraceTimer);
        blurGraceTimer = null;
    }
});

function handleBeforeUnload(e) {
    if (examSecurity.isActive) {
        e.preventDefault();
        e.returnValue = 'You are taking an exam. Closing this window will submit your exam automatically.';
        return e.returnValue;
    }
}

function preventContextMenu(e) {
    if (examSecurity.isActive) {
        e.preventDefault();
        examSecurity.proctoringData.rightClickAttempts++;
        recordSuspiciousActivity('Right-click attempt blocked');
        showSecurityWarning('⚠️ Right-click is disabled during exams');
        return false;
    }
}

function preventTextSelection(e) {
    if (examSecurity.isActive) {
        // Allow selection in input fields and textareas
        const target = e.target;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            return false;
        }
    }
}

// Keyboard Blocking - Disable copy, paste, cut, select all, etc.
function enableKeyboardBlocking() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keypress', handleKeyPress);
}

function handleKeyDown(e) {
    if (!examSecurity.isActive) return;
    
    // Allow typing in input fields and textareas
    const target = e.target;
    const isInputField = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.contentEditable === 'true'
    );
    
    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    
    // If typing in an input field, only block dangerous shortcuts
    if (isInputField) {
        // Block only dangerous shortcuts even in input fields (F12, F5, etc.)
        const dangerousKeys = ['f12', 'f5'];
        if (dangerousKeys.includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            recordSuspiciousActivity(`Blocked key in input: ${key}`);
            if (typeof window.logAction === 'function') {
                window.logAction('SUSPICIOUS_ACTIVITY', `Blocked key in input: ${key}`, { 
                    examId: examSecurity.examId,
                    activity: 'blocked_key_input',
                    key: key
                });
            }
            return false;
        }
        
        // Block Ctrl+Shift combinations that open DevTools
        if (ctrl && shift && (key === 'i' || key === 'j')) {
            e.preventDefault();
            e.stopPropagation();
            recordSuspiciousActivity(`Blocked DevTools shortcut in input: Ctrl+Shift+${key}`);
            if (typeof window.logAction === 'function') {
                window.logAction('SUSPICIOUS_ACTIVITY', `Blocked DevTools shortcut in input: Ctrl+Shift+${key}`, { 
                    examId: examSecurity.examId,
                    activity: 'devtools_shortcut_input',
                    key: `Ctrl+Shift+${key}`
                });
            }
            return false;
        }
        
        // Allow normal typing (letters, numbers, space, backspace, delete, arrow keys, etc.)
        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X for normal editing in input fields
        return; // Allow other keys in input fields
    }
    
    // Block common shortcuts (only outside input fields)
    const blockedShortcuts = [
        { key: 'c', ctrl: true },      // Copy
        { key: 'v', ctrl: true },      // Paste
        { key: 'x', ctrl: true },      // Cut
        { key: 'a', ctrl: true },      // Select All
        { key: 's', ctrl: true },      // Save
        { key: 'p', ctrl: true },      // Print
        { key: 'f', ctrl: true },      // Find
        { key: 'f12' },                // DevTools
        { key: 'f5' },                  // Refresh
        { key: 'r', ctrl: true },      // Refresh
        { key: 'tab', shift: true },    // Shift+Tab (backward navigation)
        { key: 'insert', shift: true }, // Shift+Insert (paste)
        { key: 'delete', shift: true }, // Shift+Delete (cut)
    ];
    
    // Check if blocked shortcut
    for (const shortcut of blockedShortcuts) {
        if (key === shortcut.key && 
            (shortcut.ctrl === undefined || shortcut.ctrl === ctrl) &&
            (shortcut.shift === undefined || shortcut.shift === shift)) {
            e.preventDefault();
            e.stopPropagation();
            
            if (key === 'c' && ctrl) {
                examSecurity.proctoringData.copyAttempts++;
                recordSuspiciousActivity('Copy attempt blocked');
            } else if (key === 'v' && ctrl) {
                examSecurity.proctoringData.pasteAttempts++;
                recordSuspiciousActivity('Paste attempt blocked');
            } else if (key === 'f12') {
                examSecurity.proctoringData.devToolsAttempts++;
                recordSuspiciousActivity('DevTools access attempt blocked');
            }
            
            showSecurityWarning(`⚠️ ${getShortcutName(key, ctrl, shift)} is disabled during exams`);
            return false;
        }
    }
    
    // Block F12 and other function keys
    if (key.startsWith('f') && key.length > 1) {
        const fNum = parseInt(key.substring(1));
        if (fNum >= 1 && fNum <= 12) {
            e.preventDefault();
            return false;
        }
    }
}

function handleKeyUp(e) {
    if (!examSecurity.isActive) return;
    // Track activity
    examSecurity.proctoringData.lastActivity = new Date();
}

function handleKeyPress(e) {
    if (!examSecurity.isActive) return;
    // Track activity
    examSecurity.proctoringData.lastActivity = new Date();
}

function getShortcutName(key, ctrl, shift) {
    const ctrlStr = ctrl ? 'Ctrl+' : '';
    const shiftStr = shift ? 'Shift+' : '';
    return `${ctrlStr}${shiftStr}${key.toUpperCase()}`;
}

// Copy/Paste Blocking (additional layer)
function enableCopyPasteBlocking() {
    document.addEventListener('copy', preventCopy);
    document.addEventListener('paste', preventPaste);
    document.addEventListener('cut', preventCut);
    
    // Block drag and drop
    document.addEventListener('dragstart', preventDrag);
    document.addEventListener('drop', preventDrop);
}

function preventCopy(e) {
    if (examSecurity.isActive) {
        // Allow copying within input fields for normal editing (but track it)
        const target = e.target;
        const isInputField = target && (
            target.tagName === 'INPUT' || 
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            target.contentEditable === 'true'
        );
        
        // Only block copying from outside input fields (like copying question text)
        if (!isInputField) {
            e.preventDefault();
            if (e.clipboardData) {
                e.clipboardData.setData('text/plain', '');
            }
            examSecurity.proctoringData.copyAttempts++;
            recordSuspiciousActivity('Copy event blocked (from question text)');
            showSecurityWarning('⚠️ Copying question text is disabled during exams');
            return false;
        }
        // Allow copying within input fields for normal editing
    }
}

function preventPaste(e) {
    if (examSecurity.isActive) {
        // Block all pasting to prevent cheating
        e.preventDefault();
        examSecurity.proctoringData.pasteAttempts++;
        recordSuspiciousActivity('Paste event blocked');
        showSecurityWarning('⚠️ Pasting is disabled during exams');
        return false;
    }
}

function preventCut(e) {
    if (examSecurity.isActive) {
        e.preventDefault();
        recordSuspiciousActivity('Cut event blocked');
        return false;
    }
}

function preventDrag(e) {
    if (examSecurity.isActive) {
        e.preventDefault();
        return false;
    }
}

function preventDrop(e) {
    if (examSecurity.isActive) {
        e.preventDefault();
        return false;
    }
}

// Tab Switch Detection
function enableTabSwitchDetection() {
    // Already handled in visibility change, but add additional checks
    setInterval(() => {
        if (examSecurity.isActive && document.hidden) {
            examSecurity.proctoringData.tabSwitches++;
            recordSuspiciousActivity('Tab switch detected (interval check)');
            
            showSecurityWarning('⛔ Exam Terminated: You navigated away from the exam window!');
            if (typeof submitExam === 'function') {
                submitExam();
                examSecurity.isActive = false;
            }
        }
    }, 1000);
}

// DevTools Blocking
function enableDevToolsBlocking() {
    // Detect DevTools opening
    let devToolsOpen = false;
    const threshold = 160;
    
    setInterval(() => {
        if (!examSecurity.isActive) return;
        
        if (window.outerHeight - window.innerHeight > threshold ||
            window.outerWidth - window.innerWidth > threshold) {
            if (!devToolsOpen) {
                devToolsOpen = true;
                examSecurity.proctoringData.devToolsAttempts++;
                recordSuspiciousActivity('DevTools detected');
                showSecurityWarning('⚠️ Developer Tools detected! This is not allowed during exams.');
            }
        } else {
            devToolsOpen = false;
        }
    }, 500);
    
    // Disable console during exam
    if (examSecurity.isActive) {
        const noop = () => {};
        const originalLog = window.console.log;
        const originalWarn = window.console.warn;
        const originalError = window.console.error;
        const originalInfo = window.console.info;
        
        window.console.log = noop;
        window.console.warn = noop;
        window.console.error = noop;
        window.console.info = noop;
        
        // Store originals for restoration
        examSecurity.originalConsole = {
            log: originalLog,
            warn: originalWarn,
            error: originalError,
            info: originalInfo
        };
    }
}

// Fullscreen Mode (for better focus) - MANDATORY (If Supported)
function enableFullscreenMode() {
    // Only request fullscreen if not already in fullscreen and API is supported
    const elem = document.documentElement;
    const isSupported = !!(elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen);
    
    if (!isSupported) {
        console.warn('Fullscreen API is not supported on this device. Bypassing requirement.');
        return Promise.resolve();
    }

    if (!isFullscreen()) {
        
        // Request fullscreen if supported
        if (elem.requestFullscreen) {
            return elem.requestFullscreen().catch(err => {
                showSecurityWarning('⚠️ Fullscreen is required! Please allow fullscreen mode to continue.');
                return Promise.reject(err);
            });
        } else if (elem.webkitRequestFullscreen) {
            try {
                elem.webkitRequestFullscreen();
                return Promise.resolve();
            } catch (err) {
                showSecurityWarning('⚠️ Fullscreen is required! Please allow fullscreen mode to continue.');
                return Promise.reject(err);
            }
        } else if (elem.mozRequestFullScreen) {
            try {
                elem.mozRequestFullScreen();
                return Promise.resolve();
            } catch (err) {
                showSecurityWarning('⚠️ Fullscreen is required! Please allow fullscreen mode to continue.');
                return Promise.reject(err);
            }
        } else if (elem.msRequestFullscreen) {
            try {
                elem.msRequestFullscreen();
                return Promise.resolve();
            } catch (err) {
                showSecurityWarning('⚠️ Fullscreen is required! Please allow fullscreen mode to continue.');
                return Promise.reject(err);
            }
        } else {
            showSecurityWarning('⚠️ Fullscreen is not supported in your browser. Please use a modern browser.');
            return Promise.reject(new Error('Fullscreen not supported'));
        }
    }
    return Promise.resolve();
}

// Check if browser is in fullscreen mode
function isFullscreen() {
    return !!(document.fullscreenElement || 
              document.webkitFullscreenElement || 
              document.mozFullScreenElement || 
              document.msFullscreenElement);
}

// Monitor fullscreen changes and prevent exam if fullscreen is exited
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
    const elem = document.documentElement;
    const isSupported = !!(elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen);
    
    if (!isSupported) return; // iOS bypass
    
    if (examSecurity.isActive && !isFullscreen()) {
        showSecurityWarning('⚠️ Fullscreen mode disabled! You must return to fullscreen immediately or your exam will be submitted.');
        
        // Give user 5 seconds to return to fullscreen
        let warningCount = 0;
        const fullscreenCheck = setInterval(() => {
            if (!examSecurity.isActive) {
                clearInterval(fullscreenCheck);
                return;
            }
            
            if (isFullscreen()) {
                clearInterval(fullscreenCheck);
                // Remove warning
                const warningDiv = document.getElementById('exam-security-warning');
                if (warningDiv) {
                    warningDiv.style.display = 'none';
                }
                return;
            }
            
            warningCount++;
            
            // After 5 seconds, try to re-enable fullscreen
            if (warningCount === 5) {
                enableFullscreenMode().catch(() => {
                    // If fullscreen still can't be enabled, show final warning
                    showSecurityWarning('⚠️ CRITICAL: Fullscreen is required! Returning to fullscreen in 3 seconds or exam will be submitted...');
                    
                    // After 3 more seconds, submit exam if still not in fullscreen
                    setTimeout(() => {
                        if (!isFullscreen() && examSecurity.isActive) {
                            showSecurityWarning('⏰ Exam submitted due to fullscreen violation.');
                            if (typeof submitExam === 'function') {
                                submitExam();
                            }
                        }
                    }, 3000);
                });
            }
        }, 1000);
    }
}

// Proctoring - Monitor and record suspicious activities
function enableProctoring() {
    // Track mouse movements (for activity detection)
    document.addEventListener('mousemove', () => {
        if (examSecurity.isActive) {
            examSecurity.proctoringData.lastActivity = new Date();
        }
    });
    
    // Track touch events (mobile)
    document.addEventListener('touchstart', () => {
        if (examSecurity.isActive) {
            examSecurity.proctoringData.lastActivity = new Date();
        }
    });
    
    // Periodic activity check
    setInterval(() => {
        if (!examSecurity.isActive) return;
        
        const now = new Date();
        const lastActivity = examSecurity.proctoringData.lastActivity;
        const inactivityTime = (now - lastActivity) / 1000; // seconds
        
        // Alert if inactive for more than 2 minutes
        if (inactivityTime > 120) {
            recordSuspiciousActivity(`Inactivity detected: ${Math.round(inactivityTime)} seconds`);
        }
    }, 30000); // Check every 30 seconds
}

// Response Pattern Analysis
function initResponsePatternTracking() {
    examSecurity.answerPatterns = {};
}

function recordAnswer(questionIndex, answer, timeSpent) {
    if (!examSecurity.isActive) return;
    
    const pattern = {
        questionIndex,
        answer,
        timeSpent,
        timestamp: new Date(),
        changed: false,
        changeCount: 0
    };
    
    // Check if answer was changed
    if (examSecurity.answerPatterns[questionIndex]) {
        const prevAnswer = examSecurity.answerPatterns[questionIndex].answer;
        if (prevAnswer !== answer) {
            pattern.changed = true;
            pattern.changeCount = (examSecurity.answerPatterns[questionIndex].changeCount || 0) + 1;
            recordSuspiciousActivity(`Answer changed for question ${questionIndex + 1}`);
        }
    }
    
    examSecurity.answerPatterns[questionIndex] = pattern;
    examSecurity.proctoringData.responseTimes.push({
        questionIndex,
        timeSpent,
        timestamp: new Date()
    });
}

function analyzeResponsePatterns() {
    const patterns = examSecurity.answerPatterns;
    const analysis = {
        suspiciousPatterns: [],
        averageTimePerQuestion: 0,
        quickAnswers: 0,
        slowAnswers: 0,
        answerChanges: 0
    };
    
    const times = examSecurity.proctoringData.responseTimes.map(r => r.timeSpent);
    if (times.length > 0) {
        analysis.averageTimePerQuestion = times.reduce((a, b) => a + b, 0) / times.length;
    }
    
    // Detect suspicious patterns
    Object.values(patterns).forEach(pattern => {
        if (pattern.timeSpent < 5) { // Less than 5 seconds
            analysis.quickAnswers++;
            if (analysis.quickAnswers > 3) {
                analysis.suspiciousPatterns.push('Multiple very quick answers detected');
            }
        }
        
        if (pattern.timeSpent > 300) { // More than 5 minutes
            analysis.slowAnswers++;
        }
        
        if (pattern.changed) {
            analysis.answerChanges++;
            if (pattern.changeCount > 2) {
                analysis.suspiciousPatterns.push(`Question ${pattern.questionIndex + 1} changed ${pattern.changeCount} times`);
            }
        }
    });
    
    return analysis;
}

// Plagiarism Checking
function checkPlagiarism(answers) {
    if (!examSecurity.isActive) return null;
    
    // Get all results from other students
    const results = getData('lms_results');
    const currentExam = getCurrentExam();
    if (!currentExam) return null;
    
    const examResults = results.filter(r => r.examId === currentExam.id);
    const plagiarismScore = {
        similarity: 0,
        suspiciousAnswers: [],
        overallRisk: 'low'
    };
    
    examResults.forEach(result => {
        if (!result.answers || result.answers.length === 0) return;
        
        answers.forEach((answer, index) => {
            if (!answer || answer === '') return;
            
            const otherAnswer = result.answers[index];
            if (!otherAnswer) return;
            
            // Simple similarity check (can be enhanced with more sophisticated algorithms)
            const similarity = calculateSimilarity(String(answer), String(otherAnswer));
            
            if (similarity > 0.8) { // 80% similarity threshold
                plagiarismScore.similarity = Math.max(plagiarismScore.similarity, similarity);
                plagiarismScore.suspiciousAnswers.push({
                    questionIndex: index,
                    similarity: similarity,
                    otherStudent: result.studentName
                });
            }
        });
    });
    
    // Determine overall risk
    if (plagiarismScore.similarity > 0.9) {
        plagiarismScore.overallRisk = 'high';
    } else if (plagiarismScore.similarity > 0.7) {
        plagiarismScore.overallRisk = 'medium';
    }
    
    return plagiarismScore;
}

function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // Normalize strings
    str1 = str1.toLowerCase().trim();
    str2 = str2.toLowerCase().trim();
    
    if (str1 === str2) return 1.0;
    
    // Simple word-based similarity
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    
    const commonWords = words1.filter(w => words2.includes(w));
    const totalWords = Math.max(words1.length, words2.length);
    
    return commonWords.length / totalWords;
}

// Auto-Submit Timer
function startAutoSubmitTimer(exam) {
    if (examSecurity.autoSubmitTimer) {
        clearInterval(examSecurity.autoSubmitTimer);
    }
    
    examSecurity.autoSubmitTimer = setInterval(() => {
        if (!examSecurity.isActive) {
            clearInterval(examSecurity.autoSubmitTimer);
            return;
        }
        
        const now = new Date();
        if (now >= examSecurity.timeLimit) {
            clearInterval(examSecurity.autoSubmitTimer);
            autoSubmitExam();
        }
    }, 1000);
}

function autoSubmitExam() {
    if (!examSecurity.isActive) return;
    
    showSecurityWarning('⏰ Time is up! Submitting exam automatically...');
    
    // Small delay to show message
    setTimeout(() => {
        if (typeof submitExam === 'function') {
            submitExam();
        }
    }, 2000);
}

// Record suspicious activity
function recordSuspiciousActivity(activity) {
    examSecurity.proctoringData.suspiciousPatterns.push({
        activity,
        timestamp: new Date(),
        severity: 'medium'
    });
    
    // Real-time logging to server
    if (typeof window.logAction === 'function' && examSecurity.examId) {
        // Debounce logging for frequent events like mouse movement or resize
        if (activity.includes('resize') || activity.includes('mouse')) return;
        
        window.logAction('EXAM_SECURITY_EVENT', `Suspicious activity: ${activity}`, {
            examId: examSecurity.examId,
            examTitle: examSecurity.examTitle,
            activity: activity,
            severity: 'medium',
            timestamp: new Date().toISOString()
        });
    }
}

// Show security warning
function showSecurityWarning(message) {
    // Create or update warning element
    let warningDiv = document.getElementById('exam-security-warning');
    
    if (!warningDiv) {
        warningDiv = document.createElement('div');
        warningDiv.id = 'exam-security-warning';
        warningDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ef4444;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: bold;
            text-align: center;
            max-width: 90%;
            animation: slideDown 0.3s ease;
        `;
        document.body.appendChild(warningDiv);
    }
    
    warningDiv.textContent = message;
    warningDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (warningDiv) {
            warningDiv.style.display = 'none';
        }
    }, 5000);
}

// Get comprehensive proctoring report
function getProctoringReport() {
    if (!examSecurity.isActive && !examSecurity.proctoringData.startTime) {
        return null; // Exam hasn't started or data cleared
    }
    
    const analysis = analyzeResponsePatterns();
    
    return {
        ...examSecurity.proctoringData,
        analysis: analysis,
        endTime: new Date(),
        durationSeconds: (new Date() - new Date(examSecurity.proctoringData.startTime)) / 1000,
        scoreModifier: calculateIntegrityScore()
    };
}

// Calculate an integrity score (0-100) based on suspicious activities
function calculateIntegrityScore() {
    let score = 100;
    const data = examSecurity.proctoringData;
    
    // Deduct points for various infractions
    score -= (data.tabSwitches * 5);
    score -= (data.copyAttempts * 2);
    score -= (data.pasteAttempts * 5);
    score -= (data.devToolsAttempts * 20);
    score -= (data.rightClickAttempts * 1);
    
    // Cap at 0
    return Math.max(0, score);
}

// Disable exam security
function disableExamSecurity() {
    examSecurity.isActive = false;
    
    // Restore console functions
    if (examSecurity.originalConsole) {
        window.console.log = examSecurity.originalConsole.log;
        window.console.warn = examSecurity.originalConsole.warn;
        window.console.error = examSecurity.originalConsole.error;
        window.console.info = examSecurity.originalConsole.info;
        delete examSecurity.originalConsole;
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('blur', handleWindowBlur);
    document.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('contextmenu', preventContextMenu);
    document.removeEventListener('selectstart', preventTextSelection);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    document.removeEventListener('keypress', handleKeyPress);
    document.removeEventListener('copy', preventCopy);
    document.removeEventListener('paste', preventPaste);
    document.removeEventListener('cut', preventCut);
    document.removeEventListener('dragstart', preventDrag);
    document.removeEventListener('drop', preventDrop);
    
    // Clear timers
    if (examSecurity.autoSubmitTimer) {
        clearInterval(examSecurity.autoSubmitTimer);
        examSecurity.autoSubmitTimer = null;
    }
    
    // Exit fullscreen
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    
    // Remove warning element
    const warningDiv = document.getElementById('exam-security-warning');
    if (warningDiv) {
        warningDiv.remove();
    }
    
    // Log exam end
    if (typeof window.logAction === 'function' && examSecurity.examId) {
        window.logAction('EXAM_END', `Finished exam: ${examSecurity.examTitle} (${examSecurity.examId})`, { 
            examId: examSecurity.examId, 
            endTime: new Date().toISOString() 
        });
        
        // Clear exam context
        examSecurity.examId = null;
        examSecurity.examTitle = null;
    }
}

// Get proctoring report


// Helper function to get current exam (should be defined in student-dashboard.js)
function getCurrentExam() {
    if (typeof currentExam !== 'undefined') {
        return currentExam;
    }
    return null;
}
