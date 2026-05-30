// API Service Layer — talks to PostgreSQL backend via /api/* endpoints

// ============================================
// AUTH TOKEN HELPERS
// ============================================

function getToken() {
    return localStorage.getItem('lms_api_token');
}

function setToken(token) {
    localStorage.setItem('lms_api_token', token);
}

function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

async function apiFetch(path, options = {}) {
    const res = await fetch(path, {
        headers: authHeaders(),
        ...options
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API error ${res.status}`);
    }
    return res.json();
}

window.setApiToken = setToken;
window.getApiToken = getToken;

// ============================================
// CACHING LAYER
// ============================================

const SERVICE_CACHE = {
    data: {},
    ttl: {
        users: 60000,
        classes: 300000,
        courses: 300000,
        exams: 15000,
        exams_minimal: 10000,
        results: 30000,
        materials: 60000,
        registration_keys: 10000
    },
    isExpired(key) {
        if (!this.data[key]) return true;
        return (Date.now() - this.data[key].timestamp) > (this.ttl[key] || 30000);
    },
    set(key, val) { this.data[key] = { val, timestamp: Date.now() }; },
    get(key) { return this.data[key] ? this.data[key].val : null; },
    invalidate(key) { delete this.data[key]; }
};

function invalidateCache(key) { SERVICE_CACHE.invalidate(key); }
window.invalidateCache = invalidateCache;

async function withCache(key, fetcher) {
    if (!SERVICE_CACHE.isExpired(key)) return SERVICE_CACHE.get(key);
    const data = await fetcher();
    if (data) SERVICE_CACHE.set(key, data);
    return data;
}

// ============================================
// SYSTEM SETTINGS
// ============================================

async function getSystemSetting(key) {
    try {
        const data = await apiFetch(`/api/settings?key=${encodeURIComponent(key)}`);
        return data.value;
    } catch {
        return localStorage.getItem(`lms_setting_${key}`);
    }
}

async function updateSystemSetting(key, value) {
    localStorage.setItem(`lms_setting_${key}`, value);
    try {
        await apiFetch('/api/settings', {
            method: 'POST',
            body: JSON.stringify({ key, value })
        });
        return true;
    } catch (e) {
        console.error('updateSystemSetting error:', e);
        return false;
    }
}

window.getSystemSetting = getSystemSetting;
window.updateSystemSetting = updateSystemSetting;

// ============================================
// AUDIT LOGS
// ============================================

async function logAction(actionType, description, metadata = {}) {
    const user = getCurrentUser?.();
    try {
        await apiFetch('/api/audit-logs', {
            method: 'POST',
            body: JSON.stringify({ actionType, description, performedBy: user?.id, metadata })
        });
    } catch {
        const logs = getData('lms_audit_logs') || [];
        logs.push({ action_type: actionType, description, performed_by: user?.id, metadata, created_at: new Date().toISOString() });
        saveData('lms_audit_logs', logs);
    }
}

async function getAuditLogs(page = 1, limit = 50) {
    try {
        return await apiFetch(`/api/audit-logs?page=${page}&limit=${limit}`);
    } catch {
        const logs = getData('lms_audit_logs') || [];
        return { data: logs.slice(0, limit), count: logs.length };
    }
}

window.logAction = logAction;

// ============================================
// GET FUNCTIONS
// ============================================

async function getUsers() {
    return withCache('users', async () => {
        try {
            return await apiFetch('/api/users');
        } catch {
            return getData('lms_users') || { students: [], lecturers: [], admin: null };
        }
    });
}

async function getClasses() {
    return withCache('classes', async () => {
        try {
            return await apiFetch('/api/classes');
        } catch {
            return getData('lms_classes') || [];
        }
    });
}

async function getCourses() {
    return withCache('courses', async () => {
        try {
            return await apiFetch('/api/courses');
        } catch {
            return getData('lms_courses') || [];
        }
    });
}

async function getExams() {
    return withCache('exams', async () => {
        try {
            return await apiFetch('/api/exams');
        } catch {
            return getData('lms_exams') || [];
        }
    });
}

async function getExamsMinimal() {
    return withCache('exams_minimal', async () => {
        try {
            return await apiFetch('/api/exams?minimal=true');
        } catch {
            return getData('lms_exams') || [];
        }
    });
}

async function getResults() {
    return withCache('results', async () => {
        try {
            return await apiFetch('/api/results');
        } catch {
            return getData('lms_results') || [];
        }
    });
}

async function getResultReleases() {
    try {
        return await apiFetch('/api/result-releases');
    } catch {
        return getData('lms_result_releases') || {};
    }
}

async function getMaterials() {
    return withCache('materials', async () => {
        try {
            return await apiFetch('/api/materials');
        } catch {
            return getData('lms_materials') || [];
        }
    });
}

async function getSubmissions(assignmentId = null) {
    try {
        const url = assignmentId ? `/api/submissions?assignmentId=${assignmentId}` : '/api/submissions';
        return await apiFetch(url);
    } catch {
        return getData('lms_submissions') || [];
    }
}

async function getAnnouncements() {
    return withCache('announcements_all', async () => {
        try {
            return await apiFetch('/api/announcements');
        } catch {
            return getData('lms_announcements') || [];
        }
    });
}

async function getNotifications(userId) {
    try {
        return await apiFetch(`/api/notifications?userId=${userId}`);
    } catch {
        return (getData('lms_notifications') || []).filter(n => n.userId === userId);
    }
}

async function markNotificationRead(notificationId) {
    try {
        await apiFetch(`/api/notifications/${notificationId}`, { method: 'PUT', body: '{}' });
        return true;
    } catch {
        return false;
    }
}

async function getWrittenMarks() {
    try {
        return await apiFetch('/api/written-marks');
    } catch {
        return getData('lms_written_marks') || {};
    }
}

async function getRegistrationKeys() {
    return withCache('registration_keys', async () => {
        try {
            return await apiFetch('/api/registration-keys');
        } catch {
            return getData('lms_registration_keys') || [];
        }
    });
}

async function getAssignments() {
    return getData('lms_assignments') || [];
}

// ============================================
// SAVE / CREATE FUNCTIONS
// ============================================

async function saveUser(user) {
    const result = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            username: user.username,
            password: user.password,
            fullName: user.fullName,
            email: user.email,
            telephone: user.telephone,
            type: user.type,
            rank: user.rank,
            className: user.class || (user.classes && user.classes[0]),
            classes: user.classes || [],
            subjects: user.subjects || [],
            registrationKey: user.registrationKey
        })
    });
    invalidateCache('users');
    return result.user;
}

async function updateUser(userId, userType, userData) {
    try {
        const result = await apiFetch(`/api/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({
                username: userData.username,
                fullName: userData.fullName || userData.full_name,
                email: userData.email,
                telephone: userData.telephone,
                rank: userData.rank,
                subjects: userData.subjects,
                classes: userData.classes,
                password: userData.password,
                className: userData.class,
                canPrintResults: userData.canPrintResults
            })
        });
        invalidateCache('users');

        const currentUser = getCurrentUser?.();
        if (currentUser && currentUser.id === userId) {
            const updated = { ...currentUser, ...userData };
            setCurrentUser?.(updated);
            saveData('lms_current_user', updated);
        }
        return result;
    } catch (e) {
        console.error('updateUser error:', e);
        return null;
    }
}

