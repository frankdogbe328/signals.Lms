// Calendar functionality for student dashboard

let currentCalendarDate = new Date();

async function loadCalendar() {
    const user = getCurrentUser();
    if (!user) return;
    
    let exams = [];
    
    // Try Supabase first, fallback to localStorage
    if (typeof getExams === 'function') {
        try {
            exams = await getExams();
        } catch (error) {
            console.warn('Supabase loadCalendar failed, using localStorage:', error);
            exams = getData('lms_exams') || [];
        }
    } else {
        exams = getData('lms_exams') || [];
    }
    
    // Filter exams for user's class
    const userExams = exams.filter(exam => {
        const examClasses = exam.classes || [];
        return examClasses.includes(user.class);
    });
    
    renderCalendar(userExams);
}

// Make function globally accessible
window.loadCalendar = loadCalendar;

function renderCalendar(exams) {
    const container = document.getElementById('calendar-grid');
    const monthYear = document.getElementById('calendar-month-year');
    
    if (!container || !monthYear) return;
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    monthYear.textContent = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Clear container
    container.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        container.appendChild(header);
    });
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        container.appendChild(empty);
    }
    
    // Add days of month
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        // Check if today
        if (date.getTime() === today.getTime()) {
            dayCell.classList.add('today');
        }
        
        // Find exams for this date
        const dayExams = exams.filter(exam => {
            const startTime = exam.start_time || exam.startTime;
            if (!startTime) return false;
            const examDate = new Date(startTime);
            return examDate.getDate() === day && 
                   examDate.getMonth() === month && 
                   examDate.getFullYear() === year;
        });
        
        dayCell.innerHTML = `<div class="day-number">${day}</div>`;
        
        if (dayExams.length > 0) {
            const examList = document.createElement('div');
            examList.className = 'calendar-exams';
            
            dayExams.forEach(exam => {
                const startTime = exam.start_time || exam.startTime;
                const examDate = new Date(startTime);
                const endDate = new Date(examDate.getTime() + (exam.duration || 0) * 60 * 1000);
                const isActive = now >= examDate && now <= endDate;
                const isUpcoming = now < examDate;
                const isPast = now > endDate;
                
                const examItem = document.createElement('div');
                examItem.className = 'calendar-exam-item';
                examItem.style.cssText = 'padding: 5px; margin: 2px 0; border-radius: 4px; cursor: pointer; transition: all 0.2s;';
                
                if (isActive) {
                    examItem.style.background = 'var(--success-color)';
                    examItem.style.color = 'white';
                } else if (isUpcoming) {
                    examItem.style.background = 'var(--warning-color)';
                    examItem.style.color = 'white';
                } else {
                    examItem.style.background = 'var(--text-light)';
                    examItem.style.color = 'var(--text-color)';
                }
                
                examItem.innerHTML = `
                    <strong style="display: block; font-size: 0.9rem;">${exam.title || 'Untitled Exam'}</strong>
                    <small style="display: block; font-size: 0.75rem; opacity: 0.9;">${exam.subject || 'N/A'}</small>
                    <small style="display: block; font-size: 0.7rem; opacity: 0.8;">${examDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</small>
                `;
                
                examItem.onclick = () => {
                    const status = isActive ? '🟢 ACTIVE' : (isUpcoming ? '⏰ UPCOMING' : '✅ COMPLETED');
                    alert(`${exam.title || 'Untitled Exam'}\n\nSubject: ${exam.subject || 'N/A'}\nStatus: ${status}\nStart: ${examDate.toLocaleString()}\nDuration: ${exam.duration || 0} minutes`);
                };
                
                examItem.onmouseenter = () => {
                    examItem.style.transform = 'scale(1.02)';
                    examItem.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                };
                
                examItem.onmouseleave = () => {
                    examItem.style.transform = 'scale(1)';
                    examItem.style.boxShadow = 'none';
                };
                
                examList.appendChild(examItem);
            });
            
            dayCell.appendChild(examList);
        }
        
        container.appendChild(dayCell);
    }
}

// Make function globally accessible
window.changeMonth = function(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    loadCalendar();
};

// Initialize calendar when section is shown
document.addEventListener('DOMContentLoaded', function() {
    // Load calendar when calendar tab is clicked
    const calendarTab = document.querySelector('[onclick="showSection(\'calendar\')"]');
    if (calendarTab) {
        calendarTab.addEventListener('click', function() {
            setTimeout(loadCalendar, 100);
        });
    }
});
