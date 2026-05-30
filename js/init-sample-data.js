// Initialize Sample Data for Testing
// Run this once to populate the system with sample data

// Make function globally available
window.initializeSampleData = function initializeSampleData() {
    // Always check and update classes/courses to ensure correct data
    const existingClasses = getData('lms_classes') || [];
    const existingCourses = getData('lms_courses') || [];
    
    // Check if old sample classes exist (Class A, B, C or old Signal classes)
    const oldClassNames = ['Class A', 'Class B', 'Class C', 'Signal Basic', 'Signal B11', 
                           'Regimental Signal BIII', 'Regimental Signal BI', 'Tactical Drone Operators Course'];
    const hasOldClasses = existingClasses.some(c => oldClassNames.includes(c.name));
    
    // If old classes exist or no classes exist, reinitialize
    if (hasOldClasses || existingClasses.length === 0) {
        console.log('Updating classes and courses with Signals Training School data...');
        // Remove old classes
        const filteredClasses = existingClasses.filter(c => !oldClassNames.includes(c.name));
        
        // Remove old courses
        const filteredCourses = existingCourses.filter(c => 
            !['Mathematics', 'English', 'Science'].includes(c.subject) || 
            !oldClassNames.includes(c.class)
        );
        
        // Save filtered data first
        saveData('lms_classes', filteredClasses);
        saveData('lms_courses', filteredCourses);
    } else {
        // Check if we already have the correct classes
        const hasSignalClasses = existingClasses.some(c => 
            ['SIGNALS BASIC', 'SIGNALS B III – B II', 'SIGNALS B II – B I', 'SUPERINTENDENT', 'PRE-QUALIFYING', 
             'REGIMENTAL BASIC', 'REGIMENTAL B III – B II', 'REGIMENTAL B II – B I', 'RSO / RSI', 
             'ELECTRONIC WARFARE COURSE', 'TACTICAL DRONE COURSE'].includes(c.name)
        );
        
        if (hasSignalClasses && localStorage.getItem('sample_data_initialized')) {
            console.log('Signals Training School data already initialized');
            return;
        }
    }
    
    // Initialize classes based on actual Signals Training School courses
    const newClasses = [
        { id: '1', name: 'SIGNALS BASIC', createdAt: new Date().toISOString() },
        { id: '2', name: 'SIGNALS B III – B II', createdAt: new Date().toISOString() },
        { id: '3', name: 'SIGNALS B II – B I', createdAt: new Date().toISOString() },
        { id: '4', name: 'SUPERINTENDENT', createdAt: new Date().toISOString() },
        { id: '5', name: 'PRE-QUALIFYING', createdAt: new Date().toISOString() },
        { id: '6', name: 'REGIMENTAL BASIC', createdAt: new Date().toISOString() },
        { id: '7', name: 'REGIMENTAL B III – B II', createdAt: new Date().toISOString() },
        { id: '8', name: 'REGIMENTAL B II – B I', createdAt: new Date().toISOString() },
        { id: '9', name: 'RSO / RSI', createdAt: new Date().toISOString() },
        { id: '10', name: 'ELECTRONIC WARFARE COURSE', createdAt: new Date().toISOString() },
        { id: '11', name: 'TACTICAL DRONE COURSE', createdAt: new Date().toISOString() }
    ];
    
    // Get existing classes and filter out old ones (refresh data in case it was updated)
    const currentClasses = getData('lms_classes') || [];
    // Reuse oldClassNames declared at the top of the function
    const customClasses = currentClasses.filter(c => !oldClassNames.includes(c.name));
    
    // Merge: keep custom classes, add new standard classes
    const finalClasses = [...customClasses];
    newClasses.forEach(newClass => {
        if (!finalClasses.find(c => c.name === newClass.name)) {
            finalClasses.push(newClass);
        }
    });
    
    saveData('lms_classes', finalClasses);
    
    // Initialize courses for SIGNALS BASIC
    const signalBasicCourses = [
        'Field Cable Networking',
        'Voice Procedure',
        'Telegraphy Procedure',
        'Power Management',
        'Antenna Theory',
        'Communication Centre Management/Front Desk Management',
        'Basic Mathematics',
        'Minor Staff Duties/Communication Skills',
        'Basic Electronics',
        'Signal Tactics',
        'Exchanges',
        'Information and Communication Technology',
        'Introduction to Surveillance Systems',
        'Introduction to Unmanned Aerial Systems'
    ];
    
    // Initialize courses for SIGNALS B III – B II (using Signal B11 course structure)
    const signalB11Courses = [
        'Voice Procedure',
        'Communication Centre Management/Front Desk Management',
        'Telegraphy Procedure',
        'Antenna Theory',
        'Signal Tactics',
        'Power Supply and Management',
        'Radio Practicals',
        'Cable Networking',
        'Information Communication Technology',
        'Communication Skills',
        'Basic Mathematics',
        'Electronics',
        'Surveillance Systems',
        'Telecommunication',
        'Exchange',
        'Fibre Optics',
        'Networking',
        'Physics'
    ];
    
    // Remove duplicates if any (Signal Tactics appears twice in original list)
    const uniqueSignalB11Courses = [...new Set(signalB11Courses)];
    
    // Initialize courses for REGIMENTAL BASIC (using Regimental Signal BIII course structure)
    const regimentalBIIICourses = [
        'Voice Procedure',
        'Communication Centre Management',
        'Telegraphy Procedure',
        'Antenna Theory',
        'Signal Tactics',
        'Power Supply Management',
        'Radio Practicals',
        'Cable Networking',
        'Introduction to Computer',
        'Minor Staff Duties/Communication Skills',
        'Basic Mathematics',
        'Surveillance Systems'
    ];
    
    // Initialize courses for REGIMENTAL B II – B I (using Regimental Signal BI course structure)
    const regimentalBICourses = [
        'Voice Procedure',
        'Telegraphy Procedure',
        'Antenna Theory',
        'Signal Tactics',
        'Power Supply and Management',
        'Radio Practicals',
        'Cable Networking',
        'Introduction to Computer',
        'Minor Staff Duties/Communication Skills',
        'Method of Instruction',
        'Basic Mathematics',
        'Introduction to Surveillance Systems'
    ];
    
    // Initialize courses for TACTICAL DRONE COURSE
    const droneOperatorsCourses = [
        'UAS Fundamentals',
        'UAS Control',
        'UAS Systems',
        'UAS Operations',
        'Flight Safety',
        'Payloads and Anti-Drone Systems'
    ];
    
    // Combine all courses
    const courses = [];
    let courseId = 1;
    
    // SIGNALS BASIC courses
    signalBasicCourses.forEach(subject => {
        courses.push({
            id: courseId.toString(),
            subject: subject,
            class: 'SIGNALS BASIC',
            createdAt: new Date().toISOString()
        });
        courseId++;
    });
    
    // SIGNALS B III – B II courses (using Signal B11 courses)
    uniqueSignalB11Courses.forEach(subject => {
        courses.push({
            id: courseId.toString(),
            subject: subject,
            class: 'SIGNALS B III – B II',
            createdAt: new Date().toISOString()
        });
        courseId++;
    });
    
    // SIGNALS B II – B I courses (using Signal B11 courses)
    uniqueSignalB11Courses.forEach(subject => {
        courses.push({
            id: courseId.toString(),
            subject: subject,
            class: 'SIGNALS B II – B I',
            createdAt: new Date().toISOString()
        });
        courseId++;
    });
    
    // REGIMENTAL BASIC courses (using Regimental Signal BIII courses)
    regimentalBIIICourses.forEach(subject => {
        courses.push({
            id: courseId.toString(),
            subject: subject,
            class: 'REGIMENTAL BASIC',
            createdAt: new Date().toISOString()
        });
        courseId++;
    });
    
    // REGIMENTAL B III – B II courses
    regimentalBIIICourses.forEach(subject => {
        courses.push({
            id: courseId.toString(),
            subject: subject,
            class: 'REGIMENTAL B III – B II',
            createdAt: new Date().toISOString()
        });
        courseId++;
    });
    
    // REGIMENTAL B II – B I courses
    regimentalBICourses.forEach(subject => {
        courses.push({
            id: courseId.toString(),
            subject: subject,
            class: 'REGIMENTAL B II – B I',
            createdAt: new Date().toISOString()
        });
        courseId++;
    });
    
    // TACTICAL DRONE COURSE
    droneOperatorsCourses.forEach(subject => {
        courses.push({
            id: courseId.toString(),
            subject: subject,
            class: 'TACTICAL DRONE COURSE',
            createdAt: new Date().toISOString()
        });
        courseId++;
    });
    
    // Get final classes (already merged and saved above at line 71)
    // Refresh from localStorage to ensure we have the latest data
    const savedClasses = getData('lms_classes') || [];
    const finalCourses = getData('lms_courses') || [];
    
    // Add new courses if they don't exist
    courses.forEach(newCourse => {
        if (!finalCourses.find(c => c.subject === newCourse.subject && c.class === newCourse.class)) {
            finalCourses.push(newCourse);
        }
    });
    
    // Classes were already saved at line 71, so savedClasses should have the data
    // No need to save again unless it's empty (which shouldn't happen)
    saveData('lms_courses', finalCourses);
    
    // Set lecturer secret key
    localStorage.setItem('lecturer_secret_key', 'SIGNALS2024');
    
    console.log('Signals Training School data initialized successfully!');
    console.log('Classes: SIGNALS BASIC, SIGNALS B III – B II, SIGNALS B II – B I, SUPERINTENDENT, PRE-QUALIFYING, REGIMENTAL BASIC, REGIMENTAL B III – B II, REGIMENTAL B II – B I, RSO / RSI, ELECTRONIC WARFARE COURSE, TACTICAL DRONE COURSE');
    console.log('Total Courses: ' + finalCourses.length);
    console.log('Lecturer Secret Key: SIGNALS2024');
    console.log('Admin Login: admin / admin123');
    
    localStorage.setItem('sample_data_initialized', 'true');
}

