// Announcements System for Lecturers

async function loadAnnouncements() {
    const user = getCurrentUser();
    if (!user) return;
    
    let announcements = [];
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
    
    const lecturerAnnouncements = announcements.filter(a => {
        if (!a) return false;
        
        // Normalize type/target
        const type = (a.type || a.target || '').toLowerCase();
        
        // Created by this lecturer
        if (a.createdBy === user.id || a.lecturerId === user.id) return true;
        
        // Site-wide or lecturer-targeted
        if (['all', 'general', 'lecturers', ''].includes(type)) return true;
        
        return false;
    });
    
    const container = document.getElementById('announcements-list');
    if (!container) return;
    
    if (lecturerAnnouncements.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);">No announcements yet. Create your first announcement!</div>';
        return;
    }
    
    container.innerHTML = '';
    
    lecturerAnnouncements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const priorityColors = {
        urgent: 'var(--danger-color)',
        high: 'var(--warning-color)',
        normal: 'var(--primary-color)',
        general: 'var(--primary-color)'
    };
    
    lecturerAnnouncements.forEach(announcement => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginBottom = '15px';
        
        const priority = (announcement.priority || announcement.type || 'normal').toLowerCase();
        const color = priorityColors[priority] || 'var(--primary-color)';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h4 style="margin: 0; flex: 1; min-width: 200px; color: var(--text-color);">${escapeHtml(announcement.title)}</h4>
                <span style="padding: 6px 14px; border-radius: 6px; background: ${color}; color: white; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">
                    ${priority.toUpperCase()}
                </span>
            </div>
            <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 15px; white-space: pre-wrap; line-height: 1.6; color: var(--text-color);">
                ${escapeHtml(announcement.message || announcement.content || '')}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 15px; font-size: 0.9rem; color: var(--text-light); margin-bottom: 15px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                <div><strong>Classes:</strong> ${announcement.targetClasses?.join(', ') || announcement.classes?.join(', ') || 'Global'}</div>
                <div><strong>Posted:</strong> ${typeof formatDate === 'function' ? formatDate(announcement.createdAt) : new Date(announcement.createdAt).toLocaleDateString()}</div>
                <div><strong>By:</strong> ${announcement.createdBy === user.id ? 'You' : escapeHtml(announcement.authorName || 'Admin')}</div>
            </div>
            <div style="display: flex; justify-content: flex-end;">
                ${(announcement.createdBy === user.id) ? 
                    `<button class="btn btn-small btn-danger" onclick="handleDeleteAnnouncement('${announcement.id}')">Delete</button>` : 
                    `<span style="font-style: italic; font-size: 0.8rem;">Site-wide announcement</span>`
                }
            </div>
        `;
        
        container.appendChild(card);
    });

    // Update count if exists
    const countBadge = document.getElementById('announcement-count');
    if (countBadge) {
        countBadge.textContent = lecturerAnnouncements.length;
    }
}

// Escaping
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create notifications for students when announcement is posted
async function createAnnouncementNotifications(announcement, selectedClasses) {
    let students = [];
    if (typeof getUsers === 'function') {
        try {
            const users = await getUsers();
            students = users.students || [];
        } catch (error) {
            console.warn('Supabase getUsers failed:', error);
            students = (getData('lms_users')?.students) || [];
        }
    } else {
        students = (getData('lms_users')?.students) || [];
    }
    
    if (students.length === 0) return;
    
    // Find students in target classes
    const targetStudents = students.filter(student => 
        student.class && selectedClasses.includes(student.class)
    );
    
    // Create notifications using global createNotification
    for (const student of targetStudents) {
        if (typeof createNotification === 'function') {
            await createNotification(
                'announcement',
                'New Announcement',
                `${announcement.title} - Posted by ${announcement.lecturerName || 'Lecturer'}`,
                '#announcements',
                { announcementId: announcement.id },
                student.id,
                'student'
            );
        }
    }
}

// Setup announcement form
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('announcementForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const user = getCurrentUser();
            const title = document.getElementById('announcementTitle').value.trim();
            const message = document.getElementById('announcementMessage').value.trim();
            const priority = document.getElementById('announcementPriority').value;
            const target = document.getElementById('announcementTarget').value;
            
            const checkboxes = document.querySelectorAll('#announcementClassesContainer input[type="checkbox"]:checked');
            const selectedClasses = Array.from(checkboxes).map(cb => cb.value);
            
            if (!title || !message) {
                alert('Please fill in all fields');
                return;
            }
            
            if (target === 'class' && selectedClasses.length === 0) {
                alert('Please select at least one class');
                return;
            }
            
            const newAnnouncement = {
                id: Date.now().toString(),
                title,
                message,
                type: target === 'all' ? 'general' : target,
                priority,
                targetClasses: selectedClasses,
                classes: selectedClasses,
                lecturerId: user.id,
                lecturerName: user.fullName,
                createdBy: user.id,
                createdAt: new Date().toISOString()
            };
            
            // Use API service layer
            if (typeof saveAnnouncement === 'function') {
                try {
                    await saveAnnouncement(newAnnouncement);
                } catch (error) {
                    console.warn('Supabase saveAnnouncement failed, using localStorage:', error);
                    const announcements = getData('lms_announcements') || [];
                    announcements.push(newAnnouncement);
                    saveData('lms_announcements', announcements);
                }
            } else {
                const announcements = getData('lms_announcements') || [];
                announcements.push(newAnnouncement);
                saveData('lms_announcements', announcements);
            }
            
            // Create notifications for all students in the selected classes
            await createAnnouncementNotifications(newAnnouncement, selectedClasses);
            
            closeAnnouncementModal();
            await loadAnnouncements();
            if (typeof showNotification === 'function') {
                showNotification('Announcement posted successfully!', 'success');
            } else {
                alert('Announcement posted successfully!');
            }
        });
    }
    
    // Load announcements when section is shown
    const announcementsTab = document.querySelector('[onclick="showSection(\'announcements\')"]');
    if (announcementsTab) {
        announcementsTab.addEventListener('click', function() {
            setTimeout(loadAnnouncements, 100);
        });
    }
});

// Bulk Announcement Functions
window.showBulkAnnouncement = function() {
    const user = getCurrentUser();
    const classes = getData('lms_classes');
    const lecturerClasses = user.classes     || [];
    
    const modal = document.getElementById('bulkAnnouncementModal');
    const container = document.getElementById('bulkAnnouncementClassesContainer');
    
    if (!modal || !container) return;
    
    container.innerHTML = '';
    lecturerClasses.forEach(cls => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        checkboxItem.innerHTML = `
            <input type="checkbox" id="bulk_class_${cls}" value="${cls}" class="bulk-class-checkbox">
            <label for="bulk_class_${cls}">${cls}</label>
        `;
        container.appendChild(checkboxItem);
    });
    
    document.getElementById('bulkAnnouncementForm').reset();
    document.getElementById('bulkAllClasses').checked = false;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
};

window.closeBulkAnnouncementModal = function() {
    const modal = document.getElementById('bulkAnnouncementModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

window.toggleBulkClasses = function() {
    const selectAll = document.getElementById('bulkAllClasses').checked;
    document.querySelectorAll('.bulk-class-checkbox').forEach(cb => {
        cb.checked = selectAll;
    });
};

// Setup bulk announcement form
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('bulkAnnouncementForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const user = getCurrentUser();
            const title = document.getElementById('bulkAnnouncementTitle').value.trim();
            const message = document.getElementById('bulkAnnouncementMessage').value.trim();
            const priority = document.getElementById('bulkAnnouncementPriority').value;
            
            const checkboxes = document.querySelectorAll('#bulkAnnouncementClassesContainer input[type="checkbox"]:checked');
            const selectedClasses = Array.from(checkboxes).map(cb => cb.value);
            
            if (!title || !message) {
                alert('Please fill in all fields');
                return;
            }
            
            if (selectedClasses.length === 0) {
                alert('Please select at least one class');
                return;
            }
            
            const announcements = [];
            
            // Create announcement for each selected class
            for (const className of selectedClasses) {
                const newAnnouncement = {
                    id: Date.now().toString() + '_' + className + '_' + Math.random().toString(36).substr(2, 9),
                    title: `${title} (${className})`,
                    message,
                    type: priority || 'normal',
                    priority,
                    targetClasses: [className],
                    classes: [className],
                    lecturerId: user.id,
                    lecturerName: user.fullName,
                    createdBy: user.id,
                    createdAt: new Date().toISOString()
                };
                
                // Use API service layer
                if (typeof saveAnnouncement === 'function') {
                    try {
                        await saveAnnouncement(newAnnouncement);
                        await createAnnouncementNotifications(newAnnouncement, [className]);
                    } catch (error) {
                        console.warn('Supabase saveAnnouncement failed, using localStorage:', error);
                        announcements.push(newAnnouncement);
                    }
                } else {
                    announcements.push(newAnnouncement);
                }
            }
            
            // Save any that failed to save to Supabase
            if (announcements.length > 0) {
                const existing = getData('lms_announcements') || [];
                existing.push(...announcements);
                saveData('lms_announcements', existing);
            }
            
            closeBulkAnnouncementModal();
            await loadAnnouncements();
            if (typeof showNotification === 'function') {
                showNotification(`Announcement posted to ${selectedClasses.length} class(es) successfully!`, 'success');
            } else {
                alert(`Announcement posted to ${selectedClasses.length} class(es) successfully!`);
            }
        });
    }
});
