// Admin Dashboard

document.addEventListener('DOMContentLoaded', async function() {
    const user = getCurrentUser();
    
    if (!user || user.type !== 'admin') {
        window.location.href = 'login.html';
        return;
    }
    
    // Initialize result releases if not exists (fallback for localStorage)
    if (!localStorage.getItem('lms_result_releases')) {
        localStorage.setItem('lms_result_releases', JSON.stringify({}));
    }
    
    // Initialize written marks storage if not exists (fallback for localStorage)
    if (!localStorage.getItem('lms_written_marks')) {
        localStorage.setItem('lms_written_marks', JSON.stringify({}));
    }
    
    try {
        await loadDashboard();
        // Parallel batch 1: independent data sets
        await Promise.allSettled([
            loadClasses(),
            loadCourses(),
            loadUsers(),
            loadPasswordReset(),
            loadResultReleases(),
        ]);
        loadSettings();
        setupForms();
        setupUserForm();
        setupAnnouncementForm();
        // Parallel batch 2: independent content sections
        await Promise.allSettled([
            loadExams(),
            loadAnnouncements(),
            loadMaterials(),
            typeof loadWrittenMarksSection === 'function' ? loadWrittenMarksSection() : Promise.resolve(),
        ]);
        await updateDashboardStats();
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        loadDashboard();
        loadClasses();
        loadCourses();
        loadUsers();
        loadPasswordReset();
        loadResultReleases();
        loadSettings();
        setupForms();
        setupUserForm();
        setupAnnouncementForm();
        loadExams();
        loadAnnouncements();
        loadMaterials();
        updateDashboardStats();
    }
});

async function loadDashboard() {
    // Try Supabase first, fallback to localStorage
    let users, classes, courses, exams, results;
    
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
            classes = await getClasses();
            courses = await getCourses();
            exams = await getExams();
            results = await getResults();
        } catch (error) {
            console.warn('Supabase load failed, using localStorage:', error);
            users = getData('lms_users') || { students: [], lecturers: [] };
            classes = getData('lms_classes') || [];
            courses = getData('lms_courses') || [];
            exams = getData('lms_exams') || [];
            results = getData('lms_results') || [];
        }
    } else {
        // Fallback to localStorage
        users = getData('lms_users') || { students: [], lecturers: [] };
        classes = getData('lms_classes') || [];
        courses = getData('lms_courses') || [];
        exams = getData('lms_exams') || [];
        results = getData('lms_results') || [];
    }
    
    const totalStudentsEl = document.getElementById('totalStudents');
    const totalLecturersEl = document.getElementById('totalLecturers');
    const totalClassesEl = document.getElementById('totalClasses');
    const totalCoursesEl = document.getElementById('totalCourses');
    const totalExamsEl = document.getElementById('totalExams');
    const totalResultsEl = document.getElementById('totalResults');
    
    if (totalStudentsEl) totalStudentsEl.textContent = users.students ? users.students.length : 0;
    if (totalLecturersEl) totalLecturersEl.textContent = users.lecturers ? users.lecturers.length : 0;
    if (totalClassesEl) totalClassesEl.textContent = classes.length;
    if (totalCoursesEl) totalCoursesEl.textContent = courses.length;
    if (totalExamsEl) totalExamsEl.textContent = exams.length;
    if (totalResultsEl) totalResultsEl.textContent = results.length;
    
    // Analyze courses for debugging
    analyzeCourses();
}

function analyzeCourses() {
    const courses = getData('lms_courses') || [];
    
    // Group by class
    const byClass = {};
    courses.forEach(c => {
        const cls = c.class || 'N/A';
        byClass[cls] = (byClass[cls] || 0) + 1;
    });
    
    // Check for duplicates
    const seen = new Map();
    const duplicates = [];
    courses.forEach((c, i) => {
        const key = `${(c.subject || '').toLowerCase()}|${c.class || ''}`;
        if (seen.has(key)) {
            duplicates.push({ index: i, course: c, firstIndex: seen.get(key) });
        } else {
            seen.set(key, i);
        }
    });
    
    // Log analysis to console
    console.log('=== COURSE ANALYSIS ===');
    console.log('Total courses:', courses.length);
    console.log('\nCourses by class:');
    Object.keys(byClass).sort().forEach(cls => {
        console.log(`  ${cls}: ${byClass[cls]}`);
    });
    
    if (duplicates.length > 0) {
        console.log('\n⚠️ Duplicates found:', duplicates.length);
        duplicates.forEach(d => {
            console.log(`  - ${d.course.subject} | ${d.course.class} (index ${d.index}, duplicate of ${d.firstIndex})`);
        });
    } else {
        console.log('\n✓ No duplicates found');
    }
    
    // Show unique subjects per class
    console.log('\nUnique subjects per class:');
    Object.keys(byClass).sort().forEach(cls => {
        const classCourses = courses.filter(c => c.class === cls);
        const subjects = [...new Set(classCourses.map(c => c.subject))];
        console.log(`  ${cls}: ${subjects.length} unique subjects`);
    });
    console.log('======================\n');
}

async function loadClasses() {
    const tbody = document.getElementById('classes-tbody');
    if (!tbody) return;
    
    let classes = [];
    
    // Try Supabase first, fallback to localStorage
    if (typeof getClasses === 'function') {
        try {
            classes = await getClasses();
        } catch (error) {
            console.warn('Supabase loadClasses failed, using localStorage:', error);
            classes = getData('lms_classes') || [];
        }
    } else {
        classes = getData('lms_classes') || [];
    }
    
    const totalClassesEl = document.getElementById('totalClasses');
    if (totalClassesEl) totalClassesEl.textContent = classes.length;

    if (classes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No classes added yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    classes.forEach(cls => {
        if (!cls || !cls.id || !cls.name) return; // Skip invalid entries
        const row = document.createElement('tr');
        row.className = 'class-row';
        row.setAttribute('data-class-name', (cls.name || '').toLowerCase());
        row.innerHTML = `
            <td>${cls.name}</td>
            <td>${cls.created_at || cls.createdAt ? formatDate(cls.created_at || cls.createdAt) : 'N/A'}</td>
            <td>
                <button class="btn-small" onclick="handleEditClass('${cls.id}')">Edit</button>
                <button class="btn-small btn-danger" onclick="handleDeleteClass('${cls.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.filterClasses = function() {
    const searchTerm = (document.getElementById('classSearchInput').value || '').toLowerCase();
    const rows = document.querySelectorAll('.class-row');
    
    rows.forEach(row => {
        const className = row.getAttribute('data-class-name') || '';
        row.style.display = !searchTerm || className.includes(searchTerm) ? '' : 'none';
    });
};

async function loadCourses() {
    const tbody = document.getElementById('courses-tbody');
    const classSelect = document.getElementById('courseClass');
    const subjectsDatalist = document.getElementById('courseSubjectsList');
    
    let courses = [];
    let classes = [];
    
    // Try Supabase first, fallback to localStorage
    if (typeof getCourses === 'function' && typeof getClasses === 'function') {
        try {
            courses = await getCourses();
            classes = await getClasses();
        } catch (error) {
            console.warn('Supabase loadCourses failed, using localStorage:', error);
            courses = getData('lms_courses') || [];
            classes = getData('lms_classes') || [];
        }
    } else {
        courses = getData('lms_courses') || [];
        classes = getData('lms_classes') || [];
    }
    
    // Populate form class dropdown
    if (classSelect) {
        classSelect.innerHTML = '<option value="">-- Select Class --</option>';
        const sortedClasses = [...classes].filter(cls => cls && cls.name).sort((a, b) => {
            return (a.name || '').localeCompare(b.name || '');
        });
        sortedClasses.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.name;
            option.textContent = cls.name;
            classSelect.appendChild(option);
        });
    }
    
    // Populate subject datalist with existing subjects
    if (subjectsDatalist) {
        subjectsDatalist.innerHTML = '';
        const uniqueSubjects = [...new Set(courses.map(c => c.subject).filter(s => s))];
        uniqueSubjects.sort().forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            subjectsDatalist.appendChild(option);
        });
    }
    
    const totalCoursesEl = document.getElementById('totalCourses');
    if (totalCoursesEl) totalCoursesEl.textContent = courses.length;

    if (!tbody) return;

    if (courses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No courses added yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    courses.forEach(course => {
        if (!course || !course.id || !course.subject) return; // Skip invalid entries
        const row = document.createElement('tr');
        row.className = 'course-row';
        row.setAttribute('data-course-subject', (course.subject || '').toLowerCase());
        row.setAttribute('data-course-class', (course.class || '').toLowerCase());
        row.innerHTML = `
            <td>${course.subject}</td>
            <td>${course.class || 'N/A'}</td>
            <td>${course.created_at || course.createdAt ? formatDate(course.created_at || course.createdAt) : 'N/A'}</td>
            <td>
                <button class="btn-small" onclick="handleEditCourse('${course.id}')">Edit</button>
                <button class="btn-small btn-danger" onclick="handleDeleteCourse('${course.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadUsers() {
    const studentsTbody = document.getElementById('students-tbody');
    const lecturersTbody = document.getElementById('lecturers-tbody');
    
    let users = { students: [], lecturers: [] };
    
    // Try Supabase first, fallback to localStorage
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            console.warn('Supabase loadUsers failed, using localStorage:', error);
            users = getData('lms_users') || { students: [], lecturers: [] };
        }
    } else {
        users = getData('lms_users') || { students: [], lecturers: [] };
    }

    const totalStudentsEl = document.getElementById('totalStudents');
    const totalLecturersEl = document.getElementById('totalLecturers');
    if (totalStudentsEl) totalStudentsEl.textContent = users.students ? users.students.length : 0;
    if (totalLecturersEl) totalLecturersEl.textContent = users.lecturers ? users.lecturers.length : 0;

    // Load students
    if (studentsTbody) {
        if (!users.students || users.students.length === 0) {
            studentsTbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No students registered</td></tr>';
        } else {
            studentsTbody.innerHTML = '';
            users.students.forEach(student => {
                if (!student || !student.id) return; // Skip invalid entries
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${student.rank || 'N/A'}</td>
                    <td>${student.full_name || student.fullName || 'N/A'}</td>
                    <td>${student.username || 'N/A'}</td>
                    <td>${student.telephone || 'N/A'}</td>
                    <td>${student.email || 'N/A'}</td>
                    <td>${student.class || 'Not assigned'}</td>
                    <td>${student.subjects && student.subjects.length > 0 ? student.subjects.join(', ') : 'None'}</td>
                    <td>${student.registered_at || student.registeredAt ? formatDate(student.registered_at || student.registeredAt) : 'N/A'}</td>
                    <td>
                        <button class="btn-small" onclick="handleEditUser('student', '${student.id}')">Edit</button>
                        <button class="btn-small btn-warning" onclick="resetPassword('student', '${student.id}')">Reset Password</button>
                        <button class="btn-small btn-danger" onclick="handleDeleteUser('student', '${student.id}')">Delete</button>
                    </td>
                `;
                studentsTbody.appendChild(row);
            });
        }
    }
    
    // Load lecturers
    if (lecturersTbody) {
        if (!users.lecturers || users.lecturers.length === 0) {
            lecturersTbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No lecturers registered</td></tr>';
        } else {
            lecturersTbody.innerHTML = '';
            users.lecturers.forEach(lecturer => {
                if (!lecturer || !lecturer.id) return; // Skip invalid entries
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${lecturer.rank || 'N/A'}</td>
                    <td>${lecturer.full_name || lecturer.fullName || 'N/A'}</td>
                    <td>${lecturer.username || 'N/A'}</td>
                    <td>${lecturer.telephone || 'N/A'}</td>
                    <td>${lecturer.email || 'N/A'}</td>
                    <td>${lecturer.subjects && lecturer.subjects.length > 0 ? lecturer.subjects.join(', ') : 'N/A'}</td>
                    <td>${lecturer.classes && lecturer.classes.length > 0 ? lecturer.classes.join(', ') : 'N/A'}</td>
                    <td>${lecturer.registered_at || lecturer.registeredAt ? formatDate(lecturer.registered_at || lecturer.registeredAt) : 'N/A'}</td>
                    <td>
                        <button class="btn-small" onclick="handleEditUser('lecturer', '${lecturer.id}')">Edit</button>
                        <button class="btn-small btn-warning" onclick="resetPassword('lecturer', '${lecturer.id}')">Reset Password</button>
                        <button class="btn-small btn-danger" onclick="handleDeleteUser('lecturer', '${lecturer.id}')">Delete</button>
                    </td>
                `;
                lecturersTbody.appendChild(row);
            });
        }
    }
}

async function loadPasswordReset() {
    let users = {};
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            users = getData('lms_users') || { students: [], lecturers: [] };
        }
    } else {
        users = getData('lms_users') || { students: [], lecturers: [] };
    }
    const studentsTbody = document.getElementById('password-students-tbody');
    const lecturersTbody = document.getElementById('password-lecturers-tbody');
    
    // Load students for password reset
    if (studentsTbody) {
        if (!users.students || users.students.length === 0) {
            studentsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No students registered</td></tr>';
        } else {
            studentsTbody.innerHTML = '';
            users.students.forEach(student => {
                if (!student || !student.id) return; // Skip invalid entries
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${student.rank || 'N/A'}</td>
                    <td>${student.fullName || 'N/A'}</td>
                    <td>${student.username || 'N/A'}</td>
                    <td>${student.telephone || 'N/A'}</td>
                    <td>${student.class || 'Not assigned'}</td>
                    <td>
                        <button class="btn-small btn-warning" onclick="resetPassword('student', '${student.id}')">Reset Password</button>
                    </td>
                `;
                studentsTbody.appendChild(row);
            });
        }
    }
    
    // Load lecturers for password reset
    if (lecturersTbody) {
        if (!users.lecturers || users.lecturers.length === 0) {
            lecturersTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No lecturers registered</td></tr>';
        } else {
            lecturersTbody.innerHTML = '';
            users.lecturers.forEach(lecturer => {
                if (!lecturer || !lecturer.id) return; // Skip invalid entries
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${lecturer.rank || 'N/A'}</td>
                    <td>${lecturer.fullName || 'N/A'}</td>
                    <td>${lecturer.username || 'N/A'}</td>
                    <td>${lecturer.telephone || 'N/A'}</td>
                    <td>${lecturer.email || 'N/A'}</td>
                    <td>
                        <button class="btn-small btn-warning" onclick="resetPassword('lecturer', '${lecturer.id}')">Reset Password</button>
                    </td>
                `;
                lecturersTbody.appendChild(row);
            });
        }
    }
}

