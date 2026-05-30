// Notifications System

let notificationCheckInterval = null;

// Initialize notifications
document.addEventListener('DOMContentLoaded', function() {
    initializeNotifications();
    startNotificationChecker();
});

// Initialize notification UI
function initializeNotifications() {
    const userInfo = document.querySelector('.user-info');
    if (userInfo && !document.getElementById('notification-bell')) {
        const notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        notificationContainer.innerHTML = `
            <button id="notification-bell" class="notification-btn" onclick="toggleNotificationDropdown(event)" title="Notifications">
                <span>🔔</span>
                <span id="notification-badge" class="notification-badge" style="display: none;">0</span>
            </button>
            <div id="notification-dropdown" class="notification-dropdown">
                <div class="notification-header">
                    <h3>Notifications</h3>
                    <button onclick="markAllNotificationsRead()" class="mark-all-read">Mark all as read</button>
                </div>
                <div id="notification-list" class="notification-list">
                    <div class="notification-empty" style="padding: 20px; text-align: center; color: var(--text-light);">No new notifications</div>
                </div>
                <div class="notification-footer">
                    <a href="#" onclick="showSection('announcements'); return false;" class="view-all-notifications">View All Announcements</a>
                </div>
            </div>
        `;
        userInfo.insertBefore(notificationContainer, userInfo.firstChild);
    }
    
    updateNotificationBadge();
    loadNotifications();
}

// Toggle notification dropdown
window.toggleNotificationDropdown = function(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            loadNotifications();
        }
    }
};

// Close notification dropdown when clicking outside
document.addEventListener('click', function(event) {
    const bell = document.getElementById('notification-bell');
    const dropdown = document.getElementById('notification-dropdown');
    if (bell && dropdown && !bell.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

// Create notification
async function createNotification(type, title, message, link = null, data = {}, userId = null, userType = null) {
    const user = userId ? { id: userId, type: userType } : getCurrentUser();
    if (!user || !user.id) return null;
    
    const notification = {
        userId: user.id,
        userType: user.type || userType,
        type: type, // 'exam', 'result', 'announcement', 'reminder', 'assignment'
        title: title,
        message: message,
        link: link,
        data: data,
        read: false,
        createdAt: new Date().toISOString()
    };
    
    let savedNotification = null;
    if (typeof saveNotification === 'function') {
        try {
            savedNotification = await saveNotification(notification);
        } catch (error) {
            console.warn('Supabase saveNotification failed:', error);
        }
    }

    // Local fallback if saving failed
    if (!savedNotification) {
        notification.id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        const notifications = getData('lms_notifications') || [];
        notifications.push(notification);
        saveData('lms_notifications', notifications);
        savedNotification = notification;
    }
    
    // Only update UI if for current user
    const currentUser = getCurrentUser();
    if (currentUser && savedNotification.userId === currentUser.id) {
        updateNotificationBadge();
        showNotificationToast(title, message);
    }
    
    return savedNotification;
}
window.createNotification = createNotification;

// Load notifications
async function loadNotifications() {
    const user = getCurrentUser();
    if (!user) return;
    
    const list = document.getElementById('notification-list');
    if (!list) return;

    let notifications = [];
    if (typeof getNotifications === 'function') {
        try {
            notifications = await getNotifications(user.id);
        } catch (error) {
            console.warn('getNotifications failed:', error);
        }
    }

    if (notifications.length === 0) {
        notifications = (getData('lms_notifications') || []).filter(n => n.userId === user.id);
    }

    // Limit to 20 for dropdown
    const displayNotifs = notifications.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);
    
    if (displayNotifs.length === 0) {
        list.innerHTML = '<div class="notification-empty" style="padding: 20px; text-align: center; color: var(--text-light);">No notifications</div>';
        return;
    }
    
    list.innerHTML = displayNotifs.map(notif => {
        const iconClasses = {
            'announcement': 'icon-announcement',
            'exam': 'icon-exam',
            'assignment': 'icon-assignment',
            'result': 'icon-exam',
            'reminder': 'icon-assignment'
        };
        const iconClass = iconClasses[notif.type] || '';
        const icon = getNotificationIcon(notif.type);
        const timeAgo = getTimeAgo(notif.createdAt);
        const unreadClass = notif.read ? '' : 'unread';
        
        const examId = notif.data?.examId || '';
        const escapedLink = (notif.link || '').replace(/'/g, "\\'");
        
        return `
            <div class="notification-item ${unreadClass}" onclick="handleNotificationClick('${notif.id}', '${escapedLink}', '${examId}')">
                <div class="notification-icon ${iconClass}">${icon}</div>
                <div class="notification-content">
                    <div class="notification-title">${escapeHtml(notif.title)}</div>
                    <div class="notification-message">${escapeHtml(notif.message)}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                <button class="notification-delete-btn" onclick="event.stopPropagation(); deleteNotification('${notif.id}');" style="background:none; border:none; cursor:pointer; opacity:0.5;">🗑️</button>
            </div>
        `;
    }).join('');
}

// Handle notification click
window.handleNotificationClick = async function(notificationId, link, examId) {
    await markNotificationAsRead(notificationId);
    
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) dropdown.classList.remove('active');
    
    if (link && link !== 'null') {
        window.location.href = link;
    } else if (examId && typeof showSection === 'function') {
        showSection('exams');
    } else if (typeof showSection === 'function') {
        showSection('announcements');
    }
};

// Mark notification as read
async function markNotificationAsRead(notificationId) {
    if (typeof markNotificationRead === 'function') {
        try {
            await markNotificationRead(notificationId);
        } catch (error) {
            console.warn('markNotificationRead failed:', error);
        }
    }

    // Local update
    const notifications = getData('lms_notifications') || [];
    const index = notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
        notifications[index].read = true;
        saveData('lms_notifications', notifications);
    }

    updateNotificationBadge();
    loadNotifications();
}

// Mark all as read
window.markAllNotificationsRead = async function() {
    const user = getCurrentUser();
    if (!user) return;
    
    const list = document.getElementById('notification-list');
    const unreadItems = list.querySelectorAll('.notification-item.unread');
    
    for (let item of unreadItems) {
        const id = item.getAttribute('onclick').match(/'([^']+)'/)[1];
        await markNotificationAsRead(id);
    }
};

