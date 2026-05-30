// Student Dashboard

let currentExam = null;
let examTimerInterval = null;
let currentSubmissionFile = null;

let examRefreshInterval = null;
let lastActiveExamCount = 0;

// Define showSection early to ensure it's available when HTML loads
window.showSection = function(section, evt) {
    // Hide all sections
    document.querySelectorAll('.tab-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(section + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Add active class to clicked button
    const clickedBtn = (evt && evt.target) ? evt.target : 
                      document.querySelector(`.tab-btn[onclick*="showSection('${section}')"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // Load section-specific data
    if (section === 'announcements' && typeof loadStudentAnnouncements === 'function') {
        setTimeout(loadStudentAnnouncements, 100);
    }
    if (section === 'calendar' && typeof loadCalendar === 'function') {
        setTimeout(loadCalendar, 100);
    }
    if (section === 'results') {
        setTimeout(() => {
            if (typeof loadResults === 'function') loadResults();
        }, 100);
    }
    if (section === 'materials') {
        setTimeout(() => {
            if (typeof loadMaterials === 'function') loadMaterials();
        }, 100);
    }
    if (section === 'progress' && typeof loadProgress === 'function') {
        setTimeout(loadProgress, 100);
    }
    if (section === 'subjects') {
        setTimeout(loadSubjects, 100);
    }
    if (section === 'exams') {
        setTimeout(() => {
            if (typeof loadExams === 'function') loadExams();
        }, 100);
    }
    if (section === 'assignments' && typeof loadStudentAssignments === 'function') {
        setTimeout(loadStudentAssignments, 100);
    }
};

async function loadSubjects() {
    const user = getCurrentUser();
    const container = document.getElementById('subjects-list-container');
    
    if (!container) return;
    
    container.innerHTML = '<p>Loading subjects...</p>';
    
    try {
        // Fetch all courses/subjects
        let courses = [];
        if (typeof getCourses === 'function') {
            try {
                courses = await getCourses();
            } catch (err) {
                console.warn('Failed to load courses from Supabase, using local:', err);
                courses = getData('lms_courses') || [];
            }
        } else {
            courses = getData('lms_courses') || [];
        }
        
        // Filter by user's class
        console.log('User Class:', user.class);
        console.log('All Courses:', courses);
        
        let availableSubjects = [];
        
        // If we have proper course objects linked to classes
        if (courses.length > 0 && typeof courses[0] === 'object') {
            availableSubjects = courses.filter(c => {
                 // Match by class name (if stored as name) or ID
                 return c.className === user.class || c.class_name === user.class || !c.class_id; 
            }).map(c => c.subject);
            
            // If filtering by class object didn't work, fallback to all unique subjects
            if (availableSubjects.length === 0) {
                 availableSubjects = [...new Set(courses.map(c => c.subject))];
            }
        } else {
             // Fallback if courses are just strings
             availableSubjects = courses;
        }
        
        // Remove duplicates and filter out nulls/undefined
        availableSubjects = [...new Set(availableSubjects)].filter(s => !!s).sort();
        
        if (availableSubjects.length === 0) {
            container.innerHTML = '<p>No subjects found for your class.</p>';
            return;
        }
        
        const userSubjects = user.subjects || [];
        
        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">';
        
        availableSubjects.forEach(subject => {
            const isChecked = userSubjects.includes(subject) ? 'checked' : '';
            html += `
                <div class="checkbox-card" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" id="subj_${subject.replace(/\s+/g, '_')}" name="student_subjects" value="${subject}" ${isChecked} style="width: 20px; height: 20px; cursor: pointer;">
                    <label for="subj_${subject.replace(/\s+/g, '_')}" style="font-size: 1.1rem; cursor: pointer; flex: 1;">${subject}</label>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // Display registered subjects separately as requested
        displayRegisteredSubjects();
        
    } catch (error) {
        console.error('Error loading subjects:', error);
        container.innerHTML = '<p style="color: red;">Error loading subjects. Please try again.</p>';
    }
}

function displayRegisteredSubjects() {
    const user = getCurrentUser();
    const container = document.getElementById('registered-subjects-list');
    if (!container) return;
    
    const userSubjects = user.subjects || [];
    
    if (userSubjects.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light);">You haven\'t registered for any subjects yet.</p>';
        return;
    }
    
    let html = '<ul style="list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">';
    userSubjects.forEach(subject => {
        html += `
            <li style="background: var(--light-color); padding: 10px 15px; border-radius: 6px; border-left: 4px solid var(--primary-color); font-weight: 500;">
                ✅ ${subject}
            </li>
        `;
    });
    html += '</ul>';
    container.innerHTML = html;
}

window.saveSubjectRegistration = async function() {
    const user = getCurrentUser();
    const checkboxes = document.querySelectorAll('input[name="student_subjects"]:checked');
    const selectedSubjects = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedSubjects.length === 0) {
        if (!confirm('You have not selected any subjects. This will clear your current registration. Are you sure?')) {
            return;
        }
    }
    
    const btn = document.querySelector('button[onclick="saveSubjectRegistration()"]');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;
    
    try {
        if (typeof window.updateUserSubjects === 'function') {
            await window.updateUserSubjects(user.id, selectedSubjects);
            
            // Refresh the registered subjects list
            displayRegisteredSubjects();
            
            alert('Subjects registered successfully!');
        } else {
            console.error('updateUserSubjects function missing');
            alert('Error: Could not save registration. API function not found.');
        }
    } catch (error) {
        console.error('Error saving subjects:', error);
        alert('Failed to save subjects. Please try again.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Student dashboard loaded');
    
    // Refresh user session from database to get latest subject registrations
    const currentUser = getCurrentUser();
    if (currentUser && typeof getUsers === 'function') {
        try {
            const users = await getUsers();
            const latestUser = users.students.find(s => s.id === currentUser.id);
            if (latestUser) {
                const updatedUser = { ...currentUser, ...latestUser, type: 'student' };
                if (typeof setCurrentUser === 'function') {
                    setCurrentUser(updatedUser);
                } else {
                    sessionStorage.setItem('current_user', JSON.stringify(updatedUser));
                }
                console.log('✅ User session refreshed from database');
            }
        } catch (error) {
            console.warn('Failed to refresh user session, using existing:', error);
        }
    }
    
    const user = getCurrentUser();
    
    if (!user || user.type !== 'student') {
        console.log('Not a student, redirecting...');
        window.location.href = 'login.html';
        return;
    }
    
    console.log('Loading dashboard for student:', user.fullName);
    await loadDashboard();

    // Load all sections in parallel — independent data, no need to wait sequentially
    await Promise.allSettled([
        loadExams(),
        loadResults(),
        loadMaterials(),
        loadStudentAssignments()
    ]);
    
    try {
        // Count initial active exams
        let exams = [];
        if (typeof window.getExamsMinimal === 'function') {
            try {
                exams = await window.getExamsMinimal();
            } catch (error) {
                exams = getData('lms_exams') || [];
            }
        } else if (typeof getExams === 'function') {
            try {
                exams = await getExams();
            } catch (error) {
                exams = getData('lms_exams') || [];
            }
        } else {
            exams = getData('lms_exams') || [];
        }
        
    const now = new Date();
    const activeExams = exams.filter(exam => {
            if (!exam.start_time && !exam.startTime) return false;
            const startTime = new Date(exam.start_time || exam.startTime);
            const endTime = new Date(startTime.getTime() + (exam.duration || 0) * 60 * 1000);
            const examClasses = exam.classes || [];
            return examClasses.includes(user.class) && now >= startTime && now <= endTime;
    });
    lastActiveExamCount = activeExams.length;
    
    // Refresh exams every 30 seconds to check for auto-start and update countdowns (reduced frequency to prevent blinking)
        examRefreshInterval = setInterval(async () => {
            let exams = [];
            if (typeof window.getExamsMinimal === 'function') {
                try {
                    exams = await window.getExamsMinimal();
                } catch (error) {
                    exams = getData('lms_exams') || [];
                }
            } else if (typeof getExams === 'function') {
                try {
                    exams = await getExams();
                } catch (error) {
                    exams = getData('lms_exams') || [];
                }
            } else {
                exams = getData('lms_exams') || [];
            }
            
        const now = new Date();
        const activeExams = exams.filter(exam => {
                if (!exam.start_time && !exam.startTime) return false;
                const startTime = new Date(exam.start_time || exam.startTime);
                const endTime = new Date(startTime.getTime() + (exam.duration || 0) * 60 * 1000);
                const examClasses = exam.classes || [];
                return examClasses.includes(user.class) && now >= startTime && now <= endTime;
        });
        
        // Notify if new exam becomes active
        if (activeExams.length > lastActiveExamCount) {
                const newExams = activeExams.filter(exam => {
                    const startTime = new Date(exam.start_time || exam.startTime);
                const endTime = new Date(startTime.getTime() + exam.duration * 60 * 1000);
                return now >= startTime && now <= endTime;
            });
            
            newExams.forEach(exam => {
                if (typeof createNotification === 'function') {
                    createNotification(
                        'exam',
                        'New Exam Available',
                        `${exam.title} is now available. Click to start.`,
                        null,
                        { examId: exam.id }
                    );
                } else {
            showNotification('New exam is now available!', 'info');
                }
            });
        }
        
        lastActiveExamCount = activeExams.length;
        
        // Only update countdowns without full reload to prevent blinking
        const examsSection = document.getElementById('exams-section');
        if (examsSection && examsSection.classList.contains('active')) {
            // Update countdowns only, don't reload entire list
            updateExamCountdowns(exams);
        }
        
        // Update dashboard stats without full reload
        updateDashboardStats(exams);
    }, 30000); // Increased to 30 seconds to reduce blinking
    } catch (error) {
        console.error('Error loading student dashboard:', error);
    }
});

// Clean up interval when page unloads
window.addEventListener('beforeunload', function() {
    if (examRefreshInterval) {
        clearInterval(examRefreshInterval);
    }
    if (examTimerInterval) {
        clearInterval(examTimerInterval);
    }
});

async function loadDashboard() {
    const user = getCurrentUser();
    document.getElementById('studentName').textContent = user.fullName;
    document.getElementById('studentClass').textContent = user.class || 'Not assigned';
    
    // Count active exams
    let exams = [];
    if (typeof getExams === 'function') {
        try {
            exams = await getExams();
        } catch (error) {
            exams = getData('lms_exams') || [];
        }
    } else {
        exams = getData('lms_exams') || [];
    }
    const now = new Date();
    const activeExams = exams.filter(exam => {
        const startTime = exam.start_time || exam.startTime;
        if (!startTime) return false;
        const start = new Date(startTime);
        const endTime = new Date(start.getTime() + (exam.duration || 0) * 60 * 1000);
        const examClasses = exam.classes || [];
        return examClasses.includes(user.class) && now >= start && now <= endTime;
    });
    document.getElementById('activeExams').textContent = activeExams.length;
    
    // Count materials
    let materials = [];
    if (typeof getMaterials === 'function') {
        try {
            materials = await getMaterials();
        } catch (error) {
            materials = getData('lms_materials') || [];
        }
    } else {
        materials = getData('lms_materials') || [];
    }
    const classMaterials = materials.filter(m => (m.class || m.class_name) === user.class);
    document.getElementById('materialsCount').textContent = classMaterials.length;

    // Count assignments
    let assignments = [];
    if (typeof getAssignments === 'function') {
        try {
            assignments = await getAssignments();
        } catch (error) {
            assignments = getData('lms_assignments') || [];
        }
    } else {
        assignments = getData('lms_assignments') || [];
    }
    const classAssignments = assignments.filter(a => Array.isArray(a.class_ids) ? a.class_ids.includes(user.class) : a.class === user.class);
    
    // Add assignments count to the UI if a card exists for it (optional but good)
    const assignmentsCountEl = document.getElementById('assignmentsCount');
    if (assignmentsCountEl) {
        assignmentsCountEl.textContent = classAssignments.length;
    }
}

// Store exams globally for filtering
let allUserExams = [];
let allUserExamResults = [];

// Helper function to update countdowns without full reload
function updateExamCountdowns(exams) {
    const user = getCurrentUser();
    const now = new Date();
    const container = document.getElementById('exams-list');
    if (!container) return;
    
    // Update countdowns in existing cards
    container.querySelectorAll('.exam-card').forEach(card => {
        const examId = card.dataset.examId;
        const exam = exams.find(e => e.id === examId);
        if (exam) {
            const startTime = (exam.start_time || exam.startTime) ? new Date(exam.start_time || exam.startTime) : null;
            const endTime = startTime ? new Date(startTime.getTime() + (exam.duration || 0) * 60 * 1000) : null;
            const isActive = startTime && now >= startTime && now <= endTime;
            
            if (isActive) {
                const countdownEl = card.querySelector('.exam-countdown');
                if (countdownEl) {
                    const remaining = getRemainingTime(exam);
                    if (remaining && !remaining.expired) {
                        countdownEl.innerHTML = `<p style="color: var(--primary-color); font-weight: bold; margin: 10px 0;">Time Remaining: ${String(remaining.minutes).padStart(2, '0')}:${String(remaining.seconds).padStart(2, '0')}</p>`;
                    }
                }
            }
        }
    });
}

// Helper function to update dashboard stats without full reload
async function updateDashboardStats(exams) {
    const user = getCurrentUser();
    const now = new Date();
    
    const activeExams = exams.filter(exam => {
        if (!exam.start_time && !exam.startTime) return false;
        const startTime = new Date(exam.start_time || exam.startTime);
        const endTime = new Date(startTime.getTime() + (exam.duration || 0) * 60 * 1000);
        const examClasses = exam.classes || [];
        return examClasses.includes(user.class) && now >= startTime && now <= endTime;
    });
    
    const activeExamsEl = document.getElementById('activeExams');
    if (activeExamsEl) {
        activeExamsEl.textContent = activeExams.length;
    }
}

