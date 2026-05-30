// Chatbot Data Access Functions
// Provides secure, privacy-aware data access for chatbot responses
// UPDATED: Uses async functions from api-service.js for Supabase integration

/**
 * Get current user information (for context)
 */
function getChatbotUserContext() {
    const user = getCurrentUser();
    if (!user) return null;
    
    return {
        id: user.id,
        name: user.fullName,
        username: user.username,
        type: user.type,
        class: user.class || null,
        subjects: user.subjects || null,
        classes: user.classes || null
    };
}

/**
 * Get user's available exams (Student)
 */
async function getChatbotStudentExams() {
    const user = getCurrentUser();
    if (!user || user.type !== 'student') return [];
    
    // Use api-service.js async function
    const exams = (typeof getExams === 'function') ? await getExams() : (getData('lms_exams') || []);
    const now = new Date();
    
    return exams
        .filter(exam => exam.classes.includes(user.class))
        .map(exam => {
            const startTime = exam.startTime ? new Date(exam.startTime) : null;
            const endTime = startTime ? new Date(startTime.getTime() + exam.duration * 60 * 1000) : null;
            const isActive = startTime && now >= startTime && now <= endTime;
            const isUpcoming = startTime && now < startTime;
            const isPast = endTime && now > endTime;
            const isManuallyActive = exam.isActivated !== false;
            
            let status = 'unknown';
            if (!isManuallyActive) {
                status = 'deactivated';
            } else if (isActive) {
                status = 'active';
            } else if (isUpcoming) {
                status = 'upcoming';
            } else if (isPast) {
                status = 'completed';
            }
            
            return {
                id: exam.id,
                title: exam.title,
                type: exam.type,
                subject: exam.subject,
                status: status,
                startTime: exam.startTime,
                duration: exam.duration,
                remainingTime: isActive && endTime ? Math.max(0, Math.floor((endTime - now) / 1000 / 60)) : null
            };
        });
}

/**
 * Get user's results (Student)
 */
async function getChatbotStudentResults() {
    const user = getCurrentUser();
    if (!user || user.type !== 'student') return [];
    
    // Use api-service.js async functions
    const results = (typeof getResults === 'function') ? await getResults() : (getData('lms_results') || []);
    const releases = (typeof getResultReleases === 'function') ? await getResultReleases() : (getData('lms_result_releases') || {});
    
    // Filter released results only
    return results
        .filter(result => {
            if (result.studentId !== user.id) return false;
            
            // Check if result is released
            if (result.isReleased === true) return true;
            if (releases[result.examId] === true) return true;
            if (releases[result.id] === true) return true;
            
            return false;
        })
        .map(result => ({
            id: result.id,
            examTitle: result.examTitle,
            type: result.type,
            subject: result.subject,
            score: result.score,
            grade: result.grade,
            submittedAt: result.submittedAt
        }));
}

/**
 * Get user's materials (Student)
 */
async function getChatbotStudentMaterials() {
    const user = getCurrentUser();
    if (!user || user.type !== 'student') return [];
    
    // Use api-service.js async function
    const materials = (typeof getMaterials === 'function') ? await getMaterials() : (getData('lms_materials') || []);
    
    return materials
        .filter(m => m.class === user.class)
        .map(m => ({
            id: m.id,
            title: m.title,
            subject: m.subject,
            type: m.type,
            uploadedAt: m.uploadedAt,
            lecturerName: m.lecturerName
        }));
}

/**
 * Get user's announcements (Student)
 */
async function getChatbotStudentAnnouncements() {
    const user = getCurrentUser();
    if (!user || user.type !== 'student') return [];
    
    // Use api-service.js async function
    const announcements = (typeof getAnnouncements === 'function') ? await getAnnouncements() : (getData('lms_announcements') || []);
    
    return announcements
        .filter(ann => {
            if (ann.target === 'all' || ann.target === 'students') return true;
            if (ann.target === 'class' && ann.classes && ann.classes.includes(user.class)) return true;
            return false;
        })
        .map(ann => ({
            id: ann.id,
            title: ann.title,
            content: ann.content.substring(0, 100) + (ann.content.length > 100 ? '...' : ''),
            createdAt: ann.createdAt,
            createdByName: ann.createdByName
        }));
}

/**
 * Get lecturer's exams
 */