window.resetPassword = function(userType, userId) {
    showPromptModal(
        'Reset Password',
        `Enter new password for this ${userType}:`,
        'New password (min 6 characters)',
        function(newPassword) {
    if (!newPassword || newPassword.length < 6) {
                showAlertModal('Error', 'Password must be at least 6 characters long');
        return;
    }
    
            showConfirmModal(
                'Confirm Password Reset',
                `Are you sure you want to reset the password for this ${userType}?`,
                function() {
                    performPasswordReset(userType, userId, newPassword);
                }
            );
        }
    );
}

async function performPasswordReset(userType, userId, newPassword) {
    try {
        if (typeof resetUserPassword === 'function') {
            await resetUserPassword(userId, newPassword);
            showAlert('password', `Password reset successfully. New password: ${newPassword}`, 'success');
        } else {
            // Fallback to localStorage
            const users = getData('lms_users') || { students: [], lecturers: [] };
            let userFound = false;
            if (userType === 'student') {
                const student = users.students.find(s => s && s.id === userId);
                if (student) {
                    student.password = newPassword;
                    userFound = true;
                }
            } else if (userType === 'lecturer') {
                const lecturer = users.lecturers.find(l => l && l.id === userId);
                if (lecturer) {
                    lecturer.password = newPassword;
                    userFound = true;
                }
            }
            
            if (userFound) {
                saveData('lms_users', users);
                showAlert('password', `Password reset successfully. New password: ${newPassword}`, 'success');
            } else {
                throw new Error('User not found');
            }
        }
        
        loadPasswordReset();
        loadUsers();
    } catch (error) {
        console.error('Error resetting password:', error);
        showAlert('password', 'Failed to reset password: ' + (error.message || 'Unknown error'), 'error');
    }
}

async function loadResultReleases() {
    let exams = [];
    let results = [];
    let releases = {};
    
    // Try Supabase first, fallback to localStorage
    if (typeof getExams === 'function' && typeof getResults === 'function' && typeof getResultReleases === 'function') {
        try {
            exams = await getExams();
            results = await getResults();
            releases = await getResultReleases();
        } catch (error) {
            console.warn('Supabase loadResultReleases failed, using localStorage:', error);
            exams = getData('lms_exams') || [];
            results = getData('lms_results') || [];
            releases = getData('lms_result_releases') || {};
        }
    } else {
        exams = getData('lms_exams') || [];
        results = getData('lms_results') || [];
        releases = getData('lms_result_releases') || {};
    }
    
    // Group exams by type
    const midExams = exams.filter(e => e && e.type === 'Mid Semester');
    const finalExams = exams.filter(e => e && e.type === 'Final Exam');
    
    // Load Mid Semester results
    loadResultTable('mid', midExams, results, releases);
    
    // Load Final Exam results
    loadResultTable('final', finalExams, results, releases);
    
    // Load All results
    loadResultTable('all', exams, results, releases);
    
    // Load Mid Course Exam release section
    await loadMidCourseExamReleaseSection();
}

// Load Mid Course Exam release section
async function loadMidCourseExamReleaseSection() {
    const classSelect = document.getElementById('mid-course-release-class-select');
    if (!classSelect) return;
    
    let classes = [];
    
    // Try Supabase first, fallback to localStorage
    if (typeof getClasses === 'function') {
        try {
            classes = await getClasses();
        } catch (error) {
            console.warn('Supabase loadMidCourseExamReleaseSection failed, using localStorage:', error);
            classes = getData('lms_classes') || [];
        }
    } else {
        classes = getData('lms_classes') || [];
    }
    
    classSelect.innerHTML = '<option value="">-- Select Class --</option>';
    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.name;
        option.textContent = cls.name;
        classSelect.appendChild(option);
    });
}

