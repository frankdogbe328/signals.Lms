// Course Progress Tracking for Students

// Make function globally accessible
window.loadProgress = function() {
    loadProgressOverview();
}

window.loadProgressOverview = function() {
    const user = getCurrentUser();
    const exams = getData('lms_exams');
    const results = getData('lms_results');
    const materials = getData('lms_materials');
    const courses = getData('lms_courses');
    
    // Get user's class courses
    const classCourses = courses.filter(c => c.class === user.class);
    const classMaterials = materials.filter(m => m.class === user.class);
    const classExams = exams.filter(e => e.classes && e.classes.includes(user.class));
    const userResults = results.filter(r => r.studentId === user.id);
    
    const container = document.getElementById('progress-container');
    if (!container) return;
    
    if (classCourses.length === 0) {
        container.innerHTML = '<p>No courses found for your class.</p>';
        return;
    }
    
    // Show overview section, hide analytics
    container.style.display = 'block';
    const analyticsContent = document.getElementById('analytics-content');
    if (analyticsContent) analyticsContent.style.display = 'none';
    
    container.innerHTML = '';
    
    // Overall Statistics Card
    const overallStats = calculateOverallStats(userResults, classExams, classMaterials);
    const statsCard = document.createElement('div');
    statsCard.className = 'progress-card';
    statsCard.style.marginBottom = '20px';
    statsCard.innerHTML = `
        <div class="progress-header">
            <h4>Overall Performance</h4>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
            <div class="stat-box">
                <div class="stat-label">Overall Average</div>
                <div class="stat-value-large" style="color: ${getGradeColor(getLetterGrade(overallStats.avgScore))}">${overallStats.avgScore.toFixed(1)}%</div>
                <div class="stat-grade">${getLetterGrade(overallStats.avgScore)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Exams Completed</div>
                <div class="stat-value-large">${overallStats.completedExams}/${overallStats.totalExams}</div>
                <div class="stat-subtext">${overallStats.examProgress.toFixed(0)}% Complete</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Best Subject</div>
                <div class="stat-value-large">${overallStats.bestSubject || 'N/A'}</div>
                <div class="stat-subtext">${overallStats.bestScore ? overallStats.bestScore.toFixed(1) + '%' : ''}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Total Materials</div>
                <div class="stat-value-large">${overallStats.totalMaterials}</div>
                <div class="stat-subtext">Available</div>
            </div>
        </div>
    `;
    container.appendChild(statsCard);
    
    // Group by subject
    const subjects = [...new Set(classCourses.map(c => c.subject))];
    
    subjects.forEach(subject => {
        const subjectCard = document.createElement('div');
        subjectCard.className = 'progress-card';
        
        // Get exams for this subject
        const subjectExams = classExams.filter(e => e.subject === subject);
        const subjectResults = userResults.filter(r => {
            const exam = exams.find(e => e.id === r.examId);
            return exam && exam.subject === subject;
        });
        const subjectMaterials = classMaterials.filter(m => m.subject === subject);
        
        // Calculate progress
        const totalExams = subjectExams.length;
        const completedExams = subjectResults.length;
        const examProgress = totalExams > 0 ? (completedExams / totalExams) * 100 : 0;
        
        // Calculate average score
        const avgScore = subjectResults.length > 0
            ? subjectResults.reduce((sum, r) => sum + (r.score || 0), 0) / subjectResults.length
            : 0;
        
        // Materials accessed (simplified - assume all materials are accessible)
        const materialsProgress = subjectMaterials.length > 0 ? 100 : 0;
        
        // Overall progress (weighted: 60% exams, 40% materials)
        const overallProgress = (examProgress * 0.6) + (materialsProgress * 0.4);
        
        // Get trend data
        const trendData = getSubjectTrend(subjectResults, subjectExams);
        
        subjectCard.innerHTML = `
            <div class="progress-header">
                <h4>${subject}</h4>
                <span class="progress-percentage" style="color: ${getGradeColor(getLetterGrade(avgScore))}">${avgScore > 0 ? avgScore.toFixed(1) + '%' : 'N/A'}</span>
            </div>
            
            <div class="progress-stats">
                <div class="stat-item">
                    <span class="stat-label">Exams Completed:</span>
                    <span class="stat-value">${completedExams}/${totalExams}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Average Score:</span>
                    <span class="stat-value" style="color: ${getGradeColor(getLetterGrade(avgScore))}">${avgScore > 0 ? avgScore.toFixed(1) + '% (' + getLetterGrade(avgScore) + ')' : 'N/A'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Materials Available:</span>
                    <span class="stat-value">${subjectMaterials.length}</span>
                </div>
                ${trendData.trend !== 0 ? `
                <div class="stat-item">
                    <span class="stat-label">Trend:</span>
                    <span class="stat-value" style="color: ${trendData.trend > 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                        ${trendData.trend > 0 ? '↑ Improving' : '↓ Declining'} (${Math.abs(trendData.trend).toFixed(1)}%)
                    </span>
                </div>
                ` : ''}
            </div>
            
            <div class="progress-bar-container">
                <div class="progress-bar-label">Overall Progress</div>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${overallProgress}%; background: ${getProgressColor(overallProgress)};"></div>
                </div>
            </div>
            
            <div class="progress-details">
                <div class="progress-item">
                    <span>Exam Progress</span>
                    <div class="progress-bar small">
                        <div class="progress-bar-fill" style="width: ${examProgress}%;"></div>
                    </div>
                    <span>${Math.round(examProgress)}%</span>
                </div>
                <div class="progress-item">
                    <span>Materials</span>
                    <div class="progress-bar small">
                        <div class="progress-bar-fill" style="width: ${materialsProgress}%;"></div>
                    </div>
                    <span>${Math.round(materialsProgress)}%</span>
                </div>
            </div>
            
            ${subjectResults.length > 0 ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                <div style="margin-bottom: 10px;"><strong>Recent Scores:</strong></div>
                <div class="score-timeline">
                    ${subjectResults.slice(-5).reverse().map(r => {
                        const exam = exams.find(e => e.id === r.examId);
                        const date = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : 'N/A';
                        return `
                            <div class="score-point">
                                <div class="score-value" style="color: ${getGradeColor(getLetterGrade(r.score || 0))}">${r.score || 0}%</div>
                                <div class="score-label">${exam ? exam.title : 'Exam'}</div>
                                <div class="score-date">${date}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}
        `;
        
        container.appendChild(subjectCard);
    });
}

window.showProgressView = function(view) {
    const overviewBtn = document.querySelector('[onclick="showProgressView(\'overview\')"]');
    const analyticsBtn = document.querySelector('[onclick="showProgressView(\'analytics\')"]');
    
    if (view === 'overview') {
        if (overviewBtn) overviewBtn.classList.add('active');
        if (analyticsBtn) analyticsBtn.classList.remove('active');
        loadProgressOverview();
    } else if (view === 'analytics') {
        if (overviewBtn) overviewBtn.classList.remove('active');
        if (analyticsBtn) analyticsBtn.classList.add('active');
        loadProgressAnalytics();
    }
}

window.loadProgressAnalytics = function() {
    const user = getCurrentUser();
    const exams = getData('lms_exams');
    const results = getData('lms_results');
    const courses = getData('lms_courses');
    const classExams = exams.filter(e => e.classes && e.classes.includes(user.class));
    const userResults = results.filter(r => r.studentId === user.id);
    
    const container = document.getElementById('analytics-content');
    if (!container) return;
    
    container.style.display = 'block';
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) progressContainer.style.display = 'none';
    
    // Prepare data for charts
    const subjectData = calculateSubjectBreakdown(userResults, exams, courses.filter(c => c.class === user.class));
    const trendData = calculatePerformanceTrend(userResults, exams);
    const gradeDistribution = calculateGradeDistribution(userResults);
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px;">
            <!-- Subject Performance Chart -->
            <div class="chart-card">
                <h4>Subject-Wise Performance</h4>
                <div class="chart-container" style="height: 250px; margin-top: 15px;">
                    ${renderBarChart(subjectData)}
                </div>
            </div>
            
            <!-- Grade Distribution Chart -->
            <div class="chart-card">
                <h4>Grade Distribution</h4>
                <div class="chart-container" style="height: 250px; margin-top: 15px;">
                    ${renderPieChart(gradeDistribution)}
                </div>
            </div>
        </div>
        
        <!-- Performance Trend Chart -->
        <div class="chart-card" style="margin-top: 20px;">
            <h4>Performance Trend Over Time</h4>
            <div class="chart-container" style="height: 300px; margin-top: 15px;">
                ${renderLineChart(trendData)}
            </div>
        </div>
        
        <!-- Detailed Subject Breakdown -->
        <div class="chart-card" style="margin-top: 20px;">
            <h4>Detailed Subject Breakdown</h4>
            <div class="table-container" style="margin-top: 15px;">
                <table>
                    <thead>
                        <tr>
                            <th>Subject</th>
                            <th>Exams Taken</th>
                            <th>Average Score</th>
                            <th>Best Score</th>
                            <th>Worst Score</th>
                            <th>Trend</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${subjectData.map(subject => {
                            const subjectResults = userResults.filter(r => {
                                const exam = exams.find(e => e.id === r.examId);
                                return exam && exam.subject === subject.name;
                            }).map(r => r.score || 0);
                            
                            const bestScore = subjectResults.length > 0 ? Math.max(...subjectResults) : 0;
                            const worstScore = subjectResults.length > 0 ? Math.min(...subjectResults) : 0;
                            const trend = getSubjectTrend(userResults.filter(r => {
                                const exam = exams.find(e => e.id === r.examId);
                                return exam && exam.subject === subject.name;
                            }), classExams.filter(e => e.subject === subject.name));
                            
                            return `
                                <tr>
                                    <td><strong>${subject.name}</strong></td>
                                    <td>${subject.examsTaken}</td>
                                    <td style="color: ${getGradeColor(getLetterGrade(subject.avgScore))}">${subject.avgScore.toFixed(1)}%</td>
                                    <td style="color: var(--success-color)">${bestScore.toFixed(1)}%</td>
                                    <td style="color: var(--danger-color)">${worstScore.toFixed(1)}%</td>
                                    <td style="color: ${trend.trend > 0 ? 'var(--success-color)' : trend.trend < 0 ? 'var(--danger-color)' : 'var(--text-light)'}">
                                        ${trend.trend > 0 ? '↑' : trend.trend < 0 ? '↓' : '→'} ${trend.trend !== 0 ? Math.abs(trend.trend).toFixed(1) + '%' : 'Stable'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function calculateOverallStats(userResults, classExams, classMaterials) {
    const totalExams = classExams.length;
    const completedExams = userResults.length;
    const examProgress = totalExams > 0 ? (completedExams / totalExams) * 100 : 0;
    const avgScore = userResults.length > 0
        ? userResults.reduce((sum, r) => sum + (r.score || 0), 0) / userResults.length
        : 0;
    
    // Find best subject
    const subjectScores = {};
    userResults.forEach(r => {
        const exam = classExams.find(e => e.id === r.examId);
        if (exam && exam.subject) {
            if (!subjectScores[exam.subject]) {
                subjectScores[exam.subject] = [];
            }
            subjectScores[exam.subject].push(r.score || 0);
        }
    });
    
    let bestSubject = null;
    let bestAvgScore = 0;
    Object.keys(subjectScores).forEach(subject => {
        const avg = subjectScores[subject].reduce((a, b) => a + b, 0) / subjectScores[subject].length;
        if (avg > bestAvgScore) {
            bestAvgScore = avg;
            bestSubject = subject;
        }
    });
    
    return {
        avgScore,
        completedExams,
        totalExams,
        examProgress,
        bestSubject,
        bestScore: bestAvgScore,
        totalMaterials: classMaterials.length
    };
}

function calculateSubjectBreakdown(userResults, exams, courses) {
    const subjects = [...new Set(courses.map(c => c.subject))];
    return subjects.map(subject => {
        const subjectResults = userResults.filter(r => {
            const exam = exams.find(e => e.id === r.examId);
            return exam && exam.subject === subject;
        });
        
        const avgScore = subjectResults.length > 0
            ? subjectResults.reduce((sum, r) => sum + (r.score || 0), 0) / subjectResults.length
            : 0;
        
        return {
            name: subject,
            avgScore,
            examsTaken: subjectResults.length
        };
    }).sort((a, b) => b.avgScore - a.avgScore);
}

function calculatePerformanceTrend(userResults, exams) {
    // Sort results by date
    const sortedResults = [...userResults].sort((a, b) => {
        const dateA = a.submittedAt ? new Date(a.submittedAt) : new Date(0);
        const dateB = b.submittedAt ? new Date(b.submittedAt) : new Date(0);
        return dateA - dateB;
    });
    
    // Group by month or week (depending on data)
    const dataPoints = [];
    sortedResults.forEach(r => {
        const date = r.submittedAt ? new Date(r.submittedAt) : new Date();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const existing = dataPoints.find(d => d.label === monthKey);
        if (existing) {
            existing.scores.push(r.score || 0);
            existing.avgScore = existing.scores.reduce((a, b) => a + b, 0) / existing.scores.length;
        } else {
            dataPoints.push({
                label: monthKey,
                scores: [r.score || 0],
                avgScore: r.score || 0
            });
        }
    });
    
    return dataPoints;
}

function calculateGradeDistribution(userResults) {
    const distribution = { A: 0, B: 0, 'C+': 0, C: 0, 'C-': 0, D: 0, F: 0 };
    
    userResults.forEach(r => {
        const grade = getLetterGrade(r.score || 0);
        if (distribution.hasOwnProperty(grade)) {
            distribution[grade]++;
        }
    });
    
    return Object.keys(distribution).map(grade => ({
        grade,
        count: distribution[grade]
    }));
}

function getSubjectTrend(subjectResults, subjectExams) {
    if (subjectResults.length < 2) return { trend: 0 };
    
    const sortedResults = [...subjectResults].sort((a, b) => {
        const dateA = a.submittedAt ? new Date(a.submittedAt) : new Date(0);
        const dateB = b.submittedAt ? new Date(b.submittedAt) : new Date(0);
        return dateA - dateB;
    });
    
    const firstHalf = sortedResults.slice(0, Math.ceil(sortedResults.length / 2));
    const secondHalf = sortedResults.slice(Math.ceil(sortedResults.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, r) => sum + (r.score || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, r) => sum + (r.score || 0), 0) / secondHalf.length;
    
    return { trend: secondAvg - firstAvg };
}

// Simple chart rendering functions
function renderBarChart(data) {
    const maxValue = Math.max(...data.map(d => d.avgScore), 100);
    
    return `
        <div style="display: flex; align-items: flex-end; height: 100%; gap: 10px; padding: 10px;">
            ${data.map(item => {
                const height = (item.avgScore / maxValue) * 100;
                return `
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;">
                        <div style="flex: 1; display: flex; align-items: flex-end; width: 100%;">
                            <div style="
                                width: 100%;
                                background: ${getGradeColor(getLetterGrade(item.avgScore))};
                                height: ${height}%;
                                border-radius: 4px 4px 0 0;
                                position: relative;
                            ">
                                <div style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 0.85rem; font-weight: bold;">
                                    ${item.avgScore.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                        <div style="margin-top: 5px; font-size: 0.85rem; text-align: center; transform: rotate(-45deg); transform-origin: left bottom; white-space: nowrap;">
                            ${item.name}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderPieChart(data) {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) return '<p style="text-align: center; color: var(--text-light);">No data available</p>';
    
    let currentAngle = 0;
    const colors = {
        'A': '#10b981',
        'B': '#3b82f6',
        'C+': '#8b5cf6',
        'C': '#f59e0b',
        'C-': '#f97316',
        'D': '#ef4444',
        'F': '#991b1b'
    };
    
    const segments = data.filter(item => item.count > 0).map(item => {
        const percentage = (item.count / total) * 100;
        const angle = (percentage / 100) * 360;
        const startAngle = currentAngle;
        currentAngle += angle;
        
        return {
            ...item,
            percentage,
            startAngle,
            angle,
            color: colors[item.grade] || '#6b7280'
        };
    });
    
    return `
        <div style="display: flex; align-items: center; height: 100%; gap: 20px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px; position: relative;">
                <svg viewBox="0 0 100 100" style="width: 100%; height: 200px;">
                    ${segments.map((segment, index) => {
                        const startAngleRad = (segment.startAngle - 90) * (Math.PI / 180);
                        const endAngleRad = (segment.startAngle + segment.angle - 90) * (Math.PI / 180);
                        const largeArc = segment.angle > 180 ? 1 : 0;
                        
                        const x1 = 50 + 40 * Math.cos(startAngleRad);
                        const y1 = 50 + 40 * Math.sin(startAngleRad);
                        const x2 = 50 + 40 * Math.cos(endAngleRad);
                        const y2 = 50 + 40 * Math.sin(endAngleRad);
                        
                        return `
                            <path
                                d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z"
                                fill="${segment.color}"
                                stroke="var(--card-bg)"
                                stroke-width="1"
                            />
                        `;
                    }).join('')}
                </svg>
            </div>
            <div style="flex: 1; min-width: 150px;">
                ${segments.map(segment => `
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <div style="width: 20px; height: 20px; background: ${segment.color}; border-radius: 3px;"></div>
                        <span style="flex: 1;">${segment.grade}</span>
                        <span style="font-weight: bold;">${segment.count} (${segment.percentage.toFixed(1)}%)</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderLineChart(data) {
    if (data.length === 0) return '<p style="text-align: center; color: var(--text-light);">No data available</p>';
    
    const maxValue = Math.max(...data.map(d => d.avgScore), 100);
    const minValue = Math.min(...data.map(d => d.avgScore), 0);
    const range = maxValue - minValue || 100;
    
    const points = data.map((item, index) => {
        const x = (index / (data.length - 1 || 1)) * 100;
        const y = 100 - ((item.avgScore - minValue) / range) * 100;
        return { x, y, ...item };
    });
    
    const pathData = points.map((point, index) => {
        return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
    }).join(' ');
    
    return `
        <div style="position: relative; height: 100%; padding: 20px;">
            <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
                <!-- Grid lines -->
                ${[0, 25, 50, 75, 100].map(y => `
                    <line x1="0" y1="${y}" x2="100" y2="${y}" stroke="var(--border-color)" stroke-width="0.5" opacity="0.5"/>
                `).join('')}
                
                <!-- Trend line -->
                <path d="${pathData}" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                
                <!-- Data points -->
                ${points.map((point, index) => `
                    <circle cx="${point.x}" cy="${point.y}" r="2" fill="var(--primary-color)"/>
                    <text x="${point.x}" y="${point.y - 5}" text-anchor="middle" font-size="3" fill="var(--text-color)">
                        ${point.avgScore.toFixed(0)}%
                    </text>
                `).join('')}
            </svg>
            
            <!-- Labels -->
            <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 0.85rem; color: var(--text-light);">
                ${data.map(item => `<span>${item.label}</span>`).join('')}
            </div>
        </div>
    `;
}

function getProgressColor(progress) {
    if (progress >= 80) return 'var(--success-color)';
    if (progress >= 60) return 'var(--warning-color)';
    return 'var(--danger-color)';
}

// Initialize progress when section is shown
document.addEventListener('DOMContentLoaded', function() {
    const progressTab = document.querySelector('[onclick="showSection(\'progress\')"]');
    if (progressTab) {
        progressTab.addEventListener('click', function() {
            setTimeout(loadProgress, 100);
        });
    }
});
