// Analytics Dashboard for Lecturers

function loadAnalytics() {
    const user = getCurrentUser();
    const exams = getData('lms_exams');
    const results = getData('lms_results');
    const students = getData('lms_users').students || [];
    
    const lecturerExams = exams.filter(e => e.lecturerId === user.id);
    const lecturerResults = results.filter(r => {
        const exam = lecturerExams.find(e => e.id === r.examId);
        return exam !== undefined;
    });
    
    const container = document.getElementById('analytics-container');
    if (!container) return;
    
    if (lecturerExams.length === 0) {
        container.innerHTML = '<p>No exams created yet. Create exams to see analytics.</p>';
        return;
    }
    
    // Calculate statistics
    const totalExams = lecturerExams.length;
    const totalSubmissions = lecturerResults.length;
    const avgScore = lecturerResults.length > 0
        ? lecturerResults.reduce((sum, r) => sum + r.score, 0) / lecturerResults.length
        : 0;
    
    // Grade distribution
    const gradeDist = {
        A: 0, B: 0, 'C+': 0, C: 0, 'C-': 0, D: 0, F: 0
    };
    lecturerResults.forEach(r => {
        const grade = getLetterGrade(r.score);
        if (gradeDist.hasOwnProperty(grade)) {
            gradeDist[grade]++;
        }
    });
    
    // Subject performance
    const subjectStats = {};
    lecturerExams.forEach(exam => {
        if (!subjectStats[exam.subject]) {
            subjectStats[exam.subject] = {
                exams: 0,
                submissions: 0,
                avgScore: 0,
                totalScore: 0
            };
        }
        subjectStats[exam.subject].exams++;
        
        const subjectResults = lecturerResults.filter(r => r.subject === exam.subject);
        subjectStats[exam.subject].submissions = subjectResults.length;
        if (subjectResults.length > 0) {
            subjectStats[exam.subject].totalScore = subjectResults.reduce((sum, r) => sum + r.score, 0);
            subjectStats[exam.subject].avgScore = subjectStats[exam.subject].totalScore / subjectResults.length;
        }
    });
    
    // Student engagement
    const studentEngagement = {};
    lecturerResults.forEach(r => {
        if (!studentEngagement[r.studentId]) {
            studentEngagement[r.studentId] = {
                name: r.studentName,
                examsTaken: 0,
                avgScore: 0,
                totalScore: 0
            };
        }
        studentEngagement[r.studentId].examsTaken++;
        studentEngagement[r.studentId].totalScore += r.score;
        studentEngagement[r.studentId].avgScore = studentEngagement[r.studentId].totalScore / studentEngagement[r.studentId].examsTaken;
    });
    
    const strugglingStudents = Object.values(studentEngagement)
        .filter(s => s.avgScore < 50)
        .sort((a, b) => a.avgScore - b.avgScore)
        .slice(0, 5);
    
    container.innerHTML = `
        <div class="analytics-grid">
            <div class="analytics-card">
                <h4>Overview</h4>
                <div class="stat-grid">
                    <div class="stat-item">
                        <div class="stat-value">${totalExams}</div>
                        <div class="stat-label">Total Exams</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${totalSubmissions}</div>
                        <div class="stat-label">Total Submissions</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${avgScore.toFixed(1)}%</div>
                        <div class="stat-label">Average Score</div>
                    </div>
                </div>
            </div>
            
            <div class="analytics-card">
                <h4>Grade Distribution</h4>
                <div class="grade-distribution">
                    ${Object.entries(gradeDist).map(([grade, count]) => {
                        const percentage = totalSubmissions > 0 ? (count / totalSubmissions) * 100 : 0;
                        const color = getGradeColor(grade);
                        return `
                            <div class="grade-bar-item">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span><strong>${grade}</strong></span>
                                    <span>${count} (${percentage.toFixed(1)}%)</span>
                                </div>
                                <div class="progress-bar small">
                                    <div class="progress-bar-fill" style="width: ${percentage}%; background: ${color};"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="analytics-card">
                <h4>Subject Performance</h4>
                <div class="subject-stats">
                    ${Object.entries(subjectStats).map(([subject, stats]) => `
                        <div class="subject-item">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <strong>${subject}</strong>
                                <span>${stats.avgScore.toFixed(1)}%</span>
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-light);">
                                ${stats.exams} exam(s) | ${stats.submissions} submission(s)
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="analytics-card">
                <h4>Students Needing Attention</h4>
                ${strugglingStudents.length > 0 ? `
                    <div class="struggling-students">
                        ${strugglingStudents.map(s => `
                            <div class="student-alert">
                                <strong>${s.name}</strong>
                                <span style="color: var(--danger-color);">Avg: ${s.avgScore.toFixed(1)}%</span>
                                <small>${s.examsTaken} exam(s) taken</small>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p style="color: var(--success-color);">No students currently struggling!</p>'}
            </div>
        </div>
    `;
}

// Initialize analytics when section is shown
document.addEventListener('DOMContentLoaded', function() {
    const analyticsTab = document.querySelector('[onclick="showSection(\'analytics\')"]');
    if (analyticsTab) {
        analyticsTab.addEventListener('click', function() {
            setTimeout(loadAnalytics, 100);
        });
    }
});