async function loadExams() {
    const user = getCurrentUser();
    const now = new Date();
    const container = document.getElementById('exams-list');
    
    if (!container) return;
    
    let exams = [];
    
    // Try Supabase first, fallback to localStorage
    if (typeof getExams === 'function') {
        try {
            exams = await getExams();
        } catch (error) {
            console.warn('Supabase loadExams failed, using localStorage:', error);
            exams = getData('lms_exams') || [];
        }
    } else {
        exams = getData('lms_exams') || [];
    }
    
    // Filter exams: only show activated exams that match user's class
    const userExams = exams.filter(exam => {
        const examClasses = exam.classes || [];
        return examClasses.includes(user.class) && 
               (exam.is_activated !== false && exam.isActivated !== false); // Only show activated exams
    });
    
    // Store globally for filtering
    allUserExams = userExams;
    
    // Get results once before the loop to avoid multiple async calls
    let allResults = [];
    if (typeof getResults === 'function') {
        try {
            allResults = await getResults();
        } catch (error) {
            allResults = getData('lms_results') || [];
        }
    } else {
        allResults = getData('lms_results') || [];
    }
    
    // Store globally for filtering
    allUserExamResults = allResults;
    
    // Clear container to prevent duplicates
    container.innerHTML = '';
    
    userExams.forEach(exam => {
        const startTime = (exam.start_time || exam.startTime) ? new Date(exam.start_time || exam.startTime) : null;
        const endTime = startTime ? new Date(startTime.getTime() + (exam.duration || 0) * 60 * 1000) : null;
        const isActive = startTime && now >= startTime && now <= endTime;
        const isUpcoming = startTime && now < startTime;
        const isPast = endTime && now > endTime;
        
        // Check if already submitted using pre-fetched results
        const existingResult = allResults.find(r => r.examId === exam.id && r.studentId === user.id);
        const isSubmitted = !!existingResult;
        
        const examCard = document.createElement('div');
        examCard.className = 'card exam-card';
        examCard.dataset.examId = exam.id;
        examCard.dataset.examStatus = isSubmitted ? 'completed' : (isActive ? 'active' : (isUpcoming ? 'upcoming' : 'past'));
        examCard.dataset.examTitle = (exam.title || '').toLowerCase();
        examCard.dataset.examSubject = (exam.subject || '').toLowerCase();
        examCard.style.marginBottom = '15px';
        
        let statusBadge = '';
        let actionButton = '';
        let countdownInfo = '';
        
        if (isSubmitted) {
            const letterGrade = getLetterGrade(existingResult.score);
            const gradeColor = getGradeColor(letterGrade);
            statusBadge = '<span class="status-badge status-completed">● SUBMITTED</span>';
            actionButton = `<button class="btn btn-secondary" disabled>Already Submitted (Score: ${existingResult.score}% - Grade: <span style="color: ${gradeColor}; font-weight: bold;">${letterGrade}</span>)</button>`;
        } else if (isActive && exam.isActivated !== false) {
            // Only show as active if exam is manually activated
            statusBadge = '<span class="status-badge status-active">● ACTIVE</span>';
            const remaining = getRemainingTime(exam);
            if (remaining && !remaining.expired) {
                countdownInfo = `<p style="color: var(--primary-color); font-weight: bold;">Time Remaining: ${String(remaining.minutes).padStart(2, '0')}:${String(remaining.seconds).padStart(2, '0')}</p>`;
            }
            actionButton = `<button class="btn btn-success" onclick="startExam('${exam.id}')">Take Exam</button>`;
        } else if (isActive && exam.isActivated === false) {
            // Exam is deactivated (e.g., students on parade)
            statusBadge = '<span class="status-badge status-completed">● DEACTIVATED</span>';
            actionButton = '<button class="btn btn-secondary" disabled>Exam Temporarily Unavailable</button>';
            countdownInfo = '<p style="color: var(--warning-color);">This exam is currently deactivated by your lecturer.</p>';
        } else if (isUpcoming) {
            statusBadge = `<span class="status-badge status-upcoming">● UPCOMING</span>`;
            const timeUntilStart = startTime - now;
            const hoursUntil = Math.floor(timeUntilStart / (1000 * 60 * 60));
            const minutesUntil = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60));
            countdownInfo = `<p style="color: var(--warning-color);">Starts in: ${hoursUntil}h ${minutesUntil}m (${formatDate(exam.startTime)})</p>`;
            actionButton = '<button class="btn btn-secondary" disabled>Not Started</button>';
        } else if (isPast) {
            statusBadge = '<span class="status-badge status-completed">● COMPLETED</span>';
            actionButton = '<button class="btn btn-secondary" disabled>Exam Ended</button>';
        }
        
        examCard.innerHTML = `
            <h4>${exam.title}</h4>
            <p><strong>Subject:</strong> ${exam.subject}</p>
            <p><strong>Duration:</strong> ${formatDuration(exam.duration)}</p>
            <!-- <p><strong>Type:</strong> ${exam.type}</p> -->
            <p>${statusBadge}</p>
            <div class="exam-countdown">${countdownInfo}</div>
            <div style="margin-top: 15px;">
                ${actionButton}
            </div>
        `;
        
        container.appendChild(examCard);
    });
    
    // Update filter count after loading
    if (typeof filterExams === 'function') {
        setTimeout(() => {
            filterExams();
        }, 100);
    }
    
    // Update print button state (since it's now in the exams tab)
    if (typeof updatePrintButtonState === 'function') {
        updatePrintButtonState();
    }
}

async function updatePrintButtonState() {
    const printBtn = document.getElementById('print-all-results-btn');
    if (!printBtn) return;
    
    try {
        console.log('Updating Print Button State...');
        
        // Check global setting
        let isPrintingAllowed = false;
        try {
            const canPrintGlobal = await getSystemSetting('allow_result_printing');
            isPrintingAllowed = canPrintGlobal === true || canPrintGlobal === 'true';
        } catch (e) {
            console.warn('Failed to check global print setting:', e);
        }
        
        // Check if user has any results
        let hasResults = false;
        const user = getCurrentUser();
        if (user) {
            let results = [];
            if (typeof getResults === 'function') {
                try {
                    results = await getResults();
                } catch (e) { results = getData('lms_results') || []; }
            } else {
                results = getData('lms_results') || [];
            }
            
            // Filter strictly for this user
            const userResults = results.filter(r => r.studentId === user.id);
            hasResults = userResults.length > 0;
            console.log(`Print Button Check: Found ${userResults.length} results for user ${user.id}`);
        }
        
        console.log('DEBUG PRINT BUTTON STATE:', { hasResults, isPrintingAllowed });

        if (!hasResults) {
            printBtn.disabled = true;
            printBtn.style.opacity = '0.6';
            printBtn.style.cursor = 'not-allowed';
            printBtn.title = 'No results available to print';
        } else if (!isPrintingAllowed) {
            printBtn.disabled = true;
            printBtn.style.opacity = '0.6';
            printBtn.style.cursor = 'not-allowed';
            printBtn.title = 'Printing results is currently disabled by the Administrator';
        } else {
            printBtn.disabled = false;
            printBtn.style.opacity = '1';
            printBtn.style.cursor = 'pointer';
            printBtn.title = 'Print all your results as PDF';
        }
    } catch (error) {
        console.error('Error updating print button state:', error);
    }
}

// Ensure loadExams calls this at the end
const originalLoadExams = window.loadExams;
// Use a safe wrapper if we haven't already
if (!window.loadExamsWrapped) {
    // We already edited the file content above, but since we are replacing the closing brace of loadExams,
    // we are effectively appending the function.
    // However, I need to make sure I'm calling it inside loadExams.
    // The implementation above puts the function OUTSIDE.
    // So I need to add the call inside.
}