async function getChatbotLecturerExams() {
    const user = getCurrentUser();
    if (!user || user.type !== 'lecturer') return [];
    
    // Use api-service.js async functions
    const exams = (typeof getExams === 'function') ? await getExams() : (getData('lms_exams') || []);
    const results = (typeof getResults === 'function') ? await getResults() : (getData('lms_results') || []);
    const releases = (typeof getResultReleases === 'function') ? await getResultReleases() : (getData('lms_result_releases') || {});

    const now = new Date();
    
    return exams
        .filter(exam => exam.lecturerId === user.id)
        .map(exam => {
            const startTime = exam.startTime ? new Date(exam.startTime) : null;
            const endTime = startTime ? new Date(startTime.getTime() + exam.duration * 60 * 1000) : null;
            const isActive = startTime && now >= startTime && now <= endTime;
            const isUpcoming = startTime && now < startTime;
            const isPast = endTime && now > endTime;
            const isManuallyActive = exam.isActivated !== false;
            
            const examResults = results.filter(r => r && r.examId === exam.id);
            const isReleased = releases[exam.id] === true;
            
            let status = 'unknown';
            if (!isManuallyActive) {
                status = 'deactivated';
            } else if (isActive) {
                status = 'active';
            } else if (isUpcoming) {
                status = 'upcoming';
            } else if (isPast) {
                status = 'completed';
            }
            
            return {
                id: exam.id,
                title: exam.title,
                type: exam.type,
                subject: exam.subject,
                classes: exam.classes,
                status: status,
                startTime: exam.startTime,
                duration: exam.duration,
                submissions: examResults.length,
                resultsReleased: isReleased
            };
        });
}

/**
 * Get lecturer's materials
 */
async function getChatbotLecturerMaterials() {
    const user = getCurrentUser();
    if (!user || user.type !== 'lecturer') return [];
    
    // Use api-service.js async function
    const materials = (typeof getMaterials === 'function') ? await getMaterials() : (getData('lms_materials') || []);
    
    return materials
        .filter(m => m.lecturerId === user.id)
        .map(m => ({
            id: m.id,
            title: m.title,
            subject: m.subject,
            class: m.class,
            type: m.type,
            uploadedAt: m.uploadedAt
        }));
}

/**
 * Get lecturer's announcements
 */
async function getChatbotLecturerAnnouncements() {
    const user = getCurrentUser();
    if (!user || user.type !== 'lecturer') return [];
    
    // Use api-service.js async function
    const announcements = (typeof getAnnouncements === 'function') ? await getAnnouncements() : (getData('lms_announcements') || []);
    
    return announcements
        .filter(ann => ann.createdBy === user.id)
        .map(ann => ({
            id: ann.id,
            title: ann.title,
            content: ann.content.substring(0, 100) + (ann.content.length > 100 ? '...' : ''),
            target: ann.target,
            classes: ann.classes || [],
            createdAt: ann.createdAt
        }));
}

/**
 * Get system statistics (Admin)
 */
async function getChatbotSystemStats() {
    const user = getCurrentUser();
    if (!user || user.type !== 'admin') return null;
    
    // Use api-service.js async functions
    const users = (typeof getUsers === 'function') ? await getUsers() : (getData('lms_users') || { students: [], lecturers: [] });
    const classes = (typeof getClasses === 'function') ? await getClasses() : (getData('lms_classes') || []);
    const courses = (typeof getCourses === 'function') ? await getCourses() : (getData('lms_courses') || []);
    const exams = (typeof getExams === 'function') ? await getExams() : (getData('lms_exams') || []);
    const results = (typeof getResults === 'function') ? await getResults() : (getData('lms_results') || []);
    const materials = (typeof getMaterials === 'function') ? await getMaterials() : (getData('lms_materials') || []);
    const announcements = (typeof getAnnouncements === 'function') ? await getAnnouncements() : (getData('lms_announcements') || []);
    
    return {
        totalStudents: (users.students || []).length,
        totalLecturers: (users.lecturers || []).length,
        totalClasses: classes.length,
        totalCourses: courses.length,
        totalExams: exams.length,
        totalResults: results.length,
        totalMaterials: materials.length,
        totalAnnouncements: announcements.length
    };
}

/**
 * Get available classes (for context)
 */
async function getChatbotClasses() {
    // Use api-service.js async function
    const classes = (typeof getClasses === 'function') ? await getClasses() : (getData('lms_classes') || []);
    return classes.map(c => ({
        id: c.id,
        name: c.name
    }));
}

/**
 * Get available courses/subjects (for context)
 */
async function getChatbotCourses() {
    // Use api-service.js async function
    const courses = (typeof getCourses === 'function') ? await getCourses() : (getData('lms_courses') || []);
    const coursesByClass = {};
    
    courses.forEach(course => {
        const className = course.class || 'Unknown';
        if (!coursesByClass[className]) {
            coursesByClass[className] = [];
        }
        coursesByClass[className].push(course.subject);
    });
    
    return coursesByClass;
}

/**
 * Search exams (for chatbot queries)
 */
async function chatbotSearchExams(query) {
    const user = getCurrentUser();
    if (!user) return [];
    
    // Use api-service.js async function
    const exams = (typeof getExams === 'function') ? await getExams() : (getData('lms_exams') || []);
    const lowerQuery = query.toLowerCase();
    
    let filteredExams = exams;
    
    // Filter by user type
    if (user.type === 'student') {
        filteredExams = filteredExams.filter(exam => exam.classes.includes(user.class));
    } else if (user.type === 'lecturer') {
        filteredExams = filteredExams.filter(exam => exam.lecturerId === user.id);
    }
    
    // Search in title, subject, type
    return filteredExams.filter(exam => 
        exam.title.toLowerCase().includes(lowerQuery) ||
        exam.subject.toLowerCase().includes(lowerQuery) ||
        exam.type.toLowerCase().includes(lowerQuery)
    ).map(exam => ({
        id: exam.id,
        title: exam.title,
        type: exam.type,
        subject: exam.subject
    }));
}