async function updateUserSubjects(userId, subjects) {
    return updateUser(userId, null, { subjects });
}

async function deleteUser(userId, userType) {
    try {
        await apiFetch(`/api/users/${userId}`, { method: 'DELETE', body: '{}' });
        invalidateCache('users');
        logAction('DELETE_USER', `Deleted ${userType}: ${userId}`, { userId, role: userType });
        return true;
    } catch (e) {
        console.error('deleteUser error:', e);
        return false;
    }
}

async function saveClass(className) {
    try {
        const result = await apiFetch('/api/classes', {
            method: 'POST',
            body: JSON.stringify({ name: className })
        });
        invalidateCache('classes');
        return result;
    } catch (e) {
        console.error('saveClass error:', e);
        const classes = getData('lms_classes') || [];
        const newClass = { id: Date.now().toString(), name: className, createdAt: new Date().toISOString() };
        classes.push(newClass);
        saveData('lms_classes', classes);
        return newClass;
    }
}

async function updateClass(classId, className) {
    try {
        const result = await apiFetch(`/api/classes/${classId}`, {
            method: 'PUT',
            body: JSON.stringify({ name: className })
        });
        invalidateCache('classes');
        return result;
    } catch (e) {
        console.error('updateClass error:', e);
        return null;
    }
}