// Filter exams function
window.filterExams = function() {
    const searchInput = document.getElementById('exam-search');
    const filterSelect = document.getElementById('exam-filter');
    const container = document.getElementById('exams-list');
    
    if (!container) {
        console.error('exams-list container not found');
        return;
    }
    
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();
    const filterValue = filterSelect?.value || 'all';
    
    const cards = container.querySelectorAll('.exam-card');
    let visibleCount = 0;
    
    if (cards.length === 0) {
        console.warn('No exam cards found to filter');
        return;
    }
    
    cards.forEach(card => {
        const title = (card.dataset.examTitle || '').toLowerCase();
        const subject = (card.dataset.examSubject || '').toLowerCase();
        const status = card.dataset.examStatus || '';
        
        // Check search match
        const matchesSearch = !searchTerm || 
                             title.includes(searchTerm) || 
                             subject.includes(searchTerm) ||
                             (card.textContent || '').toLowerCase().includes(searchTerm);
        
        // Check filter match
        const matchesFilter = filterValue === 'all' || status === filterValue;
        
        if (matchesSearch && matchesFilter) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Show/hide no results message
    let noResultsMsg = container.querySelector('.no-results-msg');
    if (visibleCount === 0 && cards.length > 0) {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.className = 'no-results-msg';
            noResultsMsg.style.cssText = 'padding: 40px; text-align: center; color: var(--text-light); background: var(--light-color); border-radius: 8px; margin: 20px 0;';
            noResultsMsg.innerHTML = `
                <p style="font-size: 1.1rem; margin-bottom: 10px;">🔍 No exams match your search criteria</p>
                <p style="font-size: 0.9rem; opacity: 0.8;">Try adjusting your search or filter options</p>
            `;
            container.appendChild(noResultsMsg);
        }
    } else if (noResultsMsg) {
        noResultsMsg.remove();
    }
    
    // Update filter count display if it exists
    const filterCountEl = document.getElementById('filter-count');
    if (filterCountEl) {
        filterCountEl.textContent = `${visibleCount} of ${cards.length} exams`;
    }
};

window.startExam = async function(examId) {
    const user = getCurrentUser();
    let exams = [];
    if (typeof getExams === 'function') {
        try {
            exams = await getExams();
        } catch (error) {
            exams = getData('lms_exams') || [];
        }
    } else {
        exams = getData('lms_exams') || [];
    }
    const exam = exams.find(e => e.id === examId);
    
    console.log('=== START EXAM DEBUG ===');
    console.log('Exam ID:', examId);
    console.log('All exams:', exams);
    console.log('Found exam:', exam);
    console.log('Exam questions:', exam ? exam.questions : 'N/A');
    console.log('=======================');
    
    if (!exam) {
        alert('Exam not found');
        return;
    }
    
    // Check if student has registered for this subject
    const userSubjects = user.subjects || [];
    if (!userSubjects.includes(exam.subject) && !exam.isGeneral) {
        alert(`You have not registered for the subject "${exam.subject}". Please go to the "Register Subjects" tab and register first.`);
        showSection('subjects'); // Switch to subjects tab
        return;
    }
    
    // Check if exam has questions
    if (!exam.questions || !Array.isArray(exam.questions) || exam.questions.length === 0) {
        console.error('Exam has no questions!', exam);
        alert('This exam has no questions. Please contact your lecturer.');
        return;
    }
    
    // Check if exam is active
    const now = new Date();
    const startTime = new Date(exam.start_time || exam.startTime);
    const endTime = new Date(startTime.getTime() + (exam.duration || 0) * 60 * 1000);
    
    if (now < startTime) {
        alert('Exam has not started yet');
        return;
    }
    
    if (now > endTime) {
        alert('Exam has ended');
        return;
    }
    
    // Check if already submitted
    let results = [];
    if (typeof getResults === 'function') {
        try {
            results = await getResults();
        } catch (error) {
            results = getData('lms_results') || [];
        }
    } else {
        results = getData('lms_results') || [];
    }
    const existingResult = results.find(r => r.examId === examId && r.studentId === user.id);
    
    if (existingResult) {
        alert('You have already submitted this exam');
        return;
    }
    
    // REQUIRE FULLSCREEN BEFORE STARTING EXAM (If Supported)
    if (isFullscreenSupported() && !isFullscreen()) {
        requestFullscreenForExam(examId);
        return;
    }
    
    currentExam = exam;
    
    // Calculate remaining time
    const remaining = getRemainingTime(exam);
    
    if (remaining.expired) {
        alert('Exam time has expired');
        return;
    }
    
    // Show exam modal
    showExamModal(exam, remaining);
};

// Check if browser natively supports the Fullscreen API
function isFullscreenSupported() {
    const elem = document.documentElement;
    return !!(elem.requestFullscreen || 
              elem.webkitRequestFullscreen || 
              elem.mozRequestFullScreen || 
              elem.msRequestFullscreen);
}

// Check if browser is in fullscreen mode
function isFullscreen() {
    return !!(document.fullscreenElement || 
              document.webkitFullscreenElement || 
              document.mozFullScreenElement || 
              document.msFullscreenElement);
}

// Request fullscreen before starting exam
function requestFullscreenForExam(examId) {
    // Remove any existing fullscreen modal
    const existingModal = document.querySelector('.fullscreen-requirement-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Show message about fullscreen requirement
    const fullscreenModal = document.createElement('div');
    fullscreenModal.className = 'modal fullscreen-requirement-modal';
    fullscreenModal.style.display = 'block';
    fullscreenModal.style.zIndex = '10001';
    fullscreenModal.style.position = 'fixed';
    fullscreenModal.style.top = '0';
    fullscreenModal.style.left = '0';
    fullscreenModal.style.width = '100%';
    fullscreenModal.style.height = '100%';
    fullscreenModal.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    fullscreenModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; text-align: center; margin: 10% auto; padding: 40px; background: var(--card-bg, #fff); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="font-size: 4rem; margin-bottom: 20px;">🔒</div>
            <h3 style="margin: 0 0 20px 0; font-size: 1.8rem; color: var(--primary-color);">Fullscreen Mode Required</h3>
            <p style="margin: 20px 0; font-size: 1.1rem; line-height: 1.6; color: var(--text-color);">
                You must enable fullscreen mode before you can start the exam.
            </p>
            <div style="background: var(--light-color, #f5f5f5); padding: 20px; border-radius: 8px; margin: 25px 0; text-align: left;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: var(--text-color);">Why fullscreen?</p>
                <ul style="margin: 0; padding-left: 20px; color: var(--text-light); line-height: 1.8;">
                    <li>Ensures a secure exam environment</li>
                    <li>Prevents unauthorized access to other applications</li>
                    <li>Maintains exam integrity</li>
                </ul>
            </div>
            <div style="margin: 35px 0;">
                <button class="btn btn-primary" onclick="enableFullscreenAndStart('${examId}')" style="font-size: 1.2rem; padding: 18px 40px; min-width: 250px; font-weight: bold;">
                    ✓ Enable Fullscreen & Start Exam
                </button>
            </div>
            <div style="margin-top: 20px;">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); document.body.style.overflow='auto';" style="padding: 12px 30px;">
                    Cancel
                </button>
            </div>
            <p style="margin-top: 25px; font-size: 0.9rem; color: var(--text-light);">
                <strong>Note:</strong> If fullscreen doesn't enable automatically, press <kbd style="background: var(--light-color); padding: 4px 8px; border-radius: 4px;">F11</kbd> on your keyboard
            </p>
        </div>
    `;
    document.body.appendChild(fullscreenModal);
    document.body.style.overflow = 'hidden';
}

// Enable fullscreen and start exam
window.enableFullscreenAndStart = function(examId) {
    const elem = document.documentElement;
    
    // Try to enter fullscreen
    let fullscreenPromise = null;
    
    if (elem.requestFullscreen) {
        fullscreenPromise = elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
        try {
            elem.webkitRequestFullscreen();
            fullscreenPromise = Promise.resolve();
        } catch (e) {
            fullscreenPromise = Promise.reject(e);
        }
    } else if (elem.mozRequestFullScreen) {
        try {
            elem.mozRequestFullScreen();
            fullscreenPromise = Promise.resolve();
        } catch (e) {
            fullscreenPromise = Promise.reject(e);
        }
    } else if (elem.msRequestFullscreen) {
        try {
            elem.msRequestFullscreen();
            fullscreenPromise = Promise.resolve();
        } catch (e) {
            fullscreenPromise = Promise.reject(e);
        }
    }
    
    if (fullscreenPromise) {
        fullscreenPromise.then(() => {
            // Verify fullscreen is actually enabled
            setTimeout(() => {
                if (isFullscreenSupported() && !isFullscreen()) {
                    alert('Fullscreen was not enabled. Please click "Allow" when prompted, or press F11 to enable fullscreen manually.');
                    // Re-show modal if fullscreen failed
                    requestFullscreenForExam(examId);
                    return;
                }
                
                // Close ALL fullscreen requirement modals (in case multiple exist)
                const fullscreenModals = document.querySelectorAll('.fullscreen-requirement-modal');
                fullscreenModals.forEach(modal => {
                    modal.style.display = 'none';
                    modal.remove();
                });
                
                // Also remove any other modals that might be blocking
                const allModals = document.querySelectorAll('.modal');
                allModals.forEach(modal => {
                    if (modal.classList.contains('fullscreen-requirement-modal')) {
                        modal.remove();
                    }
                });
                
                document.body.style.overflow = 'auto';
                
                // Small delay to ensure modal is completely removed before starting exam
                setTimeout(() => {
                    // Start the exam after fullscreen is verified
                    startExam(examId);
                }, 300);
            }, 500);
        }).catch(err => {
            alert('Failed to enable fullscreen. Please:\n\n1. Click "Allow" if your browser asks for permission\n2. Or press F11 to enable fullscreen manually\n3. Then click "Take Exam" again');
            
            // Re-show modal if fullscreen failed
            requestFullscreenForExam(examId);
        });
    } else {
        // This branch technically shouldn't be hit anymore due to isFullscreenSupported check,
        // but if it is, bypass gracefully instead of blocking forever.
        console.warn('Fullscreen is not supported in this browser. Bypassing requirement.');
        
        // Remove modals and start
        const allModals = document.querySelectorAll('.modal');
        allModals.forEach(modal => {
            if (modal.classList.contains('fullscreen-requirement-modal')) {
                modal.remove();
            }
        });
        document.body.style.overflow = 'auto';
        startExam(examId);
    }
};

let currentQuestionIndex = 0;

function showExamModal(exam, remaining) {
    // Verify fullscreen is still enabled before showing exam (If Supported)
    if (isFullscreenSupported() && !isFullscreen()) {
        alert('Fullscreen mode is required! Please enable fullscreen and try again.');
        requestFullscreenForExam(exam.id);
        return;
    }
    
    const modal = document.getElementById('examModal');
    const timerDiv = document.getElementById('exam-timer');
    const contentDiv = document.getElementById('exam-content');
    
    if (!modal || !timerDiv || !contentDiv) {
        alert('Error: Exam interface not found. Please refresh the page.');
        return;
    }
    
    // Ensure no other modals are blocking - remove ALL fullscreen modals
    const fullscreenModals = document.querySelectorAll('.fullscreen-requirement-modal');
    fullscreenModals.forEach(fm => {
        fm.style.display = 'none';
        fm.style.visibility = 'hidden';
        fm.remove();
    });
    
    // Also remove any modals with class 'modal' that aren't the exam modal
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(m => {
        if (m.id !== 'examModal' && m.classList.contains('fullscreen-requirement-modal')) {
            m.style.display = 'none';
            m.remove();
        }
    });
    
    // Show modal with proper styling - higher z-index than fullscreen modal
    modal.style.display = 'block';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '10002';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Reset question index
    currentQuestionIndex = 0;
    
    // Initialize exam security with randomization
    // Ensure questions exist before initializing security
    const questionsToRandomize = exam.questions || [];
    
    console.log('=== INITIALIZING EXAM SECURITY ===');
    console.log('Exam ID:', exam.id);
    console.log('Exam title:', exam.title);
    console.log('Questions to randomize:', questionsToRandomize);
    console.log('Questions count:', questionsToRandomize.length);
    console.log('Questions type:', typeof questionsToRandomize);
    console.log('Is array:', Array.isArray(questionsToRandomize));
    
    if (questionsToRandomize.length === 0) {
        console.error('No questions found in exam for security initialization:', exam);
        console.error('Exam object:', JSON.stringify(exam, null, 2));
        contentDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: white;"><p style="color: var(--danger-color); font-size: 1.2rem;">Error: Exam has no questions. Please contact your lecturer.</p><p style="color: var(--text-light); margin-top: 10px;">Exam ID: ' + (exam.id || 'N/A') + '</p></div>';
        return;
    }
    
    // Verify questions have required structure
    const validQuestions = questionsToRandomize.filter(q => q && q.question && q.question.trim() !== '');
    if (validQuestions.length === 0) {
        console.error('No valid questions found (all questions missing question text):', questionsToRandomize);
        contentDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: white;"><p style="color: var(--danger-color); font-size: 1.2rem;">Error: Exam questions are invalid. Please contact your lecturer.</p></div>';
        return;
    }
    
    console.log('Valid questions count:', validQuestions.length);
    
    if (typeof initExamSecurity === 'function') {
        initExamSecurity(exam, validQuestions);
    } else if (typeof initializeExamSecurity === 'function') {
        initializeExamSecurity(exam);
    } else {
        console.error('initExamSecurity function not found!');
    }
    
    // Ensure fullscreen is maintained
    if (typeof enableFullscreenMode === 'function') {
        enableFullscreenMode().catch(() => {
            // If fullscreen fails, warn but don't block exam if already started
            if (typeof showSecurityWarning === 'function') {
                showSecurityWarning('⚠️ Warning: Fullscreen mode is required for exam security!');
            }
        });
    }
    
    // Scroll to top of modal
    modal.scrollTop = 0;
    
    // Display timer
    updateTimer(remaining);
    
    // Start timer countdown with auto-submission
    if (examTimerInterval) {
        clearInterval(examTimerInterval);
    }
    
    examTimerInterval = setInterval(() => {
        const remaining = getRemainingTime(exam);
        if (remaining.expired) {
            clearInterval(examTimerInterval);
            
            // Disable submit button
            const submitBtn = document.getElementById('submit-exam-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Time Expired - Auto-Submitting...';
            }
            
            // Show warning
            showSecurityAlert('⏰ Time is up! Your exam is being automatically submitted...');
            
            // Auto-submit after 2 seconds
            setTimeout(() => {
                submitExam();
            }, 2000);
            
            return;
        }
        updateTimer(remaining);
        
        // Warning when 5 minutes remaining
        if (remaining.totalSeconds === 300) {
            showSecurityAlert('⚠️ 5 minutes remaining!');
        }
        
        // Warning when 1 minute remaining
        if (remaining.totalSeconds === 60) {
            showSecurityAlert('⚠️ 1 minute remaining! Submit your exam now!');
        }
    }, 1000);
    
    // Reset question tracking
    questionViewTimes = {};
    questionStartTimes = {};
    currentQuestionIndex = 0;
    answeredQuestions = {}; // Reset answered questions
    studentAnswers = {}; // Reset student answers
    
    // Ensure fullscreen is active
    if (typeof isFullscreen === 'function' && !isFullscreen()) {
        if (typeof enableFullscreenMode === 'function') {
            enableFullscreenMode();
        }
    }
    
    // Render questions immediately - don't wait for setTimeout
    // Debug: Log exam data
    console.log('=== EXAM DEBUG INFO ===');
    console.log('Exam object:', exam);
    console.log('Exam.questions:', exam.questions);
    console.log('Exam.questions type:', typeof exam.questions);
    console.log('Exam.questions is array:', Array.isArray(exam.questions));
    console.log('Exam.questions length:', exam.questions ? exam.questions.length : 'N/A');
    console.log('examSecurity:', typeof examSecurity !== 'undefined' ? examSecurity : 'undefined');
    
    // Check if exam has questions
    const hasQuestions = exam && (
        (exam.questions && Array.isArray(exam.questions) && exam.questions.length > 0) ||
        (exam.randomizedQuestions && Array.isArray(exam.randomizedQuestions) && exam.randomizedQuestions.length > 0) ||
        (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.randomizedQuestions && Array.isArray(examSecurity.randomizedQuestions) && examSecurity.randomizedQuestions.length > 0)
    );
    
    console.log('Has questions:', hasQuestions);
    console.log('======================');
    
    if (hasQuestions) {
        // Render questions immediately
    renderQuestionWithNavigation(exam, contentDiv);
    } else {
        // Show error if no questions with detailed debug info
        console.error('NO QUESTIONS FOUND! Exam:', exam);
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: white;">
                <p style="color: var(--danger-color); font-size: 1.2rem; margin-bottom: 10px;">Error: No questions found in this exam.</p>
                <p style="color: var(--text-light);">Exam ID: ${exam.id || 'N/A'}</p>
                <p style="color: var(--text-light);">Questions: ${exam.questions ? (Array.isArray(exam.questions) ? exam.questions.length + ' items' : 'not an array: ' + typeof exam.questions) : 'undefined'}</p>
                <p style="color: var(--text-light); margin-top: 10px;">Please check browser console (F12) for details</p>
                <p style="color: var(--text-light); margin-top: 10px;">Please contact your lecturer or refresh the page.</p>
            </div>
        `;
    }
}

function renderQuestionWithNavigation(exam, contentDiv) {
    console.log('=== RENDER QUESTIONS DEBUG ===');
    console.log('Exam:', exam);
    console.log('Exam.questions:', exam.questions);
    
    // Use randomized questions from security module if available
    let questionsToDisplay = null;
    
    if (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.isActive && examSecurity.randomizedQuestions && Array.isArray(examSecurity.randomizedQuestions) && examSecurity.randomizedQuestions.length > 0) {
        questionsToDisplay = examSecurity.randomizedQuestions;
        console.log('Using examSecurity.randomizedQuestions:', questionsToDisplay);
    } else if (exam.randomizedQuestions && Array.isArray(exam.randomizedQuestions) && exam.randomizedQuestions.length > 0) {
        questionsToDisplay = exam.randomizedQuestions;
        console.log('Using exam.randomizedQuestions:', questionsToDisplay);
    } else if (exam.questions && Array.isArray(exam.questions) && exam.questions.length > 0) {
        questionsToDisplay = exam.questions;
        console.log('Using exam.questions:', questionsToDisplay);
    }
    
    // Validate questions exist
    if (!questionsToDisplay || !Array.isArray(questionsToDisplay) || questionsToDisplay.length === 0) {
        console.error('No valid questions found!', {
            questionsToDisplay,
            examQuestions: exam.questions,
            examRandomized: exam.randomizedQuestions,
            examSecurityQuestions: typeof examSecurity !== 'undefined' ? examSecurity.randomizedQuestions : 'undefined'
        });
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: white;">
                <p style="color: var(--danger-color); font-size: 1.2rem;">Error: No questions found in this exam.</p>
                <p style="color: var(--text-light); margin-top: 10px;">Check browser console (F12) for details</p>
                <p style="color: var(--text-light);">Please contact your lecturer.</p>
            </div>
        `;
        return;
    }
    
    console.log('Questions to display:', questionsToDisplay);
    console.log('Questions count:', questionsToDisplay.length);
    console.log('=============================');
    
    const totalQuestions = questionsToDisplay.length;
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    
    // Ensure currentQuestionIndex is valid
    if (currentQuestionIndex < 0) currentQuestionIndex = 0;
    if (currentQuestionIndex >= totalQuestions) currentQuestionIndex = totalQuestions - 1;
    
    // Check if current question is answered - disable going back if answered
    const isAnswered = answeredQuestions[currentQuestionIndex] || false;
    const canGoBack = currentQuestionIndex > 0 && !answeredQuestions[currentQuestionIndex - 1];
    
    contentDiv.innerHTML = `
        <div class="question-progress">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span><strong>Question ${currentQuestionIndex + 1} of ${totalQuestions}</strong></span>
                <span style="color: var(--text-light);">${Math.round(progress)}% Complete</span>
            </div>
            <div class="question-progress-bar">
                <div class="question-progress-fill" style="width: ${progress}%;"></div>
            </div>
            ${isAnswered ? '<div style="margin-top: 10px; padding: 10px; background: rgba(239, 68, 68, 0.1); border-left: 4px solid var(--danger-color); border-radius: 4px; color: var(--danger-color); font-weight: 600;">⚠️ This question has been answered. You cannot go back to previous questions.</div>' : ''}
        </div>
        
        <div id="current-question-container"></div>
        
        <div class="question-navigation">
            <button class="question-nav-btn" onclick="previousQuestion()" ${!canGoBack ? 'disabled' : ''} style="${!canGoBack ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                ← Previous
            </button>
            <div id="question-numbers" style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; flex: 1; margin: 0 15px;">
                ${questionsToDisplay.map((_, idx) => {
                    const isAnswered = answeredQuestions[idx] || false;
                    const isCurrent = idx === currentQuestionIndex;
                    const isDisabled = idx < currentQuestionIndex && !answeredQuestions[idx];
                    let bgColor = 'var(--border-color)';
                    
                    if (isCurrent) {
                        bgColor = 'var(--secondary-color)';
                    } else if (isAnswered) {
                        bgColor = 'var(--success-color)';
                    } else if (isDisabled) {
                        bgColor = '#ccc';
                    }
                    
                    return `<button 
                        class="question-nav-btn" 
                        id="q-btn-${idx}"
                        style="min-width: 40px; padding: 8px; background: ${bgColor}; ${isDisabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
                        onclick="goToQuestion(${idx})"
                        ${isDisabled ? 'disabled' : ''}
                        title="${isDisabled ? 'You cannot go back to unanswered previous questions' : isAnswered ? 'Answered' : 'Not answered'}">
                        ${idx + 1}
                    </button>`;
                }).join('')}
            </div>
            <button class="question-nav-btn" onclick="nextQuestion()" ${currentQuestionIndex === totalQuestions - 1 ? 'disabled' : ''}>
                Next →
            </button>
        </div>
    `;
    
    const questionContainer = document.getElementById('current-question-container');
    
    if (!questionContainer) {
        contentDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: white;"><p style="color: var(--danger-color); font-size: 1.2rem;">Error: Question container not found. Please refresh the page.</p></div>';
        return;
    }
    
    const question = questionsToDisplay[currentQuestionIndex];
    
    if (!question) {
        questionContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: white;"><p style="color: var(--danger-color); font-size: 1.2rem;">Error: Question not found. Please refresh the page.</p></div>';
        return;
    }
    
    const questionType = question.type || (question.options && question.options.length > 0 ? 'multiple-choice' : 'essay');
    
    if (questionType === 'essay') {
        questionContainer.innerHTML = `
            <div class="question-card">
                <h4>Question ${currentQuestionIndex + 1}: ${question.question}</h4>
                <p style="color: var(--text-light); margin-bottom: 10px;">
                    ${question.wordLimit > 0 ? `Expected length: ${question.wordLimit} words` : 'Long answer question'}
                    ${question.points ? ` | Points: ${question.points}` : ''}
                </p>
                <textarea 
                    class="essay-answer" 
                    name="question_${currentQuestionIndex}" 
                    data-question="${currentQuestionIndex}"
                    placeholder="Type your answer here..."
                    oninput="updateEssayWordCount(${currentQuestionIndex}, ${question.wordLimit || 0}); handleAnswerChange(${currentQuestionIndex}, null)"
                >${studentAnswers[currentQuestionIndex] || ''}</textarea>
                ${question.wordLimit > 0 ? `<div class="word-count" id="word-count-${currentQuestionIndex}">0 / ${question.wordLimit} words</div>` : ''}
            </div>
        `;
    } else {
        // Build optionMap: display index -> original option index
        const optionMap = [];
        if (question.shuffledOptionIndices && question.shuffledOptionIndices.length > 0) {
            question.shuffledOptionIndices.forEach(idx => optionMap.push(idx));
        } else {
            question.options.forEach((opt, idx) => {
                if (opt && opt.trim() !== '' && opt.trim().toUpperCase() !== 'N/A') optionMap.push(idx);
            });
        }
        const displayOptions = optionMap.map(idx => question.options[idx]);
        
        // Get stored answer for this question
        const storedAnswer = studentAnswers[currentQuestionIndex];
        
        questionContainer.innerHTML = `
            <div class="question-card">
                <h4>Question ${currentQuestionIndex + 1}: ${question.question}</h4>
                ${displayOptions.map((option, displayIndex) => {
                    const originalIndex = optionMap[displayIndex];
                    const isChecked = storedAnswer !== undefined && storedAnswer === originalIndex;
                    return `
                        <label class="option">
                            <input type="radio" name="question_${currentQuestionIndex}" value="${originalIndex}" data-question="${currentQuestionIndex}" onchange="handleAnswerChange(${currentQuestionIndex}, ${originalIndex})" ${isChecked ? 'checked' : ''}>
                            <span>${option}</span>
                        </label>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    // Update question buttons to show answered status
    updateQuestionButtons();
}

window.previousQuestion = function() {
    if (currentQuestionIndex > 0) {
        // Check if previous question was answered - cannot go back if answered
        if (answeredQuestions[currentQuestionIndex - 1]) {
            if (typeof showSecurityAlert === 'function') {
                showSecurityAlert('⚠️ You cannot go back to previous questions after answering them.');
            } else {
                alert('⚠️ You cannot go back to previous questions after answering them.');
            }
            return;
        }
        
        // Track time spent on current question before moving
        if (questionStartTimes[currentQuestionIndex]) {
            questionViewTimes[currentQuestionIndex] = (questionViewTimes[currentQuestionIndex] || 0) + (Date.now() - questionStartTimes[currentQuestionIndex]);
            questionStartTimes[currentQuestionIndex] = null;
        }
        
        currentQuestionIndex--;
        const exam = currentExam;
        const contentDiv = document.getElementById('exam-content');
        renderQuestionWithNavigation(exam, contentDiv);
    }
}

window.nextQuestion = function() {
    if (!currentExam) return;
    
    const questionsToUse = (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.isActive && examSecurity.randomizedQuestions) 
        ? examSecurity.randomizedQuestions 
        : (currentExam.randomizedQuestions || currentExam.questions);
    
    if (currentQuestionIndex < questionsToUse.length - 1) {
        // Track time spent on current question before moving
        if (questionStartTimes[currentQuestionIndex]) {
            questionViewTimes[currentQuestionIndex] = (questionViewTimes[currentQuestionIndex] || 0) + (Date.now() - questionStartTimes[currentQuestionIndex]);
            questionStartTimes[currentQuestionIndex] = null;
        }
        
        currentQuestionIndex++;
        const contentDiv = document.getElementById('exam-content');
        renderQuestionWithNavigation(currentExam, contentDiv);
    }
}

window.goToQuestion = function(index) {
    const questions = (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.isActive && examSecurity.randomizedQuestions) 
        ? examSecurity.randomizedQuestions 
        : (currentExam ? currentExam.questions : []);
    
    if (currentExam && index >= 0 && index < questions.length) {
        // Cannot go to previous questions if they were answered
        if (index < currentQuestionIndex && answeredQuestions[index]) {
            if (typeof showSecurityAlert === 'function') {
                showSecurityAlert('⚠️ You cannot go back to previous questions after answering them.');
            } else {
                alert('⚠️ You cannot go back to previous questions after answering them.');
            }
            return;
        }
        
        // Cannot go to unanswered previous questions
        if (index < currentQuestionIndex && !answeredQuestions[index]) {
            if (typeof showSecurityAlert === 'function') {
                showSecurityAlert('⚠️ You cannot go back to unanswered previous questions. Please answer questions in order.');
            } else {
                alert('⚠️ You cannot go back to unanswered previous questions. Please answer questions in order.');
            }
            return;
        }
        
        // Track time spent on current question before moving
        if (questionStartTimes[currentQuestionIndex]) {
            questionViewTimes[currentQuestionIndex] = (questionViewTimes[currentQuestionIndex] || 0) + (Date.now() - questionStartTimes[currentQuestionIndex]);
            questionStartTimes[currentQuestionIndex] = null;
        }
        
        currentQuestionIndex = index;
        const exam = currentExam;
        const contentDiv = document.getElementById('exam-content');
        renderQuestionWithNavigation(exam, contentDiv);
    }
}

// Helper function to get current answer
function getCurrentAnswer(questionIndex, exam) {
    const questions = (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.isActive && examSecurity.randomizedQuestions) 
        ? examSecurity.randomizedQuestions 
        : exam.questions;
    
    const question = questions[questionIndex];
    if (!question) return null;
    
    const questionType = question.type || (question.options && question.options.length > 0 ? 'multiple-choice' : 'essay');
    
    if (questionType === 'essay') {
        const textarea = document.querySelector(`textarea[name="question_${questionIndex}"]`);
        return textarea ? textarea.value.trim() : '';
    } else {
        const selected = document.querySelector(`input[name="question_${questionIndex}"]:checked`);
        return selected ? parseInt(selected.value) : null;
    }
}

// Track question view time
let questionViewTimes = {};
let questionStartTimes = {};
let answeredQuestions = {}; // Track which questions have been answered
let studentAnswers = {}; // Store actual answer values for each question

function updateQuestionButtons() {
    if (!currentExam) return;
    
    // Use randomized questions from security module if available (standardize source)
    const questionsToDisplay = (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.isActive && examSecurity.randomizedQuestions && examSecurity.randomizedQuestions.length > 0) 
        ? examSecurity.randomizedQuestions 
        : (currentExam.randomizedQuestions || currentExam.questions);
    
    questionsToDisplay.forEach((_, idx) => {
        const btn = document.getElementById(`q-btn-${idx}`);
        if (btn) {
            const question = questionsToDisplay[idx];
            const questionType = question.type || (question.options && question.options.length > 0 ? 'multiple-choice' : 'essay');
            
            let isAnswered = false;
            let answer = null;
            if (questionType === 'essay') {
                const textarea = document.querySelector(`textarea[name="question_${idx}"]`);
                isAnswered = textarea && textarea.value.trim().length > 0;
                answer = isAnswered ? textarea.value.trim() : null;
            } else {
                const selected = document.querySelector(`input[name="question_${idx}"]:checked`);
                isAnswered = selected !== null;
                answer = selected ? parseInt(selected.value) : null;
            }
            
            const isCurrent = idx === currentQuestionIndex;
            
            // Track response time when answer changes
            if (isAnswered && typeof recordAnswer === 'function' && typeof examSecurity !== 'undefined' && examSecurity.isActive) {
                const timeSpent = questionViewTimes[idx] || 0;
                recordAnswer(idx, answer, timeSpent);
            }
            
            if (isCurrent) {
                btn.style.background = 'var(--secondary-color)';
                // Start tracking time for current question
                questionStartTimes[idx] = Date.now();
            } else if (isAnswered) {
                btn.style.background = 'var(--success-color)';
                // Update time spent if was viewing
                if (questionStartTimes[idx]) {
                    questionViewTimes[idx] = (questionViewTimes[idx] || 0) + (Date.now() - questionStartTimes[idx]);
                    questionStartTimes[idx] = null;
                }
            } else {
                btn.style.background = 'var(--border-color)';
            }
        }
    });
}

function updateEssayWordCount(questionIndex, wordLimit) {
    const textarea = document.querySelector(`textarea[name="question_${questionIndex}"]`);
    const wordCountDiv = document.getElementById(`word-count-${questionIndex}`);
    
    if (textarea && wordCountDiv) {
        const text = textarea.value.trim();
        const wordCount = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
        wordCountDiv.textContent = `${wordCount} / ${wordLimit} words`;
        
        if (wordLimit > 0) {
            if (wordCount > wordLimit) {
                wordCountDiv.style.color = 'var(--danger-color)';
            } else if (wordCount >= wordLimit * 0.9) {
                wordCountDiv.style.color = 'var(--warning-color)';
            } else {
                wordCountDiv.style.color = 'var(--text-light)';
            }
        }
    }
    
    updateQuestionButtons();
}

// Handle answer changes and track response times
window.handleAnswerChange = function(questionIndex, answer) {
    // Store the answer value
    if (answer === null) {
        // Essay question - get text value
        const textarea = document.querySelector(`textarea[name="question_${questionIndex}"]`);
        studentAnswers[questionIndex] = textarea ? textarea.value.trim() : '';
    } else {
        // Multiple choice question - store the answer index
        studentAnswers[questionIndex] = answer;
    }
    
    // Mark question as answered only if there's an actual answer
    if (studentAnswers[questionIndex] !== undefined && studentAnswers[questionIndex] !== '' && studentAnswers[questionIndex] !== null) {
        answeredQuestions[questionIndex] = true;
    }
    
    // Update question buttons to show answered status
    updateQuestionButtons();
    
    // Track response time if security is active
    if (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.isActive && typeof recordAnswer === 'function') {
        const timeSpent = questionViewTimes[questionIndex] || 0;
        const answerToRecord = answer === null ? studentAnswers[questionIndex] : answer;
        if (answerToRecord !== null && answerToRecord !== undefined && answerToRecord !== '') {
            recordAnswer(questionIndex, answerToRecord, Math.round(timeSpent / 1000)); // Convert to seconds
        }
    }
    
    // Auto-advance to next question for multiple choice questions (not essay)
    if (answer !== null && currentQuestionIndex === questionIndex) {
        // Get total questions count
        const questionsToUse = (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.isActive && examSecurity.randomizedQuestions) 
            ? examSecurity.randomizedQuestions 
            : (currentExam.randomizedQuestions || currentExam.questions);
        
        // Only auto-advance if not the last question
        if (currentQuestionIndex < questionsToUse.length - 1) {
            // Small delay to show the selection before moving
            setTimeout(() => {
                if (typeof window.nextQuestion === 'function') {
                    window.nextQuestion();
                }
            }, 300);
        }
    }
};

window.closeExamModal = function() {
    // Prevent closing during active exam (security measure)
    if (typeof examSecurityActive !== 'undefined' && examSecurityActive) {
        if (!confirm('⚠️ Closing the exam window will trigger security alerts. Are you sure you want to close?')) {
            return;
        }
        // Log closing attempt
        if (typeof logSuspiciousActivity === 'function') {
            logSuspiciousActivity('Exam modal closed by user', 'high');
        }
    }
    
    if (confirm('Are you sure you want to close? Your progress will be saved, but you can continue later.')) {
        // Disable exam security
        if (typeof disableExamSecurity === 'function') {
            disableExamSecurity();
        }
        
        const modal = document.getElementById('examModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Stop timer
        if (examTimerInterval) {
            clearInterval(examTimerInterval);
    }
}
};

function updateTimer(remaining) {
    const timerDiv = document.getElementById('exam-timer');
    if (!timerDiv) return;
    
    const minutes = String(remaining.minutes).padStart(2, '0');
    const seconds = String(remaining.seconds).padStart(2, '0');
    
    timerDiv.className = 'exam-timer' + (remaining.totalSeconds < 300 ? ' warning' : '');
    timerDiv.innerHTML = `
        <h3>Time Remaining</h3>
        <div class="timer-display">${minutes}:${seconds}</div>
    `;
}

window.submitExam = async function() {
    if (!currentExam) return;
    
    // Disable submit button to prevent double submission
    const submitBtn = document.getElementById('submit-exam-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }
    
    const user = getCurrentUser();
    const answers = {};
    
    // Use randomized questions from security module if available (standardize source)
    const questionsToUse = (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.isActive && examSecurity.randomizedQuestions && examSecurity.randomizedQuestions.length > 0) 
        ? examSecurity.randomizedQuestions 
        : (currentExam.randomizedQuestions || currentExam.questions);
    
    // Collect answers from stored studentAnswers (more reliable than DOM)
    questionsToUse.forEach((question, index) => {
        // Use stored answer if available
        if (studentAnswers[index] !== undefined && studentAnswers[index] !== null && studentAnswers[index] !== '') {
            answers[index] = studentAnswers[index];
        } else {
            // Fallback to DOM if stored answer not found
        const questionType = question.type || (question.options && question.options.length > 0 ? 'multiple-choice' : 'essay');
        
        if (questionType === 'essay') {
            const textarea = document.querySelector(`textarea[name="question_${index}"]`);
            if (textarea) {
                answers[index] = textarea.value.trim();
            }
        } else {
            const selected = document.querySelector(`input[name="question_${index}"]:checked`);
            if (selected) {
                answers[index] = parseInt(selected.value);
                }
            }
        }
    });
    
    // Map randomized answers back to original question order for storage and plagiarism checking
    const originalAnswers = {};
    if (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.isActive && examSecurity.randomizedQuestions) {
        questionsToUse.forEach((randomizedQ, randomizedIndex) => {
            // Use helper from exam-security.js for robust mapping
            const originalIndex = typeof getOriginalQuestionIndex === 'function' 
                ? getOriginalQuestionIndex(randomizedIndex)
                : (randomizedQ.originalIndex !== undefined ? randomizedQ.originalIndex : examSecurity.originalQuestionOrder.findIndex(q => q.question === randomizedQ.question));
            
            if (originalIndex !== -1 && answers[randomizedIndex] !== undefined) {
                originalAnswers[originalIndex] = answers[randomizedIndex];
            }
        });
    } else {
        Object.assign(originalAnswers, answers);
    }
    
    // Check for plagiarism
    let plagiarismReport = null;
    if (typeof checkPlagiarism === 'function') {
        plagiarismReport = checkPlagiarism(Object.values(originalAnswers));
    }
    
    // Get proctoring report
    let proctoringReport = null;
    if (typeof getProctoringReport === 'function') {
        proctoringReport = getProctoringReport();
    }
    
    // Combine into security report
    const securityReport = {
        plagiarismReport: plagiarismReport,
        proctoringReport: proctoringReport
    };
    
    // Calculate score (only for multiple choice, essay needs manual grading)
    // Use original questions for scoring
    const questionsForScoring = currentExam.questions;
    
    let correct = 0;
    let totalMultipleChoice = 0;
    let hasEssay = false;
    
    questionsForScoring.forEach((question, originalIndex) => {
        const questionType = question.type || (question.options && question.options.length > 0 ? 'multiple-choice' : 'essay');
        
        if (questionType === 'essay') {
            hasEssay = true;
        } else {
            totalMultipleChoice++;
            // Use loose equality (==) to handle type differences (string vs number)
            if (originalAnswers[originalIndex] !== undefined && originalAnswers[originalIndex] == question.correctAnswer) {
                correct++;
            }
        }
    });
    
    // For exams with essay questions, score is 0 until manually graded
    // For multiple choice only, calculate automatically
    let score = 0;
    if (hasEssay) {
        // Essay questions need manual grading - score will be 0 initially
        score = totalMultipleChoice > 0 ? (correct / totalMultipleChoice) * 100 : 0;
    } else {
        score = (correct / questionsForScoring.length) * 100;
    }
    
    const finalScore = Math.round(score);
    
    // Save result with detailed answers
    const result = {
        id: Date.now().toString(),
        examId: currentExam.id,
        examTitle: currentExam.title,
        studentId: user.id,
        studentName: user.fullName,
        subject: currentExam.subject,
        type: currentExam.type,
        score: finalScore,
        letterGrade: getLetterGrade(finalScore),
        totalQuestions: questionsForScoring.length,
        correctAnswers: correct,
        answers: Object.values(originalAnswers), // Use original order
        questionDetails: questionsForScoring.map((q, idx) => {
            const questionType = q.type || (q.options && q.options.length > 0 ? 'multiple-choice' : 'essay');
            return {
                type: questionType,
                question: q.question,
                options: q.options || [],
                correctAnswer: q.correctAnswer,
                studentAnswer: originalAnswers[idx] !== undefined ? originalAnswers[idx] : null,
                isCorrect: questionType === 'essay' ? null : (originalAnswers[idx] == q.correctAnswer),
                needsGrading: questionType === 'essay',
                points: q.points || null,
                wordLimit: q.wordLimit || null
            };
        }),
        securityReport: securityReport, // Include security monitoring data
        plagiarismReport: plagiarismReport,
        proctoringReport: proctoringReport,
        randomized: (typeof examSecurity !== 'undefined' && examSecurity && examSecurity.isActive),
        submittedAt: new Date().toISOString()
    };
    
    // Save to Supabase with retry, fall back to localStorage only if all retries fail
    if (typeof saveResult === 'function') {
        let saved = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await saveResult(result);
                saved = true;
                break;
            } catch (error) {
                console.warn(`saveResult attempt ${attempt}/3 failed:`, error);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                }
            }
        }
        if (!saved) {
            console.error('All saveResult retries failed — saving to localStorage as backup');
            const results = getData('lms_results') || [];
            results.push(result);
            saveData('lms_results', results);
        }
    } else {
        const results = getData('lms_results') || [];
        results.push(result);
        saveData('lms_results', results);
    }
    
    // Stop timer
    if (examTimerInterval) {
        clearInterval(examTimerInterval);
        examTimerInterval = null;
    }
    
    // Disable exam security
    if (typeof disableExamSecurity === 'function') {
        disableExamSecurity();
    }
    
    // Close modal
    const modal = document.getElementById('examModal');
    if (modal) {
    modal.style.display = 'none';
    }
    document.body.style.overflow = 'auto';
    
    // Show submission confirmation
    let message = 'Exam submitted successfully!';
    if (securityReport && securityReport.suspiciousActivities && securityReport.suspiciousActivities.length > 0) {
        message += '\n\n⚠️ Note: Some activities were detected during the exam and have been logged for review.';
    }
    if (securityReport && securityReport.plagiarismFlags) {
        message += '\n\n⚠️ Plagiarism detection was performed on your answers.';
    }
    
    alert(message);
    
    currentExam = null;
    
    const letterGrade = getLetterGrade(Math.round(score));
    const gradeColor = getGradeColor(letterGrade);
    
    // Reload data
    await loadExams();
    await loadResults();
    await loadDashboard();
};

// Helper function to show security alerts (from exam-security.js)
function showSecurityAlert(message) {
    if (typeof showSecurityAlert !== 'undefined' && window.showSecurityAlert) {
        return; // Use the one from exam-security.js
    }
    
    // Fallback alert
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--warning-color);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Helper function to check if a result is released
function isResultReleased(result, user, releases, exams) {
    if (!result || result.studentId !== user.id) return false;
    
    // Method 1: Check if result is explicitly marked as released (highest priority)
    if (result.isReleased === true) {
        console.log(`  ✓ Method 1: isReleased=true for result ${result.id}`);
        return true;
    }
    
    // Method 2: Primary check - examId in releases object (most common)
    if (result.examId) {
        // Direct check - this is the main way results are released
        if (releases[result.examId] === true) {
            console.log(`  ✓ Method 2: releases[${result.examId}]=true for result ${result.id}`);
            return true;
        } else {
            console.log(`  ✗ Method 2: releases[${result.examId}]=${releases[result.examId]} (not true) for result ${result.id}`);
        }
        
        // For written exams, also check if the exam itself is released (redundant but safe)
        if (result.isWritten === true || result.type === 'Mid Course Exam') {
            const exam = exams.find(e => e.id === result.examId);
            if (exam) {
                if (releases[exam.id] === true) {
                    console.log(`  ✓ Method 2b: Exam ${exam.id} is released for result ${result.id}`);
                    return true;
                }
            } else {
                console.log(`  ⚠ Method 2b: Exam ${result.examId} not found in exams array`);
            }
        }
    } else {
        console.log(`  ⚠ Result ${result.id} has no examId`);
    }
    
    // Method 3: Fallback - check if result.id is in releases (for backwards compatibility)
    if (result.id && releases[result.id] === true) {
        console.log(`  ✓ Method 3: releases[${result.id}]=true for result ${result.id}`);
        return true;
    }
    
    // Method 4: For composite results, check if the exam is released
    if (result.isComposite === true && result.examId) {
        const exam = exams.find(e => e.id === result.examId);
        if (exam && releases[exam.id] === true) {
            console.log(`  ✓ Method 4: Composite exam ${exam.id} is released for result ${result.id}`);
            return true;
        }
    }
    
    // Method 5: For Mid Course Exam written results, check by type and class even if examId doesn't match
    if (result.type === 'Mid Course Exam' && result.isWritten === true) {
        // Find any Mid Course Exam for this class that's released
        const releasedMidCourseExams = exams.filter(e => 
            e.type === 'Mid Course Exam' &&
            e.classes && e.classes.includes(user.class) &&
            releases[e.id] === true
        );
        if (releasedMidCourseExams.length > 0) {
            // Check if this result matches any released exam by subject
            const matchingExam = releasedMidCourseExams.find(e => 
                (!e.subject && !result.subject) || (e.subject === result.subject)
            );
            if (matchingExam) {
                console.log(`  ✓ Method 5: Found matching Mid Course Exam ${matchingExam.id} for result ${result.id}`);
                return true;
            }
        }
    }
    
    // Method 6: For any result without examId, try to find matching exam by title, type, and subject
    if (!result.examId && result.examTitle && result.type) {
        const matchingExams = exams.filter(e => 
            e.title === result.examTitle &&
            e.type === result.type &&
            e.classes && e.classes.includes(user.class) &&
            releases[e.id] === true
        );
        if (matchingExams.length > 0) {
            console.log(`  ✓ Method 6: Found matching exam by title for result ${result.id}`);
            return true;
        }
    }
    
    // If no release mechanism found, don't show the result
    console.log(`  ✗ Result ${result.id} (examId: ${result.examId}, type: ${result.type}) NOT RELEASED`);
    return false;
}

async function loadResults() {
    // Also load manual entries/continuous assessment
    loadContinuousAssessment();
    
    try {
    const user = getCurrentUser();
        if (!user) {
            console.error('loadResults: No user found');
            return;
        }
        
        let results = [];
        if (typeof getResults === 'function') {
            try {
                results = await getResults();
            } catch (error) {
                results = getData('lms_results') || [];
            }
        } else {
            results = getData('lms_results') || [];
        }
        
        let releases = {};
        if (typeof getResultReleases === 'function') {
            try {
                releases = await getResultReleases();
            } catch (error) {
                releases = getData('lms_result_releases') || {};
            }
        } else {
            releases = getData('lms_result_releases') || {};
        }
        
        let exams = [];
        if (typeof getExams === 'function') {
            try {
                exams = await getExams();
            } catch (error) {
                exams = getData('lms_exams') || [];
            }
        } else {
            exams = getData('lms_exams') || [];
        }
        
        // Check global print permission
        let isPrintingAllowed = false;
        try {
            const canPrintGlobal = await getSystemSetting('allow_result_printing');
            isPrintingAllowed = canPrintGlobal === true || canPrintGlobal === 'true';
            console.log('Global print permission:', isPrintingAllowed);
        } catch (e) {
            console.warn('Failed to check global print setting:', e);
            isPrintingAllowed = false; // Default to locked if check fails
        }
        
        // Debug: Log all data
        console.log('=== LOAD RESULTS DEBUG ===');
        console.log('User:', user);
        console.log('Total results:', results.length);
        console.log('Releases object:', releases);
        console.log('Total exams:', exams.length);
        
        // First, get all results for this student
        const allUserResults = results.filter(r => r && r.studentId === user.id);
        console.log(`Found ${allUserResults.length} total results for user ${user.id} (${user.fullName})`);
        
        // Filter results: only show released results for this student
        const userResults = allUserResults.filter(r => {
            try {
                const isReleased = isResultReleased(r, user, releases, exams);
                if (r.studentId === user.id) {
                    console.log(`Result ${r.id || 'no-id'}: examId=${r.examId}, type=${r.type}, isReleased=${r.isReleased}, examTitle=${r.examTitle}, released=${isReleased}`);
                    if (!isReleased && r.examId) {
                        console.log(`  Release check: releases["${r.examId}"] = ${releases[r.examId]}`);
                    }
                }
                return isReleased;
            } catch (e) {
                console.error('Error checking result:', e, r);
                return false;
            }
        });
        
        console.log('Filtered user results:', userResults.length);
        console.log('User results:', userResults);
        console.log('========================');
        
        // Separate Mid Course Exam from other results
    const midCourseResults = userResults.filter(r => r.type === 'Mid Course Exam');
    const otherResults = userResults.filter(r => r.type !== 'Mid Course Exam');
    
    // Sort both arrays by date (newest first)
    midCourseResults.sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0));
    otherResults.sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0));
    
    const tbody = document.getElementById('results-tbody');
    if (!tbody) return;
    
    // Update print all button state
    updatePrintButtonState();
    
    if (userResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">No results available. Results will appear here once released by your lecturer.<br><small style="color: var(--text-light); margin-top: 10px; display: block;">Print buttons will appear when results are available.</small></td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    // Show Mid Course Exam results first (if any)
    if (midCourseResults.length > 0) {
        midCourseResults.forEach(result => {
        const letterGrade = getLetterGrade(result.score);
        const gradeColor = getGradeColor(letterGrade);
        const row = document.createElement('tr');
            row.style.background = 'var(--light-color)';
            row.style.borderLeft = '4px solid var(--primary-color)';
        row.innerHTML = `
                <td>
                    <strong style="color: var(--primary-color);">${result.examTitle || 'Mid Course Exam'}</strong>
                    <br><small style="color: var(--text-light);">Standalone Exam</small>
                </td>
                <td>${result.subject || 'General'}</td>
                <!-- <td>
                    <span style="background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">${result.type}</span>
                </td> -->
                <td>
                    <strong style="font-size: 1.1rem;">${result.score}%</strong> 
                <span class="grade-badge" style="background: ${gradeColor}; color: white; padding: 4px 8px; border-radius: 4px; margin-left: 8px; font-weight: bold;">${letterGrade}</span>
                    ${result.correctAnswers !== undefined ? `<br><small style="color: var(--text-light);">(${result.correctAnswers}/${result.totalQuestions})</small>` : ''}
            </td>
            <td>${formatDate(result.submittedAt)}</td>
            <td style="white-space: nowrap;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <button class="btn btn-small" onclick="showGradeBreakdown('${result.id}')" style="flex: 1; min-width: 90px; padding: 8px 12px; display: inline-flex; align-items: center; justify-content: center;">
                        <span style="margin-right: 4px;">👁️</span> View
                    </button>
                    ${isPrintingAllowed ? 
                        `<button class="btn btn-small btn-success" onclick="printResultPDF('${result.id}')" title="Print/Download as PDF" style="flex: 1; min-width: 90px; padding: 8px 12px; display: inline-flex; align-items: center; justify-content: center;">
                            <span style="margin-right: 4px;">📄</span> Print
                        </button>` : 
                        `<button class="btn btn-small" disabled title="Printing disabled by Admin." style="flex: 1; min-width: 90px; padding: 8px 12px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.5; cursor: not-allowed; background: #ccc;">
                            <span style="margin-right: 4px;">🔒</span> Locked
                        </button>`
                    }
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    }
    
    // Show other results
    otherResults.forEach(result => {
        const letterGrade = getLetterGrade(result.score);
        const gradeColor = getGradeColor(letterGrade);
        const isComposite = result.isComposite === true;
        const row = document.createElement('tr');
        
        // Style composite results differently
        if (isComposite) {
            row.style.background = 'var(--light-color)';
            row.style.borderLeft = '4px solid var(--success-color)';
        }
        
        // Determine result type display
        let typeDisplay = result.type || 'Exam';
        let typeBadgeStyle = 'background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;';
        
        if (isComposite) {
            typeDisplay = 'Final Composite';
            typeBadgeStyle = 'background: var(--success-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;';
        } else if (result.type === 'Quiz' || result.type === 'Mid Semester') {
            typeBadgeStyle = 'background: var(--warning-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;';
        } else if (result.type === 'Final Exam') {
            typeBadgeStyle = 'background: var(--danger-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;';
        }
        
        row.innerHTML = `
            <td>
                ${isComposite ? '<strong style="color: var(--success-color);">' + (result.examTitle || 'Final Exam Composite') + '</strong><br><small style="color: var(--text-light);">Includes all components</small>' : (result.examTitle || 'Untitled Exam')}
            </td>
            <td>${result.subject || 'N/A'}</td>
            <!-- <td>
                <span style="${typeBadgeStyle}">${typeDisplay}</span>
            </td> -->
            <td>
                <strong style="font-size: ${isComposite ? '1.2rem' : '1rem'}; color: ${isComposite ? 'var(--success-color)' : 'var(--text-color)'};">${result.score}%</strong> 
                <span class="grade-badge" style="background: ${gradeColor}; color: white; padding: 4px 8px; border-radius: 4px; margin-left: 8px; font-weight: bold;">${letterGrade}</span>
                ${result.correctAnswers !== undefined && result.totalQuestions !== undefined && result.totalQuestions > 0 ? `<br><small style="color: var(--text-light);">(${result.correctAnswers}/${result.totalQuestions})</small>` : ''}
                ${isComposite && result.compositeBreakdown ? `
                    <br><small style="color: var(--text-light); font-size: 0.85rem;">
                        Opening: ${result.compositeBreakdown.opening || 0}% | 
                        BFT: ${((result.compositeBreakdown.bft1 || 0) + (result.compositeBreakdown.bft2 || 0)) / 2}% | 
                        Mid Course: ${result.compositeBreakdown.midCourse || 0}%
                    </small>
                ` : ''}
            </td>
            <td>${formatDate(result.submittedAt || result.createdAt)}</td>
            <td style="white-space: nowrap;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <button class="btn btn-small" onclick="showGradeBreakdown('${result.id}')" style="flex: 1; min-width: 90px; padding: 8px 12px; display: inline-flex; align-items: center; justify-content: center;">
                        <span style="margin-right: 4px;">👁️</span> View
                    </button>
                    ${isPrintingAllowed ? 
                        `<button class="btn btn-small btn-success" onclick="printResultPDF('${result.id}')" title="Print/Download as PDF" style="flex: 1; min-width: 90px; padding: 8px 12px; display: inline-flex; align-items: center; justify-content: center;">
                            <span style="margin-right: 4px;">📄</span> Print
                        </button>` : 
                        `<button class="btn btn-small" disabled title="Printing disabled by Admin." style="flex: 1; min-width: 90px; padding: 8px 12px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.5; cursor: not-allowed; background: #ccc;">
                            <span style="margin-right: 4px;">🔒</span> Locked
                        </button>`
                    }
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    } catch (e) {
        console.error('Error in loadResults:', e);
        const tbody = document.getElementById('results-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--danger-color);">Error loading results. Please refresh the page.<br><small>' + e.message + '</small></td></tr>';
        }
    }
}

async function loadMaterials() {
    // Delegate to window.loadMaterials if it has been defined (the full implementation below)
    if (window._loadMaterialsFull) {
        return window._loadMaterialsFull();
    }

    const user = getCurrentUser();
    let materials = [];
    if (typeof window.getMaterials === 'function') {
        try {
            materials = await window.getMaterials();
            window.loadedMaterials = materials; // Store globally for downloads
        } catch (error) {
            console.warn('Supabase getMaterials failed, using localStorage:', error);
            materials = getData('lms_materials') || [];
            window.loadedMaterials = materials;
        }
    } else {
        materials = getData('lms_materials') || [];
        window.loadedMaterials = materials;
    }

    // Normalize material properties (handle both snake_case DB columns and camelCase frontend)
    materials = materials.map(m => ({
        ...m,
        class: m.class || m.class_name,
        lecturerId: m.lecturerId || m.lecturer_id,
        uploadedBy: m.uploadedBy || m.lecturer_id,
        lecturerName: m.lecturerName || m.lecturer_name,
        uploadedAt: m.uploadedAt || m.uploaded_at,
        fileUrl: m.fileUrl || m.file_url,
        videoUrl: m.videoUrl || m.video_url,
        audioUrl: m.audioUrl || m.audio_url,
        uploadedFile: m.uploadedFile || m.uploaded_file,
        fileName: m.fileName || m.file_name
    }));
    window.loadedMaterials = materials;

    // Filter by user's class only (subjects filter removed — students may not have subjects array)
    const classMaterials = materials.filter(m =>
        (m.class === user.class || m.class_name === user.class)
    );
    
    const container = document.getElementById('materials-list');
    if (!container) return;
    
    if (classMaterials.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-light); background: var(--light-color); border-radius: 12px;">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">📚 No materials available yet</p>
                <p style="font-size: 0.9rem;">Materials for your registered subjects (${userSubjects.join(', ') || 'none'}) will appear here.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    classMaterials.forEach(material => {
        const materialCard = document.createElement('div');
        materialCard.className = 'material-card';
        
        // Build download buttons
        let downloadButtons = '';
        if (material.uploadedFile && !material.fileUrl) {
            downloadButtons += `<button class="btn-small btn btn-success" onclick="downloadUploadedFile('${material.id}')" title="${material.uploadedFile.name}">
                📄 Download ${material.uploadedFile.name}
            </button>`;
        }
        if (material.fileUrl) {
            const isBase64 = material.fileUrl.startsWith('data:');
            downloadButtons += `<button class="btn-small btn btn-success" onclick="downloadMaterialById('${material.id}')" style="${material.uploadedFile ? 'margin-left: 10px;' : ''}" title="${material.fileName || 'Download'}">
                ${isBase64 ? '📄 Download File' : '🔗 External File'}
            </button>`;
        }
        
        materialCard.innerHTML = `
            <div class="material-info">
                <h4 style="color: var(--primary-color); font-size: 1.2rem; margin-bottom: 8px;">${material.title}</h4>
                <p style="font-size: 0.9rem; margin-bottom: 12px;">
                    <span class="badge" style="background: var(--light-color); color: var(--primary-color); padding: 2px 8px; border-radius: 4px;">${material.subject}</span>
                    <span style="color: var(--text-light); margin-left: 10px;">Uploaded: ${formatDate(material.uploadedAt)}</span>
                </p>
                ${material.description ? `<p style="margin-bottom: 15px; color: var(--text-color);">${material.description}</p>` : ''}
                ${material.uploadedFile ? `<p style="color: var(--text-light); font-size: 0.85rem; margin-bottom: 10px;">
                    <strong>File:</strong> ${material.uploadedFile.name} (${formatFileSize(material.uploadedFile.size)})
                </p>` : ''}
            </div>
            <div class="material-actions" style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 15px; display: flex; gap: 10px;">
                ${material.content ? `<button class="btn-small btn" onclick="viewMaterial('${material.id}')">View Details</button>` : ''}
                ${downloadButtons}
            </div>
        `;
        container.appendChild(materialCard);
    });
}

window.viewMaterial = async function(materialId) {
    let materials = [];
    if (typeof window.getMaterials === 'function') {
        try {
            materials = await window.getMaterials();
        } catch (error) {
            materials = getData('lms_materials') || [];
        }
    } else {
        materials = getData('lms_materials') || [];
    }
    
    const material = materials.find(m => m.id === materialId);
    
    if (!material) return;
    
    const modal = document.getElementById('materialModal');
    const title = document.getElementById('modalMaterialTitle');
    const subject = document.getElementById('modalMaterialSubject');
    const date = document.getElementById('modalMaterialDate');
    const content = document.getElementById('modalMaterialContent');
    
    if (!modal || !content) return;
    
    title.textContent = material.title;
    subject.textContent = `Subject: ${material.subject}`;
    date.textContent = `Uploaded: ${formatDate(material.uploadedAt)}`;
    content.innerHTML = material.content || material.description || 'No detailed content available.';
    
    modal.style.display = 'flex';
}

window.closeMaterialModal = function() {
    const modal = document.getElementById('materialModal');
    if (modal) modal.style.display = 'none';
}

window.downloadMaterialById = function(materialId) {
    const material = window.loadedMaterials?.find(m => m.id === materialId);
    if (!material || !material.fileUrl) return;
    
    window.downloadFile(material.fileUrl, material.fileName || material.title || 'download');
};

function downloadMaterial(fileUrl) {
    window.downloadFile(fileUrl, 'download');
}

function formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

window.downloadUploadedFile = function(materialId) {
    // Try global loadedMaterials first, then fallback to local storage
    const materials = window.loadedMaterials || getData('lms_materials') || [];
    const material = materials.find(m => m.id === materialId || String(m.id) === String(materialId));
    
    if (!material || !material.uploadedFile) {
        console.warn('Material not found for download:', materialId, 'Available:', materials.length);
        alert('File not found');
        return;
    }
    
    window.downloadFile(material.uploadedFile.data, material.uploadedFile.name);
};

// showSection is already defined at the top of the file - removing duplicate to avoid conflicts

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; margin-left: 15px;">×</button>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

window.showGradeBreakdown = async function(resultId) {
    let results = [];
    if (typeof getResults === 'function') {
        try {
            results = await getResults();
        } catch (error) {
            results = getData('lms_results') || [];
        }
    } else {
        results = getData('lms_results') || [];
    }
    const result = results.find(r => r.id === resultId);
    
    if (!result) {
        alert('Result not found');
        return;
    }
    
    const modal = document.getElementById('gradeBreakdownModal');
    const title = document.getElementById('breakdown-exam-title');
    const summary = document.getElementById('breakdown-summary');
    const questions = document.getElementById('breakdown-questions');
    
    if (!modal || !title || !summary || !questions) return;
    
    title.textContent = result.examTitle;
    
    const letterGrade = getLetterGrade(result.score);
    const gradeColor = getGradeColor(letterGrade);
    
    summary.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
            <div>
                <strong>Overall Score</strong>
                <div style="font-size: 2rem; color: ${gradeColor}; font-weight: bold;">${result.score}%</div>
            </div>
            <div>
                <strong>Letter Grade</strong>
                <div style="font-size: 2rem; color: ${gradeColor}; font-weight: bold;">${letterGrade}</div>
            </div>
            <div>
                <strong>Correct Answers</strong>
                <div style="font-size: 2rem; color: var(--success-color); font-weight: bold;">${result.correctAnswers}/${result.totalQuestions}</div>
            </div>
            <div>
                <strong>Subject</strong>
                <div style="font-size: 1.2rem; margin-top: 5px;">${result.subject}</div>
            </div>
        </div>
    `;
    
    questions.innerHTML = '';
    
    if (result.questionDetails && result.questionDetails.length > 0) {
        result.questionDetails.forEach((qDetail, index) => {
            const questionCard = document.createElement('div');
            questionCard.className = 'breakdown-question-card';
            questionCard.style.marginBottom = '20px';
            questionCard.style.padding = '15px';
            
            const questionType = qDetail.type || (qDetail.options && qDetail.options.length > 0 ? 'multiple-choice' : 'essay');
            
            if (questionType === 'essay') {
                questionCard.style.border = '2px solid var(--warning-color)';
                questionCard.style.borderRadius = '8px';
                questionCard.style.background = 'rgba(245, 158, 11, 0.1)';
                
                questionCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <h4 style="margin: 0;">Question ${index + 1} (Essay)</h4>
                        <span style="padding: 4px 12px; border-radius: 4px; font-weight: bold; background: var(--warning-color); color: white;">
                            ${qDetail.needsGrading ? '⏳ Pending Grading' : '✓ Graded'}
                        </span>
                    </div>
                    <p style="margin-bottom: 15px; font-weight: 500;">${qDetail.question}</p>
                    <div style="margin-bottom: 10px;">
                        <strong>Your Answer:</strong>
                        <div style="padding: 12px; margin-top: 8px; background: var(--light-color); border-radius: 6px; white-space: pre-wrap; min-height: 100px;">
                            ${qDetail.studentAnswer || 'No answer provided'}
                        </div>
                        ${qDetail.wordLimit ? `<small style="color: var(--text-light);">Word limit: ${qDetail.wordLimit} words</small>` : ''}
                    </div>
                `;
            } else {
                questionCard.style.border = `2px solid ${qDetail.isCorrect ? 'var(--success-color)' : 'var(--danger-color)'}`;
                questionCard.style.borderRadius = '8px';
                questionCard.style.background = qDetail.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                
                questionCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <h4 style="margin: 0;">Question ${index + 1}</h4>
                        <span style="padding: 4px 12px; border-radius: 4px; font-weight: bold; background: ${qDetail.isCorrect ? 'var(--success-color)' : 'var(--danger-color)'}; color: white;">
                            ${qDetail.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                        </span>
                    </div>
                    <p style="margin-bottom: 15px; font-weight: 500;">${qDetail.question}</p>
                    <div style="margin-bottom: 10px;">
                        ${qDetail.options.map((opt, optIdx) => {
                            let style = 'padding: 8px; margin: 5px 0; border-radius: 4px; border: 1px solid var(--border-color);';
                            if (optIdx === qDetail.correctAnswer) {
                                style += 'background: rgba(16, 185, 129, 0.2); border-color: var(--success-color);';
                            }
                            if (qDetail.studentAnswer !== null && optIdx === qDetail.studentAnswer && !qDetail.isCorrect) {
                                style += 'background: rgba(239, 68, 68, 0.2); border-color: var(--danger-color);';
                            }
                            return `
                                <div style="${style}">
                                    ${optIdx === qDetail.correctAnswer ? '✓ ' : ''}
                                    ${qDetail.studentAnswer !== null && optIdx === qDetail.studentAnswer && !qDetail.isCorrect ? '✗ ' : ''}
                                    ${opt}
                                    ${optIdx === qDetail.correctAnswer ? ' <strong>(Correct Answer)</strong>' : ''}
                                    ${qDetail.studentAnswer !== null && optIdx === qDetail.studentAnswer && !qDetail.isCorrect ? ' <strong>(Your Answer)</strong>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }
            
            questions.appendChild(questionCard);
        });
    } else {
        questions.innerHTML = '<p>Detailed breakdown not available for this exam.</p>';
    }
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
};

window.closeGradeBreakdown = function() {
    const modal = document.getElementById('gradeBreakdownModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

window.logout = function() {
    clearCurrentUser();
    window.location.href = 'login.html';
};

// Print/Download Result as PDF
window.printResultPDF = async function(resultId) {
    // Check global permission first
    const canPrint = await getSystemSetting('allow_result_printing');
    // Convert to boolean (it might be string 'true'/'false' or boolean)
    const isAllowed = canPrint === true || canPrint === 'true';
    
    if (!isAllowed) {
        alert('Printing results is currently disabled by the Administrator.');
        return;
    }

    let result;
    
    if (resultId) {
        // Get result by ID
        let results = [];
        if (typeof getResults === 'function') {
            try {
                results = await getResults();
            } catch (error) {
                results = getData('lms_results') || [];
            }
        } else {
            results = getData('lms_results') || [];
        }
        result = results.find(r => r.id === resultId);
    } else {
        // Get currently displayed result from modal
        const title = document.getElementById('breakdown-exam-title');
        if (!title) {
            alert('No result selected. Please view a result first.');
            return;
        }
        let results = [];
        if (typeof getResults === 'function') {
            try {
                results = await getResults();
            } catch (error) {
                results = getData('lms_results') || [];
            }
        } else {
            results = getData('lms_results') || [];
        }
        result = results.find(r => r.examTitle === title.textContent);
    }
    
    if (!result) {
        alert('Result not found');
        return;
    }
    
    const user = getCurrentUser();
    const letterGrade = getLetterGrade(result.score);
    const gradeColor = getGradeColor(letterGrade);
    
    // Create printable content
    const printableDiv = document.getElementById('printable-result');
    if (!printableDiv) {
        // Create it if it doesn't exist
        const div = document.createElement('div');
        div.id = 'printable-result';
        div.style.display = 'none';
        document.body.appendChild(div);
    }
    
    let questionsHTML = '';
    if (result.questionDetails && result.questionDetails.length > 0) {
        result.questionDetails.forEach((qDetail, index) => {
            const questionType = qDetail.type || (qDetail.options && qDetail.options.length > 0 ? 'multiple-choice' : 'essay');
            
            if (questionType === 'essay') {
                questionsHTML += `
                    <div style="page-break-inside: avoid; margin-bottom: 20px; padding: 15px; border: 2px solid #f59e0b; border-radius: 8px; background: rgba(245, 158, 11, 0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <h4 style="margin: 0;">Question ${index + 1} (Essay)</h4>
                            <span style="padding: 4px 12px; border-radius: 4px; font-weight: bold; background: #f59e0b; color: white;">
                                ${qDetail.needsGrading ? '⏳ Pending Grading' : '✓ Graded'}
                            </span>
                        </div>
                        <p style="margin-bottom: 15px; font-weight: 500;">${qDetail.question}</p>
                        <div style="margin-bottom: 10px;">
                            <strong>Your Answer:</strong>
                            <div style="padding: 12px; margin-top: 8px; background: #f9fafb; border-radius: 6px; white-space: pre-wrap; min-height: 100px;">
                                ${qDetail.studentAnswer || 'No answer provided'}
                            </div>
                            ${qDetail.wordLimit ? `<small style="color: #6b7280;">Word limit: ${qDetail.wordLimit} words</small>` : ''}
                        </div>
                    </div>
                `;
            } else {
                const borderColor = qDetail.isCorrect ? '#10b981' : '#ef4444';
                const bgColor = qDetail.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                
                questionsHTML += `
                    <div style="page-break-inside: avoid; margin-bottom: 20px; padding: 15px; border: 2px solid ${borderColor}; border-radius: 8px; background: ${bgColor};">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <h4 style="margin: 0;">Question ${index + 1}</h4>
                            <span style="padding: 4px 12px; border-radius: 4px; font-weight: bold; background: ${borderColor}; color: white;">
                                ${qDetail.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                            </span>
                        </div>
                        <p style="margin-bottom: 15px; font-weight: 500;">${qDetail.question}</p>
                        <div style="margin-bottom: 10px;">
                            ${qDetail.options.map((opt, optIdx) => {
                                let style = 'padding: 8px; margin: 5px 0; border-radius: 4px; border: 1px solid #e5e7eb;';
                                if (optIdx === qDetail.correctAnswer) {
                                    style += 'background: rgba(16, 185, 129, 0.2); border-color: #10b981;';
                                }
                                if (qDetail.studentAnswer !== null && optIdx === qDetail.studentAnswer && !qDetail.isCorrect) {
                                    style += 'background: rgba(239, 68, 68, 0.2); border-color: #ef4444;';
                                }
                                return `
                                    <div style="${style}">
                                        ${optIdx === qDetail.correctAnswer ? '✓ ' : ''}
                                        ${qDetail.studentAnswer !== null && optIdx === qDetail.studentAnswer && !qDetail.isCorrect ? '✗ ' : ''}
                                        ${opt}
                                        ${optIdx === qDetail.correctAnswer ? ' <strong>(Correct Answer)</strong>' : ''}
                                        ${qDetail.studentAnswer !== null && optIdx === qDetail.studentAnswer && !qDetail.isCorrect ? ' <strong>(Your Answer)</strong>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        });
    }
    
    printableDiv.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; background: white;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px;">
                <h1 style="color: #2563eb; margin: 0 0 10px 0;">Signals Training School</h1>
                <h2 style="color: #1e40af; margin: 0; font-size: 1.5rem;">Examination Result</h2>
            </div>
            
            <!-- Student Info -->
            <div style="margin-bottom: 30px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Student Name:</strong></td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${user.fullName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Class:</strong></td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${user.class || 'Not assigned'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Exam/Quiz:</strong></td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${result.examTitle}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Subject:</strong></td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${result.subject}</td>
                    </tr>
                    <!-- <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Type:</strong></td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${result.type}</td>
                    </tr> -->
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Date Submitted:</strong></td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${formatDate(result.submittedAt)}</td>
                    </tr>
                </table>
            </div>
            
            <!-- Score Summary -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px; margin-bottom: 30px; text-align: center;">
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                    <div>
                        <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Overall Score</div>
                        <div style="font-size: 2.5rem; font-weight: bold;">${result.score}%</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Letter Grade</div>
                        <div style="font-size: 2.5rem; font-weight: bold;">${letterGrade}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Correct Answers</div>
                        <div style="font-size: 2.5rem; font-weight: bold;">${result.correctAnswers}/${result.totalQuestions}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Total Questions</div>
                        <div style="font-size: 2.5rem; font-weight: bold;">${result.totalQuestions}</div>
                    </div>
                </div>
            </div>
            
            <!-- Question Details -->
            <div style="margin-top: 30px;">
                <h3 style="color: #1e40af; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px;">Question Breakdown</h3>
                ${questionsHTML || '<p>Detailed breakdown not available for this exam.</p>'}
            </div>
            
            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 0.9rem;">
                <p style="margin: 5px 0;">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                <p style="margin: 5px 0;">Signals Training School - Learning Management System</p>
            </div>
        </div>
    `;
    
    // Show printable content and print
    printableDiv.style.display = 'block';
    
    // Create print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${result.examTitle} - Result</title>
            <style>
                @media print {
                    @page {
                        margin: 20mm;
                        size: A4;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                }
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                }
            </style>
        </head>
        <body>
            ${printableDiv.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        // Optionally close after printing
        // printWindow.close();
    }, 250);
    
    // Hide printable div
    printableDiv.style.display = 'none';
};

// Print all results as PDF
window.printAllResultsPDF = async function() {
    // Check global permission first
    const canPrint = await getSystemSetting('allow_result_printing');
    // Convert to boolean (it might be string 'true'/'false' or boolean)
    const isAllowed = canPrint === true || canPrint === 'true';
    
    if (!isAllowed) {
        alert('Printing results is currently disabled by the Administrator.');
        return;
    }

    const user = getCurrentUser();
    if (!user) {
        alert('Please log in to print results.');
        return;
    }
    
    let results = [];
    let releases = {};
    let exams = [];
    
    if (typeof getResults === 'function') {
        try {
            results = await getResults();
        } catch (error) {
            results = getData('lms_results') || [];
        }
    } else {
        results = getData('lms_results') || [];
    }
    
    if (typeof getResultReleases === 'function') {
        try {
            releases = await getResultReleases();
        } catch (error) {
            releases = getData('lms_result_releases') || {};
        }
    } else {
        releases = getData('lms_result_releases') || {};
    }
    
    if (typeof getExams === 'function') {
        try {
            exams = await getExams();
        } catch (error) {
            exams = getData('lms_exams') || [];
        }
    } else {
        exams = getData('lms_exams') || [];
    }
    
    // Filter results: only show released results for this student (use same logic as loadResults)
    const userResults = results.filter(r => isResultReleased(r, user, releases, exams));
    
    if (userResults.length === 0) {
        alert('No results available to print. Results will appear here once they are released by the lecturer.');
        return;
    }
    
    // Sort by date (newest first)
    userResults.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    
    // Create printable content
    const printableDiv = document.getElementById('printable-result');
    if (!printableDiv) {
        const div = document.createElement('div');
        div.id = 'printable-result';
        div.style.display = 'none';
        document.body.appendChild(div);
    }
    
    let resultsHTML = '';
    userResults.forEach((result, idx) => {
        const letterGrade = getLetterGrade(result.score);
        const gradeColor = getGradeColor(letterGrade);
        
        resultsHTML += `
            <div style="page-break-before: ${idx > 0 ? 'always' : 'auto'}; margin-bottom: 40px;">
                <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px;">
                    <h1 style="color: #2563eb; margin: 0 0 10px 0;">Signals Training School</h1>
                    <h2 style="color: #1e40af; margin: 0; font-size: 1.5rem;">Examination Result</h2>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Student Name:</strong></td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;">${user.fullName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Class:</strong></td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;">${user.class || 'Not assigned'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Exam/Quiz:</strong></td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;">${result.examTitle}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Subject:</strong></td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;">${result.subject}</td>
                        </tr>
                        <!-- <tr>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Type:</strong></td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;">${result.type}</td>
                        </tr> -->
                        <tr>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Date Submitted:</strong></td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb;">${formatDate(result.submittedAt)}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px; margin-bottom: 30px; text-align: center;">
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                        <div>
                            <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Overall Score</div>
                            <div style="font-size: 2.5rem; font-weight: bold;">${result.score}%</div>
                        </div>
                        <div>
                            <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Letter Grade</div>
                            <div style="font-size: 2.5rem; font-weight: bold;">${letterGrade}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Correct Answers</div>
                            <div style="font-size: 2.5rem; font-weight: bold;">${result.correctAnswers}/${result.totalQuestions}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Total Questions</div>
                            <div style="font-size: 2.5rem; font-weight: bold;">${result.totalQuestions}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    printableDiv.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; background: white;">
            ${resultsHTML}
            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 0.9rem;">
                <p style="margin: 5px 0;">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                <p style="margin: 5px 0;">Signals Training School - Learning Management System</p>
            </div>
        </div>
    `;
    
    // Show printable content and print
    printableDiv.style.display = 'block';
    
    // Create print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>All Results - ${user.fullName}</title>
            <style>
                @media print {
                    @page {
                        margin: 20mm;
                        size: A4;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                }
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                }
            </style>
        </head>
        <body>
            ${printableDiv.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 250);
    
    // Hide printable div
    printableDiv.style.display = 'none';
};

// Load manual entries/continuous assessment marks for students
async function loadContinuousAssessment() {
    const user = getCurrentUser();
    const tbody = document.getElementById('continuous-assessment-tbody');
    if (!tbody) return;

    try {
        let writtenMarks = {};
        if (typeof getWrittenMarks === 'function') {
            try {
                writtenMarks = await getWrittenMarks();
            } catch (err) {
                writtenMarks = getData('lms_written_marks') || {};
            }
        } else {
            writtenMarks = getData('lms_written_marks') || {};
        }

        // Written marks are stored by class
        const key = `general_${user.class}`;
        const studentMarks = writtenMarks[key] || {};
        
        const assessments = [];
        Object.keys(studentMarks).forEach(examType => {
            const marksForType = studentMarks[examType];
            if (marksForType && marksForType[user.id] !== undefined && marksForType[user.id] !== null) {
                assessments.push({
                    type: examType,
                    mark: marksForType[user.id],
                    point: (parseFloat(marksForType[user.id]) / 100 * 5).toFixed(2)
                });
            }
        });

        if (assessments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">No assessment marks available yet.</td></tr>';
            return;
        }

        let html = '';
        assessments.forEach(ass => {
            // Prettify type name
            let typeName = ass.type;
            const standardTypes = {
                'opening': 'Opening (5%)',
                'bft1': 'BFT 1 (2.5%)',
                'bft2': 'BFT 2 (2.5%)',
                'bft': 'BFT (5%)',
                'BFT': 'BFT (5%)',
                'mid-course': 'Mid Course Exam (20%)',
                'general-assessment': 'General Assessment (5%)',
                'final-exam': 'Final Exam (25%)'
            };
            
            typeName = standardTypes[ass.type] || ass.type;

            html += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px; font-weight: 500;">${typeName}</td>
                    <td style="padding: 12px; text-align: center;">${parseFloat(ass.mark).toFixed(1)}</td>
                    <td style="padding: 12px; text-align: center;"><strong style="color: var(--primary-color);">${ass.point}</strong></td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading continuous assessment:', error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--danger-color);">Error loading marks.</td></tr>';
    }
}
async function loadStudentAssignments() {
    console.log('Loading student assignments...');
    const user = getCurrentUser();
    const container = document.getElementById('student-assignments-list');
    
    if (!container) return;
    
    // Normalize user class
    let rawUserClass = user.class;
    if (Array.isArray(rawUserClass)) rawUserClass = rawUserClass[0];
    if (!rawUserClass && Array.isArray(user.classes) && user.classes.length > 0) {
        rawUserClass = user.classes[0];
    }
    const studentClass = String(rawUserClass || '').trim();
    console.log('[Dashboard] Current User:', user);
    console.log('[Dashboard] Resolved Student Class:', studentClass);
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading assignments...</div>';
    
    try {
        let assignments = [];
        // Use the API with filtering
        console.log('[Dashboard] Calling getAssignments...');
        if (typeof window.getAssignments === 'function') {
            assignments = await window.getAssignments(studentClass);
        } else {
            console.warn('[Dashboard] window.getAssignments is not a function!');
            assignments = getData('lms_assignments') || [];
            // Fallback local filter
            if (studentClass) {
                assignments = assignments.filter(a => {
                    const classes = a.classes || a.classIds || [];
                    return Array.isArray(classes) ? classes.includes(studentClass) : classes === studentClass;
                });
            }
        }
        
        console.log(`[Dashboard] Assignments returned: ${assignments.length}`, assignments);

        // Get submissions for this student - SAFE GUARDED
        let submissions = [];
        try {
            if (typeof window.getSubmissions === 'function') {
                const subData = await window.getSubmissions(null, user.id);
                if (Array.isArray(subData)) submissions = subData;
            } else {
                submissions = (getData('lms_submissions') || []).filter(s => s.studentId === user.id || s.student_id === user.id);
            }
        } catch (subErr) {
            console.error('[Dashboard] Error fetching submissions:', subErr);
            // Continue without submissions, don't crash the whole assignment list
        }

        if (assignments.length === 0) {
            console.log('[Dashboard] No assignments found. Checking if class matches...');
            if (studentClass) {
                  // Debug: Check if there are ANY assignments at all in IDB/Cache to see if it's a filtering issue
                  const allAssignments = getData('lms_assignments');
                  console.log('[Dashboard] All local assignments (for debugging):', allAssignments);
            }
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-color);">
                    <i class="fas fa-clipboard-list" style="font-size: 48px; color: var(--light-text); margin-bottom: 20px;"></i>
                    <p style="font-size: 1.1rem; font-weight: 500;">No assignments found for your class (${studentClass}).</p>
                    <small style="color: var(--text-light)">If you believe this is an error, please contact your lecturer.</small>
                </div>
            `;
            return;
        }

        // Generate Cards
        let cardsHtml = '';
        console.log(`[Dashboard] Generating HTML for ${assignments.length} assignments...`);
        
        assignments.forEach((assignment, index) => {
            console.log(`[Dashboard] Processing assignment ${index + 1}/${assignments.length}:`, assignment.id);
            const submission = submissions.find(s => s.assignment_id === assignment.id);
            
            let deadlineStr = 'No deadline';
            let isLate = false;
            try {
                if (assignment.deadline) {
                    const deadline = new Date(assignment.deadline);
                    deadlineStr = deadline.toLocaleString();
                    isLate = !submission && deadline < new Date();
                }
            } catch (e) { console.error('Date parse error', e); }
            
            const isSubmitted = !!submission;
            
            let borderColor = isSubmitted ? 'var(--success-color)' : (isLate ? 'var(--danger-color)' : 'var(--warning-color)');
            let statusText = 'Pending';
            let statusClass = 'status-upcoming';
            
            if (isSubmitted) {
                statusText = submission.status || 'submitted';
                statusClass = statusText === 'graded' ? 'status-active' : 'status-completed';
            } else if (isLate) {
                statusText = 'Late / Missing';
                statusClass = 'status-past';
            }

            // Sanitized file URL display
            let fileLink = '';
            if (assignment.file_url) {
                 // Use window.downloadFile helper to avoid about:blank#blocked
                 fileLink = `<button onclick="window.downloadFile('${assignment.file_url}', '${(assignment.title || 'attachment').replace(/'/g, "\\'")}')" class="btn btn-small btn-secondary" style="margin-top: 5px; display: inline-block; cursor: pointer;">📎 Download Attachment</button>`;
            }

            cardsHtml += `
                <div class="card assignment-card" style="margin-bottom: 20px; border-left: 5px solid ${borderColor};">
                    <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 15px;">
                        <div style="flex: 1; min-width: 300px;">
                            <h4 style="margin: 0; color: var(--primary-color); font-size: 1.3rem;">${assignment.title || 'Untitled'}</h4>
                            <p style="margin: 5px 0; font-weight: 500; font-size: 0.9rem;">Subject: ${assignment.subject || 'General'}</p>
                            <p style="margin: 10px 0; color: var(--text-color);">${assignment.description || ''}</p>
                            ${fileLink}
                        </div>
                        <div style="text-align: right; min-width: 200px;">
                            <span class="status-badge ${statusClass}">● ${statusText.toUpperCase()}</span>
                            <div style="margin-top: 10px; font-size: 0.9rem;">
                                <strong>Deadline:</strong><br>
                                <span style="color: ${isLate ? 'var(--danger-color)' : 'inherit'}">${deadlineStr}</span>
                            </div>
                            ${submission && submission.grade ? `
                                <div style="margin-top: 10px; padding: 10px; background: var(--light-color); border-radius: 6px; text-align: center;">
                                    <div style="font-size: 0.8rem; color: var(--text-light);">Your Grade</div>
                                    <div style="font-size: 1.2rem; font-weight: bold; color: var(--primary-color);">${submission.grade}</div>
                                    ${submission.feedback ? `<div style="font-size: 0.8rem; margin-top: 5px; font-style: italic;">"${submission.feedback}"</div>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
                        ${!isSubmitted && !isLate ? `
                            <button class="btn btn-primary" onclick="window.showSubmissionModal('${assignment.id}', '${assignment.title.replace(/'/g, "\\'")}')">Submit Work</button>
                        ` : (!isSubmitted && isLate ? `
                            <button class="btn btn-secondary" disabled>Late / Missing</button>
                        ` : `
                            <button class="btn btn-secondary" disabled>Work Submitted</button>
                        `)}
                    </div>
                </div>
            `;
        });
        
        console.log(`[Dashboard] Generated HTML length: ${cardsHtml.length}`);
        
        // Safety check: if cardsHtml is empty but we had assignments?
        if (assignments.length > 0 && cardsHtml.length === 0) {
            console.error('[Dashboard] Error: Assignments loaded but HTML is empty!');
        }

        container.innerHTML = cardsHtml;
        console.log('[Dashboard] InnerHTML updated.');
        
    } catch (error) {
        console.error('Error loading student assignments:', error);
        container.innerHTML = `<div style="color: red; text-align: center;">Error loading assignments: ${error.message}</div>`;
    }
}


window.showSubmissionModal = function(id, title) {
    const modal = document.getElementById('assignmentSubmissionModal');
    const titleEl = document.getElementById('submissionAssignmentTitle');
    const idEl = document.getElementById('submissionAssignmentId');
    const contentEl = document.getElementById('submissionContent');
    const fileEl = document.getElementById('submissionFile');
    const fileInfo = document.getElementById('submission-file-info');
    
    if (modal && titleEl && idEl) {
        titleEl.textContent = 'Submit: ' + title;
        idEl.value = id;
        contentEl.value = '';
        fileEl.value = '';
        fileInfo.style.display = 'none';
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
};

window.closeSubmissionModal = function() {
    const modal = document.getElementById('assignmentSubmissionModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

// Implement loadMaterials since it was missing
window._loadMaterialsFull = async function() {
    console.log('[Dashboard] Loading course materials (full version)...');
    const user = getCurrentUser();
    const container = document.getElementById('materials-list');

    if (!container) return;

    // Normalize user class
    let rawUserClass = user.class;
    if (Array.isArray(rawUserClass)) rawUserClass = rawUserClass[0];
    if (!rawUserClass && Array.isArray(user.classes) && user.classes.length > 0) {
        rawUserClass = user.classes[0];
    }
    const studentClass = String(rawUserClass || '').trim();

    container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading materials...</div>';

    try {
        let materials = [];
        // Fetch ALL materials (no server-side class filter) and filter client-side
        // This matches the approach used in loadDashboard which works correctly
        if (typeof window.getMaterials === 'function') {
            materials = await window.getMaterials();
        } else {
            materials = getData('lms_materials') || [];
        }

        // Normalize material properties (handle both snake_case DB columns and camelCase frontend)
        materials = materials.map(m => ({
            ...m,
            class: m.class || m.class_name,
            className: m.className || m.class_name,
            lecturerId: m.lecturerId || m.lecturer_id,
            uploadedBy: m.uploadedBy || m.lecturer_id,
            lecturerName: m.lecturerName || m.lecturer_name,
            uploadedAt: m.uploadedAt || m.uploaded_at,
            fileUrl: m.fileUrl || m.file_url,
            videoUrl: m.videoUrl || m.video_url,
            audioUrl: m.audioUrl || m.audio_url,
            uploadedFile: m.uploadedFile || m.uploaded_file,
            fileName: m.fileName || m.file_name
        }));

        // Filter client-side by student's class
        if (studentClass) {
            materials = materials.filter(m => (m.class || m.class_name) === studentClass);
        }

        console.log(`[Dashboard] Materials returned: ${materials.length}`, materials);

        if (materials.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-color);">
                    <i class="fas fa-book-open" style="font-size: 48px; color: var(--light-text); margin-bottom: 20px;"></i>
                    <p style="font-size: 1.1rem; font-weight: 500;">No materials found for your class.</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        materials.forEach(material => {
            // Use uploaded_at or fallback
            const date = new Date(material.uploaded_at || material.created_at || material.createdAt || Date.now()).toLocaleDateString();
            const fileLink = (material.file_url || material.fileUrl) ? 
                `<button onclick="window.downloadFile('${material.file_url || material.fileUrl}', '${(material.title || 'material').replace(/'/g, "\\'")}')" class="btn btn-primary btn-small" style="cursor: pointer;">Download</button>` : '';
                
            html += `
                <div class="card material-card" style="margin-bottom: 15px; border-left: 4px solid var(--info-color);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h4 style="margin: 0; color: var(--primary-color);">${material.title}</h4>
                            <p style="margin: 5px 0; font-size: 0.9rem; color: var(--text-light);">${material.subject || 'General'} • ${date}</p>
                            <p style="margin: 10px 0;">${material.description || ''}</p>
                        </div>
                        <div>${fileLink}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading materials:', error);
        container.innerHTML = `<div style="color: red; text-align: center;">Error loading materials.</div>`;
    }
};
// Point window.loadMaterials to the full implementation so all callers use it
window.loadMaterials = window._loadMaterialsFull;


window.handleSubmissionFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    currentSubmissionFile = file;
    document.getElementById('submission-file-name').textContent = file.name;
    document.getElementById('submission-file-info').style.display = 'inline-block';
};

window.clearSubmissionFile = function() {
    currentSubmissionFile = null;
    const fileInput = document.getElementById('submissionFile');
    if (fileInput) fileInput.value = '';
    const info = document.getElementById('submission-file-info');
    if (info) info.style.display = 'none';
};

// Handle submission form
document.addEventListener('DOMContentLoaded', function() {
    const subForm = document.getElementById('submissionForm');
    if (subForm) {
        subForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const user = getCurrentUser();
            const assignmentId = document.getElementById('submissionAssignmentId').value;
            const content = document.getElementById('submissionContent').value;
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                let fileUrl = null;
                if (currentSubmissionFile) {
                    fileUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(currentSubmissionFile);
                    });
                }

                const submission = {
                    id: crypto.randomUUID(),
                    assignmentId,
                    studentId: user.id,
                    content,
                    fileUrl,
                    status: 'Submitted',
                    submittedAt: new Date().toISOString()
                };

                const result = await window.saveSubmission(submission);
                if (result) {
                    alert('Assignment submitted successfully!');
                    closeSubmissionModal();
                    loadStudentAssignments();
                } else {
                    alert('Error submitting assignment.');
                }
            } catch (err) {
                console.error('Submission error:', err);
                alert('An error occurred during submission.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Assignment';
            }
        });
    }
});

window.loadStudentAssignments = loadStudentAssignments;
