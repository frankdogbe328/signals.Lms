// Lecturer Dashboard

let questionCount = 0;
let defaultQuestionType = 'multiple-choice';
let currentAssignmentFile = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Lecturer dashboard loaded');
    
    // Refresh user session from database
    const currentUser = getCurrentUser();
    if (currentUser && typeof getUsers === 'function') {
        try {
            const users = await getUsers();
            const latestUser = users.lecturers.find(l => l.id === currentUser.id);
            if (latestUser) {
                const updatedUser = { ...currentUser, ...latestUser, type: 'lecturer' };
                if (typeof setCurrentUser === 'function') {
                    setCurrentUser(updatedUser);
                } else {
                    sessionStorage.setItem('current_user', JSON.stringify(updatedUser));
                }
                console.log('✅ Lecturer session refreshed from database');
            }
        } catch (error) {
            console.warn('Failed to refresh lecturer session, using existing:', error);
        }
    }
    
    const user = getCurrentUser();
    
    if (!user || user.type !== 'lecturer') {
        window.location.href = 'login.html';
        return;
    }
    
    await loadDashboard();
    // Load all sections in parallel — independent data
    await Promise.allSettled([
        loadExams(),
        loadMaterials(),
        loadResults(),
        loadAssignments(),
        loadBulkGradingExams(),
    ]);
    
    await setupExamForm();
    setupMaterialForm();
    await setupAssignmentForm();
    
    // Load announcements if function exists
    if (typeof loadAnnouncements === 'function') {
        // Will be loaded when section is shown
    }
});

async function loadDashboard() {
    const user = getCurrentUser();
    document.getElementById('lecturerName').textContent = user.fullName;
}