/**
 * Search materials (for chatbot queries)
 */
async function chatbotSearchMaterials(query) {
    const user = getCurrentUser();
    if (!user) return [];
    
    // Use api-service.js async function
    const materials = (typeof getMaterials === 'function') ? await getMaterials() : (getData('lms_materials') || []);
    const lowerQuery = query.toLowerCase();
    
    let filteredMaterials = materials;
    
    // Filter by user type
    if (user.type === 'student') {
        filteredMaterials = filteredMaterials.filter(m => m.class === user.class);
    } else if (user.type === 'lecturer') {
        filteredMaterials = filteredMaterials.filter(m => m.lecturerId === user.id);
    }
    
    // Search in title, subject
    return filteredMaterials.filter(m => 
        m.title.toLowerCase().includes(lowerQuery) ||
        m.subject.toLowerCase().includes(lowerQuery)
    ).map(m => ({
        id: m.id,
        title: m.title,
        subject: m.subject,
        class: m.class
    }));
}

/**
 * Get exam details by ID (for chatbot queries)
 */
async function getChatbotExamDetails(examId) {
    // Use api-service.js async function
    const exams = (typeof getExams === 'function') ? await getExams() : (getData('lms_exams') || []);
    const exam = exams.find(e => e.id === examId);
    
    if (!exam) return null;
    
    const now = new Date();
    const startTime = exam.startTime ? new Date(exam.startTime) : null;
    const endTime = startTime ? new Date(startTime.getTime() + exam.duration * 60 * 1000) : null;
    const isActive = startTime && now >= startTime && now <= endTime;
    const isUpcoming = startTime && now < startTime;
    const isPast = endTime && now > endTime;
    
    return {
        id: exam.id,
        title: exam.title,
        type: exam.type,
        subject: exam.subject,
        classes: exam.classes,
        startTime: exam.startTime,
        duration: exam.duration,
        questionCount: exam.questions ? exam.questions.length : 0,
        isActive: isActive,
        isUpcoming: isUpcoming,
        isPast: isPast,
        isActivated: exam.isActivated !== false
    };
}

/**
 * Get user's progress summary (Student)
 */
async function getChatbotStudentProgress() {
    const user = getCurrentUser();
    if (!user || user.type !== 'student') return null;
    
    // Need to await this now
    const results = await getChatbotStudentResults();
    
    if (results.length === 0) {
        return {
            totalExams: 0,
            averageScore: 0,
            gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 }
        };
    }
    
    const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
    const averageScore = totalScore / results.length;
    
    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    results.forEach(r => {
        if (r.grade && gradeDistribution.hasOwnProperty(r.grade)) {
            gradeDistribution[r.grade]++;
        }
    });
    
    return {
        totalExams: results.length,
        averageScore: Math.round(averageScore * 10) / 10,
        gradeDistribution: gradeDistribution
    };
}

/**
 * Export all chatbot context (for AI integration)
 */
async function getChatbotContext() {
    const user = getChatbotUserContext();
    if (!user) return null;
    
    const context = {
        user: user,
        timestamp: new Date().toISOString(),
        portal: user.type
    };
    
    // Add portal-specific data
    if (user.type === 'student') {
        context.exams = await getChatbotStudentExams();
        context.results = await getChatbotStudentResults();
        context.materials = await getChatbotStudentMaterials();
        context.announcements = await getChatbotStudentAnnouncements();
        context.progress = await getChatbotStudentProgress();
    } else if (user.type === 'lecturer') {
        context.exams = await getChatbotLecturerExams();
        context.materials = await getChatbotLecturerMaterials();
        context.announcements = await getChatbotLecturerAnnouncements();
    } else if (user.type === 'admin') {
        context.stats = await getChatbotSystemStats();
        context.classes = await getChatbotClasses();
        context.courses = await getChatbotCourses();
    }
    
    return context;
}

// Export functions for use in chatbot.js
window.getChatbotUserContext = getChatbotUserContext;
window.getChatbotStudentExams = getChatbotStudentExams;
window.getChatbotStudentResults = getChatbotStudentResults;
window.getChatbotStudentMaterials = getChatbotStudentMaterials;
window.getChatbotStudentAnnouncements = getChatbotStudentAnnouncements;
window.getChatbotLecturerExams = getChatbotLecturerExams;
window.getChatbotLecturerMaterials = getChatbotLecturerMaterials;
window.getChatbotLecturerAnnouncements = getChatbotLecturerAnnouncements;
window.getChatbotSystemStats = getChatbotSystemStats;
window.getChatbotClasses = getChatbotClasses;
window.getChatbotCourses = getChatbotCourses;
window.chatbotSearchExams = chatbotSearchExams;
window.chatbotSearchMaterials = chatbotSearchMaterials;
window.getChatbotExamDetails = getChatbotExamDetails;
window.getChatbotStudentProgress = getChatbotStudentProgress;
window.getChatbotContext = getChatbotContext;
