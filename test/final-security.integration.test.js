import { randomUUID } from 'node:crypto';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const enabled = process.env.RUN_FINAL_SECURITY_API_TESTS === '1';
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const testDbUrl = process.env.TEST_DATABASE_URL;
const configuredDbUrl = process.env.DATABASE_URL;
const adminToken = process.env.TEST_ADMIN_TOKEN;
const lecturerToken = process.env.TEST_LECTURER_TOKEN;
const studentToken = process.env.TEST_STUDENT_TOKEN;
const examId = process.env.TEST_OPEN_EXAM_ID;
const otherLecturerResultId = process.env.TEST_OTHER_LECTURER_RESULT_ID;
const materialInScopeId = process.env.TEST_MATERIAL_IN_SCOPE_ID;
const materialOutOfScopeId = process.env.TEST_MATERIAL_OUT_OF_SCOPE_ID;
const announcementInScopeId = process.env.TEST_ANNOUNCEMENT_IN_SCOPE_ID;
const announcementOutOfScopeId = process.env.TEST_ANNOUNCEMENT_OUT_OF_SCOPE_ID;
const globalAnnouncementId = process.env.TEST_GLOBAL_ANNOUNCEMENT_ID;
const classInScope = process.env.TEST_CLASS_IN_SCOPE;
const classOutOfScope = process.env.TEST_CLASS_OUT_OF_SCOPE;
const subjectInScope = process.env.TEST_SUBJECT_IN_SCOPE;
const studentInScopeId = process.env.TEST_STUDENT_IN_SCOPE_ID;
const submissionOutOfScopeId = process.env.TEST_SUBMISSION_OUT_OF_SCOPE_ID;
const duplicateUsername = process.env.TEST_EXISTING_USERNAME;

