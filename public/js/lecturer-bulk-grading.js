// Bulk Grading System for Lecturers

window.bulkGradingMode = false;
window.selectedResults = new Set();

// Export Selected Results to CSV
window.exportSelectedResults = function() {
    if (window.selectedResults.size === 0) {
        alert('Please select at least one result to export');
        return;
    }
    
    const results = getData('lms_results') || [];
    const exams = getData('lms_exams') || [];
    const users = getData('lms_users') || { students: [] };
    const selected = Array.from(window.selectedResults);
    const selectedResults = results.filter(r => selected.includes(r.id));
    
    exportResultsToCSV(selectedResults, exams, users.students, 'selected_results');
};

// Export All Results to CSV
window.exportAllResults = function() {
    const user = getCurrentUser();
    const results = getData('lms_results') || [];
    const exams = getData('lms_exams') || [];
    const users = getData('lms_users') || { students: [] };
    
    // Filter to only lecturer's exams
    const lecturerExams = exams.filter(e => e.lecturerId === user.id);
    const lecturerExamIds = lecturerExams.map(e => e.id);
    const lecturerResults = results.filter(r => lecturerExamIds.includes(r.examId));
    
    exportResultsToCSV(lecturerResults, exams, users.students, 'all_results');
};

function exportResultsToCSV(results, exams, students, filename) {
    if (results.length === 0) {
        alert('No results to export');
        return;
    }
    
    // Create CSV headers
    const headers = ['Student Name', 'Username', 'Class', 'Exam Title', 'Subject', 'Type', 'Score', 'Grade', 'Submitted At'];
    const rows = [headers.join(',')];
    
    // Sort by exam title and student name
    results.sort((a, b) => {
        const examA = exams.find(e => e.id === a.examId);
        const examB = exams.find(e => e.id === b.examId);
        const nameA = (examA ? examA.title : '') + ' - ' + (students.find(s => s.id === a.studentId)?.fullName || '');
        const nameB = (examB ? examB.title : '') + ' - ' + (students.find(s => s.id === b.studentId)?.fullName || '');
        return nameA.localeCompare(nameB);
    });
    
    // Add data rows
    results.forEach(result => {
        const student = students.find(s => s.id === result.studentId);
        const exam = exams.find(e => e.id === result.examId);
        
        const studentName = student ? student.fullName : 'Unknown';
        const username = student ? student.username : 'N/A';
        const studentClass = student ? student.class : 'N/A';
        const examTitle = exam ? exam.title : 'Unknown Exam';
        const subject = exam ? exam.subject : 'N/A';
        const type = exam ? exam.type : 'N/A';
        const score = result.score !== undefined ? result.score : 'N/A';
        const grade = result.score !== undefined ? getLetterGrade(result.score) : 'N/A';
        const submittedAt = result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A';
        
        // Escape commas and quotes in CSV
        const escapeCSV = (str) => {
            if (str === null || str === undefined) return '';
            const s = String(str);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };
        
        rows.push([
            escapeCSV(studentName),
            escapeCSV(username),
            escapeCSV(studentClass),
            escapeCSV(examTitle),
            escapeCSV(subject),
            escapeCSV(type),
            escapeCSV(score),
            escapeCSV(grade),
            escapeCSV(submittedAt)
        ].join(','));
    });
    
    // Create CSV content
    const csvContent = rows.join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert(`${results.length} result(s) exported successfully!`, 'success');
}

function loadBulkGrading() {
    const examId = document.getElementById('bulkExamSelect').value;
    if (!examId) return;
    
    const user = getCurrentUser();
    const exams = getData('lms_exams');
    const results = getData('lms_results');
    
    const exam = exams.find(e => e.id === examId);
    if (!exam) return;
    
    const examResults = results.filter(r => r.examId === examId);
    
    // Populate results table with checkboxes
    loadResults(); // This will reload with the exam filter
}

