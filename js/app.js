// Initialize localStorage data structure
function initializeStorage() {
    if (!localStorage.getItem('lms_users')) {
        localStorage.setItem('lms_users', JSON.stringify({
            students: [],
            lecturers: [],
            admin: { username: 'admin', password: 'admin123', name: 'System Administrator' }
        }));
    }
    
    if (!localStorage.getItem('lms_classes')) {
        localStorage.setItem('lms_classes', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('lms_courses')) {
        localStorage.setItem('lms_courses', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('lms_materials')) {
        localStorage.setItem('lms_materials', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('lms_exams')) {
        localStorage.setItem('lms_exams', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('lms_results')) {
        localStorage.setItem('lms_results', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('lms_result_releases')) {
        localStorage.setItem('lms_result_releases', JSON.stringify({}));
    }
    
    if (!localStorage.getItem('lms_announcements')) {
        localStorage.setItem('lms_announcements', JSON.stringify([]));
    }
}

// Get data from localStorage
function getData(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

// Save data to localStorage
function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Get current user
function getCurrentUser() {
    const userStr = sessionStorage.getItem('current_user');
    return userStr ? JSON.parse(userStr) : null;
}

// Set current user
function setCurrentUser(user) {
    sessionStorage.setItem('current_user', JSON.stringify(user));
}

// Clear current user
function clearCurrentUser() {
    sessionStorage.removeItem('current_user');
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format time duration
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

// Convert score to letter grade
function getLetterGrade(score) {
    if (score >= 90 && score <= 100) return 'A';
    if (score >= 80 && score <= 89) return 'B';
    if (score >= 70 && score <= 79) return 'C+';
    if (score >= 60 && score <= 69) return 'C';
    if (score >= 50 && score <= 59) return 'C-';
    if (score >= 40 && score <= 49) return 'D';
    if (score >= 0 && score <= 39) return 'F';
    return 'N/A';
}

// Get grade color for styling
function getGradeColor(grade) {
    switch(grade) {
        case 'A': return '#10b981'; // Green
        case 'B': return '#3b82f6'; // Blue
        case 'C+': return '#8b5cf6'; // Purple
        case 'C': return '#f59e0b'; // Orange
        case 'C-': return '#f97316'; // Orange-red
        case 'D': return '#ef4444'; // Red
        case 'F': return '#991b1b'; // Dark red
        default: return '#6b7280'; // Gray
    }
}

// Calculate remaining time for exam
function getRemainingTime(exam) {
    if (!exam.startTime) return null;
    
    const startTime = new Date(exam.startTime);
    const durationMs = exam.duration * 60 * 1000; // Convert minutes to milliseconds
    const endTime = new Date(startTime.getTime() + durationMs);
    const now = new Date();
    
    const remaining = endTime - now;
    
    if (remaining <= 0) {
        return { expired: true, minutes: 0, seconds: 0 };
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return { expired: false, minutes, seconds, totalSeconds: Math.floor(remaining / 1000) };
}

// Initialize on page load (localStorage legacy — kept for utility functions below)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStorage);
} else {
    initializeStorage();
}

// Toggle password visibility
window.togglePassword = function(id) {
    const input = document.getElementById(id);
    if (!input) return;
    const isVisible = input.type === 'text';
    input.type = isVisible ? 'password' : 'text';
    const btn = input.closest('.password-wrapper')?.querySelector('.eye-toggle');
    if (btn) {
        btn.innerHTML = isVisible ? eyeIcon() : eyeOffIcon();
        btn.title = isVisible ? 'Show password' : 'Hide password';
    }
};

function eyeIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function eyeOffIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

// Global helper for downloading files safely (including data URLs)
window.downloadFile = function(url, fileName) {
    if (!url) return;
    
    let downloadUrl = url;
    let isBlob = false;
    
    // For data URLs (Base64), convert to Blob for better mobile/iOS compatibility
    if (url.startsWith('data:')) {
        try {
            const parts = url.split(',');
            const mime = parts[0].match(/:(.*?);/)[1];
            const b64 = atob(parts[1]);
            let n = b64.length;
            const u8arr = new Uint8Array(n);
            
            while (n--) {
                u8arr[n] = b64.charCodeAt(n);
            }
            
            const blob = new Blob([u8arr], { type: mime });
            downloadUrl = URL.createObjectURL(blob);
            isBlob = true;
        } catch (e) {
            console.error('Error converting data URL to Blob:', e);
            // Fallback to original URL if conversion fails
            downloadUrl = url;
        }
    }
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    // Use the provided filename or a default
    link.download = fileName || 'download';
    
    // Add to body, click, and remove
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(link);
        if (isBlob) {
            URL.revokeObjectURL(downloadUrl);
        }
    }, 100);
    
    console.log('Download triggered for:', fileName);
};
