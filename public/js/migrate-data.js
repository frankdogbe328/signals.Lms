// Migration Script: Export localStorage to Supabase
// Run this once to migrate all existing data
// Usage: Open browser console, type: migrateToSupabase()

async function migrateToSupabase() {
    console.log('🚀 Starting migration to Supabase...');
    
    if (!window.supabase) {
        console.error('❌ Supabase client not initialized!');
        console.error('Make sure:');
        console.error('1. Supabase CDN is added to HTML');
        console.error('2. supabase-client.js has correct URL and key');
        return;
    }
    
    let migrated = 0;
    let errors = 0;
    
    // 1. Migrate Classes
    try {
        const classes = getData('lms_classes') || [];
        if (classes.length > 0) {
            console.log(`📦 Migrating ${classes.length} classes...`);
            const classData = classes.map(c => ({ name: c.name }));
            
            const { error } = await window.supabase.from('classes').insert(classData);
            if (error) {
                if (error.code === '23505') { // Duplicate key
                    console.log('⚠️ Classes already exist, skipping...');
                } else {
                    console.error('Error migrating classes:', error);
                    errors++;
                }
            } else {
                console.log(`✅ Migrated ${classes.length} classes`);
                migrated += classes.length;
            }
        }
    } catch (e) {
        console.error('Exception migrating classes:', e);
        errors++;
    }
    
    // 2. Migrate Users
    try {
        const users = getData('lms_users');
        if (users) {
            const allUsers = [
                ...(users.students || []).map(u => ({ 
                    ...u, 
                    type: 'student',
                    password_hash: u.password // TODO: Hash properly!
                })),
                ...(users.lecturers || []).map(u => ({ 
                    ...u, 
                    type: 'lecturer',
                    password_hash: u.password // TODO: Hash properly!
                }))
            ];
            
            if (allUsers.length > 0) {
                console.log(`📦 Migrating ${allUsers.length} users...`);
                
                // Get class IDs for mapping
                const { data: classes } = await window.supabase.from('classes').select('id, name');
                const classMap = {};
                classes.forEach(c => { classMap[c.name] = c.id; });
                
                const userData = allUsers.map(u => ({
                    username: u.username,
                    password_hash: u.password_hash || u.password,
                    full_name: u.fullName,
                    email: u.email,
                    telephone: u.telephone,
                    type: u.type,
                    class_id: u.class ? classMap[u.class] : null,
                    rank: u.rank,
                    subjects: u.subjects || [],
                    classes: u.classes || []
                }));
                
                const { error } = await window.supabase.from('users').insert(userData);
                if (error) {
                    if (error.code === '23505') {
                        console.log('⚠️ Users already exist, skipping...');
                    } else {
                        console.error('Error migrating users:', error);
                        errors++;
                    }
                } else {
                    console.log(`✅ Migrated ${allUsers.length} users`);
                    migrated += allUsers.length;
                }
            }
        }
    } catch (e) {
        console.error('Exception migrating users:', e);
        errors++;
    }
    
    // 3. Migrate Courses
    try {
        const courses = getData('lms_courses') || [];
        if (courses.length > 0) {
            console.log(`📦 Migrating ${courses.length} courses...`);
            
            const { data: classes } = await window.supabase.from('classes').select('id, name');
            const classMap = {};
            classes.forEach(c => { classMap[c.name] = c.id; });
            
            const courseData = courses.map(c => ({
                subject: c.subject,
                class_id: classMap[c.class] || null,
                lecturer_id: c.lecturerId || null
            }));
            
            const { error } = await window.supabase.from('courses').insert(courseData);
            if (error) {
                if (error.code === '23505') {
                    console.log('⚠️ Courses already exist, skipping...');
                } else {
                    console.error('Error migrating courses:', error);
                    errors++;
                }
            } else {
                console.log(`✅ Migrated ${courses.length} courses`);
                migrated += courses.length;
            }
        }
    } catch (e) {
        console.error('Exception migrating courses:', e);
        errors++;
    }
    
    // 4. Migrate Exams (more complex - needs relationships)
    try {
        const exams = getData('lms_exams') || [];
        if (exams.length > 0) {
            console.log(`📦 Migrating ${exams.length} exams...`);
            
            const { data: classes } = await window.supabase.from('classes').select('id, name');
            const classMap = {};
            classes.forEach(c => { classMap[c.name] = c.id; });
            
            for (const exam of exams) {
                try {
                    // Insert exam
                    const { data: examData, error: examError } = await window.supabase
                        .from('exams')
                        .insert({
                            id: exam.id, // Keep original ID if possible
                            title: exam.title,
                            type: exam.type,
                            subject: exam.subject,
                            start_time: exam.startTime,
                            duration: exam.duration,
                            is_activated: exam.isActivated !== false,
                            is_manually_active: exam.isManuallyActive !== false,
                            is_written: exam.isWritten || false,
                            is_general: exam.isGeneral || false,
                            created_by: exam.createdBy
                        })
                        .select()
                        .single();
                    
                    if (examError && examError.code !== '23505') {
                        console.error(`Error migrating exam ${exam.title}:`, examError);
                        errors++;
                        continue;
                    }
                    
                    const examId = examData?.id || exam.id;
                    
                    // Insert exam-class relationships
                    if (exam.classes && exam.classes.length > 0) {
                        const examClasses = exam.classes
                            .map(className => classMap[className])
                            .filter(Boolean)
                            .map(classId => ({
                                exam_id: examId,
                                class_id: classId
                            }));
                        
                        if (examClasses.length > 0) {
                            await window.supabase.from('exam_classes').insert(examClasses);
                        }
                    }
                    
                    // Insert questions
                    if (exam.questions && exam.questions.length > 0) {
                        const questions = exam.questions.map((q, index) => ({
                            exam_id: examId,
                            question_type: q.type,
                            question_text: q.question,
                            options: q.options || [],
                            correct_answer: q.correctAnswer,
                            points: q.points || 100,
                            word_limit: q.wordLimit,
                            question_order: index
                        }));
                        
                        await window.supabase.from('exam_questions').insert(questions);
                    }
                    
                    migrated++;
                } catch (e) {
                    console.error(`Exception migrating exam ${exam.title}:`, e);
                    errors++;
                }
            }
            
            console.log(`✅ Migrated ${migrated} exams`);
        }
    } catch (e) {
        console.error('Exception migrating exams:', e);
        errors++;
    }
    
    // 5. Migrate Results
    try {
        const results = getData('lms_results') || [];
        if (results.length > 0) {
            console.log(`📦 Migrating ${results.length} results...`);
            
            const resultData = results.map(r => ({
                id: r.id,
                exam_id: r.examId,
                exam_title: r.examTitle,
                student_id: r.studentId,
                student_name: r.studentName,
                subject: r.subject,
                type: r.type,
                score: r.score,
                correct_answers: r.correctAnswers,
                total_questions: r.totalQuestions,
                submitted_at: r.submittedAt,
                is_written: r.isWritten || false,
                is_released: r.isReleased || false,
                is_composite: r.isComposite || false,
                composite_breakdown: r.compositeBreakdown,
                security_report: r.securityReport
            }));
            
            const { error } = await window.supabase.from('results').insert(resultData);
            if (error) {
                if (error.code === '23505') {
                    console.log('⚠️ Results already exist, skipping...');
                } else {
                    console.error('Error migrating results:', error);
                    errors++;
                }
            } else {
                console.log(`✅ Migrated ${results.length} results`);
                migrated += results.length;
            }
        }
    } catch (e) {
        console.error('Exception migrating results:', e);
        errors++;
    }
    
    // 6. Migrate Result Releases
    try {
        const releases = getData('lms_result_releases') || {};
        const releaseData = Object.keys(releases).map(examId => ({
            exam_id: examId,
            is_released: releases[examId] === true
        }));
        
        if (releaseData.length > 0) {
            console.log(`📦 Migrating ${releaseData.length} result releases...`);
            const { error } = await window.supabase.from('result_releases').insert(releaseData);
            if (error && error.code !== '23505') {
                console.error('Error migrating result releases:', error);
                errors++;
            } else {
                console.log(`✅ Migrated ${releaseData.length} result releases`);
                migrated += releaseData.length;
            }
        }
    } catch (e) {
        console.error('Exception migrating result releases:', e);
        errors++;
    }
    
    // 7. Migrate Materials
    try {
        const materials = getData('lms_materials') || [];
        if (materials.length > 0) {
            console.log(`📦 Migrating ${materials.length} materials...`);
            
            const { data: classes } = await window.supabase.from('classes').select('id, name');
            const classMap = {};
            classes.forEach(c => { classMap[c.name] = c.id; });
            
            const materialData = materials.map(m => ({
                title: m.title,
                description: m.description,
                content: m.content,
                file_url: m.fileUrl,
                file_name: m.fileName,
                subject: m.subject,
                class_id: classMap[m.class] || null,
                uploaded_by: m.uploadedBy,
                uploaded_at: m.uploadedAt
            }));
            
            const { error } = await window.supabase.from('materials').insert(materialData);
            if (error && error.code !== '23505') {
                console.error('Error migrating materials:', error);
                errors++;
            } else {
                console.log(`✅ Migrated ${materials.length} materials`);
                migrated += materials.length;
            }
        }
    } catch (e) {
        console.error('Exception migrating materials:', e);
        errors++;
    }
    
    // 8. Migrate Announcements
    try {
        const announcements = getData('lms_announcements') || [];
        if (announcements.length > 0) {
            console.log(`📦 Migrating ${announcements.length} announcements...`);
            
            const { data: classes } = await window.supabase.from('classes').select('id, name');
            const classMap = {};
            classes.forEach(c => { classMap[c.name] = c.id; });
            
            for (const ann of announcements) {
                try {
                    const { data: annData, error: annError } = await window.supabase
                        .from('announcements')
                        .insert({
                            title: ann.title,
                            message: ann.message,
                            type: ann.type,
                            created_by: ann.createdBy
                        })
                        .select()
                        .single();
                    
                    if (annError && annError.code !== '23505') {
                        console.error(`Error migrating announcement ${ann.title}:`, annError);
                        errors++;
                        continue;
                    }
                    
                    // Insert announcement-class relationships
                    if (ann.targetClasses && ann.targetClasses.length > 0) {
                        const annClasses = ann.targetClasses
                            .map(className => classMap[className])
                            .filter(Boolean)
                            .map(classId => ({
                                announcement_id: annData?.id || ann.id,
                                class_id: classId
                            }));
                        
                        if (annClasses.length > 0) {
                            await window.supabase.from('announcement_classes').insert(annClasses);
                        }
                    }
                    
                    migrated++;
                } catch (e) {
                    console.error(`Exception migrating announcement ${ann.title}:`, e);
                    errors++;
                }
            }
            
            console.log(`✅ Migrated ${migrated} announcements`);
        }
    } catch (e) {
        console.error('Exception migrating announcements:', e);
        errors++;
    }
    
    // 9. Migrate Notifications
    try {
        const notifications = getData('lms_notifications') || [];
        if (notifications.length > 0) {
            console.log(`📦 Migrating ${notifications.length} notifications...`);
            
            const notifData = notifications.map(n => ({
                user_id: n.userId,
                user_type: n.userType,
                type: n.type,
                title: n.title,
                message: n.message,
                link: n.link,
                data: n.data,
                read: n.read,
                created_at: n.createdAt
            }));
            
            const { error } = await window.supabase.from('notifications').insert(notifData);
            if (error && error.code !== '23505') {
                console.error('Error migrating notifications:', error);
                errors++;
            } else {
                console.log(`✅ Migrated ${notifications.length} notifications`);
                migrated += notifications.length;
            }
        }
    } catch (e) {
        console.error('Exception migrating notifications:', e);
        errors++;
    }
    
    // 10. Migrate Written Marks
    try {
        const writtenMarks = getData('lms_written_marks') || {};
        const marksArray = [];
        
        Object.keys(writtenMarks).forEach(key => {
            const [subject, className] = key.startsWith('general_') 
                ? [null, key.replace('general_', '')]
                : key.split('_');
            
            Object.keys(writtenMarks[key]).forEach(examType => {
                Object.keys(writtenMarks[key][examType]).forEach(studentId => {
                    marksArray.push({
                        student_id: studentId,
                        exam_type: examType,
                        class_name: className,
                        subject: subject,
                        mark: writtenMarks[key][examType][studentId]
                    });
                });
            });
        });
        
        if (marksArray.length > 0) {
            console.log(`📦 Migrating ${marksArray.length} written marks...`);
            const { error } = await window.supabase.from('written_marks').insert(marksArray);
            if (error && error.code !== '23505') {
                console.error('Error migrating written marks:', error);
                errors++;
            } else {
                console.log(`✅ Migrated ${marksArray.length} written marks`);
                migrated += marksArray.length;
            }
        }
    } catch (e) {
        console.error('Exception migrating written marks:', e);
        errors++;
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migrated} items`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(50));
    
    if (errors === 0) {
        console.log('🎉 Migration completed successfully!');
    } else {
        console.log('⚠️ Migration completed with some errors. Check console above for details.');
    }
}

// Make globally available
window.migrateToSupabase = migrateToSupabase;

console.log('✅ Migration script loaded. Run: migrateToSupabase()');