// Load Mid Course Exams for release
window.loadMidCourseExamsForRelease = function() {
    const className = document.getElementById('mid-course-release-class-select')?.value;
    const container = document.getElementById('mid-course-release-container');
    
    if (!container) return;
    
    if (!className) {
        container.innerHTML = '';
        return;
    }
    
    const writtenMarks = getData('lms_written_marks') || {};
    const key = `general_${className}`;
    const marks = writtenMarks[key]?.['mid-course'] || {};
    const releases = getData('lms_result_releases') || {};
    const results = getData('lms_results') || [];
    const exams = getData('lms_exams') || [];
    
    // Find or create Mid Course Exam
    let midCourseExam = exams.find(e => 
        e.classes.includes(className) && 
        e.type === 'Mid Course Exam' &&
        !e.subject // General exam
    );
    
    const hasMarks = Object.keys(marks).length > 0;
    const isReleased = midCourseExam ? releases[midCourseExam.id] === true : false;
    
    if (!hasMarks) {
        container.innerHTML = `
            <div style="background: var(--light-color); padding: 20px; border-radius: 8px; text-align: center;">
                <p style="color: var(--text-light); margin: 0;">No Mid Course Exam marks entered yet for ${className}.</p>
                <p style="color: var(--text-light); margin: 10px 0 0 0; font-size: 0.9rem;">Please enter marks in the "Enter Written Exam Marks" section first.</p>
            </div>
        `;
        return;
    }
    
    const users = getData('lms_users') || { students: [] };
    const students = (users.students || []).filter(s => s.class === className);
    const studentsWithMarks = students.filter(s => marks[s.id] !== undefined && marks[s.id] !== null && marks[s.id] !== '');
    
    let html = `
        <div style="background: var(--light-color); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div>
                    <h4 style="margin: 0; color: var(--primary-color);">Mid Course Exam - ${className}</h4>
                    <p style="margin: 5px 0 0 0; color: var(--text-light);">
                        ${studentsWithMarks.length} student(s) with marks entered
                    </p>
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                    <span class="status-badge ${isReleased ? 'status-active' : 'status-completed'}" style="font-size: 0.95rem; padding: 8px 15px;">
                        ${isReleased ? '● RELEASED' : '● NOT RELEASED'}
                    </span>
                    ${!isReleased ? `
                        <button class="btn btn-success" onclick="releaseMidCourseExamForClass('${className}')" style="font-weight: bold;">
                            📤 Release Mid Course Exam Results
                        </button>
                    ` : `
                        <button class="btn btn-danger" onclick="hideMidCourseExamForClass('${className}')" style="font-weight: bold;">
                            👁️ Hide Mid Course Exam Results
                        </button>
                    `}
                </div>
            </div>
        </div>
        <div class="table-container">
            <table style="width: 100%;">
                <thead>
                    <tr style="background: var(--primary-color); color: white;">
                        <th style="padding: 12px; text-align: left;">Rank</th>
                        <th style="padding: 12px; text-align: left;">Student Name</th>
                        <th style="padding: 12px; text-align: center;">Score</th>
                        <th style="padding: 12px; text-align: center;">Grade</th>
                        <th style="padding: 12px; text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    const sortedStudents = [...studentsWithMarks].sort((a, b) => {
        const scoreA = marks[a.id] || 0;
        const scoreB = marks[b.id] || 0;
        return scoreB - scoreA;
    });
    
    sortedStudents.forEach((student, index) => {
        const score = marks[student.id] || 0;
        const letterGrade = getLetterGrade(score);
        const gradeColor = getGradeColor(letterGrade);
        const hasResult = midCourseExam ? results.some(r => r.examId === midCourseExam.id && r.studentId === student.id) : false;
        
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px; font-weight: bold;">${index + 1}</td>
                <td style="padding: 12px;">${student.fullName || 'N/A'}</td>
                <td style="padding: 12px; text-align: center; font-weight: bold; color: var(--primary-color);">${score.toFixed(1)}%</td>
                <td style="padding: 12px; text-align: center;">
                    <span style="background: ${gradeColor}; color: white; padding: 4px 10px; border-radius: 4px; font-weight: bold;">${letterGrade}</span>
                </td>
                <td style="padding: 12px; text-align: center;">
                    ${hasResult && isReleased ? '<span style="color: var(--success-color);">✓ Released</span>' : '<span style="color: var(--text-light);">Not Released</span>'}
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
};

// Release Mid Course Exam for a class
window.releaseMidCourseExamForClass = function(className) {
    showConfirmModal(
        'Release Mid Course Exam Results',
        `Are you sure you want to release Mid Course Exam results for ${className}? Students will be able to view their results in the student portal.`,
        function() {
            if (typeof performReleaseMidCourseExam === 'function') {
                performReleaseMidCourseExam(null, className);
            } else {
                // Fallback: use the function from admin-written-marks.js
                const writtenMarks = getData('lms_written_marks') || {};
                const key = `general_${className}`;
                const marks = writtenMarks[key]?.['mid-course'] || {};
                
                if (Object.keys(marks).length === 0) {
                    showAlert('results', 'No marks entered yet. Please enter marks first.', 'error');
                    return;
                }
                
                const users = getData('lms_users') || { students: [] };
                const students = (users.students || []).filter(s => s.class === className);
                const results = getData('lms_results') || [];
                const releases = getData('lms_result_releases') || {};
                const exams = getData('lms_exams') || [];
                
                let midCourseExam = exams.find(e => 
                    e.classes.includes(className) && 
                    e.type === 'Mid Course Exam' &&
                    !e.subject
                );
                
                if (!midCourseExam) {
                    midCourseExam = {
                        id: `mid-course-general-${className}-${Date.now()}`,
                        title: `Mid Course Exam - ${className}`,
                        type: 'Mid Course Exam',
                        subject: null,
                        classes: [className],
                        isWritten: true,
                        isGeneral: true,
                        createdAt: new Date().toISOString()
                    };
                    exams.push(midCourseExam);
                    saveData('lms_exams', exams);
                }
                
                let createdCount = 0;
                let updatedCount = 0;
                students.forEach(student => {
                    const mark = marks[student.id];
                    if (mark !== undefined && mark !== null && mark !== '') {
                        const existingResult = results.find(r => 
                            r.examId === midCourseExam.id && 
                            r.studentId === student.id
                        );
                        
                        if (!existingResult) {
                            const result = {
                                id: `mid-course-${midCourseExam.id}-${student.id}-${Date.now()}`,
                                examId: midCourseExam.id,
                                examTitle: midCourseExam.title || `Mid Course Exam - ${className}`,
                                studentId: student.id,
                                studentName: student.fullName,
                                subject: null,
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
                            existingResult.score = parseFloat(mark);
                            existingResult.isReleased = true; // Ensure it's marked as released
                            updatedCount++;
                        }
                    }
                });
                
                saveData('lms_results', results);
                releases[midCourseExam.id] = true;
                saveData('lms_result_releases', releases);
                
                // Create notifications
                const notifications = getData('lms_notifications') || [];
                students.forEach(student => {
                    const mark = marks[student.id];
                    if (mark !== undefined && mark !== null && mark !== '') {
                        // Check if notification already exists
                        const existingNotif = notifications.find(n => 
                            n.userId === student.id && 
                            n.type === 'result' &&
                            n.data && n.data.examId === midCourseExam.id
                        );
                        
                        if (!existingNotif) {
                            const notification = {
                                id: `mid-course-notif-${midCourseExam.id}-${student.id}-${Date.now()}`,
                                userId: student.id,
                                userType: 'student',
                                type: 'result',
                                title: 'Mid Course Exam Result Released',
                                message: `Your Mid Course Exam result for ${className} has been released. Score: ${mark.toFixed(1)}%`,
                                link: null,
                                data: { examId: midCourseExam.id, resultId: results.find(r => r.examId === midCourseExam.id && r.studentId === student.id)?.id },
                                read: false,
                                createdAt: new Date().toISOString()
                            };
                            notifications.push(notification);
                        }
                    }
                });
                saveData('lms_notifications', notifications);
                
                const totalAffected = createdCount + updatedCount;
                showAlert('results', `Mid Course Exam results released successfully for ${totalAffected} student(s)`, 'success');
            }
            loadMidCourseExamsForRelease();
            loadResultReleases();
        }
    );
};

// Hide Mid Course Exam for a class
window.hideMidCourseExamForClass = function(className) {
    const exams = getData('lms_exams') || [];
    const midCourseExam = exams.find(e => 
        e.classes.includes(className) && 
        e.type === 'Mid Course Exam' &&
        !e.subject
    );
    
    if (!midCourseExam) {
        showAlert('results', 'Mid Course Exam not found', 'error');
        return;
    }
    
    showConfirmModal(
        'Hide Mid Course Exam Results',
        `Are you sure you want to hide Mid Course Exam results for ${className}? Students will no longer be able to view these results.`,
        function() {
            const releases = getData('lms_result_releases') || {};
            releases[midCourseExam.id] = false;
            saveData('lms_result_releases', releases);
            showAlert('results', 'Mid Course Exam results hidden successfully', 'success');
            loadMidCourseExamsForRelease();
            loadResultReleases();
        }
    );
};

function loadResultTable(tabType, exams, results, releases) {
    const tbody = document.getElementById(`results-${tabType}-tbody`);
    if (!tbody) return;
    
    if (!exams || exams.length === 0) {
        const colspan = tabType === 'all' ? '7' : '6';
        tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center;">No exams found</td></tr>`;
        return;
    }
    
    tbody.innerHTML = '';
    
    exams.forEach(exam => {
        if (!exam || !exam.id) return; // Skip invalid entries
        const examResults = results.filter(r => r && r.examId === exam.id);
        const isReleased = releases[exam.id] === true;
        
        const row = document.createElement('tr');
        const typeCell = ''; // tabType === 'all' ? `<td>${exam.type || 'N/A'}</td>` : '';
        row.innerHTML = `
            <td>${exam.title || 'Untitled Exam'}</td>
            ${typeCell}
            <td>${exam.subject || 'N/A'}</td>
            <td>${exam.classes && exam.classes.length > 0 ? exam.classes.join(', ') : 'N/A'}</td>
            <td>${examResults.length}</td>
            <td>
                <span class="status-badge ${isReleased ? 'status-active' : 'status-completed'}">
                    ${isReleased ? '● RELEASED' : '● HIDDEN'}
                </span>
            </td>
            <td>
                ${isReleased 
                    ? `<button class="btn-small btn-danger" onclick="toggleResultRelease('${exam.id}', false)">Hide</button>`
                    : `<button class="btn-small btn-success" onclick="toggleResultRelease('${exam.id}', true)">Release</button>`
                }
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.toggleResultRelease = async function(examId, release) {
    // Use API service layer
    if (typeof saveResultRelease === 'function') {
        try {
            await saveResultRelease(examId, release);
            const action = release ? 'released' : 'hidden';
            showAlert('results', `Results ${action} successfully. Students ${release ? 'can' : 'cannot'} now view these results.`, 'success');
        } catch (error) {
            console.warn('Supabase saveResultRelease failed, using localStorage:', error);
            const releases = getData('lms_result_releases') || {};
            releases[examId] = release;
            saveData('lms_result_releases', releases);
            const action = release ? 'released' : 'hidden';
            showAlert('results', `Results ${action} successfully. Students ${release ? 'can' : 'cannot'} now view these results.`, 'success');
        }
    } else {
        const releases = getData('lms_result_releases') || {};
        releases[examId] = release;
        saveData('lms_result_releases', releases);
        const action = release ? 'released' : 'hidden';
        showAlert('results', `Results ${action} successfully. Students ${release ? 'can' : 'cannot'} now view these results.`, 'success');
    }
    
    await loadResultReleases();
}

window.showResultTab = function(tab) {
    // Hide all result tabs
    document.querySelectorAll('#results-section .user-tab').forEach(t => {
        t.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('#results-section .nav-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const targetTab = document.getElementById(`results-${tab}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Add active class to clicked button
    const clickedBtn = event && event.target ? event.target : 
                      document.querySelector(`#results-section .tab-btn[onclick*="showResultTab('${tab}')"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
}

window.showPasswordTab = function(tab) {
    // Hide all password tabs
    document.querySelectorAll('#password-reset-section .user-tab').forEach(t => {
        t.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('#password-reset-section .nav-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const targetTab = document.getElementById(`password-${tab}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Add active class to clicked button
    const clickedBtn = event && event.target ? event.target : 
                      document.querySelector(`#password-reset-section .tab-btn[onclick*="showPasswordTab('${tab}')"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
}

window.bulkReleaseResults = function(examType, release) {
    console.log('bulkReleaseResults called:', examType, release);
    try {
        if (typeof showConfirmModal !== 'function') {
            console.error('showConfirmModal is not a function');
            alert(`Are you sure you want to ${release ? 'release' : 'hide'} all ${examType} results?`);
            performBulkReleaseResults(examType, release);
            return;
        }
        showConfirmModal(
            'Confirm Bulk Action',
            `Are you sure you want to ${release ? 'release' : 'hide'} all ${examType} results?`,
            function() {
                console.log('Confirmed bulk release:', examType, release);
                performBulkReleaseResults(examType, release);
            }
        );
    } catch (e) {
        console.error('Error in bulkReleaseResults:', e);
        alert('Error: ' + e.message);
    }
}

function performBulkReleaseResults(examType, release) {
    console.log('performBulkReleaseResults called:', examType, release);
    try {
        const exams = getData('lms_exams') || [];
        const releases = getData('lms_result_releases') || {};
        const results = getData('lms_results') || [];
        const users = getData('lms_users') || { students: [] };
        const notifications = getData('lms_notifications') || [];
        
        console.log('Total exams:', exams.length);
        console.log('Looking for exam type:', examType);
        
        // Handle different naming variations
        let typeExams = [];
        if (examType === 'Mid Semester') {
            // Match Mid Semester, Mid Course Exam, Mid Semester Exam, etc.
            typeExams = exams.filter(e => e && (
                e.type === 'Mid Semester' || 
                e.type === 'Mid Course Exam' ||
                e.type === 'Mid Semester Exam' ||
                e.type === 'Mid-Course Exam' ||
                (e.type && e.type.toLowerCase().includes('mid'))
            ));
        } else if (examType === 'Final Exam') {
            // Match Final Exam, Final, Final Composite, etc.
            typeExams = exams.filter(e => e && (
                e.type === 'Final Exam' ||
                e.type === 'Final' ||
                e.type === 'Final Composite' ||
                (e.type && e.type.toLowerCase().includes('final'))
            ));
        } else {
            // Exact match
            typeExams = exams.filter(e => e && e.type === examType);
        }
        
        console.log('Found exams with type', examType + ':', typeExams.length);
        console.log('Matching exams:', typeExams.map(e => ({ id: e.id, title: e.title, type: e.type })));
        console.log('All exam types in system:', [...new Set(exams.map(e => e.type).filter(Boolean))]);
        
        let count = 0;
        let notificationsCreated = 0;
    
    typeExams.forEach(exam => {
        const wasReleased = releases[exam.id];
        releases[exam.id] = release;
        
        // Create notifications when results are released
        if (release && !wasReleased) {
            const examResults = results.filter(r => r && r.examId === exam.id);
            
            examResults.forEach(result => {
                const student = users.students.find(s => s && s.id === result.studentId);
                if (!student) return;
                
                // Check if notification already exists
                const alreadyNotified = notifications.some(n => 
                    n.userId === student.id && 
                    n.type === 'result' && 
                    n.data && 
                    n.data.resultId === result.id
                );
                
                if (!alreadyNotified) {
                    const examTitle = exam.title || 'Exam';
                    const notification = {
                        id: Date.now().toString() + '_' + result.id + '_' + Math.random().toString(36).substr(2, 9),
                        userId: student.id,
                        userType: 'student',
                        type: 'result',
                        title: 'Result Released',
                        message: `Your result for ${examTitle} has been released. Score: ${result.score || 0}%`,
                        link: null,
                        data: { resultId: result.id, examId: exam.id },
                        read: false,
                        createdAt: new Date().toISOString()
                    };
                    
                    notifications.push(notification);
                    notificationsCreated++;
                }
            });
        }
        
        count++;
    });
    
    saveData('lms_result_releases', releases);
    if (notificationsCreated > 0) {
        saveData('lms_notifications', notifications);
        // Trigger badge update if notification system is loaded
        if (typeof updateNotificationBadge === 'function') {
            setTimeout(updateNotificationBadge, 100);
        }
    }
    
        const action = release ? 'released' : 'hidden';
        const notifyMsg = notificationsCreated > 0 ? ` ${notificationsCreated} notification(s) sent.` : '';
        console.log(`Bulk release complete: ${count} ${examType} result(s) ${action}`);
        showAlert('results', `${count} ${examType} result(s) ${action} successfully.${notifyMsg}`, 'success');
        
        loadResultReleases();
    } catch (e) {
        console.error('Error in performBulkReleaseResults:', e);
        alert('Error releasing results: ' + e.message);
    }
}

function loadSettings() {
    console.log('loadSettings called');
    try {
        // Load system settings (print toggle)
        if (typeof loadSystemSettings === 'function') {
            loadSystemSettings();
        }
        
        // Load one-time registration keys
        loadRegistrationKeys();
        
        console.log('Settings loaded successfully');
    } catch (e) {
        console.error('Error loading settings:', e);
    }
}

async function loadRegistrationKeys() {
    const tbody = document.getElementById('registration-keys-tbody');
    if (!tbody) return;
    
    try {
        const keys = await getRegistrationKeys();
        
        if (!keys || keys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No active registration keys</td></tr>';
        } else {
            tbody.innerHTML = '';
            keys.forEach(k => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><code style="background: var(--light-color); padding: 5px 10px; border-radius: 4px; font-weight: bold;">${k.key}</code></td>
                    <td>${new Date(k.createdAt).toLocaleString()}</td>
                    <td>
                        <button class="btn-small btn-danger" onclick="handleDeleteRegistrationKey('${k.key}')">Revoke</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error loading keys:', error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Error loading keys</td></tr>';
    }
}

window.generateRegistrationKey = async function() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = 'LECT-';
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 4; j++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < 1) key += '-';
    }
    
    try {
        const keyData = {
            key: key,
            createdAt: new Date().toISOString()
        };
        
        await saveRegistrationKey(keyData);
        await loadRegistrationKeys();
        showAlert('settings', `Generated new key: ${key}`, 'success');
    } catch (error) {
        console.error('Error generating key:', error);
        showAlert('settings', 'Failed to generate key. Please try again.', 'error');
    }
};

window.handleDeleteRegistrationKey = async function(keyToDelete) {
    if (!confirm('Are you sure you want to revoke this registration key? It will no longer be valid for registration.')) return;
    
    try {
        await deleteRegistrationKey(keyToDelete);
        await loadRegistrationKeys();
        showAlert('settings', 'Registration key revoked successfully', 'success');
    } catch (error) {
        console.error('Error deleting key:', error);
        showAlert('settings', 'Failed to revoke key. Please try again.', 'error');
    }
};

function setupForms() {
    // Class form
    const classForm = document.getElementById('classForm');
    if (classForm) {
        classForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const classId = document.getElementById('classId').value;
            const className = document.getElementById('className').value;
            
            // Get classes for validation
            let classes = [];
            if (typeof getClasses === 'function') {
                try {
                    classes = await getClasses();
                } catch (error) {
                    classes = getData('lms_classes') || [];
                }
            } else {
                classes = getData('lms_classes') || [];
            }
            
            if (classId) {
                // Editing existing class
                // Check if name already exists (excluding current class)
                if (classes.some(c => c && c.id !== classId && c.name && c.name.toLowerCase() === className.toLowerCase())) {
                    showAlert('classes', 'Class name already exists', 'error');
                    return;
                }
                
                // Try Supabase first
                if (typeof updateClass === 'function') {
                    try {
                        await updateClass(classId, className);
                        showAlert('classes', 'Class updated successfully', 'success');
                        cancelClassEdit();
                        await loadClasses();
                        await loadCourses();
                        return;
                    } catch (error) {
                        console.warn('Supabase updateClass failed, using localStorage:', error);
                    }
                }
                
                // Fallback to localStorage
                const classIndex = classes.findIndex(c => c && c.id === classId);
                if (classIndex !== -1) {
                    classes[classIndex].name = className;
                    saveData('lms_classes', classes);
                    showAlert('classes', 'Class updated successfully', 'success');
                    cancelClassEdit();
                }
            } else {
                // Adding new class
                if (classes.some(c => c && c.name && c.name.toLowerCase() === className.toLowerCase())) {
                    showAlert('classes', 'Class already exists', 'error');
                    return;
                }
                
                // Try Supabase first
                if (typeof saveClass === 'function') {
                    try {
                        await saveClass(className);
                        showAlert('classes', 'Class added successfully', 'success');
                        document.getElementById('className').value = '';
                        await loadClasses();
                        await loadCourses();
                        return;
                    } catch (error) {
                        console.warn('Supabase saveClass failed, using localStorage:', error);
                    }
                }
                
                // Fallback to localStorage
                classes.push({
                    id: Date.now().toString(),
                    name: className,
                    createdAt: new Date().toISOString()
                });
                saveData('lms_classes', classes);
                showAlert('classes', 'Class added successfully', 'success');
                document.getElementById('className').value = '';
            }
            
            await loadClasses();
            await loadCourses(); // Reload to update class dropdown
        });
    }
    
    // Course form
    const courseForm = document.getElementById('courseForm');
    if (courseForm) {
        courseForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const courseId = document.getElementById('courseId').value;
            const subject = document.getElementById('courseSubject').value;
            const courseClass = document.getElementById('courseClass').value;
            
            // Get courses for validation
            let courses = [];
            if (typeof getCourses === 'function') {
                try {
                    courses = await getCourses();
                } catch (error) {
                    courses = getData('lms_courses') || [];
                }
            } else {
                courses = getData('lms_courses') || [];
            }
            
            if (courseId) {
                // Editing existing course
                // Check if course already exists (excluding current course)
                if (courses.some(c => c && c.id !== courseId && c.subject && c.subject.toLowerCase() === subject.toLowerCase() && c.class === courseClass)) {
                    showAlert('courses', 'Course already exists for this class', 'error');
                    return;
                }
                
                // Try Supabase first
                if (typeof updateCourse === 'function') {
                    try {
                        await updateCourse(courseId, { subject, class: courseClass });
                        showAlert('courses', 'Course updated successfully', 'success');
                        cancelCourseEdit();
                        await loadCourses();
                        return;
                    } catch (error) {
                        console.warn('Supabase updateCourse failed, using localStorage:', error);
                    }
                }
                
                // Fallback to localStorage
                const courseIndex = courses.findIndex(c => c && c.id === courseId);
                if (courseIndex !== -1) {
                    courses[courseIndex].subject = subject;
                    courses[courseIndex].class = courseClass;
                    saveData('lms_courses', courses);
                    showAlert('courses', 'Course updated successfully', 'success');
                    cancelCourseEdit();
                }
            } else {
                // Adding new course
                if (courses.some(c => c && c.subject && c.subject.toLowerCase() === subject.toLowerCase() && c.class === courseClass)) {
                    showAlert('courses', 'Course already exists for this class', 'error');
                    return;
                }
                
                // Try Supabase first
                if (typeof saveCourse === 'function') {
                    try {
                        await saveCourse({ subject, class: courseClass });
                        showAlert('courses', 'Course added successfully', 'success');
                        document.getElementById('courseForm').reset();
                        await loadCourses();
                        return;
                    } catch (error) {
                        console.warn('Supabase saveCourse failed, using localStorage:', error);
                    }
                }
                
                // Fallback to localStorage
                courses.push({
                    id: Date.now().toString(),
                    subject,
                    class: courseClass,
                    createdAt: new Date().toISOString()
                });
                saveData('lms_courses', courses);
                showAlert('courses', 'Course added successfully', 'success');
                document.getElementById('courseForm').reset();
            }
            
            await loadCourses(); // This will also update the subjects datalist
        });
    }
    
    // Settings form handler removed (global key deprecated)
}

window.handleDeleteClass = function(classId) {
    showConfirmModal(
        'Delete Class',
        'Are you sure you want to delete this class? This action cannot be undone.',
        function() {
            performDeleteClass(classId);
        }
    );
}

async function performDeleteClass(classId) {
    // Try Supabase first (using window.deleteClass to avoid dashboard-local conflict)
    if (typeof window.deleteClass === 'function') {
        try {
            await window.deleteClass(classId);
            showAlert('classes', 'Class deleted successfully', 'success');
            await loadClasses();
            await loadCourses();
            return;
        } catch (error) {
            console.warn('Supabase deleteClass failed:', error);
        }
    }
    
    // Fallback to localStorage
    const classes = getData('lms_classes') || [];
    const filtered = classes.filter(c => c && c.id !== classId);
    saveData('lms_classes', filtered);
    
    showAlert('classes', 'Class deleted successfully', 'success');
    await loadClasses();
    await loadCourses(); // Reload to update class dropdown
}

window.handleDeleteCourse = function(courseId) {
    showConfirmModal(
        'Delete Course',
        'Are you sure you want to delete this course? This action cannot be undone.',
        function() {
            performDeleteCourse(courseId);
        }
    );
}

async function performDeleteCourse(courseId) {
    // Try Supabase first (using window.deleteCourse to avoid dashboard-local conflict)
    if (typeof window.deleteCourse === 'function') {
        try {
            await window.deleteCourse(courseId);
            showAlert('courses', 'Course deleted successfully', 'success');
            await loadCourses();
            return;
        } catch (error) {
            console.warn('Supabase deleteCourse failed:', error);
        }
    }
    
    // Fallback to localStorage
    const courses = getData('lms_courses') || [];
    const filtered = courses.filter(c => c && c.id !== courseId);
    saveData('lms_courses', filtered);
    
    showAlert('courses', 'Course deleted successfully', 'success');
    await loadCourses();
}

// Make functions globally accessible
window.showSection = function(section) {
    console.log('showSection called with:', section);
    
    // Hide all sections
    document.querySelectorAll('.tab-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none'; // Ensure hidden
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.nav-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(section + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block'; // Ensure visible
        console.log('Showing section:', section + '-section');
    } else {
        console.error('Section not found:', section + '-section');
    }
    
    // Load written marks section if needed
    if (section === 'written-marks' && typeof loadWrittenMarksSection === 'function') {
        loadWrittenMarksSection();
    }
    
    // Add active class to clicked button
    const clickedBtn = event && event.target ? event.target : 
                      document.querySelector(`.tab-btn[onclick*="showSection('${section}')"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // Reload data when switching sections
    if (section === 'users') {
        loadUsers();
    } else if (section === 'password-reset') {
        loadPasswordReset();
    } else if (section === 'results') {
        loadResultReleases();
    } else if (section === 'classes') {
        loadClasses();
    } else if (section === 'courses') {
        loadCourses();
    } else if (section === 'settings') {
        console.log('Loading settings...');
        try {
            loadSettings();
            updateDashboardStats();
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    } else if (section === 'exams') {
        console.log('Loading exams...');
        try {
            loadExams();
        } catch (e) {
            console.error('Error loading exams:', e);
        }
    } else if (section === 'announcements') {
        console.log('Loading announcements...');
        try {
            // Ensure form is set up
            if (typeof setupAnnouncementForm === 'function') {
                setupAnnouncementForm();
            }
            loadAnnouncements();
        } catch (e) {
            console.error('Error loading announcements:', e);
        }
    } else if (section === 'materials') {
        console.log('Loading materials...');
        try {
            loadMaterials();
        } catch (e) {
            console.error('Error loading materials:', e);
        }
    }
    
    // Reinitialize table sorting after loading data
    setTimeout(() => {
        if (typeof initTableSorting === 'function') {
            initTableSorting();
        }
    }, 300);
}

window.showUserTab = function(tab) {
    // Hide all user tabs
    document.querySelectorAll('#users-section .user-tab').forEach(t => {
        t.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('#users-section .nav-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const targetTab = document.getElementById(tab + '-tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Add active class to clicked button
    const clickedBtn = event && event.target ? event.target : 
                      document.querySelector(`#users-section .tab-btn[onclick*="showUserTab('${tab}')"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
}

function showAlert(container, message, type) {
    const alertContainer = document.getElementById(`alert-container-${container}`);
    if (!alertContainer) return;
    
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

window.reinitializeCourseData = function() {
    const message = 'This will reinitialize all course data with official Signals Training School courses. This will add:\n\n- SIGNALS BASIC\n- SIGNALS B III – B II\n- SIGNALS B II – B I\n- SUPERINTENDENT\n- PRE-QUALIFYING\n- REGIMENTAL BASIC\n- REGIMENTAL B III – B II\n- REGIMENTAL B II – B I\n- RSO / RSI\n- ELECTRONIC WARFARE COURSE\n- TACTICAL DRONE COURSE\n\nContinue?';
    showConfirmModal(
        'Reinitialize Course Data',
        message,
        function() {
            performReinitializeCourseData();
        }
    );
}

function performReinitializeCourseData() {
    
    // Call the reinitialize function from init-sample-data.js
    if (typeof window.reinitializeCourseData === 'function') {
        window.reinitializeCourseData();
    } else {
        // If function not available, reload page after clearing flag
        localStorage.removeItem('sample_data_initialized');
        showAlert('settings', 'Course data will be reinitialized on next page load. Refreshing...', 'info');
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
}

window.logout = function() {
    clearCurrentUser();
    window.location.href = 'login.html';
}

// Modal Utility Functions
window.showConfirmModal = function(title, message, onConfirm) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
    const modal = document.getElementById('confirmModal');
    modal.style.display = 'block';
    
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');
    
    // Remove old listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    newConfirmBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    });
    
    newCancelBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
};

window.showAlertModal = function(title, message) {
    document.getElementById('alertModalTitle').textContent = title;
    document.getElementById('alertModalMessage').textContent = message;
    const modal = document.getElementById('alertModal');
    modal.style.display = 'block';
    
    const okBtn = document.getElementById('alertModalOk');
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    newOkBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
};

window.showPromptModal = function(title, message, placeholder, onConfirm) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmModalTitle').textContent = title;
    
    // Create input field
    const messageEl = document.getElementById('confirmModalMessage');
    messageEl.innerHTML = `<p>${message}</p><input type="text" id="promptInput" placeholder="${placeholder || ''}" style="width: 100%; padding: 8px; margin-top: 10px;" required>`;
    
    modal.style.display = 'block';
    
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');
    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    newConfirmBtn.addEventListener('click', function() {
        const input = document.getElementById('promptInput');
        if (input && input.value) {
            modal.style.display = 'none';
            if (onConfirm) onConfirm(input.value);
        }
    });
    
    newCancelBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    // Focus input
    setTimeout(() => {
        const input = document.getElementById('promptInput');
        if (input) input.focus();
    }, 100);
};

// Edit Class
window.handleEditClass = async function(classId) {
    let classes = [];
    if (typeof getClasses === 'function') {
        try {
            classes = await getClasses();
        } catch (error) {
            classes = getData('lms_classes') || [];
        }
    } else {
        classes = getData('lms_classes') || [];
    }
    
    const cls = classes.find(c => c && c.id === classId);
    if (!cls) return;
    
    document.getElementById('classId').value = cls.id;
    document.getElementById('className').value = cls.name;
    document.getElementById('classSubmitBtn').textContent = 'Update Class';
    document.getElementById('classCancelBtn').style.display = 'inline-block';
};

window.cancelClassEdit = function() {
    document.getElementById('classId').value = '';
    document.getElementById('className').value = '';
    document.getElementById('classSubmitBtn').textContent = 'Add Class';
    document.getElementById('classCancelBtn').style.display = 'none';
};

// Edit Course
window.handleEditCourse = async function(courseId) {
    let courses = [];
    if (typeof getCourses === 'function') {
        try {
            courses = await getCourses();
        } catch (error) {
            courses = getData('lms_courses') || [];
        }
    } else {
        courses = getData('lms_courses') || [];
    }
    
    const course = courses.find(c => c && c.id === courseId);
    if (!course) return;
    
    document.getElementById('courseId').value = course.id;
    document.getElementById('courseSubject').value = course.subject;
    document.getElementById('courseClass').value = course.class;
    document.getElementById('courseSubmitBtn').textContent = 'Update Course';
    document.getElementById('courseCancelBtn').style.display = 'inline-block';
};

window.cancelCourseEdit = function() {
    document.getElementById('courseId').value = '';
    document.getElementById('courseForm').reset();
    document.getElementById('courseSubmitBtn').textContent = 'Add Course';
    document.getElementById('courseCancelBtn').style.display = 'none';
};

// Bulk Course Import
window.openBulkCourseModal = async function() {
    const modal = document.getElementById('bulkCourseModal');
    const select = document.getElementById('bulkCourseClass');
    if (!modal || !select) return;

    // Populate class dropdown
    select.innerHTML = '<option value="">-- Select Class --</option>';
    try {
        const classes = await getClasses();
        [...classes].filter(c => c && c.name).sort((a, b) => a.name.localeCompare(b.name)).forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls.name;
            opt.textContent = cls.name;
            select.appendChild(opt);
        });
    } catch (e) { console.warn('Could not load classes for bulk modal', e); }

    document.getElementById('bulkCourseNames').value = '';
    document.getElementById('bulk-course-alert').innerHTML = '';
    document.getElementById('bulkCourseProgress').style.display = 'none';
    document.getElementById('bulkProgressBar').style.width = '0%';
    document.getElementById('bulkImportBtn').disabled = false;
    modal.style.display = 'block';
};

window.closeBulkCourseModal = function() {
    const modal = document.getElementById('bulkCourseModal');
    if (modal) modal.style.display = 'none';
};

window.runBulkCourseImport = async function() {
    const className = document.getElementById('bulkCourseClass').value.trim();
    const raw = document.getElementById('bulkCourseNames').value;
    const alertEl = document.getElementById('bulk-course-alert');
    const progressWrap = document.getElementById('bulkCourseProgress');
    const bar = document.getElementById('bulkProgressBar');
    const progressText = document.getElementById('bulkProgressText');
    const btn = document.getElementById('bulkImportBtn');

    if (!className) {
        alertEl.innerHTML = '<div class="alert alert-error">Please select a class first.</div>';
        return;
    }

    const names = raw.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    if (names.length === 0) {
        alertEl.innerHTML = '<div class="alert alert-error">Please enter at least one course name.</div>';
        return;
    }

    btn.disabled = true;
    alertEl.innerHTML = '';
    progressWrap.style.display = 'block';

    let added = 0, skipped = 0, failed = 0;

    for (let i = 0; i < names.length; i++) {
        const subject = names[i];
        const pct = Math.round(((i + 1) / names.length) * 100);
        bar.style.width = pct + '%';
        progressText.textContent = `Processing ${i + 1} of ${names.length}: ${subject}`;

        try {
            await saveCourse({ subject, class: className });
            added++;
        } catch (err) {
            const msg = (err && err.message) || '';
            if (msg.toLowerCase().includes('conflict') || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
                skipped++;
            } else {
                console.warn('Failed to add course:', subject, err);
                failed++;
            }
        }
    }

    bar.style.width = '100%';
    progressText.textContent = '';
    invalidateCache('courses');
    await loadCourses();
    updateDashboardStats();

    const parts = [];
    if (added > 0) parts.push(`<strong>${added}</strong> added`);
    if (skipped > 0) parts.push(`<strong>${skipped}</strong> already existed (skipped)`);
    if (failed > 0) parts.push(`<strong>${failed}</strong> failed`);

    alertEl.innerHTML = `<div class="alert alert-success">Import complete — ${parts.join(', ')}.</div>`;
    btn.disabled = false;
};

// User Management
window.showAddUserModal = function(userType) {
    const modal = document.getElementById('addUserModal');
    const title = document.getElementById('addUserModalTitle');
    const form = document.getElementById('addUserForm');
    
    document.getElementById('addUserType').value = userType;
    document.getElementById('addUserId').value = '';
    form.reset();
    
    if (userType === 'student') {
        title.textContent = 'Add Student';
        document.getElementById('addUserClassGroup').style.display = 'block';
        document.getElementById('addUserPrintGroup').style.display = 'block';
        document.getElementById('addUserSubjectsGroup').style.display = 'none';
        document.getElementById('addUserLecturerClassesGroup').style.display = 'none';
        document.getElementById('addUserCanPrint').checked = false;
        
        // Populate class dropdown
        const classSelect = document.getElementById('addUserClass');
        classSelect.innerHTML = '<option value="">-- Select Class --</option>';
        const classes = getData('lms_classes') || [];
        const sortedClasses = [...classes].filter(cls => cls && cls.name).sort((a, b) => {
            return (a.name || '').localeCompare(b.name || '');
        });
        sortedClasses.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.name;
            option.textContent = cls.name;
            classSelect.appendChild(option);
        });
    } else {
        title.textContent = 'Add Lecturer';
        document.getElementById('addUserClassGroup').style.display = 'none';
        document.getElementById('addUserPrintGroup').style.display = 'none';
        document.getElementById('addUserSubjectsGroup').style.display = 'block';
        document.getElementById('addUserLecturerClassesGroup').style.display = 'block';
    }
    
    // Reset button text
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Save User';
    
    modal.style.display = 'block';
};

window.handleEditUser = async function(userType, userId) {
    let users = {};
    if (typeof getUsers === 'function') {
        try {
            users = await getUsers();
        } catch (error) {
            users = getData('lms_users') || { students: [], lecturers: [] };
        }
    } else {
        users = getData('lms_users') || { students: [], lecturers: [] };
    }
    
    let user = null;
    
    if (userType === 'student') {
        user = users.students.find(s => s && s.id === userId);
    } else {
        user = users.lecturers.find(l => l && l.id === userId);
    }
    
    if (!user) return;
    
    const modal = document.getElementById('addUserModal');
    const title = document.getElementById('addUserModalTitle');
    
    document.getElementById('addUserType').value = userType;
    document.getElementById('addUserId').value = user.id;
    document.getElementById('addUserRank').value = user.rank || '';
    document.getElementById('addUserFullName').value = user.fullName || user.full_name || '';
    document.getElementById('addUserUsername').value = user.username || '';
    document.getElementById('addUserPassword').value = user.password || '';
    document.getElementById('addUserTelephone').value = user.telephone || '';
    document.getElementById('addUserEmail').value = user.email || '';
    
    if (userType === 'student') {
        title.textContent = 'Edit Student';
        document.getElementById('addUserClassGroup').style.display = 'block';
        document.getElementById('addUserPrintGroup').style.display = 'block';
        document.getElementById('addUserSubjectsGroup').style.display = 'none';
        document.getElementById('addUserLecturerClassesGroup').style.display = 'none';
        document.getElementById('addUserClass').value = user.class || '';
        document.getElementById('addUserCanPrint').checked = (user.canPrintResults === true || user.can_print_results === true);
        
        // Populate class dropdown
        const classSelect = document.getElementById('addUserClass');
        classSelect.innerHTML = '<option value="">-- Select Class --</option>';
        let classes = [];
        if (typeof getClasses === 'function') {
            try {
                classes = await getClasses();
            } catch (error) {
                classes = getData('lms_classes') || [];
            }
        } else {
            classes = getData('lms_classes') || [];
        }
        const sortedClasses = [...classes].filter(cls => cls && cls.name).sort((a, b) => {
            return (a.name || '').localeCompare(b.name || '');
        });
        sortedClasses.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.name;
            option.textContent = cls.name;
            classSelect.appendChild(option);
        });
        classSelect.value = user.class || '';
    } else {
        title.textContent = 'Edit Lecturer';
        document.getElementById('addUserClassGroup').style.display = 'none';
        document.getElementById('addUserPrintGroup').style.display = 'none';
        document.getElementById('addUserSubjectsGroup').style.display = 'block';
        document.getElementById('addUserLecturerClassesGroup').style.display = 'block';
        document.getElementById('addUserSubjects').value = user.subjects ? user.subjects.join(', ') : '';
        document.getElementById('addUserLecturerClasses').value = user.classes ? user.classes.join(', ') : '';
    }
    
    // Change button text
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Update User';
    
    modal.style.display = 'block';
};

window.handleDeleteUser = function(userType, userId) {
    showConfirmModal(
        'Delete User',
        `Are you sure you want to delete this ${userType}? This action cannot be undone.`,
        function() {
            performDeleteUser(userType, userId);
        }
    );
}

async function performDeleteUser(userType, userId) {
    // Try Supabase first (using window.deleteUser to avoid dashboard-local conflict)
    if (typeof window.deleteUser === 'function') {
        try {
            await window.deleteUser(userId, userType);
            showAlert('users', `${userType.charAt(0).toUpperCase() + userType.slice(1)} deleted successfully`, 'success');
            await loadUsers();
            loadPasswordReset();
            return;
        } catch (error) {
            console.warn('Supabase deleteUser failed:', error);
        }
    }
    
    // Fallback to localStorage
    const users = getData('lms_users') || { students: [], lecturers: [] };
    
    if (userType === 'student') {
        users.students = users.students.filter(s => s && s.id !== userId);
    } else {
        users.lecturers = users.lecturers.filter(l => l && l.id !== userId);
    }
    
    saveData('lms_users', users);
    showAlert('users', `${userType.charAt(0).toUpperCase() + userType.slice(1)} deleted successfully`, 'success');
    await loadUsers();
    loadPasswordReset();
};

function setupUserForm() {
    const form = document.getElementById('addUserForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const userType = document.getElementById('addUserType').value;
        const userId = document.getElementById('addUserId').value;
        const rank = document.getElementById('addUserRank').value;
        const fullName = document.getElementById('addUserFullName').value;
        const username = document.getElementById('addUserUsername').value;
        const password = document.getElementById('addUserPassword').value;
        const telephone = document.getElementById('addUserTelephone').value;
        const email = document.getElementById('addUserEmail').value;
        
        if (!rank || !fullName || !username || !password || password.length < 6) {
            showAlert('add-user', 'Please fill all required fields. Password must be at least 6 characters.', 'error');
            return;
        }
        
        // Get users for validation
        let users = { students: [], lecturers: [] };
        if (typeof getUsers === 'function') {
            try {
                users = await getUsers();
            } catch (error) {
                users = getData('lms_users') || { students: [], lecturers: [] };
            }
        } else {
            users = getData('lms_users') || { students: [], lecturers: [] };
        }
        
        if (userType === 'student') {
            const classValue = document.getElementById('addUserClass').value;
            const canPrint = document.getElementById('addUserCanPrint').checked;
            
            if (userId) {
                // Edit existing student
                // Check username uniqueness (excluding current user)
                if (users.students.some(s => s && s.id !== userId && s.username === username)) {
                    showAlert('add-user', 'Username already exists', 'error');
                    return;
                }
                
                // Try Supabase first
                if (typeof updateUser === 'function') {
                    try {
                        await updateUser(userId, 'student', {
                            rank,
                            fullName,
                            username,
                            password,
                            telephone,
                            email,
                            telephone,
                            email,
                            class: classValue,
                            can_print_results: canPrint
                        });
                        showAlert('add-user', 'Student updated successfully', 'success');
                        closeModal('addUserModal');
                        await loadUsers();
                        await loadPasswordReset();
                        await loadDashboard();
                        return;
                    } catch (error) {
                        console.warn('Supabase updateUser failed, using localStorage:', error);
                    }
                }
                
                // Fallback to localStorage
                const studentIndex = users.students.findIndex(s => s && s.id === userId);
                if (studentIndex !== -1) {
                    users.students[studentIndex] = {
                        ...users.students[studentIndex],
                        rank,
                        fullName,
                        username,
                        password,
                        telephone,
                        email,
                        email,
                        class: classValue,
                        canPrintResults: canPrint
                    };
                    saveData('lms_users', users);
                    showAlert('add-user', 'Student updated successfully', 'success');
                }
            } else {
                // Add new student
                if (users.students.some(s => s && s.username === username)) {
                    showAlert('add-user', 'Username already exists', 'error');
                    return;
                }
                
                const newStudent = {
                    rank,
                    fullName,
                    username,
                    password,
                    telephone,
                    email,
                    email,
                    class: classValue,
                    can_print_results: canPrint,
                    type: 'student',
                    registeredAt: new Date().toISOString()
                };
                
                // Try Supabase first
                if (typeof saveUser === 'function') {
                    try {
                        await saveUser(newStudent);
                        showAlert('add-user', 'Student added successfully', 'success');
                        closeModal('addUserModal');
                        await loadUsers();
                        await loadPasswordReset();
                        await loadDashboard();
                        return;
                    } catch (error) {
                        console.warn('Supabase saveUser failed, using localStorage:', error);
                    }
                }
                
                // Fallback to localStorage
                newStudent.id = Date.now().toString();
                users.students.push(newStudent);
                saveData('lms_users', users);
                showAlert('add-user', 'Student added successfully', 'success');
            }
        } else {
            const subjects = document.getElementById('addUserSubjects').value.split(',').map(s => s.trim()).filter(s => s);
            const lecturerClasses = document.getElementById('addUserLecturerClasses').value.split(',').map(c => c.trim()).filter(c => c);
            
            if (userId) {
                // Edit existing lecturer
                // Check username uniqueness
                if (users.lecturers.some(l => l && l.id !== userId && l.username === username)) {
                    showAlert('add-user', 'Username already exists', 'error');
                    return;
                }
                
                // Try Supabase first
                if (typeof updateUser === 'function') {
                    try {
                        await updateUser(userId, 'lecturer', {
                            rank,
                            fullName,
                            username,
                            password,
                            telephone,
                            email,
                            subjects,
                            classes: lecturerClasses
                        });
                        showAlert('add-user', 'Lecturer updated successfully', 'success');
                        closeModal('addUserModal');
                        await loadUsers();
                        await loadPasswordReset();
                        await loadDashboard();
                        return;
                    } catch (error) {
                        console.warn('Supabase updateUser failed, using localStorage:', error);
                    }
                }
                
                // Fallback to localStorage
                const lecturerIndex = users.lecturers.findIndex(l => l && l.id === userId);
                if (lecturerIndex !== -1) {
                    users.lecturers[lecturerIndex] = {
                        ...users.lecturers[lecturerIndex],
                        rank,
                        fullName,
                        username,
                        password,
                        telephone,
                        email,
                        subjects,
                        classes: lecturerClasses
                    };
                    saveData('lms_users', users);
                    showAlert('add-user', 'Lecturer updated successfully', 'success');
                }
            } else {
                // Add new lecturer
                if (users.lecturers.some(l => l && l.username === username)) {
                    showAlert('add-user', 'Username already exists', 'error');
                    return;
                }
                
                const newLecturer = {
                    rank,
                    fullName,
                    username,
                    password,
                    telephone,
                    email,
                    subjects,
                    classes: lecturerClasses,
                    type: 'lecturer',
                    registeredAt: new Date().toISOString()
                };
                
                // Try Supabase first
                if (typeof saveUser === 'function') {
                    try {
                        await saveUser(newLecturer);
                        showAlert('add-user', 'Lecturer added successfully', 'success');
                        closeModal('addUserModal');
                        await loadUsers();
                        await loadPasswordReset();
                        await loadDashboard();
                        return;
                    } catch (error) {
                        console.warn('Supabase saveUser failed, using localStorage:', error);
                    }
                }
                
                // Fallback to localStorage
                newLecturer.id = Date.now().toString();
                users.lecturers.push(newLecturer);
                saveData('lms_users', users);
                showAlert('add-user', 'Lecturer added successfully', 'success');
            }
        }
        
        closeModal('addUserModal');
        await loadUsers();
        await loadPasswordReset();
        await loadDashboard();
    });
}

// Exam Management
async function loadExams() {
    const tbody = document.getElementById('exams-tbody');
    if (!tbody) return;
    
    let exams = [];
    let users = { lecturers: [] };
    
    // Try Supabase first, fallback to localStorage
    if (typeof getExams === 'function' && typeof getUsers === 'function') {
        try {
            exams = await getExams();
            users = await getUsers();
        } catch (error) {
            console.warn('Supabase loadExams failed, using localStorage:', error);
            exams = getData('lms_exams') || [];
            users = getData('lms_users') || { lecturers: [] };
        }
    } else {
        exams = getData('lms_exams') || [];
        users = getData('lms_users') || { lecturers: [] };
    }
    
    const totalExamsEl = document.getElementById('totalExams');
    if (totalExamsEl) totalExamsEl.textContent = exams.length;

    if (exams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No exams found</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    exams.forEach(exam => {
        if (!exam || !exam.id) return;
        
        const lecturer = users.lecturers.find(l => l && l.id === exam.lecturer_id || l && l.id === exam.lecturerId);
        const lecturerName = lecturer ? (lecturer.full_name || lecturer.fullName) : 'Unknown';
        
        const startTime = exam.start_time || exam.startTime ? new Date(exam.start_time || exam.startTime) : null;
        const endTime = startTime ? new Date(startTime.getTime() + (exam.duration || 0) * 60 * 1000) : null;
        const now = new Date();
        const isActive = startTime && now >= startTime && now <= endTime;
        const isUpcoming = startTime && now < startTime;
        const isPast = endTime && now > endTime;
        
        let status = 'N/A';
        if (isActive) status = '<span class="status-badge status-active">● ACTIVE</span>';
        else if (isUpcoming) status = '<span class="status-badge status-upcoming">● UPCOMING</span>';
        else if (isPast) status = '<span class="status-badge status-completed">● COMPLETED</span>';
        
        const row = document.createElement('tr');
        row.className = 'exam-row';
        row.setAttribute('data-exam-title', (exam.title || '').toLowerCase());
        row.setAttribute('data-exam-type', exam.type || '');
        row.innerHTML = `
            <td>${exam.title || 'Untitled Exam'}</td>
            <!-- <td>${exam.type || 'N/A'}</td> -->
            <td>${exam.subject || 'N/A'}</td>
            <td>${exam.classes && exam.classes.length > 0 ? exam.classes.join(', ') : 'N/A'}</td>
            <td>${lecturerName}</td>
            <td>${exam.start_time || exam.startTime ? formatDate(exam.start_time || exam.startTime) : 'Not set'}</td>
            <td>${exam.duration ? formatDuration(exam.duration) : 'N/A'}</td>
            <td>${exam.questions ? exam.questions.length : 0}</td>
            <td>${status}</td>
            <td>
                <button class="btn-small" onclick="viewExamResults('${exam.id}')">View Results</button>
                <button class="btn-small btn-danger" onclick="deleteExam('${exam.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.filterExams = function() {
    const searchTerm = (document.getElementById('examSearchInput').value || '').toLowerCase();
    const filterType = document.getElementById('examFilterType').value || '';
    const rows = document.querySelectorAll('.exam-row');
    
    rows.forEach(row => {
        const title = row.getAttribute('data-exam-title') || '';
        const type = row.getAttribute('data-exam-type') || '';
        
        const matchesSearch = !searchTerm || title.includes(searchTerm);
        const matchesType = !filterType || type === filterType;
        
        row.style.display = matchesSearch && matchesType ? '' : 'none';
    });
};

window.deleteExam = function(examId) {
    showConfirmModal(
        'Delete Exam',
        'Are you sure you want to delete this exam? All associated results will also be deleted. This action cannot be undone.',
        function() {
            performDeleteExam(examId);
        }
    );
}

function performDeleteExam(examId) {
    
    const exams = getData('lms_exams') || [];
    const results = getData('lms_results') || [];
    
    // Delete exam
    const filteredExams = exams.filter(e => e && e.id !== examId);
    saveData('lms_exams', filteredExams);
    
    // Delete associated results
    const filteredResults = results.filter(r => r && r.examId !== examId);
    saveData('lms_results', filteredResults);
    
    // Remove from releases
    const releases = getData('lms_result_releases') || {};
    delete releases[examId];
    saveData('lms_result_releases', releases);
    
    showAlert('exams', 'Exam and associated results deleted successfully', 'success');
    loadExams();
    loadResultReleases();
    loadDashboard();
};

window.viewExamResults = function(examId) {
    const results = getData('lms_results') || [];
    const users = getData('lms_users') || { students: [] };
    const exams = getData('lms_exams') || [];
    const exam = exams.find(e => e && e.id === examId);
    const examResults = results.filter(r => r && r.examId === examId);
    
    if (examResults.length === 0) {
        showAlertModal('No Results', 'No results found for this exam.');
        return;
    }
    
    // Show detailed results modal
    showDetailedResults(exam, examResults, users);
};

window.currentExamId = null;

function showDetailedResults(exam, examResults, users) {
    window.currentExamId = exam.id;
    const modal = document.getElementById('resultDetailsModal');
    const title = document.getElementById('resultDetailsModalTitle');
    const content = document.getElementById('resultDetailsContent');
    
    title.textContent = `Results: ${exam.title || 'Untitled Exam'}`;
    
    // Sort results by score (descending)
    const sortedResults = [...examResults].sort((a, b) => (b.score || 0) - (a.score || 0));
    
    let html = `
        <div style="margin-bottom: 15px;">
            <p><strong>Subject:</strong> ${exam.subject || 'N/A'}</p>
            <!-- <p><strong>Type:</strong> ${exam.type || 'N/A'}</p> -->
            <p><strong>Classes:</strong> ${exam.classes && exam.classes.length > 0 ? exam.classes.join(', ') : 'N/A'}</p>
            <p><strong>Total Submissions:</strong> ${examResults.length}</p>
        </div>
        <table class="result-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Student Name</th>
                    <th>Username</th>
                    <th>Class</th>
                    <th>Score</th>
                    <th>Grade</th>
                    <th>Submitted</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedResults.forEach((result, index) => {
        const student = users.students.find(s => s && s.id === result.studentId);
        const studentName = student ? student.fullName : 'Unknown';
        const username = student ? student.username : 'N/A';
        const studentClass = student ? student.class : 'N/A';
        const score = result.score || 0;
        const grade = getLetterGrade(score);
        const gradeColor = getGradeColor(grade);
        const submittedAt = result.submittedAt ? formatDate(result.submittedAt) : 'N/A';
        
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${studentName}</td>
                <td>${username}</td>
                <td>${studentClass}</td>
                <td>${score}%</td>
                <td style="color: ${gradeColor}; font-weight: bold;">${grade}</td>
                <td>${submittedAt}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    content.innerHTML = html;
    modal.style.display = 'block';
}

window.exportExamResults = function() {
    if (!window.currentExamId) return;
    
    const results = getData('lms_results') || [];
    const users = getData('lms_users') || { students: [] };
    const exams = getData('lms_exams') || [];
    const exam = exams.find(e => e && e.id === window.currentExamId);
    const examResults = results.filter(r => r && r.examId === window.currentExamId);
    
    if (!exam || examResults.length === 0) {
        showAlertModal('Error', 'No results to export.');
        return;
    }
    
    let csv = `Exam: ${exam.title || 'Untitled'}\n`;
    csv += `Subject: ${exam.subject || 'N/A'}\n`;
    // csv += `Type: ${exam.type || 'N/A'}\n\n`;
    csv += 'Rank,Student Name,Username,Class,Score,Grade,Submitted\n';
    
    const sortedResults = [...examResults].sort((a, b) => (b.score || 0) - (a.score || 0));
    
    sortedResults.forEach((result, index) => {
        const student = users.students.find(s => s && s.id === result.studentId);
        const studentName = student ? student.fullName : 'Unknown';
        const username = student ? student.username : 'N/A';
        const studentClass = student ? student.class : 'N/A';
        const score = result.score || 0;
        const grade = getLetterGrade(score);
        const submittedAt = result.submittedAt || '';
        
        csv += `${index + 1},"${studentName}","${username}","${studentClass}",${score},"${grade}","${submittedAt}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam_results_${(exam.title || 'exam').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showAlertModal('Success', 'Results exported successfully!');
};

// Result Management - Enhanced
window.viewDetailedResults = function(examId) {
    showSection('results');
    // Could open a modal or navigate to detailed results view
    showAlert('results', 'Viewing detailed results for exam: ' + examId, 'info');
};

// Announcement Management
async function loadAnnouncements() {
    const tbody = document.getElementById('announcements-tbody');
    if (!tbody) return;
    
    let announcements = [];
    
    // Try Supabase first, fallback to localStorage
    if (typeof getAnnouncements === 'function') {
        try {
            announcements = await getAnnouncements();
        } catch (error) {
            console.warn('Supabase loadAnnouncements failed, using localStorage:', error);
            announcements = getData('lms_announcements') || [];
        }
    } else {
        announcements = getData('lms_announcements') || [];
    }
    
    if (announcements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No announcements found</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    announcements.forEach(announcement => {
        if (!announcement || !announcement.id) return;
        
        const row = document.createElement('tr');
        row.className = 'announcement-row';
        row.setAttribute('data-announcement-title', (announcement.title || '').toLowerCase());
        row.setAttribute('data-announcement-content', (announcement.content || '').toLowerCase());
        row.setAttribute('data-announcement-target', (announcement.target || '').toLowerCase());
        row.innerHTML = `
            <td>${announcement.title || 'Untitled'}</td>
            <td>${announcement.content ? (announcement.content.length > 50 ? announcement.content.substring(0, 50) + '...' : announcement.content) : 'N/A'}</td>
            <td>${announcement.authorName || 'Admin'}</td>
            <td>${announcement.target || 'all'}</td>
            <td>${announcement.classes && announcement.classes.length > 0 ? announcement.classes.join(', ') : 'All'}</td>
            <td>${announcement.created_at || announcement.createdAt ? formatDate(announcement.created_at || announcement.createdAt) : 'N/A'}</td>
            <td>
                <button class="btn-small" onclick="editAnnouncement('${announcement.id}')">Edit</button>
                <button class="btn-small btn-danger" onclick="handleDeleteAnnouncement('${announcement.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.filterAnnouncements = function() {
    const searchTerm = (document.getElementById('announcementSearchInput').value || '').toLowerCase();
    const filterTarget = (document.getElementById('announcementFilterTarget').value || '').toLowerCase();
    const rows = document.querySelectorAll('.announcement-row');
    
    rows.forEach(row => {
        const title = row.getAttribute('data-announcement-title') || '';
        const content = row.getAttribute('data-announcement-content') || '';
        const target = row.getAttribute('data-announcement-target') || '';
        
        const matchesSearch = !searchTerm || title.includes(searchTerm) || content.includes(searchTerm);
        const matchesTarget = !filterTarget || target === filterTarget;
        
        row.style.display = matchesSearch && matchesTarget ? '' : 'none';
    });
};

window.showAddAnnouncementModal = function() {
    console.log('showAddAnnouncementModal called');
    const modal = document.getElementById('addAnnouncementModal');
    if (!modal) {
        console.error('addAnnouncementModal not found!');
        alert('Announcement modal not found. Please refresh the page.');
        return;
    }
    
    // Ensure form is set up
    if (typeof setupAnnouncementForm === 'function') {
        setupAnnouncementForm();
    }
    
    const idInput = document.getElementById('addAnnouncementId');
    const form = document.getElementById('addAnnouncementForm');
    const titleEl = document.getElementById('addAnnouncementModalTitle');
    
    if (idInput) idInput.value = '';
    if (form) form.reset();
    if (titleEl) titleEl.textContent = 'Add Announcement';
    
    toggleAnnouncementClasses();
    modal.style.display = 'block';
    console.log('Modal displayed');
};

window.editAnnouncement = function(announcementId) {
    const announcements = getData('lms_announcements') || [];
    const announcement = announcements.find(a => a && a.id === announcementId);
    if (!announcement) return;
    
    const modal = document.getElementById('addAnnouncementModal');
    document.getElementById('addAnnouncementId').value = announcement.id;
    document.getElementById('addAnnouncementTitle').value = announcement.title || '';
    document.getElementById('addAnnouncementContent').value = announcement.content || '';
    document.getElementById('addAnnouncementTarget').value = announcement.target || 'all';
    document.getElementById('addAnnouncementModalTitle').textContent = 'Edit Announcement';
    
    toggleAnnouncementClasses();
    
    // Set selected classes
    if (announcement.classes && announcement.classes.length > 0) {
        announcement.classes.forEach(cls => {
            const checkbox = document.getElementById(`announcement_class_${cls.replace(/\s+/g, '_')}`);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    modal.style.display = 'block';
};

window.handleDeleteAnnouncement = function(announcementId) {
    showConfirmModal(
        'Delete Announcement',
        'Are you sure you want to delete this announcement?',
        function() {
            performDeleteAnnouncement(announcementId);
        }
    );
}

async function performDeleteAnnouncement(announcementId) {
    try {
        if (typeof window.deleteAnnouncement === 'function') {
            await window.deleteAnnouncement(announcementId);
            showAlert('announcements', 'Announcement deleted successfully', 'success');
        } else {
            const announcements = getData('lms_announcements') || [];
            const filtered = announcements.filter(a => a && a.id !== announcementId);
            saveData('lms_announcements', filtered);
            showAlert('announcements', 'Announcement deleted successfully', 'success');
        }
        loadAnnouncements();
        updateDashboardStats();
    } catch (error) {
        console.error('Error deleting announcement:', error);
        showAlert('announcements', 'Failed to delete announcement', 'error');
    }
}

window.toggleAnnouncementClasses = function() {
    const target = document.getElementById('addAnnouncementTarget').value;
    const classesGroup = document.getElementById('addAnnouncementClassesGroup');
    const container = document.getElementById('addAnnouncementClassesContainer');
    
    if (target === 'class') {
        classesGroup.style.display = 'block';
        container.innerHTML = '';
        const classes = getData('lms_classes') || [];
        const sortedClasses = [...classes].filter(cls => cls && cls.name).sort((a, b) => {
            return (a.name || '').localeCompare(b.name || '');
        });
        sortedClasses.forEach(cls => {
            const checkboxItem = document.createElement('div');
            checkboxItem.className = 'checkbox-item';
            const id = cls.name.replace(/\s+/g, '_');
            checkboxItem.innerHTML = `
                <input type="checkbox" id="announcement_class_${id}" value="${cls.name}">
                <label for="announcement_class_${id}">${cls.name}</label>
            `;
            container.appendChild(checkboxItem);
        });
    } else {
        classesGroup.style.display = 'none';
    }
};

function setupAnnouncementForm() {
    console.log('setupAnnouncementForm called');
    const form = document.getElementById('addAnnouncementForm');
    if (!form) {
        console.error('addAnnouncementForm not found!');
        return;
    }
    
    // Remove existing listeners to avoid duplicates
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    newForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const announcementId = document.getElementById('addAnnouncementId').value;
        const title = document.getElementById('addAnnouncementTitle').value;
        const content = document.getElementById('addAnnouncementContent').value;
        const target = document.getElementById('addAnnouncementTarget').value;
        
        if (!title || !content) {
            showAlert('add-announcement', 'Please fill all required fields', 'error');
            return;
        }
        
        let targetClasses = [];
        if (target === 'class') {
            const checkboxes = document.querySelectorAll('#addAnnouncementClassesContainer input[type="checkbox"]:checked');
            targetClasses = Array.from(checkboxes).map(cb => cb.value);
            if (targetClasses.length === 0) {
                showAlert('add-announcement', 'Please select at least one class', 'error');
                return;
            }
        }
        
        const announcementData = {
            id: announcementId || null,
            title,
            message: content,
            type: target === 'all' ? 'general' : target,
            targetClasses: targetClasses
        };

        try {
            if (typeof saveAnnouncement === 'function') {
                await saveAnnouncement(announcementData);
                showAlert('add-announcement', announcementId ? 'Announcement updated successfully' : 'Announcement added successfully', 'success');
            } else {
                throw new Error('saveAnnouncement API not available');
            }
            
            setTimeout(() => {
                closeModal('addAnnouncementModal');
                loadAnnouncements();
                updateDashboardStats();
            }, 1000);
        } catch (error) {
            console.error('Error saving announcement:', error);
            showAlert('add-announcement', 'Failed to save announcement', 'error');
        }
    });
}

// Material Management
async function loadMaterials() {
    console.log('loadMaterials called');
    const tbody = document.getElementById('materials-tbody');
    
    if (!tbody) {
        console.error('materials-tbody not found!');
        return;
    }
    
    let materials = [];
    let users = { lecturers: [] };
    
    // Try Supabase first, fallback to localStorage
    if (typeof getMaterials === 'function' && typeof getUsers === 'function') {
        try {
            materials = await getMaterials();
            window.loadedMaterials = materials; // Store globally
            users = await getUsers();
        } catch (error) {
            console.warn('Supabase loadMaterials failed, using localStorage:', error);
            materials = getData('lms_materials') || [];
            users = getData('lms_users') || { lecturers: [] };
        }
    } else {
        materials = getData('lms_materials') || [];
        users = getData('lms_users') || { lecturers: [] };
    }
    
    console.log('Found materials:', materials.length);
    
    // Populate subject filter
    const subjectFilter = document.getElementById('materialFilterSubject');
    if (subjectFilter) {
        const subjects = [...new Set(materials.map(m => m.subject).filter(s => s))];
        subjectFilter.innerHTML = '<option value="">All Subjects</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectFilter.appendChild(option);
        });
    }
    
    if (materials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No materials found</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    materials.forEach(material => {
        if (!material || !material.id) return;
        
        const lecturer = users.lecturers.find(l => l && l.id === (material.lecturer_id || material.lecturerId));
        const lecturerName = lecturer ? (lecturer.full_name || lecturer.fullName) : 'Unknown';
        
        let materialType = 'Text';
        if (material.video_url || material.videoUrl) materialType = 'Video';
        else if (material.audio_url || material.audioUrl) materialType = 'Audio';
        else if (material.uploaded_file || material.uploadedFile || material.file_url || material.fileUrl) materialType = 'File';
        
        const row = document.createElement('tr');
        row.className = 'material-row';
        row.setAttribute('data-material-title', (material.title || '').toLowerCase());
        row.setAttribute('data-material-subject', (material.subject || '').toLowerCase());
        row.innerHTML = `
            <td>${material.title || 'Untitled'}</td>
            <td>${material.subject || 'N/A'}</td>
            <td>${material.class || 'N/A'}</td>
            <td>${lecturerName}</td>
            <td>${materialType}</td>
            <td>${material.uploadedAt ? formatDate(material.uploadedAt) : 'N/A'}</td>
            <td>
                <button class="btn-small" onclick="viewMaterial('${material.id}')">View</button>
                <button class="btn-small btn-danger" onclick="deleteMaterial('${material.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.filterMaterials = function() {
    const searchTerm = (document.getElementById('materialSearchInput').value || '').toLowerCase();
    const filterSubject = (document.getElementById('materialFilterSubject').value || '').toLowerCase();
    const rows = document.querySelectorAll('.material-row');
    
    rows.forEach(row => {
        const title = row.getAttribute('data-material-title') || '';
        const subject = row.getAttribute('data-material-subject') || '';
        
        const matchesSearch = !searchTerm || title.includes(searchTerm);
        const matchesSubject = !filterSubject || subject === filterSubject;
        
        row.style.display = matchesSearch && matchesSubject ? '' : 'none';
    });
};

window.viewMaterial = function(materialId) {
    const materials = window.loadedMaterials || getData('lms_materials') || [];
    const material = materials.find(m => m && (m.id === materialId || String(m.id) === String(materialId)));
    if (!material) return;
    
    const message = `Material: ${material.title}\n\nSubject: ${material.subject}\nClass: ${material.class}\n\n${material.description || 'No description'}`;
    showAlertModal('Material Details', message);
};

window.deleteMaterial = function(materialId) {
    showConfirmModal(
        'Delete Material',
        'Are you sure you want to delete this material?',
        function() {
            performDeleteMaterial(materialId);
        }
    );
}

function performDeleteMaterial(materialId) {
    const materials = window.loadedMaterials || getData('lms_materials') || [];
    const filtered = materials.filter(m => m && m.id !== materialId && String(m.id) !== String(materialId));
    saveData('lms_materials', filtered);
    
    showAlert('materials', 'Material deleted successfully', 'success');
    loadMaterials();
    updateDashboardStats();
};

// User Search/Filter
window.filterUsers = function() {
    const searchTerm = (document.getElementById('userSearchInput').value || '').toLowerCase();
    const studentRows = document.querySelectorAll('#students-tbody tr');
    const lecturerRows = document.querySelectorAll('#lecturers-tbody tr');
    
    [...studentRows, ...lecturerRows].forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = !searchTerm || text.includes(searchTerm) ? '' : 'none';
    });
};

// Modal Functions
window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};

// Close modal when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};

// Export/Import Functions
window.exportData = function() {
    const data = {
        users: getData('lms_users'),
        classes: getData('lms_classes'),
        courses: getData('lms_courses'),
        exams: getData('lms_exams'),
        results: getData('lms_results'),
        materials: getData('lms_materials'),
        announcements: getData('lms_announcements'),
        resultReleases: getData('lms_result_releases'),
        exportedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lms_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showAlert('settings', 'Data exported successfully', 'success');
};

window.exportResults = function() {
    const results = getData('lms_results') || [];
    const exams = getData('lms_exams') || [];
    const users = getData('lms_users') || { students: [] };
    
    let csv = 'Student Name,Username,Exam Title,Subject,Score,Grade,Date\n';
    
    results.forEach(result => {
        const exam = exams.find(e => e && e.id === result.examId);
        const student = users.students.find(s => s && s.id === result.studentId);
        
        if (exam && student) {
            csv += `"${student.fullName || ''}","${student.username || ''}","${exam.title || ''}","${exam.subject || ''}",${result.score || 0},"${getLetterGrade(result.score || 0)}","${result.submittedAt || ''}"\n`;
        }
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showAlert('settings', 'Results exported successfully', 'success');
};

window.exportUsers = function() {
    const users = getData('lms_users') || { students: [], lecturers: [] };
    
    let csv = 'Type,Rank,Full Name,Username,Telephone,Email,Class/Subjects,Registered\n';
    
    users.students.forEach(student => {
        csv += `Student,"${student.rank || ''}","${student.fullName || ''}","${student.username || ''}","${student.telephone || ''}","${student.email || ''}","${student.class || ''}","${student.registeredAt || ''}"\n`;
    });
    
    users.lecturers.forEach(lecturer => {
        csv += `Lecturer,"${lecturer.rank || ''}","${lecturer.fullName || ''}","${lecturer.username || ''}","${lecturer.telephone || ''}","${lecturer.email || ''}","${(lecturer.subjects || []).join('; ')} / ${(lecturer.classes || []).join('; ')}","${lecturer.registeredAt || ''}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showAlert('settings', 'Users exported successfully', 'success');
};

window.importData = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showConfirmModal(
        'Import Data',
        'Importing data will replace existing data. Are you sure you want to continue?',
        function() {
        performImportData(file);
        event.target.value = '';
    });
}

function performImportData(file) {
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.users) saveData('lms_users', data.users);
            if (data.classes) saveData('lms_classes', data.classes);
            if (data.courses) saveData('lms_courses', data.courses);
            if (data.exams) saveData('lms_exams', data.exams);
            if (data.results) saveData('lms_results', data.results);
            if (data.materials) saveData('lms_materials', data.materials);
            if (data.announcements) saveData('lms_announcements', data.announcements);
            if (data.resultReleases) saveData('lms_result_releases', data.resultReleases);
            
            showAlert('settings', 'Data imported successfully. Page will reload.', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            showAlert('settings', 'Error importing data: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};

// Update Dashboard Statistics — fetches results count live from the API
async function updateDashboardStats() {
    try {
        if (typeof getResults !== 'function') return;
        invalidateCache('results');
        const results = await getResults();
        const totalResultsEl = document.getElementById('totalResults');
        if (totalResultsEl) totalResultsEl.textContent = Array.isArray(results) ? results.length : 0;
    } catch (error) {
        console.error('Error updating dashboard stats:', error);
    }
}

// Table Sorting Functionality
window.initTableSorting = function() {
    document.querySelectorAll('table thead th').forEach((th, index) => {
        if (th.textContent.trim() === 'Actions') return; // Skip Actions column
        
        th.classList.add('sortable');
        th.addEventListener('click', function() {
            const table = th.closest('table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            // Determine sort direction
            const isAsc = th.classList.contains('asc');
            const isDesc = th.classList.contains('desc');
            
            // Reset all sort indicators
            table.querySelectorAll('th.sortable').forEach(h => {
                h.classList.remove('asc', 'desc');
            });
            
            // Set new sort direction
            if (!isAsc && !isDesc) {
                th.classList.add('asc');
            } else if (isAsc) {
                th.classList.remove('asc');
                th.classList.add('desc');
            } else {
                th.classList.remove('desc');
            }
            
            // Sort rows
            const newDirection = th.classList.contains('asc') ? 1 : -1;
            rows.sort((a, b) => {
                const aText = a.cells[index] ? a.cells[index].textContent.trim() : '';
                const bText = b.cells[index] ? b.cells[index].textContent.trim() : '';
                
                // Try to parse as numbers
                const aNum = parseFloat(aText);
                const bNum = parseFloat(bText);
                
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return (aNum - bNum) * newDirection;
                }
                
                // Try to parse as dates
                const aDate = new Date(aText);
                const bDate = new Date(bText);
                
                if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                    return (aDate - bDate) * newDirection;
                }
                
                // String comparison
                return aText.localeCompare(bText) * newDirection;
            });
            
            // Re-append sorted rows
            rows.forEach(row => tbody.appendChild(row));
        });
    });
};

// Initialize table sorting when sections are loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize sorting after a short delay to ensure tables are loaded
    setTimeout(() => {
        if (typeof initTableSorting === 'function') {
            initTableSorting();
        }
    }, 500);
});

// ============================================
// AUDIT LOGS SECTION
// ============================================

let currentAuditLogs = [];
let currentAuditPage = 1;
const auditItemsPerPage = 50;
let totalAuditLogs = 0;

async function loadAuditLogs(page = 1) {
    const tbody = document.getElementById('audit-logs-tbody');
    const paginationControls = document.getElementById('audit-logs-pagination');
    if (!tbody) return;
    
    currentAuditPage = page;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-light);">Loading logs...</td></tr>';
    
    if (typeof getAuditLogs !== 'function') {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">Error: Audit logging not supported.</td></tr>';
        return;
    }
    
    try {
        const response = await getAuditLogs(currentAuditPage, auditItemsPerPage); // Fetch page
        
        // Handle response structure (it might be just an array for localStorage or object for Supabase)
        let logs = [];
        if (Array.isArray(response)) {
             // Backward compatibility or localStorage fallback from older api-service
            logs = response;
            totalAuditLogs = logs.length;
        } else {
            logs = response.data || [];
            totalAuditLogs = response.count || 0;
        }
        
        currentAuditLogs = logs;
        
        if (currentAuditLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px;">No audit logs found.</td></tr>';
            if (paginationControls) paginationControls.style.display = 'none';
            return;
        }
        
        tbody.innerHTML = '';
        
        currentAuditLogs.forEach((log, index) => {
            const row = document.createElement('tr');
            
            const date = new Date(log.createdAt || log.created_at);
            const dateStr = date.toLocaleString();
            
            // Format action type for display
            const actionType = (log.actionType || log.action_type || '').replace(/_/g, ' ');
            
            // Format description (truncate if too long)
            let description = log.description || '-';
            if (description.length > 50) {
                description = description.substring(0, 50) + '...';
            }
            
            row.innerHTML = `
                <td style="font-size: 0.9em; color: var(--text-light); white-space: nowrap;">${dateStr}</td>
                <td><span class="status-badge status-active" style="font-size: 0.85em;">${actionType}</span></td>
                <td style="font-weight: 500;">${log.performedBy || 'System'}</td>
                <td>${description}</td>
                <td style="text-align: center;">
                    <button class="btn btn-small btn-secondary" onclick="viewLogDetails(${index})">View Details</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Update Pagination Controls
        if (paginationControls) {
            paginationControls.style.display = 'flex';
            
            const prevBtn = document.getElementById('audit-prev-btn');
            const nextBtn = document.getElementById('audit-next-btn');
            const pageInfo = document.getElementById('audit-page-info');
            
            const totalPages = Math.ceil(totalAuditLogs / auditItemsPerPage);
            
            if (pageInfo) {
                pageInfo.textContent = `Page ${currentAuditPage} of ${totalPages || 1} (${totalAuditLogs} items)`;
            }
            
            if (prevBtn) prevBtn.disabled = currentAuditPage <= 1;
            if (nextBtn) nextBtn.disabled = currentAuditPage >= totalPages;
        }
        
    } catch (error) {
        console.error('Error loading audit logs:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">Error loading logs: ${error.message}</td></tr>`;
    }
}

function changeAuditLogPage(direction) {
    const newPage = currentAuditPage + direction;
    if (newPage > 0) {
        loadAuditLogs(newPage);
    }
}

function viewLogDetails(index) {
    const log = currentAuditLogs[index];
    if (!log) return;
    
    const contentDiv = document.getElementById('log-details-content');
    const modal = document.getElementById('logDetailsModal');
    
    if (log.metadata && typeof log.metadata === 'string') {
        try {
            log.metadata = JSON.parse(log.metadata);
        } catch (e) {
            // keep as string
        }
    }
    
    const details = {
        id: log.id,
        timestamp: log.createdAt || log.created_at,
        action: log.actionType || log.action_type,
        performer: log.performedBy,
        description: log.description,
        metadata: log.metadata || {}
    };
    
    contentDiv.textContent = JSON.stringify(details, null, 2);
    modal.style.display = 'flex';
}

// Make sure viewLogDetails is globally available
window.viewLogDetails = viewLogDetails;
window.loadAuditLogs = loadAuditLogs;
window.loadAuditLogs = loadAuditLogs;
window.changeAuditLogPage = changeAuditLogPage;

// ============================================
// SYSTEM SETTINGS SECTION
// ============================================

async function loadSystemSettings() {
    const printToggle = document.getElementById('setting-allow-printing');
    if (!printToggle) return;
    
    // Disable while loading
    printToggle.disabled = true;
    
    try {
        const canPrint = await getSystemSetting('allow_result_printing');
        console.log('System Setting [allow_result_printing]:', canPrint, typeof canPrint);
        
        // Convert to boolean (it might be string 'true'/'false' or boolean)
        const isAllowed = canPrint === true || canPrint === 'true';
        
        printToggle.checked = isAllowed;
        
        // Update slider color manually if needed or rely on CSS
        const slider = printToggle.nextElementSibling;
        if (slider) {
            slider.style.backgroundColor = isAllowed ? 'var(--success-color)' : '#ccc';
        }
        
    } catch (e) {
        console.error('Error loading settings:', e);
    } finally {
        printToggle.disabled = false;
    }
}

async function toggleResultPrinting(checkbox) {
    const isAllowed = checkbox.checked;
    const slider = checkbox.nextElementSibling;
    
    // Optimistic UI update
    if (slider) {
        slider.style.backgroundColor = isAllowed ? 'var(--success-color)' : '#ccc';
    }
    
    try {
        const success = await updateSystemSetting('allow_result_printing', isAllowed);
        if (success) {
            // Log if success
            if (isAllowed) {
                 showAlert('settings', 'Result printing ENABLED for all students', 'success');
            } else {
                 showAlert('settings', 'Result printing DISABLED for all students', 'success');
            }
        } else {
            // Revert if failed
            checkbox.checked = !isAllowed;
            if (slider) {
                slider.style.backgroundColor = !isAllowed ? 'var(--success-color)' : '#ccc';
            }
            showAlert('settings', 'Failed to update setting', 'error');
        }
    } catch (e) {
        console.error('Error toggling setting:', e);
        checkbox.checked = !isAllowed;
        showAlert('settings', 'Error updating setting', 'error');
    }
}

window.loadSystemSettings = loadSystemSettings;
window.toggleResultPrinting = toggleResultPrinting;
