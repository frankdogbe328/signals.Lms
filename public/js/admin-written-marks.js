// Admin Written Exam Marks Entry System
// Handles entry of marks for written exams and composite score calculation

// Written exam marks storage structure:
// lms_written_marks = {
//   "subject_class": {
//     "opening": { "studentId": mark, ... },
//     "bft1": { "studentId": mark, ... },
//     "bft2": { "studentId": mark, ... },
//     "mid-course": { "studentId": mark, ... },
//     "general-assessment": { "studentId": mark, ... },
//     "final-exam": { "studentId": mark, ... }
//   }
// }

// Initialize written marks section
window.loadWrittenMarksSection = async function() {
    // We no longer need to load classes for the marks entry as it's now student-centric.
    // However, we still need to load composite dropdowns for the section below.
    await loadCompositeDropdowns();
    await loadAllStudentsForSelection();
};

// Load all students into the select dropdown
async function loadAllStudentsForSelection() {
    const studentSelect = document.getElementById('written-marks-student-select');
    if (!studentSelect) return;
    
    let users = { students: [] };
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            users = getData('lms_users') || { students: [] };
        }
    } else {
        users = getData('lms_users') || { students: [] };
    }
    
    const students = (users.students || []).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    
    studentSelect.innerHTML = '<option value="">-- Browse All Students --</option>';
    students.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = `${s.fullName} (${s.username}) - ${s.class || 'No Class'}`;
        studentSelect.appendChild(option);
    });
}

// Search students for manual marks entry
window.searchStudentsForMarks = async function(query) {
    const resultsContainer = document.getElementById('student-search-results');
    if (!query || query.length < 1) {
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
        return;
    }
    
    let users = { students: [] };
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            console.warn('Supabase getUsers failed, using localStorage:', error);
            users = getData('lms_users') || { students: [] };
        }
    } else {
        users = getData('lms_users') || { students: [] };
    }
    
    const students = (users.students || []).filter(s => 
        (s.fullName && s.fullName.toLowerCase().includes(query.toLowerCase())) ||
        (s.username && s.username.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, 10); // Limit to 10 results
    
    if (students.length === 0) {
        resultsContainer.innerHTML = '<div class="search-result-item">No students found</div>';
        resultsContainer.style.display = 'block';
        return;
    }
    
    resultsContainer.innerHTML = students.map(s => `
        <div class="search-result-item" onclick="selectStudentForMarks('${s.id}', '${s.fullName}', '${s.username}', '${s.class}')">
            <span class="student-name">${s.fullName}</span>
            <span class="student-info">${s.username} | Class: ${s.class || 'N/A'}</span>
        </div>
    `).join('');
    resultsContainer.style.display = 'block';
};

// Select a student from search results
window.selectStudentForMarks = function(id, fullName, username, className) {
    document.getElementById('written-marks-student-search').value = `${fullName} (${username})`;
    document.getElementById('selected-student-id').value = id;
    document.getElementById('student-search-results').style.display = 'none';
    
    // Sync the dropdown if it exists
    const studentSelect = document.getElementById('written-marks-student-select');
    if (studentSelect) {
        studentSelect.value = id;
    }
    
    // Auto-load mark for current type
    loadStudentMarkIfSelected();
};

// Select a student from the dropdown
window.selectStudentFromDropdown = async function(id) {
    if (!id) {
        document.getElementById('written-marks-student-search').value = '';
        document.getElementById('selected-student-id').value = '';
        const container = document.getElementById('written-marks-container');
        if (container) container.style.display = 'none';
        return;
    }
    
    let users = { students: [] };
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            users = getData('lms_users') || { students: [] };
        }
    } else {
        users = getData('lms_users') || { students: [] };
    }
    
    const student = (users.students || []).find(s => s.id === id);
    if (student) {
        document.getElementById('written-marks-student-search').value = `${student.fullName} (${student.username})`;
        document.getElementById('selected-student-id').value = id;
        
        // Auto-load mark for current type
        loadStudentMarkIfSelected();
    }
};

// Load mark if both student and type are selected
window.loadStudentMarkIfSelected = function() {
    const studentId = document.getElementById('selected-student-id').value;
    const type = document.getElementById('written-marks-exam-type-input').value.trim();
    
    if (studentId && type) {
        loadStudentMark(type, studentId);
    }
};

// Reset search
window.resetWrittenMarksSelection = function() {
    document.getElementById('written-marks-student-search').value = '';
    document.getElementById('selected-student-id').value = '';
    document.getElementById('written-marks-exam-type-input').value = 'BFT';
    
    const studentSelect = document.getElementById('written-marks-student-select');
    if (studentSelect) studentSelect.value = '';
    
    const container = document.getElementById('written-marks-container');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
};