async function deleteClass(classId) {
    try {
        await apiFetch(`/api/classes/${classId}`, { method: 'DELETE', body: '{}' });
        invalidateCache('classes');
        return true;
    } catch (e) {
        console.error('deleteClass error:', e);
        return false;
    }
}

async function saveCourse(course) {
    try {
        const result = await apiFetch('/api/courses', {
            method: 'POST',
            body: JSON.stringify({ subject: course.subject, className: course.class })
        });
        invalidateCache('courses');
        return result;
    } catch (e) {
        console.error('saveCourse error:', e);
        const courses = getData('lms_courses') || [];
        const newCourse = { id: Date.now().toString(), ...course, createdAt: new Date().toISOString() };
        courses.push(newCourse);
        saveData('lms_courses', courses);
        return newCourse;
    }
}

async function updateCourse(courseId, course) {
    try {
        const result = await apiFetch(`/api/courses/${courseId}`, {
            method: 'PUT',
            body: JSON.stringify({ subject: course.subject, className: course.class })
        });
        invalidateCache('courses');
        return result;
    } catch (e) {
        console.error('updateCourse error:', e);
        return null;
    }
}

async function deleteCourse(courseId) {
    try {
        await apiFetch(`/api/courses/${courseId}`, { method: 'DELETE', body: '{}' });
        invalidateCache('courses');
        return true;
    } catch (e) {
        console.error('deleteCourse error:', e);
        return false;
    }
}

async function saveExam(exam) {
    try {
        const result = await apiFetch('/api/exams', {
            method: 'POST',
            body: JSON.stringify(exam)
        });
        invalidateCache('exams');
        invalidateCache('exams_minimal');
        return result;
    } catch (e) {
        console.error('saveExam error:', e);
        const exams = getData('lms_exams') || [];
        if (exam.id) {
            const idx = exams.findIndex(ex => ex.id === exam.id);
            if (idx !== -1) exams[idx] = exam; else exams.push(exam);
        } else {
            exams.push(exam);
        }
        saveData('lms_exams', exams);
        return exam;
    }
}