// Function to force reinitialize (useful for updating course data)
// Make it globally accessible
window.reinitializeCourseData = function() {
    // Get existing classes and courses
    const existingClasses = getData('lms_classes') || [];
    const existingCourses = getData('lms_courses') || [];
    
    // Remove old sample classes (keep any custom ones)
    const oldClassNames = ['Class A', 'Class B', 'Class C', 'Signal Basic', 'Signal B11', 
                           'Regimental Signal BIII', 'Regimental Signal BI', 'Tactical Drone Operators Course'];
    const customClasses = existingClasses.filter(c => !oldClassNames.includes(c.name));
    
    // Remove old sample courses (keep any custom ones)
    const customCourses = existingCourses.filter(c => 
        !['Mathematics', 'English', 'Science'].includes(c.subject)
    );
    
    // Initialize new course data
    localStorage.removeItem('sample_data_initialized');
    initializeSampleData();
    
    // Merge with custom data
    const newClasses = getData('lms_classes');
    const newCourses = getData('lms_courses');
    
    // Combine custom classes with new ones (avoid duplicates)
    const allClasses = [...customClasses];
    newClasses.forEach(newClass => {
        if (!allClasses.find(c => c.name === newClass.name)) {
            allClasses.push(newClass);
        }
    });
    
    // Combine custom courses with new ones (avoid duplicates)
    const allCourses = [...customCourses];
    newCourses.forEach(newCourse => {
        if (!allCourses.find(c => c.subject === newCourse.subject && c.class === newCourse.class)) {
            allCourses.push(newCourse);
        }
    });
    
    saveData('lms_classes', allClasses);
    saveData('lms_courses', allCourses);
    
    console.log('Course data reinitialized successfully!');
    
    // Show alert if called from admin dashboard
    if (typeof showAlert === 'function') {
        showAlert('settings', 'Course data reinitialized successfully!', 'success');
    }
    
    // Reload page if in admin dashboard
    if (window.location.pathname.includes('admin/dashboard.html')) {
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }
};

// Auto-initialize if running from index page
if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
    document.addEventListener('DOMContentLoaded', function() {
        initializeSampleData();
    });
}