// Load composite dropdowns
async function loadCompositeDropdowns() {
    let classes = [];
    let courses = [];
    
    if (typeof getClasses === 'function') {
        try {
            classes = await getClasses();
            courses = await getCourses();
        } catch (error) {
            console.warn('Supabase loading failed for composite dropdowns:', error);
            classes = getData('lms_classes') || [];
            courses = getData('lms_courses') || [];
        }
    } else {
        classes = getData('lms_classes') || [];
        courses = getData('lms_courses') || [];
    }
    
    const classSelect = document.getElementById('composite_class_select') || document.getElementById('composite-class-select');
    if (classSelect) {
        classSelect.innerHTML = '<option value="">Select Class</option>';
        classes.forEach(cls => {
            const className = typeof cls === 'string' ? cls : cls.name;
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            classSelect.appendChild(option);
        });
    }
    
    // Subject will be loaded when class is selected
    const subjectSelect = document.getElementById('composite-subject-select');
    if (subjectSelect) {
        subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    }
}

// Load written marks for a specific student
window.loadStudentMark = async function(type, studentId) {
    const container = document.getElementById('written-marks-container');
    if (!container) return;
    
    container.style.display = 'block';
    container.innerHTML = '<p style="text-align: center; padding: 20px;">Fetching marks...</p>';
    
    let users = { students: [] };
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            users = getData('lms_users') || { students: [] };
        }
    } else {
        users = getData('lms_users') || { students: [] };
    }
    
    const student = (users.students || []).find(s => s.id === studentId);
    if (!student) {
        container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-light);">Student not found.</p>';
        return;
    }
    
    const writtenMarks = typeof getWrittenMarks === 'function' ? await getWrittenMarks() : (getData('lms_written_marks') || {});
    // Use student's class to find the key
    const key = `general_${student.class}`;
    const currentMark = (writtenMarks[key] && writtenMarks[key][type]) ? (writtenMarks[key][type][studentId] || '') : '';
    
    const examInfo = {
        'opening': { name: 'Opening', percentage: 5 },
        'bft1': { name: 'BFT 1', percentage: 2.5 },
        'bft2': { name: 'BFT 2', percentage: 2.5 },
        'bft': { name: 'BFT', percentage: 5 },
        'mid-course': { name: 'Mid Course Exam', percentage: 20 },
        'general-assessment': { name: 'General Assessment', percentage: 5 },
        'final-exam': { name: 'Final Exam', percentage: 25 }
    };
    
    const info = examInfo[type.toLowerCase()] || { name: type, percentage: 5 }; // Default 5% for manual entry
    
    let html = `
        <div style="background: var(--light-color); padding: 20px; border-radius: 12px; border: 2px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h3 style="margin: 0; color: var(--primary-color);">${info.name} (${info.percentage}%)</h3>
                    <p style="margin: 5px 0 0 0; color: var(--text-light);">Student: <strong>${student.fullName}</strong> | Class: <strong>${student.class || 'N/A'}</strong></p>
                </div>
                <button class="btn btn-secondary" onclick="resetWrittenMarksSelection()">New Search</button>
            </div>
            
            <div style="display: flex; gap: 20px; align-items: flex-end; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">Enter Mark (out of 100)</label>
                    <input type="number" 
                           id="mark_${type}_${student.id}" 
                           value="${currentMark}" 
                           min="0" 
                           max="100" 
                           step="0.01"
                           style="width: 100%; padding: 12px; font-size: 1.1rem; border: 2px solid var(--border-color); border-radius: 8px;"
                           oninput="updateBftPoint('${type}', '${student.id}', this.value)">
                </div>
                <div style="width: 150px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">Final Point (${info.percentage}%)</label>
                    <div style="padding: 12px; background: white; border: 2px solid var(--border-color); border-radius: 8px; font-size: 1.1rem; font-weight: bold; color: var(--primary-color); text-align: center;">
                        <span id="point_${type}_${student.id}">${currentMark !== '' ? (parseFloat(currentMark) / 100 * info.percentage).toFixed(2) : '0.00'}</span>
                    </div>
                </div>
                <button class="btn btn-primary" style="padding: 12px 30px; font-size: 1.1rem;"
                        onclick="submitMarkForStudent('${type}', '${student.class}', '${student.id}')">
                    Submit Score
                </button>
            </div>
            <div id="save-status-${type}-${student.id}" style="margin-top: 10px; color: var(--success-color); font-weight: bold; display: none; text-align: center;">
                ✓ Score saved successfully for ${student.fullName}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
};

// Explicit submit function
window.submitMarkForStudent = async function(type, className, studentId) {
    const input = document.getElementById(`mark_${type}_${studentId}`);
    if (!input) return;
    
    const markValue = parseFloat(input.value);
    if (isNaN(markValue) || markValue < 0 || markValue > 100) {
        alert('Please enter a valid mark between 0 and 100');
        return;
    }
    
    const saveStatus = document.getElementById(`save-status-${type}-${studentId}`);
    
    try {
        await saveWrittenMark(type, null, className, studentId, input.value);
        if (saveStatus) {
            saveStatus.style.display = 'block';
            setTimeout(() => {
                saveStatus.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        console.error('Failed to submit mark:', error);
        alert('Failed to save score. Please try again.');
    }
};

// Legacy support for loading written marks (archived/unused but kept for internal calls)
window.loadWrittenMarks = async function(type, className, subject) {
    // This function is now superseded by search-based flow
    // but we can keep it for any bulk view if needed.
    // For now, let's redirect to individual load if className is missing
    if (!className) return; 
    // ... logic remains but basically we want individuals now
};

// Save individual written mark
window.saveWrittenMark = async function(type, subject, className, studentId, mark) {
    const writtenMarks = typeof getWrittenMarks === 'function' ? await getWrittenMarks() : (getData('lms_written_marks') || {});
    // Use class as key since these are general exams (no subject)
    const key = `general_${className}`;
    
    if (!writtenMarks[key]) {
        writtenMarks[key] = {};
    }
    if (!writtenMarks[key][type]) {
        writtenMarks[key][type] = {};
    }
    
    // Allow empty value to clear the mark
    if (mark === '' || mark === null || mark === undefined) {
        delete writtenMarks[key][type][studentId];
        // Use API service layer if available
        if (typeof saveWrittenMarks === 'function') {
            try {
                await saveWrittenMarks(writtenMarks);
            } catch (error) {
                console.warn('Supabase saveWrittenMarks failed, using localStorage:', error);
                saveData('lms_written_marks', writtenMarks);
            }
        } else {
            saveData('lms_written_marks', writtenMarks);
        }
        const statusEl = document.getElementById(`save-status-${type}-${studentId}`);
        if (statusEl) {
            statusEl.style.display = 'none';
        }
        return;
    }
    
    const markValue = parseFloat(mark);
    if (isNaN(markValue) || markValue < 0 || markValue > 100) {
        const statusEl = document.getElementById(`save-status-${type}-${studentId}`);
        if (statusEl) {
            statusEl.textContent = '✗ Invalid';
            statusEl.style.color = 'var(--danger-color)';
            statusEl.style.display = 'inline';
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 2000);
        }
        return;
    }
    
    writtenMarks[key][type][studentId] = markValue;
    
    // Use API service layer if available
    if (typeof saveWrittenMarks === 'function') {
        try {
            await saveWrittenMarks(writtenMarks);
        } catch (error) {
            console.warn('Supabase saveWrittenMarks failed, using localStorage:', error);
            saveData('lms_written_marks', writtenMarks);
        }
    } else {
        saveData('lms_written_marks', writtenMarks);
    }
    
    // Show save confirmation
    const statusEl = document.getElementById(`save-status-${type}-${studentId}`);
    if (statusEl) {
        statusEl.textContent = '✓ Saved';
        statusEl.style.color = 'var(--success-color)';
        statusEl.style.display = 'inline';
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 2000);
    }
};

// Update BFT point calculation live
window.updateBftPoint = function(type, studentId, mark) {
    const pointEl = document.getElementById(`point_${type}_${studentId}`);
    if (pointEl) {
        const markVal = parseFloat(mark);
        
        // Define percentages
        const examInfo = {
            'opening': 5,
            'bft1': 2.5,
            'bft2': 2.5,
            'bft': 5,
            'mid-course': 20,
            'general-assessment': 5,
            'final-exam': 25
        };
        
        const percentage = examInfo[type.toLowerCase()] || 5;
        
        if (!isNaN(markVal)) {
            pointEl.textContent = (markVal / 100 * percentage).toFixed(2);
        } else {
            pointEl.textContent = '0.00';
        }
    }
};

// Save all marks for a type
window.saveAllMarks = async function(type, subject, className) {
    let users = { students: [] };
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            console.warn('Supabase getUsers failed, using localStorage:', error);
            users = getData('lms_users') || { students: [] };
        }
    } else {
        users = getData('lms_users') || { students: [] };
    }
    
    const students = (users.students || []).filter(s => s.class === className);
    const writtenMarks = typeof getWrittenMarks === 'function' ? await getWrittenMarks() : (getData('lms_written_marks') || {});
    // Use class as key since these are general exams (no subject)
    const key = `general_${className}`;
    
    if (!writtenMarks[key]) {
        writtenMarks[key] = {};
    }
    if (!writtenMarks[key][type]) {
        writtenMarks[key][type] = {};
    }
    
    let savedCount = 0;
    students.forEach(student => {
        const input = document.getElementById(`mark_${type}_${student.id}`);
        if (input && input.value !== '') {
            const markValue = parseFloat(input.value);
            if (!isNaN(markValue) && markValue >= 0 && markValue <= 100) {
                writtenMarks[key][type][student.id] = markValue;
                savedCount++;
            }
        }
    });
    
    // Use API service layer if available
    if (typeof saveWrittenMarks === 'function') {
        try {
            await saveWrittenMarks(writtenMarks);
            showAlert('written-marks', `${savedCount} mark(s) saved successfully`, 'success');
        } catch (error) {
            console.warn('Supabase saveWrittenMarks failed, using localStorage:', error);
            saveData('lms_written_marks', writtenMarks);
            showAlert('written-marks', `${savedCount} mark(s) saved successfully`, 'success');
        }
    } else {
        saveData('lms_written_marks', writtenMarks);
        showAlert('written-marks', `${savedCount} mark(s) saved successfully`, 'success');
    }
};

// Export marks to CSV
window.exportMarks = async function(type, subject, className) {
    let users = { students: [] };
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            console.warn('Supabase getUsers failed, using localStorage:', error);
            users = getData('lms_users') || { students: [] };
        }
    } else {
        users = getData('lms_users') || { students: [] };
    }
    
    const students = (users.students || []).filter(s => s.class === className);
    const writtenMarks = typeof getWrittenMarks === 'function' ? await getWrittenMarks() : (getData('lms_written_marks') || {});
    // Use class as key since these are general exams (no subject)
    const key = `general_${className}`;
    const marks = writtenMarks[key]?.[type] || {};
    
    const examInfo = {
        'opening': 'Opening',
        'bft1': 'BFT 1',
        'bft2': 'BFT 2',
        'mid-course': 'Mid Course Exam',
        'general-assessment': 'General Assessment',
        'final-exam': 'Final Exam'
    };
    
    let csv = `${examInfo[type] || type} Marks\n`;
    csv += `Class: ${className}\n`;
    // csv += `Type: General Exam\n\n`;
    csv += 'Rank,Student Name,Username,Mark\n';
    
    students.forEach((student, index) => {
        const mark = marks[student.id] || '';
        csv += `${index + 1},"${student.fullName || ''}","${student.username || ''}",${mark}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${examInfo[type] || type}_${subject}_${className}_marks.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
};

