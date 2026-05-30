// Student Announcements View

// Make function globally accessible
window.loadStudentAnnouncements = async function() {
    console.log('[Announcements] loadStudentAnnouncements called');
    const user = getCurrentUser();
    if (!user) return;
    
    // Normalize user class logic (matching dashboard)
    let rawUserClass = user.class;
    if (Array.isArray(rawUserClass)) rawUserClass = rawUserClass[0];
    if (!rawUserClass && Array.isArray(user.classes) && user.classes.length > 0) {
        rawUserClass = user.classes[0];
    }
    const studentClass = String(rawUserClass || '').trim();
    console.log('[Announcements] Resolved Student Class:', studentClass);

    let announcements = [];
    if (typeof getAnnouncements === 'function') {
        try {
            announcements = await getAnnouncements();
            console.log('[Announcements] Fetched from Supabase:', announcements.length);
        } catch (error) {
            console.warn('[Announcements] Supabase getAnnouncements failed, using localStorage:', error);
            announcements = getData('lms_announcements') || [];
        }
    } else {
        announcements = getData('lms_announcements') || [];
    }
    
    // Filter announcements for student's class OR global ones
    const studentAnnouncements = announcements.filter(a => {
        if (!a) return false;
        
        // Normalize type/target for comparison
        const type = (a.type || a.target || '').toLowerCase();
        
        // Site-wide announcements
        if (['all', 'general', 'students', ''].includes(type)) return true;
        
        // Class-specific announcements (check targetClasses and classes arrays)
        const targetClasses = a.targetClasses || a.classes || [];
        
        // Check if studentClass matches any of the target classes
        if (studentClass && targetClasses.includes(studentClass)) return true;
        
        return false;
    });
    
    console.log('[Announcements] Filtered for student:', studentAnnouncements.length);

    const container = document.getElementById('student-announcements-list');
    if (!container) {
        console.error('[Announcements] Container #student-announcements-list not found');
        return;
    }
    
    if (studentAnnouncements.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-light); background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color);">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">📢 No announcements yet</p>
                <p style="font-size: 0.9rem;">Check back later for school updates and news.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    // Sort by date (newest first)
    studentAnnouncements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const priorityColors = {
        urgent: 'var(--danger-color)',
        high: 'var(--warning-color)',
        normal: 'var(--primary-color)',
        general: 'var(--primary-color)',
        all: 'var(--primary-color)'
    };
    
    studentAnnouncements.forEach(announcement => {
        const card = document.createElement('div');
        card.className = 'announcement-card';
        card.style.cssText = 'background: var(--card-bg); border-radius: 12px; padding: 25px; margin-bottom: 20px; border-left: 5px solid ' + (priorityColors[announcement.type?.toLowerCase()] || 'var(--primary-color)') + '; box-shadow: 0 4px 15px var(--shadow);';
        
        const typeLabel = (announcement.type || 'GENERAL').toUpperCase();
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h4 style="margin: 0; font-size: 1.3rem; color: var(--text-color);">${escapeHtml(announcement.title)}</h4>
                <span style="padding: 5px 15px; border-radius: 20px; background: ${priorityColors[announcement.type?.toLowerCase()] || 'var(--primary-color)'}; color: white; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${typeLabel}
                </span>
            </div>
            <div style="margin-bottom: 20px; line-height: 1.7; color: var(--text-color); font-size: 1.05rem; white-space: pre-wrap;">${escapeHtml(announcement.message || announcement.content)}</div>
            <div style="display: flex; gap: 20px; font-size: 0.85rem; color: var(--text-light); flex-wrap: wrap; padding-top: 15px; border-top: 1px solid var(--border-color);">
                <span style="display: flex; align-items: center; gap: 6px;">👤 <strong>Posted by:</strong> ${escapeHtml(announcement.authorName || 'Admin')}</span>
                <span style="display: flex; align-items: center; gap: 6px;">📅 <strong>Date:</strong> ${typeof formatDate === 'function' ? formatDate(announcement.createdAt) : new Date(announcement.createdAt).toLocaleDateString()}</span>
            </div>
        `;
        
        container.appendChild(card);
    });
};

function escapeHtml(text) {
    const div = document.createElement('div');
    if (!text) return '';
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when tab is clicked
document.addEventListener('DOMContentLoaded', function() {
    const announcementsTab = document.querySelector('[onclick*="showSection(\'announcements\'"]');
    if (announcementsTab) {
        announcementsTab.addEventListener('click', function() {
            setTimeout(window.loadStudentAnnouncements, 100);
        });
    }
});
