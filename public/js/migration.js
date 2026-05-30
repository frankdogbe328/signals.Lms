// Migration Script: LocalStorage to Supabase
// Run this script to migrate all local data to Supabase

async function migrateToSupabase() {
    console.log('🚀 Starting Partial Migration to Supabase...');
    
    if (!window.supabase) {
        console.error('❌ Supabase client not found. Cannot migrate.');
        return;
    }

    const report = {
        classes: { success: 0, failed: 0 },
        users: { success: 0, failed: 0 },
        courses: { success: 0, failed: 0 },
        exams: { success: 0, failed: 0 },
        materials: { success: 0, failed: 0 },
        announcements: { success: 0, failed: 0 },
        notifications: { success: 0, failed: 0 },
        results: { success: 0, failed: 0 },
        writtenMarks: { success: 0, failed: 0 }
    };

    try {
        // 1. Migrate Classes (Implicitly via getClasses auto-sync)
        console.log('📦 Migrating Classes...');
        // getClasses() in api-service.js has logic to sync from localStorage if Supabase is empty
        const classes = await getClasses();
        report.classes.success = classes.length;
        console.log(`✅ Classes ready: ${classes.length}`);

        // 2. Migrate Users
        console.log('👤 Migrating Users...');
        const localUsers = getData('lms_users') || { students: [], lecturers: [] };
        
        // Migrate Lecturers
        for (const lecturer of (localUsers.lecturers || [])) {
            try {
                // Check if already in Supabase to avoid duplicates/errors
                // saveUser handles insert/fallback
                await saveUser(lecturer);
                report.users.success++;
            } catch (e) {
                console.error(`Failed to migrate lecturer ${lecturer.username}:`, e);
                report.users.failed++;
            }
        }

        // Migrate Students
        for (const student of (localUsers.students || [])) {
            try {
                // Resolve Class ID if missing
                if (!student.classId && student.class) {
                    const cls = classes.find(c => c.name === student.class);
                    if (cls) {
                        student.classId = cls.id;
                    }
                }
                await saveUser(student);
                report.users.success++;
            } catch (e) {
                console.error(`Failed to migrate student ${student.username}:`, e);
                report.users.failed++;
            }
        }

        // 3. Migrate Courses
        console.log('📚 Migrating Courses...');
        const localCourses = getData('lms_courses') || [];
        for (const course of localCourses) {
            try {
                await saveCourse(course);
                report.courses.success++;
            } catch (e) {
                console.error(`Failed to migrate course ${course.subject}:`, e);
                report.courses.failed++;
            }
        }

        // 4. Migrate Exams
        console.log('📝 Migrating Exams...');
        const localExams = getData('lms_exams') || [];
        for (const exam of localExams) {
            try {
                await saveExam(exam);
                report.exams.success++;
            } catch (e) {
                console.error(`Failed to migrate exam ${exam.title}:`, e);
                report.exams.failed++;
            }
        }

        // 5. Migrate Materials
        console.log('📂 Migrating Materials...');
        const localMaterials = getData('lms_materials') || [];
        // saveMaterial is not explicitly exported in the snippet I saw, but assumed available
        // If not, we might fail here. checking getMaterials works locally though.
        if (typeof saveMaterial === 'function') {
            for (const material of localMaterials) {
                try {
                    await saveMaterial(material);
                    report.materials.success++;
                } catch (e) {
                    console.error(`Failed to migrate material ${material.title}:`, e);
                    report.materials.failed++;
                }
            }
        } else {
            console.warn('saveMaterial function not available, skipping materials.');
        }

        // 6. Migrate Announcements
        console.log('📢 Migrating Announcements...');
        const localAnnouncements = getData('lms_announcements') || [];
        if (typeof saveAnnouncement === 'function') {
            for (const announcement of localAnnouncements) {
                try {
                    await saveAnnouncement(announcement);
                    report.announcements.success++;
                } catch (e) {
                    console.error(`Failed to migrate announcement ${announcement.title}:`, e);
                    report.announcements.failed++;
                }
            }
        }

        // 7. Migrate Results
        console.log('📊 Migrating Results...');
        const localResults = getData('lms_results') || [];
        for (const result of localResults) {
            try {
                await saveResult(result);
                report.results.success++;
            } catch (e) {
                console.error(`Failed to migrate result for ${result.studentName}:`, e);
                report.results.failed++;
            }
        }

        // 8. Migrate Written Marks
        console.log('✍️ Migrating Written Marks...');
        const localWrittenMarks = getData('lms_written_marks'); // Object
        if (localWrittenMarks && typeof saveWrittenMarks === 'function') {
            try {
                await saveWrittenMarks(localWrittenMarks);
                // Count isn't easily determined from the object structure without standardizing
                report.writtenMarks.success = 1; // Treated as bulk operation
            } catch (e) {
                console.error('Failed to migrate written marks:', e);
                report.writtenMarks.failed++;
            }
        }

        console.log('🎉 Migration Completed!');
        console.table(report);
        alert('Migration completed! Check console for details.');

    } catch (error) {
        console.error('❌ Migration Critical Error:', error);
        alert('Migration failed with critical error. Check console.');
    }
}

// Expose to window for manual trigger
window.migrateToSupabase = migrateToSupabase;