// Load composite scores
window.loadCompositeScores = async function() {
    const className = document.getElementById('composite-class-select')?.value;
    const container = document.getElementById('composite-scores-container');
    const infoBox = document.getElementById('composite-info-box');
    
    if (!container) return;
    
    if (!className) {
        container.innerHTML = '';
        if (infoBox) infoBox.style.display = 'none';
        return;
    }
    
    // Show info box
    if (infoBox) infoBox.style.display = 'block';
    
    let users = { students: [] };
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            console.warn('Supabase getUsers failed, using localStorage:', error);
            users = getData('lms_users') || { students: [] };
        }
    } else {
        users = getData('lms_users') || { students: [] };
    }
    
    const students = (users.students || []).filter(s => s.class === className);
    
    if (students.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; background: var(--light-color); border-radius: 12px;"><p style="color: var(--text-light); font-size: 1.1rem;">No students found for this class.</p></div>';
        return;
    }
    
    const writtenMarks = typeof getWrittenMarks === 'function' ? await getWrittenMarks() : (getData('lms_written_marks') || {});
    // Use class as key since written exams are general (no subject)
    const key = `general_${className}`;
    const marks = writtenMarks[key] || {};
    
    // Get online quiz results
    const results = typeof getResults === 'function' ? await getResults() : (getData('lms_results') || []);
    const exams = typeof getExams === 'function' ? await getExams() : (getData('lms_exams') || []);
    
    // Get all subjects for this class to calculate composite for each subject
    const courses = typeof getCourses === 'function' ? await getCourses() : (getData('lms_courses') || []);
    const classCourses = courses.filter(c => c.class === className);
    const subjects = [...new Set(classCourses.map(c => c.subject))].sort();
    
    if (subjects.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; background: var(--light-color); border-radius: 12px;"><p style="color: var(--text-light); font-size: 1.1rem;">No subjects found for this class.</p></div>';
        return;
    }
    
    // Calculate composite scores for each subject
    let html = '<div style="display: flex; flex-direction: column; gap: 30px;">';
    
    subjects.forEach(subject => {
        // Find online quizzes for this subject and class
        const madeCourseExerciseExam = exams.find(e => e.subject === subject && e.classes.includes(className) && e.type === 'Made Course Exercise');
        const finalCourseExerciseExam = exams.find(e => e.subject === subject && e.classes.includes(className) && e.type === 'Final Course Exercise');
    
        const compositeScores = [];
        
        students.forEach(student => {
            // Get written marks (same for all subjects since they're general)
            const opening = marks.opening?.[student.id] || 0;
            const bft1 = marks.bft1?.[student.id] || 0;
            const bft2 = marks.bft2?.[student.id] || 0;
            const midCourse = marks['mid-course']?.[student.id] || 0;
            const generalAssessment = marks['general-assessment']?.[student.id] || 0;
            const finalExam = marks['final-exam']?.[student.id] || 0;
            
            // Get online quiz results for this specific subject
            let madeCourseExercise = 0;
            if (madeCourseExerciseExam) {
                const result = results.find(r => r.examId === madeCourseExerciseExam.id && r.studentId === student.id);
                if (result) madeCourseExercise = result.score || 0;
            }
            
            let finalCourseExercise = 0;
            if (finalCourseExerciseExam) {
                const result = results.find(r => r.examId === finalCourseExerciseExam.id && r.studentId === student.id);
                if (result) finalCourseExercise = result.score || 0;
            }
            
            // Get BFT (Try new "bft" first, fallback to bft1 + bft2)
            const bftValue = marks.bft?.[student.id] || marks.BFT?.[student.id];
            let bftComposite = 0;
            if (bftValue !== undefined && bftValue !== null) {
                bftComposite = bftValue * 0.05;
            } else {
                bftComposite = (bft1 * 0.025) + (bft2 * 0.025);
            }

            // Calculate composite score
            const composite = (
                (opening * 0.05) +
                bftComposite +
                (madeCourseExercise * 0.15) +
                (midCourse * 0.20) +
                (generalAssessment * 0.05) +
                (finalCourseExercise * 0.20) +
                (finalExam * 0.25)
            );
            
            const letterGrade = getLetterGrade(composite);
            const gradeColor = getGradeColor(letterGrade);
            
            compositeScores.push({
                studentId: student.id,
                studentName: student.fullName,
                username: student.username,
                subject: subject,
                opening,
                bft1,
                bft2,
                bft: (bft1 + bft2) / 2,
                madeCourseExercise,
                midCourse,
                generalAssessment,
                finalCourseExercise,
                finalExam,
                composite,
                letterGrade,
                gradeColor
            });
        });
        
        // Sort by composite score (descending)
        compositeScores.sort((a, b) => b.composite - a.composite);
        
        // Subject section header
        html += `
            <div style="background: var(--card-bg); border: 2px solid var(--border-color); border-radius: 12px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                    <h3 style="margin: 0; color: var(--primary-color); font-size: 1.4rem;">📚 ${subject}</h3>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn btn-success" onclick="releaseFinalCompositeScores('${subject}', '${className}')" style="font-weight: bold;">
                            📤 Release Results for ${subject}
                        </button>
                        <button class="btn btn-secondary" onclick="exportCompositeScores('${subject}', '${className}')">
                            📄 Export CSV
                        </button>
                    </div>
                </div>
                <div class="table-container" style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--primary-color); color: white;">
                                <th style="padding: 12px; text-align: left; font-weight: bold;">Rank</th>
                                <th style="padding: 12px; text-align: left; font-weight: bold;">Student Name</th>
                                <th style="padding: 12px; text-align: center; font-weight: bold;">Opening<br><small>(5%)</small></th>
                                <th style="padding: 12px; text-align: center; font-weight: bold;">BFT<br><small>(5%)</small></th>
                                <th style="padding: 12px; text-align: center; font-weight: bold;">Made Course<br><small>(15%)</small></th>
                                <th style="padding: 12px; text-align: center; font-weight: bold;">Mid Course<br><small>(20%)</small></th>
                                <th style="padding: 12px; text-align: center; font-weight: bold;">Gen. Assess.<br><small>(5%)</small></th>
                                <th style="padding: 12px; text-align: center; font-weight: bold;">Final Course<br><small>(20%)</small></th>
                                <th style="padding: 12px; text-align: center; font-weight: bold;">Final Exam<br><small>(25%)</small></th>
                                <th style="padding: 12px; text-align: center; font-weight: bold;">Composite<br><small>(100%)</small></th>
                                <th style="padding: 12px; text-align: center; font-weight: bold;">Grade</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        compositeScores.forEach((score, index) => {
            const rowColor = index % 2 === 0 ? 'var(--card-bg)' : 'var(--light-color)';
            html += `
                <tr style="background: ${rowColor}; border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px; font-weight: bold; color: var(--text-color);">${index + 1}</td>
                    <td style="padding: 12px; font-weight: 500; color: var(--text-color);">${score.studentName || 'N/A'}</td>
                    <td style="padding: 12px; text-align: center; color: ${score.opening > 0 ? 'var(--text-color)' : 'var(--text-light)'};">
                        ${score.opening > 0 ? score.opening.toFixed(1) : '<span style="opacity: 0.5;">-</span>'}
                    </td>
                    <td style="padding: 12px; text-align: center; color: ${score.bft > 0 ? 'var(--text-color)' : 'var(--text-light)'};">
                        ${score.bft > 0 ? score.bft.toFixed(1) : '<span style="opacity: 0.5;">-</span>'}
                    </td>
                    <td style="padding: 12px; text-align: center; color: ${score.madeCourseExercise > 0 ? 'var(--text-color)' : 'var(--text-light)'};">
                        ${score.madeCourseExercise > 0 ? score.madeCourseExercise.toFixed(1) : '<span style="opacity: 0.5;">-</span>'}
                    </td>
                    <td style="padding: 12px; text-align: center; color: ${score.midCourse > 0 ? 'var(--text-color)' : 'var(--text-light)'};">
                        ${score.midCourse > 0 ? score.midCourse.toFixed(1) : '<span style="opacity: 0.5;">-</span>'}
                    </td>
                    <td style="padding: 12px; text-align: center; color: ${score.generalAssessment > 0 ? 'var(--text-color)' : 'var(--text-light)'};">
                        ${score.generalAssessment > 0 ? score.generalAssessment.toFixed(1) : '<span style="opacity: 0.5;">-</span>'}
                    </td>
                    <td style="padding: 12px; text-align: center; color: ${score.finalCourseExercise > 0 ? 'var(--text-color)' : 'var(--text-light)'};">
                        ${score.finalCourseExercise > 0 ? score.finalCourseExercise.toFixed(1) : '<span style="opacity: 0.5;">-</span>'}
                    </td>
                    <td style="padding: 12px; text-align: center; color: ${score.finalExam > 0 ? 'var(--text-color)' : 'var(--text-light)'};">
                        ${score.finalExam > 0 ? score.finalExam.toFixed(1) : '<span style="opacity: 0.5;">-</span>'}
                    </td>
                    <td style="padding: 12px; text-align: center;">
                        <strong style="font-size: 1.1rem; color: var(--primary-color);">${score.composite.toFixed(2)}%</strong>
                    </td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="background: ${score.gradeColor}; color: white; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 0.95rem;">${score.letterGrade}</span>
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    container.innerHTML = html;
};

// Release Mid Course Exam results
window.releaseMidCourseExam = function() {
    const subject = document.getElementById('mid-course-subject-select')?.value;
    const className = document.getElementById('mid-course-class-select')?.value;
    
    if (!subject || !className) {
        showAlert('written-marks', 'Please select a subject and class first', 'error');
        return;
    }
    
    showConfirmModal(
        'Release Mid Course Exam Results',
        `Are you sure you want to release Mid Course Exam results for ${subject} - ${className}? Students will be able to view their results.`,
        function() {
            performReleaseMidCourseExam(subject, className);
        }
    );
};

async function performReleaseMidCourseExam(subject, className) {
    const writtenMarks = typeof getWrittenMarks === 'function' ? await getWrittenMarks() : (getData('lms_written_marks') || {});
    // For general exams (no subject), use general_${className} key
    const key = subject ? `${subject}_${className}` : `general_${className}`;
    const marks = writtenMarks[key]?.['mid-course'] || {};
    
    let users = { students: [] };
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            console.warn('Supabase getUsers failed, using localStorage:', error);
            users = getData('lms_users') || { students: [] };
        }
    } else {
        users = getData('lms_users') || { students: [] };
    }
    
    const students = (users.students || []).filter(s => s.class === className);
    const results = typeof getResults === 'function' ? await getResults() : (getData('lms_results') || []);
    const releases = typeof getResultReleases === 'function' ? await getResultReleases() : (getData('lms_result_releases') || {});
    
    // Find or create Mid Course Exam
    const exams = typeof getExams === 'function' ? await getExams() : (getData('lms_exams') || []);
    let midCourseExam = exams.find(e => 
        (!subject || e.subject === subject) && 
        e.classes.includes(className) && 
        e.type === 'Mid Course Exam' &&
        (!subject || !e.subject) // Match general exams if no subject
    );
    
    // If exam doesn't exist, create a placeholder exam for results
    if (!midCourseExam) {
        midCourseExam = {
            id: `mid-course-${subject || 'general'}-${className}-${Date.now()}`,
            title: subject ? `Mid Course Exam - ${subject}` : `Mid Course Exam - ${className}`,
            type: 'Mid Course Exam',
            subject: subject || null,
            classes: [className],
            isWritten: true,
            isGeneral: !subject,
            createdAt: new Date().toISOString()
        };
        exams.push(midCourseExam);
        saveData('lms_exams', exams);
    }
    
    // Create results for students with marks
    let createdCount = 0;
    students.forEach(student => {
        const mark = marks[student.id];
        if (mark !== undefined && mark !== null && mark !== '') {
            // Check if result already exists
            const existingResult = results.find(r => 
                r.examId === midCourseExam.id && 
                r.studentId === student.id
            );
            
            if (!existingResult) {
                const result = {
                    id: `mid-course-${midCourseExam.id}-${student.id}-${Date.now()}`,
                    examId: midCourseExam.id,
                    examTitle: midCourseExam.title,
                    studentId: student.id,
                    studentName: student.fullName,
                    subject: subject || null, // General exam if no subject
                    type: 'Mid Course Exam',
                    score: parseFloat(mark),
                    correctAnswers: 0,
                    totalQuestions: 0,
                    answers: {},
                    submittedAt: new Date().toISOString(),
                    isWritten: true,
                    isReleased: true // Explicitly mark as released
                };
                results.push(result);
                createdCount++;
            } else {
                // Update existing result
                existingResult.score = parseFloat(mark);
                existingResult.isReleased = true; // Ensure it's marked as released
            }
        }
    });
    
    if (typeof saveResults === 'function') {
        await saveResults(results);
    } else {
        saveData('lms_results', results);
    }
    
    // Release results
    if (typeof saveResultRelease === 'function') {
        await saveResultRelease(midCourseExam.id, true);
    } else {
        releases[midCourseExam.id] = true;
        saveData('lms_result_releases', releases);
    }
    
    // Create notifications
    const notifications = getData('lms_notifications') || [];
    students.forEach(student => {
        const mark = marks[student.id];
        if (mark !== undefined && mark !== null && mark !== '') {
            const notification = {
                id: Date.now().toString() + '_' + student.id,
                userId: student.id,
                userType: 'student',
                type: 'result',
                title: 'Mid Course Exam Result Released',
                message: `Your Mid Course Exam result for ${className} has been released. Score: ${mark}%`,
                link: null,
                data: { examId: midCourseExam.id },
                read: false,
                createdAt: new Date().toISOString()
            };
            notifications.push(notification);
        }
    });
    saveData('lms_notifications', notifications);
    
    showAlert('written-marks', `Mid Course Exam results released successfully for ${createdCount} student(s)`, 'success');
    loadResultReleases();
}

