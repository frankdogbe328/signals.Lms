// Load progress and analytics
async function loadProgress() {
    const user = getCurrentUser();
    const container = document.getElementById('progress-container');
    const analyticsContent = document.getElementById('analytics-content');
    
    if (!container) return;
    
    // Get results
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
    
    // Get result releases
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
    
    // Get exams
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
    
    // Filter released results for this student
    const userResults = results.filter(r => isResultReleased(r, user, releases, exams));
    
    if (userResults.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px;"><p style="color: var(--text-light);">No results available yet. Your progress will appear here once you complete exams and results are released.</p></div>';
        if (analyticsContent) analyticsContent.innerHTML = '';
        return;
    }
    
    // Calculate statistics
    const totalExams = userResults.length;
    const avgScore = userResults.reduce((sum, r) => sum + (r.score || 0), 0) / totalExams;
    const highestScore = Math.max(...userResults.map(r => r.score || 0));
    const passedExams = userResults.filter(r => (r.score || 0) >= 50).length;
    const passRate = (passedExams / totalExams) * 100;
    
    // Group by subject
    const bySubject = {};
    userResults.forEach(r => {
        const subject = r.subject || 'Unknown';
        if (!bySubject[subject]) {
            bySubject[subject] = { count: 0, totalScore: 0, results: [] };
        }
        bySubject[subject].count++;
        bySubject[subject].totalScore += r.score || 0;
        bySubject[subject].results.push(r);
    });
    
    // Render overview
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div class="card" style="text-align: center; padding: 20px;">
                <h4 style="margin: 0 0 10px 0; color: var(--primary-color);">Total Exams</h4>
                <p style="font-size: 2rem; font-weight: bold; margin: 0;">${totalExams}</p>
            </div>
            <div class="card" style="text-align: center; padding: 20px;">
                <h4 style="margin: 0 0 10px 0; color: var(--success-color);">Average Score</h4>
                <p style="font-size: 2rem; font-weight: bold; margin: 0;">${avgScore.toFixed(1)}%</p>
            </div>
            <div class="card" style="text-align: center; padding: 20px;">
                <h4 style="margin: 0 0 10px 0; color: var(--warning-color);">Highest Score</h4>
                <p style="font-size: 2rem; font-weight: bold; margin: 0;">${highestScore}%</p>
            </div>
            <div class="card" style="text-align: center; padding: 20px;">
                <h4 style="margin: 0 0 10px 0; color: var(--danger-color);">Pass Rate</h4>
                <p style="font-size: 2rem; font-weight: bold; margin: 0;">${passRate.toFixed(1)}%</p>
            </div>
        </div>
        
        <div class="card" style="margin-bottom: 20px;">
            <h3 style="margin-top: 0;">Performance by Subject</h3>
            <div style="display: flex; flex-direction: column; gap: 15px;">
                ${Object.entries(bySubject).map(([subject, data]) => {
                    const avg = (data.totalScore / data.count).toFixed(1);
                    const grade = getLetterGrade(avg);
                    const color = getGradeColor(grade);
                    return `
                        <div style="padding: 15px; background: var(--light-color); border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <div>
                                    <h4 style="margin: 0 0 5px 0;">${subject}</h4>
                                    <p style="margin: 0; color: var(--text-light);">${data.count} exam${data.count !== 1 ? 's' : ''}</p>
                                </div>
                                <div style="text-align: right;">
                                    <p style="margin: 0; font-size: 1.5rem; font-weight: bold; color: ${color};">${avg}%</p>
                                    <p style="margin: 0; color: var(--text-light);">Grade: ${grade}</p>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div class="card">
            <h3 style="margin-top: 0;">Recent Results</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--light-color);">
                            <th style="padding: 12px; text-align: left;">Exam</th>
                            <th style="padding: 12px; text-align: left;">Subject</th>
                            <th style="padding: 12px; text-align: center;">Score</th>
                            <th style="padding: 12px; text-align: center;">Grade</th>
                            <th style="padding: 12px; text-align: center;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userResults.slice(0, 10).map(r => {
                            const grade = getLetterGrade(r.score);
                            const color = getGradeColor(grade);
                            return `
                                <tr>
                                    <td style="padding: 12px;">${r.examTitle || 'N/A'}</td>
                                    <td style="padding: 12px;">${r.subject || 'N/A'}</td>
                                    <td style="padding: 12px; text-align: center; font-weight: bold;">${r.score || 0}%</td>
                                    <td style="padding: 12px; text-align: center; color: ${color}; font-weight: bold;">${grade}</td>
                                    <td style="padding: 12px; text-align: center;">${r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Render analytics
    if (analyticsContent) {
        analyticsContent.innerHTML = `
            <div class="card">
                <h3 style="margin-top: 0;">Performance Analytics</h3>
                <div style="margin-bottom: 30px;">
                    <h4>Score Distribution</h4>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${['90-100', '80-89', '70-79', '60-69', '50-59', '0-49'].map(range => {
                            const [min, max] = range.split('-').map(Number);
                            const count = userResults.filter(r => {
                                const score = r.score || 0;
                                return score >= min && score <= max;
                            }).length;
                            const percentage = (count / totalExams) * 100;
                            return `
                                <div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                        <span>${range}%</span>
                                        <span>${count} (${percentage.toFixed(1)}%)</span>
                                    </div>
                                    <div style="height: 20px; background: var(--light-color); border-radius: 10px; overflow: hidden;">
                                        <div style="height: 100%; width: ${percentage}%; background: linear-gradient(90deg, var(--primary-color), var(--secondary-color)); transition: width 0.5s;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div>
                    <h4>Performance Trends</h4>
                    <p style="color: var(--text-light);">Your performance is ${avgScore >= 70 ? 'excellent' : avgScore >= 50 ? 'good' : 'needs improvement'}. Keep up the great work!</p>
                    <div style="margin-top: 20px; padding: 15px; background: var(--light-color); border-radius: 8px;">
                        <p><strong>Strengths:</strong> ${Object.entries(bySubject).filter(([s, d]) => (d.totalScore / d.count) >= 70).map(([s]) => s).join(', ') || 'Keep working on all subjects'}</p>
                        <p><strong>Areas for Improvement:</strong> ${Object.entries(bySubject).filter(([s, d]) => (d.totalScore / d.count) < 50).map(([s]) => s).join(', ') || 'None - great job!'}</p>
                    </div>
                </div>
            </div>
        `;
    }
}

window.loadProgress = loadProgress;

// Show progress view (overview or analytics)
window.showProgressView = function(view) {
    const overviewBtn = document.querySelector('[onclick="showProgressView(\'overview\')"]');
    const analyticsBtn = document.querySelector('[onclick="showProgressView(\'analytics\')"]');
    const container = document.getElementById('progress-container');
    const analyticsContent = document.getElementById('analytics-content');
    
    if (view === 'analytics') {
        if (overviewBtn) overviewBtn.classList.remove('active');
        if (analyticsBtn) analyticsBtn.classList.add('active');
        if (container) container.style.display = 'none';
        if (analyticsContent) analyticsContent.style.display = 'block';
    } else {
        if (overviewBtn) overviewBtn.classList.add('active');
        if (analyticsBtn) analyticsBtn.classList.remove('active');
        if (container) container.style.display = 'block';
        if (analyticsContent) analyticsContent.style.display = 'none';
    }
};