async function updateExam(examId, updates) {
    try {
        const result = await apiFetch(`/api/exams/${examId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        invalidateCache('exams');
        invalidateCache('exams_minimal');
        return result;
    } catch (e) {
        console.error('updateExam error:', e);
        return null;
    }
}

async function deleteExam(examId) {
    try {
        await apiFetch(`/api/exams/${examId}`, { method: 'DELETE', body: '{}' });
        invalidateCache('exams');
        invalidateCache('exams_minimal');
        return true;
    } catch (e) {
        console.error('deleteExam error:', e);
        return false;
    }
}

async function saveResult(result) {
    try {
        const saved = await apiFetch('/api/results', {
            method: 'POST',
            body: JSON.stringify(result)
        });
        invalidateCache('results');
        return saved;
    } catch (e) {
        console.error('saveResult error:', e);
        const results = getData('lms_results') || [];
        const idx = results.findIndex(r => r.studentId === result.studentId && r.examId === result.examId);
        if (idx >= 0) results[idx] = result; else results.push(result);
        saveData('lms_results', results);
        return result;
    }
}

async function updateResult(resultId, updates) {
    try {
        const result = await apiFetch(`/api/results/${resultId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        invalidateCache('results');
        return result;
    } catch (e) {
        console.error('updateResult error:', e);
        return null;
    }
}

async function setResultRelease(examId, isReleased) {
    try {
        return await apiFetch('/api/result-releases', {
            method: 'POST',
            body: JSON.stringify({ examId, isReleased })
        });
    } catch (e) {
        console.error('setResultRelease error:', e);
        return null;
    }
}

async function saveMaterial(material) {
    try {
        const result = await apiFetch('/api/materials', {
            method: 'POST',
            body: JSON.stringify({
                title: material.title,
                description: material.description,
                content: material.content,
                fileUrl: material.fileUrl,
                fileName: material.fileName,
                uploadedFile: material.uploadedFile,
                subject: material.subject,
                className: material.class,
                uploadedBy: material.uploadedBy || material.lecturerId
            })
        });
        invalidateCache('materials');
        return result;
    } catch (e) {
        console.error('saveMaterial error:', e);
        const materials = getData('lms_materials') || [];
        materials.push({ id: Date.now().toString(), ...material, uploadedAt: new Date().toISOString() });
        saveData('lms_materials', materials);
        return material;
    }
}

async function deleteMaterial(materialId) {
    try {
        await apiFetch(`/api/materials/${materialId}`, { method: 'DELETE', body: '{}' });
        invalidateCache('materials');
        return true;
    } catch (e) {
        console.error('deleteMaterial error:', e);
        return false;
    }
}

async function saveAnnouncement(announcement) {
    try {
        const result = await apiFetch('/api/announcements', {
            method: 'POST',
            body: JSON.stringify({
                title: announcement.title,
                message: announcement.message || announcement.content,
                type: announcement.type || announcement.target || 'general',
                targetClasses: announcement.targetClasses || announcement.classes || [],
                createdBy: announcement.createdBy
            })
        });
        invalidateCache('announcements_all');
        return result;
    } catch (e) {
        console.error('saveAnnouncement error:', e);
        return null;
    }
}

async function deleteAnnouncement(announcementId) {
    try {
        await apiFetch(`/api/announcements/${announcementId}`, { method: 'DELETE', body: '{}' });
        invalidateCache('announcements_all');
        return true;
    } catch (e) {
        console.error('deleteAnnouncement error:', e);
        return false;
    }
}

async function saveNotification(notification) {
    try {
        return await apiFetch('/api/notifications', {
            method: 'POST',
            body: JSON.stringify({
                userId: notification.userId,
                userType: notification.userType,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                link: notification.link,
                data: notification.data
            })
        });
    } catch (e) {
        console.error('saveNotification error:', e);
        return null;
    }
}

async function saveWrittenMark(subject, className, examType, studentId, mark) {
    try {
        return await apiFetch('/api/written-marks', {
            method: 'POST',
            body: JSON.stringify({ subject, className, examType, studentId, mark })
        });
    } catch (e) {
        console.error('saveWrittenMark error:', e);
        return null;
    }
}

async function saveRegistrationKey(key) {
    try {
        const result = await apiFetch('/api/registration-keys', {
            method: 'POST',
            body: JSON.stringify({ key })
        });
        invalidateCache('registration_keys');
        return result;
    } catch (e) {
        console.error('saveRegistrationKey error:', e);
        return null;
    }
}

async function deleteRegistrationKey(key) {
    try {
        await apiFetch('/api/registration-keys', {
            method: 'DELETE',
            body: JSON.stringify({ key })
        });
        invalidateCache('registration_keys');
        return true;
    } catch (e) {
        console.error('deleteRegistrationKey error:', e);
        return false;
    }
}

// ============================================
// CLOUDINARY FILE UPLOAD
// ============================================

async function uploadFileToCloudinary(file, onProgress) {
    try {
        const sigData = await apiFetch('/api/materials/upload-signature');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', sigData.apiKey);
        formData.append('timestamp', sigData.timestamp);
        formData.append('signature', sigData.signature);
        formData.append('folder', sigData.folder);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`);

            if (onProgress) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
                };
            }

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    resolve({ url: data.secure_url, fileName: file.name, publicId: data.public_id });
                } else {
                    reject(new Error('Upload failed'));
                }
            };
            xhr.onerror = () => reject(new Error('Upload failed'));
            xhr.send(formData);
        });
    } catch (e) {
        console.error('uploadFileToCloudinary error:', e);
        throw e;
    }
}

// Assignments (localStorage only for now)
async function saveAssignment(assignment) {
    const assignments = getData('lms_assignments') || [];
    if (!assignment.id) assignment.id = Date.now().toString();
    assignments.push(assignment);
    saveData('lms_assignments', assignments);
    return assignment;
}

async function deleteAssignment(assignmentId) {
    const assignments = (getData('lms_assignments') || []).filter(a => a.id !== assignmentId);
    saveData('lms_assignments', assignments);
    return true;
}

async function saveSubmission(submission) {
    try {
        return await apiFetch('/api/submissions', {
            method: 'POST',
            body: JSON.stringify(submission)
        });
    } catch {
        const subs = getData('lms_submissions') || [];
        subs.push({ id: Date.now().toString(), ...submission, submittedAt: new Date().toISOString() });
        saveData('lms_submissions', subs);
        return submission;
    }
}

async function gradeSubmission(submissionId, grade, feedback) {
    try {
        return await apiFetch('/api/submissions', {
            method: 'PUT',
            body: JSON.stringify({ id: submissionId, grade, feedback })
        });
    } catch {
        return null;
    }
}

// ============================================
// EXPOSE GLOBALLY
// ============================================

window.getUsers = getUsers;
window.getClasses = getClasses;
window.getCourses = getCourses;
window.getExams = getExams;
window.getExamsMinimal = getExamsMinimal;
window.getResults = getResults;
window.getResultReleases = getResultReleases;
window.getMaterials = getMaterials;
window.getAssignments = getAssignments;
window.getSubmissions = getSubmissions;
window.getAnnouncements = getAnnouncements;
window.getNotifications = getNotifications;
window.markNotificationRead = markNotificationRead;
window.getWrittenMarks = getWrittenMarks;
window.getRegistrationKeys = getRegistrationKeys;
window.getAuditLogs = getAuditLogs;

window.saveUser = saveUser;
window.updateUser = updateUser;
window.updateUserSubjects = updateUserSubjects;
window.deleteUser = deleteUser;
window.saveClass = saveClass;
window.updateClass = updateClass;
window.deleteClass = deleteClass;
window.saveCourse = saveCourse;
window.updateCourse = updateCourse;
window.deleteCourse = deleteCourse;
window.saveExam = saveExam;
window.updateExam = updateExam;
window.deleteExam = deleteExam;
window.saveResult = saveResult;
window.updateResult = updateResult;
window.setResultRelease = setResultRelease;
window.saveMaterial = saveMaterial;
window.deleteMaterial = deleteMaterial;
window.saveAnnouncement = saveAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.saveNotification = saveNotification;
window.saveWrittenMark = saveWrittenMark;
window.saveRegistrationKey = saveRegistrationKey;
window.deleteRegistrationKey = deleteRegistrationKey;
window.saveAssignment = saveAssignment;
window.deleteAssignment = deleteAssignment;
window.saveSubmission = saveSubmission;
window.gradeSubmission = gradeSubmission;
window.uploadFileToCloudinary = uploadFileToCloudinary;