if (enabled) {
    const apiUrl = new URL(baseUrl);
    if (!testDbUrl || configuredDbUrl !== testDbUrl) {
        throw new Error('Final security API tests require DATABASE_URL to exactly match TEST_DATABASE_URL.');
    }
    if (!['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname)) {
        throw new Error('Final security API mutation tests only run against a local test server.');
    }
    if (!adminToken || !lecturerToken || !studentToken) {
        throw new Error('Set dedicated TEST_ADMIN_TOKEN, TEST_LECTURER_TOKEN, and TEST_STUDENT_TOKEN values.');
    }
}

async function api(path, token, body, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(new URL(path, baseUrl), {
        method,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Content-Type': 'application/json'
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    let responseBody = null;
    try { responseBody = await response.json(); } catch {}
    return { status: response.status, body: responseBody };
}

describe('final security API regressions', { skip: !enabled }, () => {
    test('student exam submission receipt does not disclose score or answer-key details', async t => {
        if (!examId) return t.skip('TEST_OPEN_EXAM_ID fixture is required');
        const response = await api('/api/results', studentToken, {
            examId,
            answers: [],
            score: 100,
            correctAnswers: 999,
            isReleased: true
        });
        assert.equal(response.status, 201);
        assert.equal(response.body.isReleased, false);
        assert.equal(Object.hasOwn(response.body, 'score'), false);
        assert.equal(Object.hasOwn(response.body, 'answers'), false);
        assert.equal(Object.hasOwn(response.body, 'questionDetails'), false);
        assert.equal(Object.hasOwn(response.body, 'correctAnswer'), false);
    });

    test('lecturer cannot GET, update, or delete another lecturer examination result', async t => {
        if (!otherLecturerResultId) return t.skip('TEST_OTHER_LECTURER_RESULT_ID fixture is required');
        const [read, update, remove] = await Promise.all([
            api(`/api/results/${otherLecturerResultId}`, lecturerToken),
            api(`/api/results/${otherLecturerResultId}`, lecturerToken, { score: 100 }, 'PUT'),
            api(`/api/results/${otherLecturerResultId}`, lecturerToken, undefined, 'DELETE')
        ]);
        assert.deepEqual([read.status, update.status, remove.status], [403, 403, 403]);
    });

    test('student material visibility is limited to global or own-class materials', async t => {
        if (!materialInScopeId || !materialOutOfScopeId) {
            return t.skip('TEST_MATERIAL_IN_SCOPE_ID and TEST_MATERIAL_OUT_OF_SCOPE_ID fixtures are required');
        }
        const response = await api('/api/materials', studentToken);
        assert.equal(response.status, 200);
        const visibleIds = new Set(response.body.map(material => material.id));
        assert.equal(visibleIds.has(materialInScopeId), true);
        assert.equal(visibleIds.has(materialOutOfScopeId), false);
    });

    test('student announcement visibility is limited to global or own-class announcements', async t => {
        if (!announcementInScopeId || !announcementOutOfScopeId || !globalAnnouncementId) {
            return t.skip('TEST_ANNOUNCEMENT_IN_SCOPE_ID, TEST_ANNOUNCEMENT_OUT_OF_SCOPE_ID, and TEST_GLOBAL_ANNOUNCEMENT_ID fixtures are required');
        }
        const response = await api('/api/announcements', studentToken);
        assert.equal(response.status, 200);
        const visibleIds = new Set(response.body.map(announcement => announcement.id));
        assert.equal(visibleIds.has(announcementInScopeId), true);
        assert.equal(visibleIds.has(globalAnnouncementId), true);
        assert.equal(visibleIds.has(announcementOutOfScopeId), false);
    });

    test('lecturer cannot write marks for students outside class or subject scope', async t => {
        if (!classOutOfScope || !subjectInScope || !studentInScopeId) {
            return t.skip('TEST_CLASS_OUT_OF_SCOPE, TEST_SUBJECT_IN_SCOPE, and TEST_STUDENT_IN_SCOPE_ID fixtures are required');
        }
        const response = await api('/api/written-marks', lecturerToken, {
            subject: subjectInScope,
            className: classOutOfScope,
            examType: `security-test-${randomUUID()}`,
            studentId: studentInScopeId,
            mark: 100
        });
        assert.equal(response.status, 403);
    });

    test('lecturer cannot target an unassigned class in an announcement', async t => {
        if (!classOutOfScope) return t.skip('TEST_CLASS_OUT_OF_SCOPE fixture is required');
        const response = await api('/api/announcements', lecturerToken, {
            title: `Security test ${randomUUID()}`,
            message: 'Test-only unauthorized target',
            targetClasses: [classOutOfScope]
        });
        assert.equal(response.status, 403);
    });

    test('lecturer cannot grade a submission outside assigned student classes', async t => {
        if (!submissionOutOfScopeId) return t.skip('TEST_SUBMISSION_OUT_OF_SCOPE_ID fixture is required');
        const response = await api('/api/submissions', lecturerToken, {
            id: submissionOutOfScopeId,
            grade: 100,
            feedback: 'Unauthorized test attempt'
        });
        assert.equal(response.status, 404);
    });

    test('registration key rolls back on account failure and cannot be reused concurrently', async t => {
        if (!classInScope || !subjectInScope || !duplicateUsername) {
            return t.skip('TEST_CLASS_IN_SCOPE, TEST_SUBJECT_IN_SCOPE, and TEST_EXISTING_USERNAME fixtures are required');
        }
        const issueKey = async () => {
            const key = `TEST-${randomUUID()}-LECTURER`;
            const response = await api('/api/registration-keys', adminToken, {
                key,
                classes: [classInScope],
                subjects: [subjectInScope]
            });
            assert.equal(response.status, 201);
            return key;
        };
        const registration = (key, username) => api('/api/auth/register', null, {
            username,
            password: `Test-${randomUUID()}-Password`,
            fullName: 'Security Test Lecturer',
            type: 'lecturer',
            registrationKey: key
        });

        const rollbackKey = await issueKey();
        const failed = await registration(rollbackKey, duplicateUsername);
        assert.equal(failed.status, 409);
        const succeedsAfterRollback = await registration(rollbackKey, `security-${randomUUID()}`);
        assert.equal(succeedsAfterRollback.status, 201);

        const concurrentKey = await issueKey();
        const [first, second] = await Promise.all([
            registration(concurrentKey, `security-${randomUUID()}`),
            registration(concurrentKey, `security-${randomUUID()}`)
        ]);
        assert.deepEqual([first.status, second.status].sort(), [201, 401]);
    });
});
