// Performance Analytics Dashboard

// Show progress view
window.showProgressView = function(view) {
    const container = document.getElementById('progress-container');
    const analyticsContent = document.getElementById('analytics-content');
    
    if (view === 'analytics') {
        if (container) container.style.display = 'none';
        if (analyticsContent) {
            analyticsContent.style.display = 'block';
            loadStudentAnalytics();
        }
    } else {
        if (container) container.style.display = 'block';
        if (analyticsContent) analyticsContent.style.display = 'none';
        if (typeof loadProgress === 'function') {
            loadProgress();
        }
    }
    
    // Update button states
    document.querySelectorAll('[onclick*="showProgressView"]').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[onclick="showProgressView('${view}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
};

// Load performance analytics
window.loadPerformanceAnalytics = function() {
    const user = getCurrentUser();
    if (!user) return;
    
    if (user.type === 'student') {
        loadStudentAnalytics();
    } else if (user.type === 'lecturer') {
        loadLecturerAnalytics();
    }
};

// Load student performance analytics
function loadStudentAnalytics() {
    const user = getCurrentUser();
    const results = getData('lms_results') || [];
    const releases = getData('lms_result_releases') || {};
    
    // Filter released results
    const userResults = results.filter(r => 
        r.studentId === user.id && releases[r.examId] === true
    );
    
    if (userResults.length === 0) {
        const container = document.getElementById('analytics-content');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-light);">
                    <div style="font-size: 3rem; margin-bottom: 15px;">📊</div>
                    <h3>No Performance Data Yet</h3>
                    <p>Complete some exams to see your performance analytics here.</p>
                </div>
            `;
        }
        return;
    }
    
    // Calculate statistics
    const stats = calculateStudentStats(userResults);
    
    // Render analytics
    renderStudentAnalytics(stats, userResults);
}

// Calculate student statistics
function calculateStudentStats(results) {
    const totalExams = results.length;
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const averageScore = totalScore / totalExams;
    
    // Subject-wise performance
    const subjectPerformance = {};
    results.forEach(result => {
        if (!subjectPerformance[result.subject]) {
            subjectPerformance[result.subject] = {
                count: 0,
                totalScore: 0,
                scores: []
            };
        }
        subjectPerformance[result.subject].count++;
        subjectPerformance[result.subject].totalScore += result.score;
        subjectPerformance[result.subject].scores.push(result.score);
    });
    
    // Calculate averages per subject
    Object.keys(subjectPerformance).forEach(subject => {
        const perf = subjectPerformance[subject];
        perf.average = perf.totalScore / perf.count;
        perf.highest = Math.max(...perf.scores);
        perf.lowest = Math.min(...perf.scores);
    });
    
    // Performance trend (last 10 exams)
    const recentResults = results
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
        .slice(0, 10)
        .reverse();
    
    // Grade distribution
    const gradeDistribution = {
        'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0
    };
    results.forEach(result => {
        const grade = getLetterGrade(result.score);
        if (gradeDistribution[grade] !== undefined) {
            gradeDistribution[grade]++;
        }
    });
    
    // Identify weak areas (subjects with average < 70%)
    const weakAreas = Object.keys(subjectPerformance)
        .filter(subject => subjectPerformance[subject].average < 70)
        .map(subject => ({
            subject: subject,
            average: subjectPerformance[subject].average
        }))
        .sort((a, b) => a.average - b.average);
    
    return {
        totalExams,
        averageScore,
        subjectPerformance,
        recentResults,
        gradeDistribution,
        weakAreas,
        highestScore: Math.max(...results.map(r => r.score)),
        lowestScore: Math.min(...results.map(r => r.score))
    };
}

// Render student analytics
function renderStudentAnalytics(stats, results) {
    const container = document.getElementById('analytics-content');
    if (!container) return;
    
    container.innerHTML = `
        <div style="margin-bottom: 30px;">
            <h3>Performance Overview</h3>
            <div class="cards-grid" style="margin-top: 20px;">
                <div class="card">
                    <h4>Average Score</h4>
                    <div style="font-size: 2.5rem; font-weight: bold; color: var(--primary-color); margin-top: 10px;">
                        ${Math.round(stats.averageScore)}%
                    </div>
                </div>
                <div class="card">
                    <h4>Total Exams</h4>
                    <div style="font-size: 2.5rem; font-weight: bold; color: var(--success-color); margin-top: 10px;">
                        ${stats.totalExams}
                    </div>
                </div>
                <div class="card">
                    <h4>Highest Score</h4>
                    <div style="font-size: 2.5rem; font-weight: bold; color: var(--success-color); margin-top: 10px;">
                        ${stats.highestScore}%
                    </div>
                </div>
                <div class="card">
                    <h4>Lowest Score</h4>
                    <div style="font-size: 2.5rem; font-weight: bold; color: var(--warning-color); margin-top: 10px;">
                        ${stats.lowestScore}%
                    </div>
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 30px;">
            <h3>Subject-Wise Performance</h3>
            <div style="margin-top: 20px;">
                ${renderSubjectPerformance(stats.subjectPerformance)}
            </div>
        </div>
        
        <div style="margin-bottom: 30px;">
            <h3>Performance Trend</h3>
            <div style="margin-top: 20px;">
                ${renderPerformanceTrend(stats.recentResults)}
            </div>
        </div>
        
        <div style="margin-bottom: 30px;">
            <h3>Grade Distribution</h3>
            <div style="margin-top: 20px;">
                ${renderGradeDistribution(stats.gradeDistribution)}
            </div>
        </div>
        
        ${stats.weakAreas.length > 0 ? `
        <div style="margin-bottom: 30px;">
            <h3>Areas for Improvement</h3>
            <div style="margin-top: 20px;">
                ${renderWeakAreas(stats.weakAreas)}
            </div>
        </div>
        ` : ''}
    `;
}

// Render subject performance
function renderSubjectPerformance(subjectPerformance) {
    const subjects = Object.keys(subjectPerformance).sort((a, b) => 
        subjectPerformance[b].average - subjectPerformance[a].average
    );
    
    return subjects.map(subject => {
        const perf = subjectPerformance[subject];
        const color = perf.average >= 80 ? 'var(--success-color)' : 
                     perf.average >= 70 ? 'var(--warning-color)' : 
                     'var(--danger-color)';
        
        return `
            <div class="card" style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0;">${subject}</h4>
                    <div style="font-size: 1.5rem; font-weight: bold; color: ${color};">
                        ${Math.round(perf.average)}%
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px;">
                    <div>
                        <small style="color: var(--text-light);">Exams Taken</small>
                        <div style="font-weight: 600;">${perf.count}</div>
                    </div>
                    <div>
                        <small style="color: var(--text-light);">Highest</small>
                        <div style="font-weight: 600; color: var(--success-color);">${perf.highest}%</div>
                    </div>
                    <div>
                        <small style="color: var(--text-light);">Lowest</small>
                        <div style="font-weight: 600; color: var(--danger-color);">${perf.lowest}%</div>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <div style="background: var(--bg-secondary); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: ${color}; height: 100%; width: ${perf.average}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render performance trend
function renderPerformanceTrend(recentResults) {
    if (recentResults.length === 0) {
        return '<p style="color: var(--text-light);">No recent results to display.</p>';
    }
    
    const maxScore = 100;
    const chartHeight = 200;
    
    return `
        <div class="card">
            <div style="position: relative; height: ${chartHeight}px; padding: 20px;">
                <svg width="100%" height="${chartHeight}" style="position: absolute; top: 0; left: 0;">
                    ${recentResults.map((result, index) => {
                        const x = (index / (recentResults.length - 1 || 1)) * 100;
                        const y = 100 - (result.score / maxScore) * 100;
                        const nextX = recentResults[index + 1] ? 
                            ((index + 1) / (recentResults.length - 1)) * 100 : x;
                        const nextY = recentResults[index + 1] ? 
                            100 - (recentResults[index + 1].score / maxScore) * 100 : y;
                        
                        return `
                            <circle cx="${x}%" cy="${y}%" r="4" fill="var(--primary-color)" />
                            ${index < recentResults.length - 1 ? 
                                `<line x1="${x}%" y1="${y}%" x2="${nextX}%" y2="${nextY}%" stroke="var(--primary-color)" stroke-width="2" />` : ''}
                        `;
                    }).join('')}
                </svg>
                <div style="display: flex; justify-content: space-between; margin-top: ${chartHeight - 20}px; font-size: 0.85rem; color: var(--text-light);">
                    ${recentResults.map((result, index) => {
                        const date = new Date(result.submittedAt);
                        return `<span>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`;
                    }).join('')}
                </div>
            </div>
            <div style="display: flex; justify-content: space-around; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                ${recentResults.map((result, index) => {
                    return `
                        <div style="text-align: center;">
                            <div style="font-size: 0.75rem; color: var(--text-light);">Exam ${index + 1}</div>
                            <div style="font-weight: 600; color: var(--primary-color);">${result.score}%</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Render grade distribution
function renderGradeDistribution(gradeDistribution) {
    const total = Object.values(gradeDistribution).reduce((sum, count) => sum + count, 0);
    if (total === 0) {
        return '<p style="color: var(--text-light);">No grades to display.</p>';
    }
    
    const gradeColors = {
        'A': 'var(--success-color)',
        'B': '#22c55e',
        'C': 'var(--warning-color)',
        'D': '#f97316',
        'F': 'var(--danger-color)'
    };
    
    return `
        <div class="card">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px;">
                ${Object.keys(gradeDistribution).map(grade => {
                    const count = gradeDistribution[grade];
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    
                    return `
                        <div style="text-align: center; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                            <div style="font-size: 2rem; font-weight: bold; color: ${gradeColors[grade]};">
                                ${grade}
                            </div>
                            <div style="font-size: 1.5rem; font-weight: 600; margin-top: 5px;">
                                ${count}
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-light); margin-top: 5px;">
                                ${Math.round(percentage)}%
                            </div>
                            <div style="margin-top: 10px; background: var(--border-color); height: 6px; border-radius: 3px; overflow: hidden;">
                                <div style="background: ${gradeColors[grade]}; height: 100%; width: ${percentage}%;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Render weak areas
function renderWeakAreas(weakAreas) {
    return `
        <div class="card">
            <p style="color: var(--text-light); margin-bottom: 15px;">Focus on improving these subjects:</p>
            ${weakAreas.map(area => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 10px;">
                    <div>
                        <strong>${area.subject}</strong>
                        <div style="font-size: 0.85rem; color: var(--text-light);">Current average: ${Math.round(area.average)}%</div>
                    </div>
                    <div style="font-size: 1.2rem; font-weight: bold; color: var(--danger-color);">
                        ${Math.round(area.average)}%
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Load lecturer analytics
function loadLecturerAnalytics() {
    const user = getCurrentUser();
    const exams = getData('lms_exams') || [];
    const results = getData('lms_results') || [];
    
    // Filter lecturer's exams
    const lecturerExams = exams.filter(e => e.lecturerId === user.id);
    
    if (lecturerExams.length === 0) {
        const container = document.getElementById('analytics-content');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-light);">
                    <div style="font-size: 3rem; margin-bottom: 15px;">📊</div>
                    <h3>No Analytics Data Yet</h3>
                    <p>Create and conduct some exams to see analytics here.</p>
                </div>
            `;
        }
        return;
    }
    
    // Calculate statistics
    const stats = calculateLecturerStats(lecturerExams, results);
    
    // Render analytics
    renderLecturerAnalytics(stats, lecturerExams, results);
}

// Calculate lecturer statistics
function calculateLecturerStats(exams, results) {
    const examResults = exams.map(exam => {
        const examResultsList = results.filter(r => r.examId === exam.id);
        const totalStudents = examResultsList.length;
        const totalScore = examResultsList.reduce((sum, r) => sum + r.score, 0);
        const averageScore = totalStudents > 0 ? totalScore / totalStudents : 0;
        const passCount = examResultsList.filter(r => r.score >= 50).length;
        const failCount = totalStudents - passCount;
        
        return {
            exam: exam,
            totalStudents,
            averageScore,
            passCount,
            failCount,
            passRate: totalStudents > 0 ? (passCount / totalStudents) * 100 : 0
        };
    });
    
    // Overall statistics
    const totalExams = exams.length;
    const totalStudents = examResults.reduce((sum, er) => sum + er.totalStudents, 0);
    const overallAverage = examResults.length > 0 ?
        examResults.reduce((sum, er) => sum + er.averageScore, 0) / examResults.length : 0;
    
    // Subject-wise performance
    const subjectStats = {};
    examResults.forEach(er => {
        const subject = er.exam.subject;
        if (!subjectStats[subject]) {
            subjectStats[subject] = {
                exams: 0,
                totalStudents: 0,
                totalScore: 0,
                passCount: 0
            };
        }
        subjectStats[subject].exams++;
        subjectStats[subject].totalStudents += er.totalStudents;
        subjectStats[subject].totalScore += er.averageScore * er.totalStudents;
        subjectStats[subject].passCount += er.passCount;
    });
    
    Object.keys(subjectStats).forEach(subject => {
        const stat = subjectStats[subject];
        stat.averageScore = stat.totalStudents > 0 ? stat.totalScore / stat.totalStudents : 0;
        stat.passRate = stat.totalStudents > 0 ? (stat.passCount / stat.totalStudents) * 100 : 0;
    });
    
    return {
        totalExams,
        totalStudents,
        overallAverage,
        examResults,
        subjectStats
    };
}

// Render lecturer analytics
function renderLecturerAnalytics(stats, exams, results) {
    const container = document.getElementById('analytics-content');
    if (!container) return;
    
    container.innerHTML = `
        <div style="margin-bottom: 30px;">
            <h3>Overall Statistics</h3>
            <div class="cards-grid" style="margin-top: 20px;">
                <div class="card">
                    <h4>Total Exams</h4>
                    <div style="font-size: 2.5rem; font-weight: bold; color: var(--primary-color); margin-top: 10px;">
                        ${stats.totalExams}
                    </div>
                </div>
                <div class="card">
                    <h4>Total Students</h4>
                    <div style="font-size: 2.5rem; font-weight: bold; color: var(--success-color); margin-top: 10px;">
                        ${stats.totalStudents}
                    </div>
                </div>
                <div class="card">
                    <h4>Overall Average</h4>
                    <div style="font-size: 2.5rem; font-weight: bold; color: var(--primary-color); margin-top: 10px;">
                        ${Math.round(stats.overallAverage)}%
                    </div>
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 30px;">
            <h3>Exam Performance</h3>
            <div style="margin-top: 20px;">
                ${renderExamPerformance(stats.examResults)}
            </div>
        </div>
        
        <div style="margin-bottom: 30px;">
            <h3>Subject-Wise Performance</h3>
            <div style="margin-top: 20px;">
                ${renderSubjectStats(stats.subjectStats)}
            </div>
        </div>
    `;
}

// Render exam performance
function renderExamPerformance(examResults) {
    return examResults.map(er => {
        const color = er.averageScore >= 70 ? 'var(--success-color)' : 
                     er.averageScore >= 50 ? 'var(--warning-color)' : 
                     'var(--danger-color)';
        
        return `
            <div class="card" style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div>
                        <h4 style="margin: 0 0 5px 0;">${er.exam.title}</h4>
                        <small style="color: var(--text-light);">${er.exam.subject}</small>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.8rem; font-weight: bold; color: ${color};">
                            ${Math.round(er.averageScore)}%
                        </div>
                        <small style="color: var(--text-light);">Average</small>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px;">
                    <div>
                        <small style="color: var(--text-light);">Students</small>
                        <div style="font-weight: 600;">${er.totalStudents}</div>
                    </div>
                    <div>
                        <small style="color: var(--text-light);">Passed</small>
                        <div style="font-weight: 600; color: var(--success-color);">${er.passCount}</div>
                    </div>
                    <div>
                        <small style="color: var(--text-light);">Failed</small>
                        <div style="font-weight: 600; color: var(--danger-color);">${er.failCount}</div>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <small style="color: var(--text-light);">Pass Rate</small>
                        <small style="color: var(--text-light);">${Math.round(er.passRate)}%</small>
                    </div>
                    <div style="background: var(--bg-secondary); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: ${color}; height: 100%; width: ${er.passRate}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render subject stats
function renderSubjectStats(subjectStats) {
    const subjects = Object.keys(subjectStats).sort((a, b) => 
        subjectStats[b].averageScore - subjectStats[a].averageScore
    );
    
    return subjects.map(subject => {
        const stat = subjectStats[subject];
        const color = stat.averageScore >= 70 ? 'var(--success-color)' : 
                     stat.averageScore >= 50 ? 'var(--warning-color)' : 
                     'var(--danger-color)';
        
        return `
            <div class="card" style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 style="margin: 0;">${subject}</h4>
                    <div style="font-size: 1.5rem; font-weight: bold; color: ${color};">
                        ${Math.round(stat.averageScore)}%
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                    <div>
                        <small style="color: var(--text-light);">Exams</small>
                        <div style="font-weight: 600;">${stat.exams}</div>
                    </div>
                    <div>
                        <small style="color: var(--text-light);">Students</small>
                        <div style="font-weight: 600;">${stat.totalStudents}</div>
                    </div>
                    <div>
                        <small style="color: var(--text-light);">Pass Rate</small>
                        <div style="font-weight: 600; color: ${color};">${Math.round(stat.passRate)}%</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