// Delete notification
window.deleteNotification = function(notificationId) {
    const notifications = getData('lms_notifications') || [];
    const filtered = notifications.filter(n => n.id !== notificationId);
    saveData('lms_notifications', filtered);
    updateNotificationBadge();
    loadNotifications();
};

// Update notification badge
async function updateNotificationBadge() {
    const user = getCurrentUser();
    if (!user) return;
    
    let notifications = [];
    if (typeof getNotifications === 'function') {
        try {
            notifications = await getNotifications(user.id);
        } catch (e) {}
    }

    if (notifications.length === 0) {
        notifications = (getData('lms_notifications') || []).filter(n => n.userId === user.id);
    }

    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Get notification icon
function getNotificationIcon(type) {
    const icons = {
        'exam': '📝',
        'result': '📊',
        'announcement': '📢',
        'reminder': '⏰',
        'assignment': '📄',
        'default': '🔔'
    };
    return icons[type] || icons.default;
}

// Get time ago helper
function getTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Notification Toast
function showNotificationToast(title, message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: var(--card-bg);
        border-left: 4px solid var(--primary-color); padding: 15px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2); z-index: 10001;
        border-radius: 8px; max-width: 300px; animation: slideIn 0.3s ease;
    `;
    toast.innerHTML = `
        <div style="font-weight:bold; margin-bottom:5px;">${title}</div>
        <div style="font-size:0.9rem; color:var(--text-light);">${message}</div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// Background checker
function startNotificationChecker() {
    notificationCheckInterval = setInterval(checkForNewNotifications, 60000);
    checkForNewNotifications();
}

async function checkForNewNotifications() {
    const user = getCurrentUser();
    if (!user) return;
    updateNotificationBadge();
}

// HTML Escaping
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