// Release Final Composite Scores
window.releaseFinalCompositeScores = function(subject, className) {
    showConfirmModal(
        'Release Final Composite Results',
        `Are you sure you want to release Final Exam composite results for ${subject} - ${className}? This will calculate and release the final composite score (100%) including all components.`,
        function() {
            performReleaseFinalCompositeScores(subject, className);
        }
    );
};

async function performReleaseFinalCompositeScores(subject, className) {
    const writtenMarks = typeof getWrittenMarks === 'function' ? await getWrittenMarks() : (getData('lms_written_marks') || {});
    const key = `${subject}_${className}`;
    const marks = writtenMarks[key] || {};
    
    let users = { students: [] };
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            console.warn('Supabase getUsers failed, using localStorage:', error);
            users = getData('lms_users') || { students: [] };
        }
    } else {
        users = getData('lms_users') || { students: [] };
    }
    
    const students = (users.students || []).filter(s => s.class === className);
    const results = typeof getResults === 'function' ? await getResults() : (getData('lms_results') || []);
    const releases = typeof getResultReleases === 'function' ? await getResultReleases() : (getData('lms_result_releases') || {});
    const exams = typeof getExams === 'function' ? await getExams() : (getData('lms_exams') || []);
    
    // Find online quizzes
    const madeCourseExerciseExam = exams.find(e => e.subject === subject && e.classes.includes(className) && e.type === 'Made Course Exercise');
    const finalCourseExerciseExam = exams.find(e => e.subject === subject && e.classes.includes(className) && e.type === 'Final Course Exercise');
    
    // Find or create Final Exam
    let finalExam = exams.find(e => 
        e.subject === subject && 
        e.classes.includes(className) && 
        e.type === 'Final Exam'
    );
    
    if (!finalExam) {
        finalExam = {
            id: `final-composite-${subject}-${className}-${Date.now()}`,
            title: `Final Exam Composite - ${subject}`,
            type: 'Final Exam',
            subject: subject,
            classes: [className],
            isComposite: true,
            createdAt: new Date().toISOString()
        };
        exams.push(finalExam);
        saveData('lms_exams', exams);
    }
    
    let createdCount = 0;
    const notifications = getData('lms_notifications') || [];
    
    students.forEach(student => {
        // Get written marks
        const opening = marks.opening?.[student.id] || 0;
        const bft1 = marks.bft1?.[student.id] || 0;
        const bft2 = marks.bft2?.[student.id] || 0;
        const midCourse = marks['mid-course']?.[student.id] || 0;
        const generalAssessment = marks['general-assessment']?.[student.id] || 0;
        const finalExamMark = marks['final-exam']?.[student.id] || 0;
        
        // Get online quiz results
        let madeCourseExercise = 0;
        if (madeCourseExerciseExam) {
            const result = results.find(r => r.examId === madeCourseExerciseExam.id && r.studentId === student.id);
            if (result) madeCourseExercise = result.score || 0;
        }
        
        let finalCourseExercise = 0;
        if (finalCourseExerciseExam) {
            const result = results.find(r => r.examId === finalCourseExerciseExam.id && r.studentId === student.id);
            if (result) finalCourseExercise = result.score || 0;
        }
        
        // Calculate composite score
        const composite = (
            (opening * 0.05) +
            (bft1 * 0.025) +
            (bft2 * 0.025) +
            (madeCourseExercise * 0.15) +
            (midCourse * 0.20) +
            (generalAssessment * 0.05) +
            (finalCourseExercise * 0.20) +
            (finalExamMark * 0.25)
        );
        
        // Check if result already exists
        const existingResult = results.find(r => 
            r.examId === finalExam.id && 
            r.studentId === student.id
        );
        
        if (!existingResult) {
            const result = {
                id: Date.now().toString() + '_' + student.id + '_' + Math.random().toString(36).substr(2, 9),
                examId: finalExam.id,
                examTitle: finalExam.title,
                studentId: student.id,
                studentName: student.fullName,
                subject: subject,
                type: 'Final Exam',
                score: Math.round(composite * 100) / 100, // Round to 2 decimal places
                correctAnswers: 0,
                totalQuestions: 0,
                answers: {},
                submittedAt: new Date().toISOString(),
                isComposite: true,
                compositeBreakdown: {
                    opening: opening,
                    bft1: bft1,
                    bft2: bft2,
                    bft: (bft1 + bft2) / 2,
                    madeCourseExercise: madeCourseExercise,
                    midCourse: midCourse,
                    generalAssessment: generalAssessment,
                    finalCourseExercise: finalCourseExercise,
                    finalExam: finalExamMark
                }
            };
            results.push(result);
            createdCount++;
            
            // Create notification
            const notification = {
                id: Date.now().toString() + '_' + student.id,
                userId: student.id,
                userType: 'student',
                type: 'result',
                title: 'Final Exam Result Released',
                message: `Your Final Exam composite result for ${subject} has been released. Score: ${result.score.toFixed(2)}%`,
                link: null,
                data: { examId: finalExam.id },
                read: false,
                createdAt: new Date().toISOString()
            };
            notifications.push(notification);
        } else {
            // Update existing result
            existingResult.score = Math.round(composite * 100) / 100;
            existingResult.compositeBreakdown = {
                opening: opening,
                bft1: bft1,
                bft2: bft2,
                bft: (bft1 + bft2) / 2,
                madeCourseExercise: madeCourseExercise,
                midCourse: midCourse,
                generalAssessment: generalAssessment,
                finalCourseExercise: finalCourseExercise,
                finalExam: finalExamMark
            };
        }
    });
    
    if (typeof saveResults === 'function') {
        await saveResults(results);
    } else {
        saveData('lms_results', results);
    }
    
    if (typeof saveNotification === 'function') {
        for (const notification of notifications) {
            await saveNotification(notification);
        }
    } else {
        saveData('lms_notifications', notifications);
    }
    
    // Release results
    if (typeof saveResultRelease === 'function') {
        await saveResultRelease(finalExam.id, true);
    } else {
        releases[finalExam.id] = true;
        saveData('lms_result_releases', releases);
    }
    
    showAlert('written-marks', `Final Exam composite results released successfully for ${createdCount} student(s)`, 'success');
    loadResultReleases();
}