function enableBulkGrading() {
    window.bulkGradingMode = !window.bulkGradingMode;
    const btn = document.getElementById('bulkGradingBtn');
    const actions = document.getElementById('bulkGradingActions');
    
    if (window.bulkGradingMode) {
        btn.textContent = 'Disable Bulk Grading';
        btn.classList.add('btn-success');
        actions.style.display = 'block';
        window.selectedResults.clear();
        updateSelectedCount();
    } else {
        btn.textContent = 'Enable Bulk Grading';
        btn.classList.remove('btn-success');
        actions.style.display = 'none';
        window.selectedResults.clear();
        // Remove all checkboxes
        document.querySelectorAll('.result-checkbox').forEach(cb => cb.remove());
    }
    
    if (typeof loadResults === 'function') {
        loadResults();
    }
}

function toggleAllResults() {
    const selectAll = document.getElementById('selectAllResults');
    const checkboxes = document.querySelectorAll('.result-checkbox');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        const resultId = cb.value;
        if (selectAll.checked) {
            window.selectedResults.add(resultId);
        } else {
            window.selectedResults.delete(resultId);
        }
    });
    
    updateSelectedCount();
}

function toggleResult(resultId) {
    if (window.selectedResults.has(resultId)) {
        window.selectedResults.delete(resultId);
    } else {
        window.selectedResults.add(resultId);
    }
    updateSelectedCount();
}

function updateSelectedCount() {
    const count = document.getElementById('selectedCount');
    if (count) {
        count.textContent = `${window.selectedResults.size} result(s) selected`;
    }
}

function bulkGradeSelected() {
    if (window.selectedResults.size === 0) {
        alert('Please select at least one result to grade');
        return;
    }
    
    const results = getData('lms_results');
    const selected = Array.from(window.selectedResults);
    
    // Show grading modal for each selected result
    const firstResult = results.find(r => selected.includes(r.id));
    if (!firstResult) return;
    
    // For now, show a simple prompt for each
    // In a full implementation, you'd have a proper grading interface
    let graded = 0;
    selected.forEach(resultId => {
        const result = results.find(r => r.id === resultId);
        if (result && result.questionDetails) {
            // Check if it has essay questions
            const hasEssay = result.questionDetails.some(q => !q.hasOwnProperty('options') || q.options.length === 0);
            
            if (hasEssay) {
                // For essay questions, we need manual grading
                const score = prompt(`Enter score for ${result.studentName} (0-100):`);
                if (score !== null && !isNaN(score)) {
                    const numScore = Math.max(0, Math.min(100, parseInt(score)));
                    result.score = numScore;
                    result.letterGrade = getLetterGrade(numScore);
                    graded++;
                }
            }
        }
    });
    
    if (graded > 0) {
        saveData('lms_results', results);
        if (typeof showNotification === 'function') {
            showNotification(`${graded} result(s) graded successfully!`, 'success');
        } else {
            alert(`${graded} result(s) graded successfully!`);
        }
        if (typeof loadResults === 'function') {
            loadResults();
        }
        window.selectedResults.clear();
        updateSelectedCount();
    }
}

// Update loadResults to include checkboxes when bulk grading is enabled
const originalLoadResults = window.loadResults;
window.loadResults = function() {
    if (originalLoadResults) originalLoadResults();
    
    if (window.bulkGradingMode) {
        const tbody = document.getElementById('results-tbody');
        if (tbody) {
            const rows = tbody.querySelectorAll('tr');
            rows.forEach((row, index) => {
                // Add checkbox as first cell if not already present
                if (!row.querySelector('.result-checkbox')) {
                    const firstCell = row.querySelector('td');
                    if (firstCell) {
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'result-checkbox';
                        checkbox.value = row.dataset.resultId || '';
                        checkbox.onchange = () => toggleResult(checkbox.value);
                        firstCell.insertBefore(checkbox, firstCell.firstChild);
                    }
                }
            });
        }
    }
};

// Populate exam dropdown for bulk grading
document.addEventListener('DOMContentLoaded', function() {
    const examSelect = document.getElementById('bulkExamSelect');
    if (examSelect) {
        const user = getCurrentUser();
        const exams = getData('lms_exams');
        const lecturerExams = exams.filter(e => e.lecturerId === user.id);
        
        lecturerExams.forEach(exam => {
            const option = document.createElement('option');
            option.value = exam.id;
            option.textContent = `${exam.title} - ${exam.subject}`;
            examSelect.appendChild(option);
        });
    }
});