async function loadExams() {
    const user = getCurrentUser();
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
    
    console.log('User ID:', user.id);
    
    // Debug what we received
    console.log('Total exams fetched:', exams.length);
    if (exams.length > 0) {
        console.log('Sample exam lecturer ID:', exams[0].lecturer_id || exams[0].lecturerId);
    }

    const lecturerExams = exams.filter(exam => {
        const examLecturerId = exam.lecturer_id || exam.lecturerId || exam.createdBy;
        // Handle both string and UUID comparisons, and case insensitivity
        return String(examLecturerId).toLowerCase() === String(user.id).toLowerCase();
    });
    
    console.log('Filtered lecturer exams:', lecturerExams.length);
    
    if (lecturerExams.length === 0) {
        container.innerHTML = '<p>No exams created yet.</p>';
        return;
    }
    
    // Sort by creation date (newest first)
    lecturerExams.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
    
    container.innerHTML = '';
    
    // Get results and releases once before the loop to avoid multiple async calls
    let allResults = [];
    let allReleases = {};
    if (typeof getResults === 'function') {
        try {
            allResults = await getResults();
        } catch (error) {
            allResults = getData('lms_results') || [];
        }
    } else {
        allResults = getData('lms_results') || [];
    }
    
    if (typeof getResultReleases === 'function') {
        try {
            allReleases = await getResultReleases();
        } catch (error) {
            allReleases = getData('lms_result_releases') || {};
        }
    } else {
        allReleases = getData('lms_result_releases') || {};
    }
    
    lecturerExams.forEach(exam => {
        const examCard = document.createElement('div');
        examCard.className = 'card';
        examCard.style.marginBottom = '15px';
        
        const startTime = (exam.start_time || exam.startTime) ? new Date(exam.start_time || exam.startTime) : null;
        const endTime = startTime ? new Date(startTime.getTime() + (exam.duration || 60) * 60 * 1000) : null;
        const now = new Date();
        const isActive = startTime && now >= startTime && now <= endTime;
        const isUpcoming = startTime && now < startTime;
        const isPast = endTime && now > endTime;
        
        // Check if exam is manually activated (for parade/activities)
        const isManuallyActive = (exam.is_manually_active !== undefined) ? exam.is_manually_active : (exam.isActivated !== false); 
        
        let status = '';
        if (!isManuallyActive) {
            status = '<span class="status-badge status-completed">● DEACTIVATED</span>';
        } else if (isActive) {
            status = '<span class="status-badge status-active">● ACTIVE</span>';
        } else if (isUpcoming) {
            status = '<span class="status-badge status-upcoming">● UPCOMING</span>';
        } else if (isPast) {
            status = '<span class="status-badge status-completed">● COMPLETED</span>';
        } else {
             // Fallback
             status = '<span class="status-badge">● SCHEDULED</span>';
        }
        
        // Use pre-fetched results and releases
        const results = allResults;
        const releases = allReleases;
        
        const examResults = results.filter(r => r && (r.examId === exam.id || r.exam_id === exam.id));
        const isReleased = releases[exam.id] === true || (releases[exam.id] && releases[exam.id].is_released);
        
        // Normalize classes list
        const classesList = Array.isArray(exam.classes) ? exam.classes.join(', ') : 'All Classes';

        examCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <h4>${exam.title}</h4>
                    <p><strong>Subject:</strong> ${exam.subject}</p>
                    <!-- <p><strong>Type:</strong> ${exam.type}</p> -->
                    <p><strong>Classes:</strong> ${classesList}</p>
                    <p><strong>Duration:</strong> ${formatDuration(exam.duration)}</p>
                    <p><strong>Start:</strong> ${startTime ? formatDate(startTime) : 'Not set'}</p>
                    <p><strong>Submissions:</strong> ${examResults.length}</p>
                    <p>${status}</p>
                    <p><strong>Results:</strong> <span class="status-badge ${isReleased ? 'status-active' : 'status-completed'}">${isReleased ? '● RELEASED' : '● HIDDEN'}</span></p>
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn-small ${isManuallyActive ? 'btn-warning' : 'btn-success'}" onclick="toggleExamActivation('${exam.id}', ${!isManuallyActive})" title="${isManuallyActive ? 'Deactivate exam (e.g., students on parade)' : 'Activate exam'}">
                        ${isManuallyActive ? '⏸ Deactivate' : '▶ Activate'}
                    </button>
                    <button class="btn-small ${isReleased ? 'btn-warning' : 'btn-success'}" onclick="toggleResultRelease('${exam.id}', ${!isReleased})" title="${isReleased ? 'Hide results from students' : 'Release results to students'}">
                        ${isReleased ? '👁️ Hide Results' : '📤 Release Results'}
                    </button>
                    <button class="btn-small btn-success" onclick="viewExamResults('${exam.id}')">View Results</button>
                    <button class="btn-small btn-danger" onclick="deleteExam('${exam.id}')">Delete</button>
                </div>
            </div>
        `;
        
        container.appendChild(examCard);
    });
}

async function setupExamForm() {
    const user = getCurrentUser();
    let courses = [];
    let classes = [];
    
    if (typeof getCourses === 'function') {
        try {
            courses = await getCourses();
        } catch (error) {
            courses = getData('lms_courses') || [];
        }
    } else {
        courses = getData('lms_courses') || [];
    }
    
    if (typeof getClasses === 'function') {
        try {
            classes = await getClasses();
        } catch (error) {
            classes = getData('lms_classes') || [];
        }
    } else {
        classes = getData('lms_classes') || [];
    }
    
    // Load subjects
    const subjectSelect = document.getElementById('examSubject');
    if (subjectSelect && courses) {
        subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        let availableSubjects = [];
        
        if (user.subjects && user.subjects.length > 0) {
            availableSubjects = user.subjects;
        } else {
            console.warn('User has no assigned subjects, showing ALL subjects from courses as fallback');
            availableSubjects = [...new Set(courses.map(c => c.subject))].filter(s => !!s).sort();
        }

        availableSubjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });
    }
    
    // Load classes - create mobile-friendly checkbox interface
    const classesSelect = document.getElementById('examClasses');
    const classesContainer = document.getElementById('examClassesContainer');
    if (classesContainer && classes) {
        console.log('User classes (Exam):', user.classes);
        console.log('All classes (Exam):', classes);
        
        // Use user's assigned classes if available, otherwise fallback to all classes
        let availableClasses = [];
        
        if (user.classes && user.classes.length > 0) {
            availableClasses = user.classes; 
        } else {
            console.warn('User has no assigned classes, showing ALL classes as fallback');
            availableClasses = classes.map(c => (typeof c === 'object' && c.name) ? c.name : c);
        }
        
        if (availableClasses.length === 0) {
            classesContainer.innerHTML = '<p class="text-muted">No classes available</p>';
        } else {
            classesContainer.innerHTML = ''; // Clear existing
            
            availableClasses.forEach(cls => {
                const className = typeof cls === 'string' ? cls : cls.name;
                if (!className) return;

                // Add to hidden select (legacy support)
                const option = document.createElement('option');
                option.value = className;
                option.textContent = className;
                if (classesSelect) classesSelect.appendChild(option);
                
                // Add to checkbox group (primary UI)
                const checkboxItem = document.createElement('div');
                checkboxItem.className = 'checkbox-item';
                checkboxItem.innerHTML = `
                    <input type="checkbox" id="class_${className.replace(/\s+/g, '_')}" value="${className}" onchange="updateClassSelection()">
                    <label for="class_${className.replace(/\s+/g, '_')}">${className}</label>
                `;
                classesContainer.appendChild(checkboxItem);
            });
        }
    }
    
    const form = document.getElementById('examForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('📝 Exam form submitted, calling createExam()...');
            createExam();
        });
    }
}

// Make functions globally accessible
window.updateClassSelection = function() {
    const checkboxes = document.querySelectorAll('#examClassesContainer input[type="checkbox"]');
    const select = document.getElementById('examClasses');
    
    // Clear all selections
    Array.from(select.options).forEach(opt => opt.selected = false);
    
    // Update based on checkboxes
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const option = Array.from(select.options).find(opt => opt.value === checkbox.value);
            if (option) option.selected = true;
            checkbox.closest('.checkbox-item').classList.add('checked');
        } else {
            checkbox.closest('.checkbox-item').classList.remove('checked');
        }
    });
}

window.setDefaultQuestionType = function(type) {
    defaultQuestionType = type;
};

window.addQuestion = function() {
    const container = document.getElementById('questions-list');
    if (!container) {
        alert('Questions container not found. Please make sure you are on the Create Exam/Quiz tab.');
        return;
    }
    
    questionCount++;
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-card';
    questionDiv.id = `question-${questionCount}`;
    
    if (defaultQuestionType === 'essay') {
        questionDiv.innerHTML = `
            <h4>Question ${questionCount} (Essay)</h4>
            <div class="form-group">
                <label>Question Text</label>
                <textarea class="question-text" placeholder="Enter essay question" rows="3" required></textarea>
            </div>
            <div class="form-group">
                <label>Maximum Points</label>
                <input type="number" class="question-points" placeholder="100" value="100" min="1" required>
            </div>
            <div class="form-group">
                <label>Expected Answer Length (words)</label>
                <input type="number" class="question-word-limit" placeholder="500" value="500" min="1">
                <small style="color: var(--text-light);">Optional: Guide for students</small>
            </div>
            <input type="hidden" class="question-type" value="essay">
            <button type="button" class="btn btn-danger" onclick="removeQuestion(${questionCount})">Remove Question</button>
        `;
    } else {
        questionDiv.innerHTML = `
            <h4>Question ${questionCount} (Multiple Choice)</h4>
            <div class="form-group">
                <label>Question Text</label>
                <input type="text" class="question-text" placeholder="Enter question" required>
            </div>
            <div class="form-group">
                <label>Option 1</label>
                <input type="text" class="option-1" placeholder="Option 1" required>
            </div>
            <div class="form-group">
                <label>Option 2</label>
                <input type="text" class="option-2" placeholder="Option 2" required>
            </div>
            <div class="form-group">
                <label>Option 3</label>
                <input type="text" class="option-3" placeholder="Option 3" required>
            </div>
            <div class="form-group">
                <label>Option 4</label>
                <input type="text" class="option-4" placeholder="Option 4" required>
            </div>
            <div class="form-group">
                <label>Correct Answer</label>
                <select class="correct-answer" required>
                    <option value="0">Option 1</option>
                    <option value="1">Option 2</option>
                    <option value="2">Option 3</option>
                    <option value="3">Option 4</option>
                </select>
            </div>
            <input type="hidden" class="question-type" value="multiple-choice">
            <button type="button" class="btn btn-danger" onclick="removeQuestion(${questionCount})">Remove Question</button>
        `;
    }
    container.appendChild(questionDiv);
};

window.removeQuestion = function(id) {
    const questionDiv = document.getElementById(`question-${id}`);
    if (questionDiv) {
        questionDiv.remove();
        updateQuestionNumbers();
    }
}

function updateQuestionNumbers() {
    const questions = document.querySelectorAll('.question-card');
    questions.forEach((q, index) => {
        q.querySelector('h4').textContent = `Question ${index + 1}`;
    });
}

async function createExam() {
    const user = getCurrentUser();
    const title = document.getElementById('examTitle').value.trim();
    const type = document.getElementById('examType').value;
    const subject = document.getElementById('examSubject').value;
    
    // Get classes from checkboxes (mobile) or select (desktop)
    let classes = [];
    const checkboxes = document.querySelectorAll('#examClassesContainer input[type="checkbox"]:checked');
    if (checkboxes.length > 0) {
        classes = Array.from(checkboxes).map(cb => cb.value);
    } else {
        classes = Array.from(document.getElementById('examClasses').selectedOptions).map(opt => opt.value);
    }
    
    const startDate = document.getElementById('examDate').value;
    const duration = parseInt(document.getElementById('examDuration').value);
    
    if (!title) {
        showAlert('Please enter an exam title', 'error');
        return;
    }
    
    if (!subject) {
        showAlert('Please select a subject', 'error');
        return;
    }
    
    if (classes.length === 0 || (classes.length === 1 && classes[0] === '')) {
        showAlert('Please select at least one class', 'error');
        return;
    }
    
    if (!startDate) {
        showAlert('Please select a start date and time', 'error');
        return;
    }
    
    // Check if start date is in the past
    const startDateTime = new Date(startDate);
    const now = new Date();
    if (startDateTime < now) {
        showAlert('Start date and time cannot be in the past', 'error');
        return;
    }
    
    if (!duration || duration < 1) {
        showAlert('Please enter a valid duration (minimum 1 minute)', 'error');
        return;
    }
    
    // Collect questions from all sources (manual entry, Excel import, Word import)
    const questions = [];
    
    // Get all questions (both manually added and imported)
    const questionCards = document.querySelectorAll('.question-card');
    
    // Check if there are imported questions that haven't been added yet (from Word/Excel)
    // Check both window.importedQuestions and importedQuestions (for module compatibility)
    const importedQuestionsArray = window.importedQuestions || (typeof importedQuestions !== 'undefined' ? importedQuestions : []);
    const hasImportedQuestions = importedQuestionsArray && Array.isArray(importedQuestionsArray) && importedQuestionsArray.length > 0;
    
    console.log('Checking for questions:', {
        questionCards: questionCards.length,
        hasImportedQuestions: hasImportedQuestions,
        importedQuestionsCount: hasImportedQuestions ? importedQuestionsArray.length : 0,
        importedQuestions: importedQuestionsArray
    });
    
    // If there are imported questions but no question cards, import them automatically
    if (hasImportedQuestions && questionCards.length === 0) {
        console.log('Auto-importing questions before creating exam...', importedQuestionsArray.length);
        
        // Check which import function is available and use it
        if (typeof window.importWordQuestions === 'function') {
            window.importWordQuestions();
        } else if (typeof importWordQuestions === 'function') {
            importWordQuestions();
        } else if (typeof window.importExcelQuestions === 'function') {
            window.importExcelQuestions();
        } else if (typeof importExcelQuestions === 'function') {
            importExcelQuestions();
        } else {
            showAlert('Please click "Import Questions" button first to add the imported questions, then create the exam.', 'error');
            return;
        }
        
        // Wait for DOM to update, then continue with exam creation
        setTimeout(() => {
            const updatedCards = document.querySelectorAll('.question-card');
            console.log('After auto-import, question cards:', updatedCards.length);
            if (updatedCards.length === 0) {
                showAlert('Failed to import questions. Please click "Import Questions" button first, then create the exam.', 'error');
                return;
            }
            // Retry creating exam after questions are imported
            console.log('Questions imported successfully, retrying exam creation...');
            createExam();
        }, 500);
        return;
    }
    
    // If no questions at all
    if (questionCards.length === 0) {
        if (hasImportedQuestions) {
            showAlert('Please click "Import Questions" button to add the imported questions before creating the exam.', 'error');
        } else {
            showAlert('Please add at least one question manually, or import questions from Excel/Word.', 'error');
        }
        return;
    }
    
    questionCards.forEach(card => {
        const questionText = card.querySelector('.question-text')?.value?.trim();
        if (!questionText) return;
        
        const questionType = card.querySelector('.question-type')?.value || 'multiple-choice';
        
        if (questionType === 'essay') {
            const points = parseInt(card.querySelector('.question-points')?.value || 100);
            const wordLimit = parseInt(card.querySelector('.question-word-limit')?.value || 0);
            
            questions.push({
                type: 'essay',
                question: questionText,
                points: points,
                wordLimit: wordLimit,
                options: [],
                correctAnswer: null
            });
        } else {
            const option1 = card.querySelector('.option-1')?.value?.trim();
            const option2 = card.querySelector('.option-2')?.value?.trim();
            const option3 = card.querySelector('.option-3')?.value?.trim();
            const option4 = card.querySelector('.option-4')?.value?.trim();
            const correctAnswer = parseInt(card.querySelector('.correct-answer')?.value || 0);
            
            // Check if all options are filled (allow "N/A" for True/False questions)
            if (option1 && option2 && option3 && option4) {
                // Filter out "N/A" options for True/False questions (keep only valid options)
                let optionsArray = [option1, option2, option3, option4];
                const validOptions = optionsArray.filter(opt => opt && opt.trim() !== '' && opt.trim().toUpperCase() !== 'N/A');
                
                // If we have 2 valid options (True/False), save with only those 2
                // Otherwise, save all 4 options
                if (validOptions.length === 2 && (option1.toUpperCase() === 'TRUE' || option2.toUpperCase() === 'TRUE' || option1.toUpperCase() === 'FALSE' || option2.toUpperCase() === 'FALSE')) {
                    questions.push({
                        type: 'multiple-choice',
                        question: questionText,
                        options: validOptions, // Only True and False
                        correctAnswer: correctAnswer < 2 ? correctAnswer : 0 // Ensure correctAnswer is 0 or 1
                    });
                } else {
                    // Regular multiple choice with all 4 options
                    questions.push({
                        type: 'multiple-choice',
                        question: questionText,
                        options: optionsArray,
                        correctAnswer: correctAnswer
                    });
                }
            }
        }
    });
    
    console.log('🏁 Starting createExam()...');
    
    // Check if we have any valid questions
    if (questions.length === 0) {
        console.error('❌ No questions collected');
        showAlert('Please fill in all question fields. Make sure all questions have complete information.', 'error');
        return;
    }
    
    console.log('✅ Questions collected:', questions.length);
    
    let exams = [];
    if (typeof getExams === 'function') {
        try {
            console.log('🔄 Fetching existing exams...');
            exams = await getExams();
        } catch (error) {
            console.warn('⚠️ getExams failed, fallback to localStorage', error);
            exams = getData('lms_exams') || [];
        }
    } else {
        exams = getData('lms_exams') || [];
    }
    
    const examId = document.getElementById('examId').value;
    console.log('🆔 Exam ID (if editing):', examId);
    
    if (examId) {
        console.log('✏️ Editing existing exam');
        // Editing existing exam
        const originalExam = exams.find(e => e.id === examId);
        if (!originalExam) {
            showAlert('Exam not found', 'error');
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
        
        const hasSubmissions = results.some(r => r.examId === examId);
        
        if (hasSubmissions) {
            showAlert('Cannot edit exam that has submissions. Delete results first or create a new exam.', 'error');
            return;
        }
        
        const updatedExam = {
            ...originalExam,
            id: examId,
            title,
            type,
            subject,
            classes: classes.filter(c => c !== ''),
            startTime: new Date(startDate).toISOString(),
            duration,
            questions,
            updatedAt: new Date().toISOString()
        };
        
        // Save to Supabase or localStorage
        if (typeof saveExam === 'function') {
            try {
                console.log('💾 calling saveExam(updated)...');
                await saveExam(updatedExam);
                console.log('✅ saveExam(updated) success');
            } catch (error) {
                console.error('❌ saveExam(updated) failed:', error);
                console.warn('Supabase saveExam failed, using localStorage:', error);
                const examIndex = exams.findIndex(e => e.id === examId);
                if (examIndex !== -1) {
                    exams[examIndex] = updatedExam;
                }
                saveData('lms_exams', exams);
            }
        } else {
            console.warn('⚠️ saveExam function not found, using localStorage');
            const examIndex = exams.findIndex(e => e.id === examId);
            if (examIndex !== -1) {
                exams[examIndex] = updatedExam;
            }
            saveData('lms_exams', exams);
        }
        
        showAlert('Exam updated successfully!', 'success');
        cancelExamEdit();
    } else {
        console.log('✨ Creating NEW exam');
        // Creating new exam
        const exam = {
            id: Date.now().toString(),
            title,
            type,
            subject,
            classes: classes.filter(c => c !== ''),
            lecturerId: user.id,
            lecturerName: user.fullName,
            startTime: new Date(startDate).toISOString(),
            duration,
            questions,
            isActivated: true, // Default to activated
            createdAt: new Date().toISOString()
        };
        
        console.log('📦 Prepared exam object:', exam);
        
        // Save to Supabase or localStorage
        // Try window.saveExam explicitly if saveExam isn't in scope
        const saveFunc = typeof saveExam === 'function' ? saveExam : window.saveExam;
        
        if (typeof saveFunc === 'function') {
            try {
                console.log('💾 calling saveExam(new)...');
                const saved = await saveFunc(exam);
                console.log('✅ saveExam(new) returned:', saved);
                
                // Add to local list immediately for UI update
                exams.push(saved);
                
            } catch (error) {
                console.error('❌ saveExam(new) failed:', error);
                console.warn('Supabase saveExam failed, using localStorage:', error);
                exams.push(exam);
                saveData('lms_exams', exams);
            }
        } else {
            console.warn('⚠️ saveExam function NOT FOUND anywhere, using localStorage');
            exams.push(exam);
            saveData('lms_exams', exams);
        }
        
        showAlert('Exam created successfully!', 'success');
        
        // Reset form
        document.getElementById('examForm').reset();
        document.getElementById('examId').value = '';
        document.getElementById('examSubmitBtn').textContent = 'Create Exam';
        document.getElementById('examCancelBtn').style.display = 'none';
        document.getElementById('questions-list').innerHTML = '';
        questionCount = 0;
    }
    
    // Reload exams
    await loadExams();
}

// Edit Exam Functionality
window.editExam = async function(examId) {
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
    
    const exam = exams.find(e => e && e.id === examId);
    
    if (!exam) {
        showAlert('Exam not found', 'error');
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
    
    const hasSubmissions = results.some(r => r.examId === examId);
    
    if (hasSubmissions) {
        showAlert('Cannot edit exam that has submissions. Please create a new exam or delete the results first.', 'error');
        return;
    }
    
    // Switch to create exam section
    showSection('create-exam');
    
    // Populate form
    document.getElementById('examId').value = exam.id;
    document.getElementById('examTitle').value = exam.title || '';
    document.getElementById('examType').value = exam.type || 'Quiz';
    document.getElementById('examSubject').value = exam.subject || '';
    document.getElementById('examDate').value = exam.startTime ? new Date(exam.startTime).toISOString().slice(0, 16) : '';
    document.getElementById('examDuration').value = exam.duration || '';
    document.getElementById('examFormTitle').textContent = 'Edit Exam or Quiz';
    document.getElementById('examSubmitBtn').textContent = 'Update Exam';
    document.getElementById('examCancelBtn').style.display = 'inline-block';
    
    // Set classes
    if (exam.classes && exam.classes.length > 0) {
        exam.classes.forEach(cls => {
            const checkbox = document.getElementById(`class_${cls.replace(/\s+/g, '_')}`);
            if (checkbox) checkbox.checked = true;
        });
        updateClassSelection();
    }
    
    // Load questions
    const questionsList = document.getElementById('questions-list');
    questionsList.innerHTML = '';
    questionCount = 0;
    
    if (exam.questions && exam.questions.length > 0) {
        exam.questions.forEach(question => {
            if (question.type === 'essay') {
                addEssayQuestionWithData(question.question, question.points, question.wordLimit);
            } else {
                addMultipleChoiceQuestionWithData(
                    question.question,
                    question.options[0],
                    question.options[1],
                    question.options[2],
                    question.options[3],
                    question.correctAnswer
                );
            }
        });
    }
    
    // Scroll to form
    document.getElementById('examForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function addMultipleChoiceQuestionWithData(questionText, opt1, opt2, opt3, opt4, correctAnswer) {
    questionCount++;
    const container = document.getElementById('questions-list');
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-card';
    questionDiv.id = `question-${questionCount}`;
    
    questionDiv.innerHTML = `
        <h4>Question ${questionCount} (Multiple Choice)</h4>
        <div class="form-group">
            <label>Question Text</label>
            <input type="text" class="question-text" placeholder="Enter question" value="${questionText || ''}" required>
        </div>
        <div class="form-group">
            <label>Option 1</label>
            <input type="text" class="option-1" placeholder="Option 1" value="${opt1 || ''}" required>
        </div>
        <div class="form-group">
            <label>Option 2</label>
            <input type="text" class="option-2" placeholder="Option 2" value="${opt2 || ''}" required>
        </div>
        <div class="form-group">
            <label>Option 3</label>
            <input type="text" class="option-3" placeholder="Option 3" value="${opt3 || ''}" required>
        </div>
        <div class="form-group">
            <label>Option 4</label>
            <input type="text" class="option-4" placeholder="Option 4" value="${opt4 || ''}" required>
        </div>
        <div class="form-group">
            <label>Correct Answer</label>
            <select class="correct-answer" required>
                <option value="0" ${correctAnswer === 0 ? 'selected' : ''}>Option 1</option>
                <option value="1" ${correctAnswer === 1 ? 'selected' : ''}>Option 2</option>
                <option value="2" ${correctAnswer === 2 ? 'selected' : ''}>Option 3</option>
                <option value="3" ${correctAnswer === 3 ? 'selected' : ''}>Option 4</option>
            </select>
        </div>
        <input type="hidden" class="question-type" value="multiple-choice">
        <button type="button" class="btn btn-danger" onclick="removeQuestion(${questionCount})">Remove Question</button>
    `;
    container.appendChild(questionDiv);
}

function addEssayQuestionWithData(questionText, points, wordLimit) {
    questionCount++;
    const container = document.getElementById('questions-list');
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-card';
    questionDiv.id = `question-${questionCount}`;
    
    questionDiv.innerHTML = `
        <h4>Question ${questionCount} (Essay)</h4>
        <div class="form-group">
            <label>Question Text</label>
            <textarea class="question-text" placeholder="Enter essay question" rows="3" required>${questionText || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Maximum Points</label>
            <input type="number" class="question-points" placeholder="100" value="${points || 100}" min="1" required>
        </div>
        <div class="form-group">
            <label>Expected Answer Length (words)</label>
            <input type="number" class="question-word-limit" placeholder="500" value="${wordLimit || 500}" min="1">
            <small style="color: var(--text-light);">Optional: Guide for students</small>
        </div>
        <input type="hidden" class="question-type" value="essay">
        <button type="button" class="btn btn-danger" onclick="removeQuestion(${questionCount})">Remove Question</button>
    `;
    container.appendChild(questionDiv);
}

window.cancelExamEdit = function() {
    document.getElementById('examId').value = '';
    document.getElementById('examFormTitle').textContent = 'Create New Exam or Quiz';
    document.getElementById('examSubmitBtn').textContent = 'Create Exam';
    document.getElementById('examCancelBtn').style.display = 'none';
    document.getElementById('examForm').reset();
    document.getElementById('questions-list').innerHTML = '';
    questionCount = 0;
    
    // Uncheck all class checkboxes
    document.querySelectorAll('#examClassesContainer input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    updateClassSelection();
};

window.deleteExam = async function(examId) {
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
    
    const exam = exams.find(e => e && e.id === examId);
    
    if (!exam) return;
    
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
    
    const examResults = results.filter(r => r.examId === examId);
    
    let message = 'Are you sure you want to delete this exam?';
    if (examResults.length > 0) {
        message += `\n\nThis will also delete ${examResults.length} result(s). This action cannot be undone.`;
    }
    
    if (!confirm(message)) return;
    
    // Delete via API
    try {
        if (typeof deleteExam === 'function') {
            await deleteExam(examId);
        }
        if (typeof invalidateCache === 'function') invalidateCache('exams');
        showAlert('Exam deleted successfully!', 'success');
    } catch (error) {
        console.error('Delete exam failed:', error);
        showAlert('Failed to delete exam. Please try again.', 'error');
        return;
    }
    
    await loadExams();
};

window.toggleExamActivation = async function(examId, activate) {
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
    
    if (!exam) {
        showAlert('Exam not found', 'error');
        return;
    }
    
    exam.isActivated = activate;
    // Map snake_case to camelCase if needed for local logic, usually handled by saveExam
    exam.is_activated = activate;
    exam.isManuallyActive = activate; // For consistency
    exam.is_manually_active = activate;
    
    // If activating and start time is in the future, offer to update start time to NOW
    if (activate) {
        const now = new Date();
        const startTime = (exam.start_time || exam.startTime) ? new Date(exam.start_time || exam.startTime) : null;
        
        if (startTime && startTime > now) {
            if (confirm('This exam is scheduled for the future. Do you want to start it NOW?')) {
                exam.startTime = now.toISOString();
                exam.start_time = now.toISOString();
                console.log('🕒 Updated exam start time to NOW');
            }
        }
    }
    
    exam.updatedAt = new Date().toISOString();
    
    // Save to Supabase or localStorage
    // Use window.saveExam if saveExam not in scope
    const saveFunc = typeof saveExam === 'function' ? saveExam : window.saveExam;
    
    if (typeof saveFunc === 'function') {
        try {
            await saveFunc(exam);
        } catch (error) {
            console.warn('Supabase saveExam failed, using localStorage:', error);
            saveData('lms_exams', exams);
        }
    } else {
        saveData('lms_exams', exams);
    }
    
    const action = activate ? 'activated' : 'deactivated';
    showAlert(`Exam ${action} successfully.`, 'success');
    
    await loadExams();
};

window.toggleResultRelease = async function(examId, release) {
    // Save to Supabase or localStorage
    if (typeof saveResultRelease === 'function') {
        try {
            await saveResultRelease(examId, release);
        } catch (error) {
            console.warn('Supabase saveResultRelease failed, using localStorage:', error);
            const releases = getData('lms_result_releases') || {};
            releases[examId] = release;
            saveData('lms_result_releases', releases);
        }
    } else {
        const releases = getData('lms_result_releases') || {};
        releases[examId] = release;
        saveData('lms_result_releases', releases);
    }
    
    const action = release ? 'released' : 'hidden';
    showAlert(`Results ${action} successfully. Students ${release ? 'can' : 'cannot'} now view these results.`, 'success');
    
    // Create notifications for students when results are released
    if (release) {
        let results = [];
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
        const examResults = results.filter(r => r && r.examId === examId);
        
        examResults.forEach(result => {
            if (typeof createNotification === 'function') {
                createNotification(
                    'result',
                    'Result Released',
                    `Your result for ${exam ? exam.title : 'the exam'} has been released. Score: ${result.score || 0}%`,
                    null,
                    { resultId: result.id, examId: examId },
                    result.studentId,
                    'student'
                );
            }
        });
    }
    
    await loadExams();
};

window.viewExamResults = function(examId) {
    // Navigate to results section and filter by exam
    window.currentResultFilterExamId = examId;
    showSection('results');
};

async function loadMaterials() {
    const user = getCurrentUser();
    const container = document.getElementById('materials-list');
    
    if (!container) return;
    
    let materials = [];
    
    // Try Supabase first, fallback to localStorage
    if (typeof window.getMaterials === 'function') {
        try {
            materials = await window.getMaterials();
            window.loadedMaterials = materials; // Store globally for downloads
        } catch (error) {
            console.warn('Supabase loadMaterials failed, using localStorage:', error);
            materials = getData('lms_materials') || [];
        }
    } else {
        materials = getData('lms_materials') || [];
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
    window.loadedMaterials = materials; // Update global reference with normalized data

    // Filter by lecturer ID (handle both camelCase and snake_case variants)
    const lecturerMaterials = materials.filter(m =>
        m.uploadedBy === user.id || m.lecturerId === user.id || m.lecturer_id === user.id
    );
    
    if (lecturerMaterials.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-light); background: var(--light-color); border-radius: 12px;">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">📄 No materials uploaded yet</p>
                <p style="font-size: 0.9rem;">Materials you upload for your classes will appear here.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    lecturerMaterials.forEach(material => {
        const materialCard = document.createElement('div');
        materialCard.className = 'material-card';
        
        let mediaContent = '';
        if (material.videoUrl) {
            let embedUrl = material.videoUrl;
            if (material.videoUrl.includes('youtube.com/watch') || material.videoUrl.includes('youtu.be/')) {
                const videoId = material.videoUrl.includes('youtu.be/') 
                    ? material.videoUrl.split('youtu.be/')[1].split('?')[0]
                    : material.videoUrl.split('v=')[1].split('&')[0];
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
            } else if (material.videoUrl.includes('vimeo.com/')) {
                const videoId = material.videoUrl.split('vimeo.com/')[1].split('?')[0];
                embedUrl = `https://player.vimeo.com/video/${videoId}`;
            }
            mediaContent = `<div style="margin-top: 15px;"><iframe class="material-video" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width: 100%; height: 200px; border-radius: 8px;"></iframe></div>`;
        } else if (material.audioUrl) {
            mediaContent = `<div style="margin-top: 15px;"><audio class="material-audio" controls style="width: 100%;"><source src="${material.audioUrl}" type="audio/mpeg">Your browser does not support audio.</audio></div>`;
        }
        
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
                    <span class="badge" style="background: var(--secondary-color); color: white; padding: 2px 8px; border-radius: 4px; margin-left: 5px;">${material.class}</span>
                    <span style="color: var(--text-light); margin-left: 10px;">Uploaded: ${formatDate(material.uploadedAt)}</span>
                </p>
                ${material.description ? `<p style="margin-bottom: 15px; color: var(--text-color);">${material.description}</p>` : ''}
                ${material.uploadedFile ? `<p style="color: var(--text-light); font-size: 0.85rem; margin-bottom: 10px;">
                    <strong>File:</strong> ${material.uploadedFile.name} (${formatFileSize(material.uploadedFile.size)})
                </p>` : ''}
                ${mediaContent}
            </div>
            <div class="material-actions" style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 15px; display: flex; gap: 10px; margin-top: 15px;">
                ${material.content ? `<button class="btn-small btn" onclick="viewMaterial('${material.id}')">View Details</button>` : ''}
                ${downloadButtons}
            </div>
        `;
        container.appendChild(materialCard);
    });
}

function viewResultDetails(resultId) {
    const results = getData('lms_results');
    const result = results.find(r => r.id === resultId);
    
    if (!result) {
        alert('Result not found');
        return;
    }
    
    // Show detailed breakdown modal (similar to student view)
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
            <button class="modal-close" onclick="this.closest('.modal').remove(); document.body.style.overflow='auto';">×</button>
            <h3>${result.examTitle} - ${result.studentName}</h3>
            <div style="margin: 20px 0; padding: 15px; background: var(--light-color); border-radius: 8px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                    <div>
                        <strong>Score</strong>
                        <div style="font-size: 2rem; color: ${getGradeColor(getLetterGrade(result.score))}; font-weight: bold;">${result.score}%</div>
                    </div>
                    <div>
                        <strong>Grade</strong>
                        <div style="font-size: 2rem; color: ${getGradeColor(getLetterGrade(result.score))}; font-weight: bold;">${getLetterGrade(result.score)}</div>
                    </div>
                    <div>
                        <strong>Correct Answers</strong>
                        <div style="font-size: 2rem; color: var(--success-color); font-weight: bold;">${result.correctAnswers}/${result.totalQuestions}</div>
                    </div>
                </div>
            </div>
            <div id="lecturer-question-details"></div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    const detailsContainer = document.getElementById('lecturer-question-details');
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
                        <h4 style="margin: 0;">Question ${index + 1} (Essay - ${qDetail.points || 100} points)</h4>
                        <span style="padding: 4px 12px; border-radius: 4px; font-weight: bold; background: var(--warning-color); color: white;">
                            ${qDetail.needsGrading ? '⏳ Needs Grading' : '✓ Graded'}
                        </span>
                    </div>
                    <p style="margin-bottom: 15px; font-weight: 500;">${qDetail.question}</p>
                    <div style="margin-bottom: 10px;">
                        <strong>Student Answer:</strong>
                        <div style="padding: 12px; margin-top: 8px; background: var(--light-color); border-radius: 6px; white-space: pre-wrap; min-height: 100px;">
                            ${qDetail.studentAnswer || 'No answer provided'}
                        </div>
                        ${qDetail.needsGrading ? `
                            <div style="margin-top: 15px;">
                                <label>Score (0-${qDetail.points || 100}):</label>
                                <input type="number" id="essay-score-${result.id}-${index}" min="0" max="${qDetail.points || 100}" style="width: 100px; margin-left: 10px;">
                                <button class="btn btn-small" onclick="saveEssayScore('${result.id}', ${index}, ${qDetail.points || 100})">Save Score</button>
                            </div>
                        ` : ''}
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
                                    ${qDetail.studentAnswer !== null && optIdx === qDetail.studentAnswer && !qDetail.isCorrect ? ' <strong>(Student Answer)</strong>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }
            
            detailsContainer.appendChild(questionCard);
        });
    }
    
    // Add Security Report button
    if (result.proctoringReport || result.plagiarismReport) {
        const securityButton = document.createElement('div');
        securityButton.style.marginTop = '20px';
        securityButton.style.paddingTop = '20px';
        securityButton.style.borderTop = '2px solid var(--border-color)';
        securityButton.innerHTML = `
            <button class="btn btn-warning" onclick="viewSecurityReport('${result.id}')" style="width: 100%;">
                🔒 View Security Report
            </button>
        `;
        modal.querySelector('.modal-content').appendChild(securityButton);
    }
}

function gradeEssayQuestions(resultId) {
    viewResultDetails(resultId);
}

function saveEssayScore(resultId, questionIndex, maxPoints) {
    const scoreInput = document.getElementById(`essay-score-${resultId}-${questionIndex}`);
    if (!scoreInput) return;
    
    const score = parseInt(scoreInput.value);
    if (isNaN(score) || score < 0 || score > maxPoints) {
        alert(`Please enter a score between 0 and ${maxPoints}`);
        return;
    }
    
    const results = getData('lms_results');
    const result = results.find(r => r.id === resultId);
    
    if (!result || !result.questionDetails) return;
    
    // Update the essay question score
    const question = result.questionDetails[questionIndex];
    if (question && question.needsGrading) {
        question.needsGrading = false;
        question.score = score;
        
        // Recalculate total score
        let totalScore = 0;
        let totalPoints = 0;
        
        result.questionDetails.forEach(q => {
            if (q.type === 'essay') {
                totalPoints += (q.points || 100);
                totalScore += (q.score || 0);
            } else {
                totalPoints += 1;
                if (q.isCorrect) totalScore += 1;
            }
        });
        
        // Calculate percentage
        const newScore = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
        result.score = Math.round(newScore);
        result.letterGrade = getLetterGrade(result.score);
        
        saveData('lms_results', results);
        if (typeof showNotification === 'function') {
            showNotification('Essay question graded successfully!', 'success');
        } else {
            alert('Essay question graded successfully!');
        }
        
        // Reload results
        loadResults();
        
        // Update modal
        viewResultDetails(resultId);
    }
}

window.viewSecurityReport = function(resultId) {
    const results = getData('lms_results');
    const result = results.find(r => r.id === resultId);
    
    if (!result) {
        showAlert('Result not found', 'error');
        return;
    }
    
    // Get reports (check both old and new structure)
    const proctoringReport = result.proctoringReport || (result.securityReport && result.securityReport.proctoringReport) || {};
    const plagiarismReport = result.plagiarismReport || (result.securityReport && result.securityReport.plagiarismReport) || {};
    const securityReport = result.securityReport || {};
    
    // Determine risk level
    let riskLevel = proctoringReport.riskLevel || plagiarismReport.overallRisk || 'low';
    if (!riskLevel || !['low', 'medium', 'high', 'critical'].includes(riskLevel)) {
        // Calculate risk level from data
        const totalActivities = (proctoringReport.tabSwitches || 0) + 
                               (proctoringReport.copyAttempts || 0) + 
                               (proctoringReport.pasteAttempts || 0) + 
                               (proctoringReport.rightClickAttempts || 0) +
                               (proctoringReport.devToolsAttempts || 0) +
                               (proctoringReport.totalSuspiciousActivities || 0);
        
        if (totalActivities > 10 || (proctoringReport.tabSwitches || 0) > 5) {
            riskLevel = 'high';
        } else if (totalActivities > 5 || (proctoringReport.tabSwitches || 0) > 2) {
            riskLevel = 'medium';
        } else {
            riskLevel = 'low';
        }
        
        if ((plagiarismReport.similarity || 0) > 0.9) {
            riskLevel = 'high';
        }
    }
    
    const riskColors = {
        low: 'var(--success-color)',
        medium: 'var(--warning-color)',
        high: 'var(--danger-color)',
        critical: '#991b1b'
    };
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <button class="modal-close" onclick="this.closest('.modal').remove(); document.body.style.overflow='auto';">×</button>
            <h3>🔒 Security Report - ${result.studentName}</h3>
            <div style="margin: 20px 0; padding: 15px; background: ${riskColors[riskLevel]}20; border-left: 4px solid ${riskColors[riskLevel]}; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong>Risk Level: </strong>
                        <span style="color: ${riskColors[riskLevel]}; font-weight: bold; text-transform: uppercase; font-size: 1.1rem;">${riskLevel}</span>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-light);">
                        ${result.randomized ? '✓ Questions Randomized' : '✗ Questions Not Randomized'}
                    </div>
                    ${proctoringReport.examDuration ? `
                        <div style="font-size: 0.9rem; color: var(--text-light);">
                            Exam Duration: ${Math.round(proctoringReport.examDuration / 60)} min
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Proctoring Data -->
            <div style="margin: 20px 0;">
                <h4 style="margin-bottom: 15px; color: var(--text-color);">📊 Proctoring Data</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">
                        <strong style="display: block; font-size: 0.9rem; color: var(--text-light); margin-bottom: 5px;">Tab Switches</strong>
                        <div style="font-size: 1.8rem; color: ${(proctoringReport.tabSwitches || 0) > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: bold;">
                            ${proctoringReport.tabSwitches || 0}
                        </div>
                    </div>
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">
                        <strong style="display: block; font-size: 0.9rem; color: var(--text-light); margin-bottom: 5px;">Copy Attempts</strong>
                        <div style="font-size: 1.8rem; color: ${(proctoringReport.copyAttempts || 0) > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: bold;">
                            ${proctoringReport.copyAttempts || 0}
                        </div>
                    </div>
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">
                        <strong style="display: block; font-size: 0.9rem; color: var(--text-light); margin-bottom: 5px;">Paste Attempts</strong>
                        <div style="font-size: 1.8rem; color: ${(proctoringReport.pasteAttempts || 0) > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: bold;">
                            ${proctoringReport.pasteAttempts || 0}
                        </div>
                    </div>
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">
                        <strong style="display: block; font-size: 0.9rem; color: var(--text-light); margin-bottom: 5px;">Right-Click Attempts</strong>
                        <div style="font-size: 1.8rem; color: ${(proctoringReport.rightClickAttempts || 0) > 0 ? 'var(--warning-color)' : 'var(--success-color)'}; font-weight: bold;">
                            ${proctoringReport.rightClickAttempts || 0}
                        </div>
                    </div>
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">
                        <strong style="display: block; font-size: 0.9rem; color: var(--text-light); margin-bottom: 5px;">DevTools Attempts</strong>
                        <div style="font-size: 1.8rem; color: ${(proctoringReport.devToolsAttempts || 0) > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: bold;">
                            ${proctoringReport.devToolsAttempts || 0}
                        </div>
                    </div>
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">
                        <strong style="display: block; font-size: 0.9rem; color: var(--text-light); margin-bottom: 5px;">Suspicious Activities</strong>
                        <div style="font-size: 1.8rem; color: ${(proctoringReport.totalSuspiciousActivities || 0) > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: bold;">
                            ${proctoringReport.totalSuspiciousActivities || 0}
                        </div>
                    </div>
                </div>
                
                ${proctoringReport.responsePatternAnalysis ? `
                    <div style="padding: 15px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 15px;">
                        <h5 style="margin-bottom: 10px;">⏱️ Response Pattern Analysis</h5>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                            <div>
                                <strong>Avg Time/Question:</strong><br>
                                <span style="font-size: 1.2rem; color: var(--primary-color);">${Math.round(proctoringReport.responsePatternAnalysis.averageTimePerQuestion || 0)}s</span>
                            </div>
                            <div>
                                <strong>Quick Answers (&lt;5s):</strong><br>
                                <span style="font-size: 1.2rem; color: ${(proctoringReport.responsePatternAnalysis.quickAnswers || 0) > 3 ? 'var(--danger-color)' : 'var(--text-color)'};">
                                    ${proctoringReport.responsePatternAnalysis.quickAnswers || 0}
                                </span>
                            </div>
                            <div>
                                <strong>Answer Changes:</strong><br>
                                <span style="font-size: 1.2rem; color: ${(proctoringReport.responsePatternAnalysis.answerChanges || 0) > 2 ? 'var(--warning-color)' : 'var(--text-color)'};">
                                    ${proctoringReport.responsePatternAnalysis.answerChanges || 0}
                                </span>
                            </div>
                        </div>
                        ${proctoringReport.responsePatternAnalysis.suspiciousPatterns && proctoringReport.responsePatternAnalysis.suspiciousPatterns.length > 0 ? `
                            <div style="margin-top: 15px; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; border-left: 3px solid var(--danger-color);">
                                <strong>⚠️ Suspicious Patterns Detected:</strong>
                                <ul style="margin: 10px 0 0 20px; padding: 0;">
                                    ${proctoringReport.responsePatternAnalysis.suspiciousPatterns.map(pattern => `<li style="margin: 5px 0;">${pattern}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                
                ${proctoringReport.suspiciousPatterns && proctoringReport.suspiciousPatterns.length > 0 ? `
                    <div style="padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 4px solid var(--danger-color); margin-bottom: 15px;">
                        <h5 style="margin-bottom: 10px; color: var(--danger-color);">🚨 Suspicious Activities Log</h5>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${proctoringReport.suspiciousPatterns.map((activity, idx) => `
                                <div style="padding: 8px; margin: 5px 0; background: white; border-radius: 4px; font-size: 0.9rem;">
                                    <strong>${new Date(activity.timestamp || activity.createdAt || Date.now()).toLocaleTimeString()}:</strong> 
                                    ${activity.activity || activity}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : '<p style="color: var(--success-color); margin: 20px 0; padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 6px;">✓ No suspicious activities detected during this exam.</p>'}
            </div>
            
            <!-- Plagiarism Report -->
            ${plagiarismReport && plagiarismReport.similarity !== undefined ? `
                <div style="margin: 20px 0; padding: 15px; background: var(--bg-secondary); border-radius: 8px; border-top: 3px solid var(--danger-color);">
                    <h4 style="margin-bottom: 15px; color: var(--text-color);">🔍 Plagiarism Detection</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 15px;">
                        <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                            <strong style="display: block; font-size: 0.9rem; color: var(--text-light); margin-bottom: 5px;">Similarity Score</strong>
                            <div style="font-size: 1.8rem; color: ${(plagiarismReport.similarity || 0) > 0.8 ? 'var(--danger-color)' : (plagiarismReport.similarity || 0) > 0.5 ? 'var(--warning-color)' : 'var(--success-color)'}; font-weight: bold;">
                                ${Math.round((plagiarismReport.similarity || 0) * 100)}%
                            </div>
                        </div>
                        <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                            <strong style="display: block; font-size: 0.9rem; color: var(--text-light); margin-bottom: 5px;">Risk Level</strong>
                            <div style="font-size: 1.8rem; color: ${riskColors[plagiarismReport.overallRisk] || riskColors.low}; font-weight: bold; text-transform: uppercase;">
                                ${plagiarismReport.overallRisk || 'low'}
                            </div>
                        </div>
                        <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                            <strong style="display: block; font-size: 0.9rem; color: var(--text-light); margin-bottom: 5px;">Suspicious Answers</strong>
                            <div style="font-size: 1.8rem; color: ${(plagiarismReport.suspiciousAnswers && plagiarismReport.suspiciousAnswers.length) > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: bold;">
                                ${plagiarismReport.suspiciousAnswers ? plagiarismReport.suspiciousAnswers.length : 0}
                            </div>
                        </div>
                    </div>
                    ${plagiarismReport.suspiciousAnswers && plagiarismReport.suspiciousAnswers.length > 0 ? `
                        <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; border-left: 3px solid var(--danger-color);">
                            <strong>⚠️ Suspicious Answers Detected:</strong>
                            <ul style="margin: 10px 0 0 20px; padding: 0;">
                                ${plagiarismReport.suspiciousAnswers.map(ans => `
                                    <li style="margin: 5px 0;">
                                        <strong>Question ${ans.questionIndex + 1}:</strong> 
                                        ${Math.round((ans.similarity || 0) * 100)}% similar to ${ans.otherStudent}'s answer
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : '<p style="color: var(--success-color); margin: 10px 0;">✓ No plagiarism detected.</p>'}
                </div>
            ` : ''}
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid var(--border-color); text-align: center;">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); document.body.style.overflow='auto';">Close Report</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '15px 20px';
    notification.style.background = 'white';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    notification.style.zIndex = '10000';
    notification.style.maxWidth = '400px';
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

function setupMaterialForm() {
    const user = getCurrentUser();
    const courses = getData('lms_courses');
    const classes = getData('lms_classes');
    
    // Load subjects
    const subjectSelect = document.getElementById('materialSubject');
    if (subjectSelect && courses) {
        const lecturerSubjects = user.subjects || [];
        lecturerSubjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });
    }
    
    // Load classes
    const classSelect = document.getElementById('materialClass');
    if (classSelect) {
        let availableClasses = [];
        if (user.classes && user.classes.length > 0) {
            availableClasses = user.classes;
        } else if (classes) {
            console.warn('User has no assigned classes for material upload, showing ALL classes as fallback');
            availableClasses = classes.map(c => (typeof c === 'object' && c.name) ? c.name : c);
        }

        classSelect.innerHTML = '<option value="">-- Select Class --</option>';
        availableClasses.forEach(cls => {
            const className = typeof cls === 'string' ? cls : cls.name;
            if (!className) return;
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            classSelect.appendChild(option);
        });
    }
    
    const form = document.getElementById('materialForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            uploadMaterial();
        });
    }
}

async function loadBulkGradingExams() {
    const examSelect = document.getElementById('bulkExamSelect');
    if (!examSelect) return;
    
    const user = getCurrentUser();
    
    let exams = [];
    
    // Try Supabase first, fallback to localStorage
    if (typeof getExams === 'function') {
        try {
            exams = await getExams();
        } catch (error) {
            console.warn('Supabase loadBulkGradingExams failed, using localStorage:', error);
            exams = getData('lms_exams') || [];
        }
    } else {
        exams = getData('lms_exams') || [];
    }
    
    const lecturerExams = exams.filter(e => (e.lecturer_id || e.lecturerId) === user.id);
    
    examSelect.innerHTML = '<option value="">-- Select Exam for Bulk Grading --</option>';
    lecturerExams.forEach(exam => {
        const option = document.createElement('option');
        option.value = exam.id;
        option.textContent = `${exam.title} - ${exam.subject}`;
        examSelect.appendChild(option);
    });
}

// Store selected file data globally
let selectedFileData = null;

window.handleFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) {
        selectedFileData = null;
        document.getElementById('file-info').style.display = 'none';
        return;
    }
    
    // Check file size (limit to 10MB to avoid localStorage issues)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showAlertUpload('File size exceeds 10MB limit. Please choose a smaller file.', 'error');
        event.target.value = '';
        selectedFileData = null;
        document.getElementById('file-info').style.display = 'none';
        return;
    }
    
    // Show file info
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = formatFileSize(file.size);
    document.getElementById('file-info').style.display = 'block';
    
    // Read file as base64
    const reader = new FileReader();
    reader.onload = function(e) {
        selectedFileData = {
            name: file.name,
            type: file.type,
            size: file.size,
            data: e.target.result // base64 string
        };
    };
    reader.onerror = function() {
        showAlertUpload('Error reading file. Please try again.', 'error');
        selectedFileData = null;
        document.getElementById('file-info').style.display = 'none';
        event.target.value = '';
    };
    reader.readAsDataURL(file);
}

window.clearFileSelection = function() {
    document.getElementById('materialFile').value = '';
    selectedFileData = null;
    document.getElementById('file-info').style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function uploadMaterial() {
    const user = getCurrentUser();
    const title = document.getElementById('materialTitle').value.trim();
    const subject = document.getElementById('materialSubject').value;
    const materialClass = document.getElementById('materialClass').value;
    const description = document.getElementById('materialDescription').value.trim();
    const content = document.getElementById('materialContent').value.trim();
    const fileUrl = document.getElementById('materialFileUrl').value.trim();
    const videoUrl = document.getElementById('materialVideoUrl')?.value.trim() || '';
    const audioUrl = document.getElementById('materialAudioUrl')?.value.trim() || '';
    
    if (!title) {
        showAlertUpload('Please enter a material title', 'error');
        return;
    }
    
    if (!subject) {
        showAlertUpload('Please select a subject', 'error');
        return;
    }
    
    if (!materialClass) {
        showAlertUpload('Please select a class', 'error');
        return;
    }
    
    // Check if at least one content source is provided
    if (!content && !fileUrl && !selectedFileData && !videoUrl && !audioUrl) {
        showAlertUpload('Please provide either content, upload a file, or provide a file/video/audio URL', 'error');
        return;
    }
    
    const material = {
        id: Date.now().toString(),
        title,
        subject,
        class: materialClass,
        description,
        content,
        fileUrl,
        videoUrl,
        audioUrl,
        lecturerId: user.id,
        lecturerName: user.fullName,
        uploadedBy: user.id,
        uploadedAt: new Date().toISOString()
    };
    
    // Add uploaded file data if available
    if (selectedFileData) {
        material.fileUrl = selectedFileData.data; // Store base64 string
        material.fileName = selectedFileData.name;
    }
    
    // Use API service layer
    if (typeof saveMaterial === 'function') {
        try {
            await saveMaterial(material);
            showAlertUpload('Material uploaded successfully!', 'success');
        } catch (error) {
            console.warn('Supabase saveMaterial failed, using localStorage:', error);
            const materials = getData('lms_materials') || [];
            materials.push(material);
            saveData('lms_materials', materials);
            showAlertUpload('Material uploaded successfully!', 'success');
        }
    } else {
        const materials = getData('lms_materials') || [];
        materials.push(material);
        saveData('lms_materials', materials);
        showAlertUpload('Material uploaded successfully!', 'success');
    }
    
    // Reset form
    document.getElementById('materialForm').reset();
    selectedFileData = null;
    document.getElementById('file-info').style.display = 'none';
    
    // Reload materials
    await loadMaterials();
}

async function loadResults() {
    const user = getCurrentUser();
    let results = [];
    let exams = [];
    
    // Try Supabase first, fallback to localStorage
    if (typeof getResults === 'function') {
        try {
            results = await getResults();
        } catch (error) {
            console.warn('Supabase loadResults failed, using localStorage:', error);
            results = getData('lms_results') || [];
        }
    } else {
        results = getData('lms_results') || [];
    }
    
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
    
    // Get results for exams created by this lecturer
    const lecturerExamIds = exams.filter(e => (e.lecturerId || e.lecturer_id || e.createdBy) === user.id).map(e => e.id);
    let lecturerResults = results.filter(r => lecturerExamIds.includes(r.examId));
    
    // Apply specific exam filter if requested
    if (window.currentResultFilterExamId) {
        lecturerResults = lecturerResults.filter(r => String(r.examId) === String(window.currentResultFilterExamId));
    }
    
    const tbody = document.getElementById('results-tbody');
    if (!tbody) return;
    
    if (lecturerResults.length === 0) {
        const colspan = window.bulkGradingMode ? 8 : 7;
        tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center;">No results available</td></tr>`;
        return;
    }
    
    tbody.innerHTML = '';
    
    lecturerResults.forEach(result => {
        const letterGrade = getLetterGrade(result.score);
        const gradeColor = getGradeColor(letterGrade);
        
        // Check if result has essay questions that need grading
        const hasEssayQuestions = result.questionDetails && result.questionDetails.some(q => q.needsGrading);
        
        const row = document.createElement('tr');
        row.dataset.resultId = result.id;
        row.innerHTML = `
            <td>${window.bulkGradingMode ? '<input type="checkbox" class="result-checkbox" value="' + result.id + '" onchange="toggleResult(\'' + result.id + '\')">' : ''}</td>
            <td>${result.studentName}</td>
            <td>${result.examTitle}</td>
            <td>${result.subject}</td>
            <!-- <td>${result.type}</td> -->
            <td>
                <strong>${result.score}%</strong> 
                <span class="grade-badge" style="background: ${gradeColor}; color: white; padding: 4px 8px; border-radius: 4px; margin-left: 8px; font-weight: bold;">${letterGrade}</span>
                <br><small style="color: var(--text-light);">(${result.correctAnswers}/${result.totalQuestions})</small>
                ${hasEssayQuestions ? '<br><small style="color: var(--warning-color);">⚠ Essay questions need grading</small>' : ''}
            </td>
            <td>${formatDate(result.submittedAt)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Make showSection globally accessible
window.showSection = function(section) {
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
    const clickedBtn = event && event.target ? event.target : 
                      document.querySelector(`.tab-btn[onclick*="showSection('${section}')"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
}
    
    // Load section-specific data
    if (section === 'announcements' && typeof loadAnnouncements === 'function') {
        setTimeout(loadAnnouncements, 100);
    }
    if (section === 'analytics' && typeof loadPerformanceAnalytics === 'function') {
        setTimeout(loadPerformanceAnalytics, 100);
    }
};

function showAlert(message, type) {
    const container = document.getElementById('alert-container');
    if (!container) return;
    
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

function showAlertUpload(message, type) {
    const container = document.getElementById('alert-container-upload');
    if (!container) return;
    
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
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
    const materialClass = document.getElementById('modalMaterialClass');
    const date = document.getElementById('modalMaterialDate');
    const content = document.getElementById('modalMaterialContent');
    
    if (!modal || !content) return;
    
    title.textContent = material.title;
    subject.textContent = `Subject: ${material.subject}`;
    if (materialClass) materialClass.textContent = `Class: ${material.class}`;
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

window.downloadMaterial = function(fileUrl) {
    window.downloadFile(fileUrl, 'download');
};

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

window.logout = function() {
    clearCurrentUser();
    window.location.href = 'login.html';
};

async function loadStudentRegistrations() {
    const user = getCurrentUser();
    const tbody = document.getElementById('student-registrations-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Loading student registrations...</td></tr>';
    
    try {
        // Fetch all students
        let usersData = { students: [] };
        if (typeof window.getUsers === 'function') {
            try {
                usersData = await window.getUsers();
            } catch (err) {
                console.warn('Failed to fetch users from Supabase:', err);
                usersData = getData('lms_users') || { students: [] };
            }
        } else {
            usersData = getData('lms_users') || { students: [] };
        }
        
        const students = usersData.students || [];
        
        // Fetch exams to find which classes this lecturer manages
        let exams = [];
        if (typeof window.getExams === 'function') {
            try {
                exams = await window.getExams();
            } catch (err) {
                exams = getData('lms_exams') || [];
            }
        } else {
            exams = getData('lms_exams') || [];
        }
        
        // Get unique classes the lecturer manages
        const lecturerClasses = [...new Set(exams
            .filter(e => (e.lecturerId || e.lecturer_id) === user.id)
            .flatMap(e => e.classes || []))];
            
        console.log('Lecturer managed classes:', lecturerClasses);
        
        // Filter students by these classes
        const filteredStudents = students.filter(s => lecturerClasses.includes(s.class));
        
        if (filteredStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No students found in your managed classes.</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        
        filteredStudents.forEach(student => {
            const subjects = student.subjects || [];
            const subjectsHtml = subjects.length > 0 
                ? subjects.map(s => `<span class="badge" style="background: var(--light-color); color: var(--primary-color); margin: 2px; padding: 3px 8px; border-radius: 12px; font-size: 0.85rem; border: 1px solid var(--primary-color); display: inline-block;">${s}</span>`).join(' ')
                : '<span style="color: var(--text-light); italic;">No subjects registered</span>';
                
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding: 12px; border-bottom: 1px solid rgba(0,0,0,0.05); font-weight: 500;">${student.fullName || student.name}</td>
                <td style="padding: 12px; border-bottom: 1px solid rgba(0,0,0,0.05);">${student.class || 'N/A'}</td>
                <td style="padding: 12px; border-bottom: 1px solid rgba(0,0,0,0.05);">${subjectsHtml}</td>
                <td style="padding: 12px; border-bottom: 1px solid rgba(0,0,0,0.05); color: var(--text-light); font-size: 0.9rem;">${student.updated_at ? new Date(student.updated_at).toLocaleDateString() : 'N/A'}</td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error in loadStudentRegistrations:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red; padding: 20px;">Error loading student registrations.</td></tr>';
    }
}

window.loadStudentRegistrations = loadStudentRegistrations;

// assignment Functions
async function loadAssignments() {
    const user = getCurrentUser();
    const container = document.getElementById('assignments-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading assignments...</div>';

    try {
        let assignments = [];
        if (typeof window.getAssignments === 'function') {
            assignments = await window.getAssignments();
        } else {
            assignments = getData('lms_assignments') || [];
        }

        const lecturerAssignments = assignments.filter(a => {
            const lecturerId = a.lecturer_id || a.lecturerId;
            return lecturerId && String(lecturerId).toLowerCase() === String(user.id).toLowerCase();
        });

        if (lecturerAssignments.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-light); background: var(--light-color); border-radius: 12px;">
                    <p style="font-size: 1.2rem; margin-bottom: 10px;">📅 No assignments given yet</p>
                    <button class="btn btn-primary" onclick="showSection('give-assignment')">Give Your First Assignment</button>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        lecturerAssignments.forEach(assignment => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginBottom = '20px';
            card.style.padding = '20px';
            
            const deadline = new Date(assignment.deadline);
            const isExpired = deadline < new Date();
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h4 style="margin: 0; color: var(--primary-color); font-size: 1.3rem;">${assignment.title}</h4>
                        <p style="margin: 8px 0; color: var(--text-light);">
                            <span class="badge" style="background: var(--light-color); color: var(--primary-color); padding: 2px 8px; border-radius: 4px;">${assignment.subject}</span>
                            
                        </p>
                        <p style="margin: 10px 0;">${assignment.description}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: ${isExpired ? 'var(--danger-color)' : 'var(--success-color)'};">
                            Deadline: ${new Date(assignment.deadline).toLocaleString()}
                        </div>
                        ${isExpired ? '<span style="color: var(--danger-color); font-size: 0.85rem;">(Deadline Passed)</span>' : ''}
                    </div>
                </div>
                <div style="margin-top: 15px; pt: 15px; border-top: 1px solid var(--border-color); display: flex; gap: 10px;">
                    <button class="btn btn-small" onclick="viewAssignmentSubmissions('${assignment.id}')">View Submissions</button>
                    ${assignment.file_url ? `<button class="btn btn-small btn-secondary" onclick="window.open('${assignment.file_url}', '_blank')">📎 View Attachment</button>` : ''}
                    <button class="btn btn-small btn-danger" onclick="confirmDeleteAssignment('${assignment.id}')">Delete</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading assignments:', error);
        container.innerHTML = '<div style="color: red; text-align: center;">Error loading assignments. Please try again.</div>';
    }
}

async function setupAssignmentForm() {
    console.log('🛠️ [Assignment] Setting up assignment form (SIMPLE)...');
    const user = getCurrentUser();
    
    // Fetch Data
    let courses = [];
    let classes = [];
    
    try { courses = window.getCourses ? await window.getCourses() : (getData('lms_courses') || []); } catch(e) {}
    try { classes = window.getClasses ? await window.getClasses() : (getData('lms_classes') || []); } catch(e) {}
    
    const lecturerCourses = courses.filter(c => (c.lecturerId || c.lecturer_id) === user.id);
    
    // SINGLE CLASS SELECT (Like Materials)
    const classSelect = document.getElementById('assignmentClass');
    // If element doesn't exist, we might need to change the HTML or targeted container. 
    // The previous code targeted 'assignmentClassesContainer'. We need to make sure the HTML expects a select or we inject one.
    
    const container = document.getElementById('assignmentClassesContainer');
    if (container) {
        // Replace checkbox container with a simple select
        container.innerHTML = `
            <select id="assignmentClass" class="form-control" required onchange="window.updateAssignmentSubjects()">
                <option value="">-- Select Class --</option>
            </select>
        `;
        
        const select = document.getElementById('assignmentClass');
        
        let availableClasses = [];
        const courseClasses = [...new Set(lecturerCourses.map(c => c.class).filter(c => c))];
        
        if (courseClasses.length > 0) availableClasses = courseClasses;
        else if (user.classes && user.classes.length > 0) availableClasses = user.classes;
        else availableClasses = classes.map(c => (typeof c === 'object' && c.name) ? c.name : c);
        
        availableClasses.sort().forEach(cls => {
            const option = document.createElement('option');
            option.value = cls;
            option.textContent = cls;
            select.appendChild(option);
        });
    }

    // SUBJECT SELECT
    const subjectSelect = document.getElementById('assignmentSubject');
    if (subjectSelect) {
        subjectSelect.innerHTML = '<option value="">-- Select Class First --</option>';
    }
    
    // Expose courses for filter function
    window.lecturerCoursesCache = lecturerCourses;
    
    const form = document.getElementById('assignmentForm');
    if (form && !form.dataset.listenerAdded) {
        form.addEventListener('submit', handleAssignmentSubmit);
        form.dataset.listenerAdded = 'true';
    }
}

// Global function for cascading logic (UPDATED for Select)
window.updateAssignmentSubjects = function() {
    const classSelect = document.getElementById('assignmentClass');
    const subjectSelect = document.getElementById('assignmentSubject');
    const courses = window.lecturerCoursesCache || []; 
    
    if (!classSelect || !subjectSelect) return;
    
    const selectedClass = classSelect.value;
    
    if (!selectedClass) {
        subjectSelect.innerHTML = '<option value="">-- Select Class First --</option>';
        return;
    }
    
    let availableSubjects = [];
    
    if (courses.length > 0) {
        const relevantCourses = courses.filter(c => c.class === selectedClass);
        availableSubjects = [...new Set(relevantCourses.map(c => c.subject))];
    }
    
    if (availableSubjects.length === 0) {
        const user = getCurrentUser();
        if (user.subjects && user.subjects.length > 0) {
            availableSubjects = user.subjects;
        }
    }
    
    subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
    availableSubjects.sort().forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        subjectSelect.appendChild(option);
    });
};

function handleAssignmentFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 5MB Limit Check
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        alert(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max allowed is 5MB.`);
        event.target.value = '';
        return;
    }
    
    const info = document.getElementById('assignment-file-info');
    const name = document.getElementById('assignment-file-name');
    
    currentAssignmentFile = file;
    name.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    info.style.display = 'flex';
    info.style.alignItems = 'center';
    info.style.gap = '10px';
}

function clearAssignmentFile() {
    currentAssignmentFile = null;
    const fileInput = document.getElementById('assignmentFile');
    if (fileInput) fileInput.value = '';
    const info = document.getElementById('assignment-file-info');
    if (info) info.style.display = 'none';
}

async function handleAssignmentSubmit(e) {
    e.preventDefault();
    const user = getCurrentUser();
    const title = document.getElementById('assignmentTitle').value.trim();
    const subject = document.getElementById('assignmentSubject').value;
    const deadline = document.getElementById('assignmentDeadline').value;
    const description = document.getElementById('assignmentDescription').value.trim();
    
    // NEW: Get single class from select
    const classSelect = document.getElementById('assignmentClass');
    const selectedClass = classSelect ? classSelect.value : null;

    if (!selectedClass) {
        alert('Please select a class.');
        return;
    }
    
    if (!subject) {
        alert('Please select a subject.');
        return;
    }
    
    if (!title) {
        alert('Please enter a title.');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    
    try {
        let fileUrl = null;
        if (currentAssignmentFile) {
            // Check size again just in case
            if (currentAssignmentFile.size > 5 * 1024 * 1024) {
                 throw new Error('File too large');
            }
            
            // Convert to base64
            fileUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(currentAssignmentFile);
            });
        }
        
        const assignment = {
            id: null, // Let DB generate ID or random
            title,
            subject,
            class: selectedClass, // Simple string
            classes: [selectedClass], // Backward compat
            deadline,
            description,
            lecturerId: user.id || user.uid,
            lecturer_id: user.id || user.uid,
            lecturerName: user.fullName || user.name,
            file_url: fileUrl, 
            created_at: new Date().toISOString()
        };
        
        console.log('[Assignment] Submitting Simple:', assignment);
        
        let result = null;
        if (typeof window.saveAssignment === 'function') {
            result = await window.saveAssignment(assignment);
        } else {
             // Fallback
             const saved = getData('lms_assignments') || [];
             saved.push(assignment);
             saveData('lms_assignments', saved);
             result = assignment;
        }
        
        if (result) {
            showNotification('Assignment created successfully!', 'success');
            e.target.reset();
            clearAssignmentFile();
            // Reset dropdowns
            updateAssignmentSubjects();
            showSection('assignments');
            if (typeof loadAssignments === 'function') loadAssignments();
        } else {
            throw new Error('Save returned null');
        }
    } catch (error) {
        console.error('Error saving assignment:', error);
        alert('Failed to create assignment: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function confirmDeleteAssignment(id) {
    if (confirm('Are you sure you want to delete this assignment?')) {
        const success = await window.deleteAssignment(id);
        if (success) {
            showNotification('Assignment deleted successfully', 'success');
            loadAssignments();
        } else {
            alert('Failed to delete assignment');
        }
    }
}

window.loadAssignments = loadAssignments;
window.setupAssignmentForm = setupAssignmentForm;
window.handleAssignmentFileSelect = handleAssignmentFileSelect;
window.clearAssignmentFile = clearAssignmentFile;
window.confirmDeleteAssignment = confirmDeleteAssignment;

// Placeholder for submissions view
window.viewAssignmentSubmissions = async function(id) {
    const modal = document.getElementById('submissionsModal');
    const tbody = document.getElementById('submissions-tbody');
    if (!modal || !tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Loading submissions...</td></tr>';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
        let submissions = [];
        let students = [];

        if (typeof window.getSubmissions === 'function') {
            submissions = await window.getSubmissions(id);
        } else {
            submissions = (getData('lms_submissions') || []).filter(s => (s.assignment_id === id || s.assignmentId === id));
        }

        if (typeof window.getUsers === 'function') {
            const users = await window.getUsers();
            students = users.students || [];
        } else {
            students = (getData('lms_users') || {}).students || [];
        }

        if (submissions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No submissions yet.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        submissions.forEach(sub => {
            const student = students.find(s => s.id === (sub.student_id || sub.studentId));
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid var(--border-color)';
            
            row.innerHTML = `
                <td style="padding: 12px;">${student ? (student.fullName || student.name) : 'Unknown Student'}</td>
                <td style="padding: 12px;">${new Date(sub.submitted_at || sub.submittedAt).toLocaleString()}</td>
                <td style="padding: 12px;"><span class="status-badge ${sub.status === 'Graded' || sub.status === 'graded' || sub.grade ? 'status-active' : 'status-completed'}">● ${(sub.status || 'SUBMITTED').toUpperCase()}</span></td>
                <td style="padding: 12px; font-weight: bold;">${sub.score !== undefined ? sub.score + '%' : (sub.grade ? sub.grade + '%' : '-')}</td>
                <td style="padding: 12px;">
                    <button class="btn btn-small" onclick="openGradingModal('${sub.id}')">Grade</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading submissions:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red; padding: 20px;">Error loading submissions.</td></tr>';
    }
};

window.closeSubmissionsModal = function() {
    document.getElementById('submissionsModal').style.display = 'none';
    document.body.style.overflow = 'auto';
};

window.openGradingModal = async function(submissionId) {
    const modal = document.getElementById('gradingModal');
    if (!modal) return;

    try {
        let submissions = [];
        if (typeof window.getSubmissions === 'function') {
            submissions = await window.getSubmissions();
        } else {
            submissions = getData('lms_submissions') || [];
        }

        const sub = submissions.find(s => s.id === submissionId);
        if (!sub) return;

        document.getElementById('gradingSubmissionId').value = sub.id;
        document.getElementById('gradeScore').value = sub.score || '';
        document.getElementById('gradeFeedback').value = sub.feedback || '';
        
        // Show student name in header if possible
        const studentNameHeader = document.getElementById('gradingStudentName');
        if (studentNameHeader) {
            // Need students to find the name
            let students = [];
            if (typeof window.getUsers === 'function') {
                const users = await window.getUsers();
                students = users.students || [];
            } else {
                students = (getData('lms_users') || {}).students || [];
            }
            const student = students.find(s => s.id === sub.student_id);
            studentNameHeader.textContent = `Grade Submission: ${student ? (student.fullName || student.name) : 'Unknown Student'}`;
        }
        
        const preview = document.getElementById('studentWorkPreview');
        preview.innerHTML = `
            <p><strong>Content:</strong></p>
            <div style="margin-bottom: 15px; white-space: pre-wrap;">${sub.content || 'No text content'}</div>
            ${sub.file_url ? `<a href="${sub.file_url}" target="_blank" class="btn btn-small btn-secondary">📎 View Student File</a>` : ''}
        `;

        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error opening grading modal:', error);
    }
};

window.closeGradingModal = function() {
    document.getElementById('gradingModal').style.display = 'none';
};

// Handle grading form submission
document.addEventListener('DOMContentLoaded', function() {
    const gradingForm = document.getElementById('gradingForm');
    if (gradingForm) {
        gradingForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const user = getCurrentUser();
            const submissionId = document.getElementById('gradingSubmissionId').value;
            const score = document.getElementById('gradeScore').value;
            const feedback = document.getElementById('gradeFeedback').value;

            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving Grade...';

            try {
                const gradeData = {
                    grade: score,
                    feedback
                };

                const result = await window.gradeSubmission(submissionId, gradeData);
                if (result) {
                    showNotification('Grade saved successfully!', 'success');
                    closeGradingModal();
                    // Refresh submissions table if open
                    const subModal = document.getElementById('submissionsModal');
                    if (subModal && subModal.style.display === 'flex') {
                        // We need the assignment ID. We can get it from the submission result.
                        viewAssignmentSubmissions(result.assignmentId || result.assignment_id);
                    }
                } else {
                    alert('Error saving grade.');
                }
            } catch (err) {
                console.error('Grading error:', err);
                alert('An error occurred during grading.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Grade';
            }
        });
    }
});