// Export composite scores to CSV
window.exportCompositeScores = async function(subject, className) {
    const writtenMarks = typeof getWrittenMarks === 'function' ? await getWrittenMarks() : (getData('lms_written_marks') || {});
    const key = subject ? `${subject}_${className}` : `general_${className}`;
    const marks = writtenMarks[key] || {};
    
    let users = { students: [] };
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            console.warn('Supabase getUsers failed, using localStorage:', error);
            users = getData('lms_users') || { students: [] };
        }
    } else {
        users = getData('lms_users') || { students: [] };
    }
    
    const students = (users.students || []).filter(s => s.class === className);
    const results = typeof getResults === 'function' ? await getResults() : (getData('lms_results') || []);
    const exams = typeof getExams === 'function' ? await getExams() : (getData('lms_exams') || []);
    
    const madeCourseExerciseExam = exams.find(e => e.subject === subject && e.classes.includes(className) && e.type === 'Made Course Exercise');
    const finalCourseExerciseExam = exams.find(e => e.subject === subject && e.classes.includes(className) && e.type === 'Final Course Exercise');
    
    let csv = `Final Exam Composite Scores\n`;
    csv += `Subject: ${subject}\n`;
    csv += `Class: ${className}\n\n`;
    csv += 'Rank,Student Name,Username,Opening (5%),BFT (5%),Made Course Exercise (15%),Mid Course Exam (20%),General Assessment (5%),Final Course Exercise (20%),Final Exam (25%),Composite Score (100%),Grade\n';
    
    const compositeScores = [];
    
    students.forEach(student => {
        const opening = marks.opening?.[student.id] || 0;
        const bft1 = marks.bft1?.[student.id] || 0;
        const bft2 = marks.bft2?.[student.id] || 0;
        const midCourse = marks['mid-course']?.[student.id] || 0;
        const generalAssessment = marks['general-assessment']?.[student.id] || 0;
        const finalExamMark = marks['final-exam']?.[student.id] || 0;
        
        let madeCourseExercise = 0;
        if (madeCourseExerciseExam) {
            const result = results.find(r => r.examId === madeCourseExerciseExam.id && r.studentId === student.id);
            if (result) madeCourseExercise = result.score || 0;
        }
        
        let finalCourseExercise = 0;
        if (finalCourseExerciseExam) {
            const result = results.find(r => r.examId === finalCourseExerciseExam.id && r.studentId === student.id);
            if (result) finalCourseExercise = result.score || 0;
        }
        
        const composite = (
            (opening * 0.05) +
            (bft1 * 0.025) +
            (bft2 * 0.025) +
            (madeCourseExercise * 0.15) +
            (midCourse * 0.20) +
            (generalAssessment * 0.05) +
            (finalCourseExercise * 0.20) +
            (finalExamMark * 0.25)
        );
        
        compositeScores.push({
            studentName: student.fullName,
            username: student.username,
            opening,
            bft1,
            bft2,
            madeCourseExercise,
            midCourse,
            generalAssessment,
            finalCourseExercise,
            finalExam: finalExamMark,
            composite,
            letterGrade: getLetterGrade(composite)
        });
    });
    
    compositeScores.sort((a, b) => b.composite - a.composite);
    
    compositeScores.forEach((score, index) => {
        csv += `${index + 1},"${score.studentName || ''}","${score.username || ''}",${score.opening.toFixed(1)},${score.bft1.toFixed(1)},${score.bft2.toFixed(1)},${score.madeCourseExercise.toFixed(1)},${score.midCourse.toFixed(1)},${score.generalAssessment.toFixed(1)},${score.finalCourseExercise.toFixed(1)},${score.finalExam.toFixed(1)},${score.composite.toFixed(2)},${score.letterGrade}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Final_Composite_${subject}_${className}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}
