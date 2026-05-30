// Utility function to reset/clear old sample data
// Run this in browser console: resetOldData()

function resetOldData() {
    const classes = getData('lms_classes') || [];
    const courses = getData('lms_courses') || [];
    
    // Remove old sample classes
    const filteredClasses = classes.filter(c => 
        !['Class A', 'Class B', 'Class C', 'Class D'].includes(c.name)
    );
    
    // Remove old sample courses
    const filteredCourses = courses.filter(c => 
        !(['Mathematics', 'English', 'Science'].includes(c.subject) && 
          ['Class A', 'Class B', 'Class C', 'Class D'].includes(c.class))
    );
    
    saveData('lms_classes', filteredClasses);
    saveData('lms_courses', filteredCourses);
    
    // Clear initialization flag to force reinitialize
    localStorage.removeItem('sample_data_initialized');
    
    console.log('Old sample data cleared. Refreshing page to reinitialize...');
    
    // Reload page to trigger reinitialization
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// Make it globally accessible
window.resetOldData = resetOldData;
