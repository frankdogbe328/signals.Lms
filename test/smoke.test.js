// API smoke tests — hit each /api/* endpoint and verify status codes.
//
// Requires:
//   - A running server (local dev at http://localhost:3000, or set BASE_URL)
//   - Admin credentials in env: ADMIN_USER and ADMIN_PASS (no defaults)
//
// Run: node --test test/smoke.test.js
//   or: npm test
//
// These tests intentionally do not modify data; they check that endpoints
// respond with sensible status codes given valid/invalid auth. Any test
// that would create/delete a row is left as a TODO — writing those requires
// a dedicated test DB.

import { test, describe, before } from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const STUDENT_TOKEN = process.env.STUDENT_TOKEN;
const LECTURER_TOKEN = process.env.LECTURER_TOKEN;
const OTHER_LECTURER_EXAM_ID = process.env.OTHER_LECTURER_EXAM_ID;
const OTHER_LECTURER_MATERIAL_ID = process.env.OTHER_LECTURER_MATERIAL_ID;
const OTHER_LECTURER_ANNOUNCEMENT_ID = process.env.OTHER_LECTURER_ANNOUNCEMENT_ID;
const OTHER_NOTIFICATION_ID = process.env.OTHER_NOTIFICATION_ID;
const SECURITY_TEST_EXAM_ID = process.env.SECURITY_TEST_EXAM_ID;

let adminToken = null;

async function api(path, opts = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(opts.headers || {})
        }
    });
    let body = null;
    try { body = await res.json(); } catch {}
    return { status: res.status, body };
}

describe('/api smoke tests', { skip: process.env.RUN_API_TESTS !== '1' }, () => {
    before(async () => {
        // Attempt to log in as admin — if this fails, most tests will be skipped
        if (!ADMIN_USER || !ADMIN_PASS) return;
        const res = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS, type: 'admin' })
        });
        if (res.status === 200 && res.body?.token) {
            adminToken = res.body.token;
        } else {
            console.warn(`⚠️  Admin login failed (${res.status}). Auth-required tests will be skipped.`);
            console.warn(`   Set ADMIN_USER/ADMIN_PASS env vars for a valid admin account.`);
        }
    });

    test('Invalid bearer token is rejected', async () => {
        const res = await api('/api/users', { headers: { 'Authorization': 'Bearer invalid.token.value' } });
        assert.strictEqual(res.status, 401);
    });

    test('Public registration cannot create administrator accounts', async () => {
        const res = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username: 'forbidden-admin-smoke-test', password: 'TestPassword123!', type: 'admin' })
        });

        test('Public registration cannot set privileged profile fields', async () => {
            const res = await api('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username: 'privileged-field-smoke-test', password: 'TestPassword123!', type: 'student', canPrintResults: true })
            });
            assert.strictEqual(res.status, 400);
        });

        test('Student cannot create an administrative notification', async (t) => {
            if (!STUDENT_TOKEN) return t.skip('STUDENT_TOKEN not configured');
            const res = await api('/api/notifications', {
                method: 'POST',
                headers: { Authorization: `Bearer ${STUDENT_TOKEN}` },
                body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000001', title: 'forged', message: 'forged' })
            });
            assert.strictEqual(res.status, 403);
        });

        test('Student cannot manage exams or users', async (t) => {
            if (!STUDENT_TOKEN) return t.skip('STUDENT_TOKEN not configured');
            const headers = { Authorization: `Bearer ${STUDENT_TOKEN}` };
            const [users, examCreate, uploadSignature, exams] = await Promise.all([
                api('/api/users', { headers }),
                api('/api/exams', { method: 'POST', headers, body: JSON.stringify({ title: 'forged' }) }),
                api('/api/materials/upload-signature', { headers }),
                api('/api/exams', { headers })
            ]);
            assert.strictEqual(users.status, 403);
            assert.strictEqual(examCreate.status, 403);
            assert.strictEqual(uploadSignature.status, 403);
            assert.strictEqual(exams.status, 200);
            assert.ok(exams.body.every(exam => (exam.questions || []).every(question => !Object.prototype.hasOwnProperty.call(question, 'correctAnswer'))));
        });

        test('Lecturer cannot submit authoritative results or create administrator accounts', async (t) => {
            if (!LECTURER_TOKEN) return t.skip('LECTURER_TOKEN not configured');
            const headers = { Authorization: `Bearer ${LECTURER_TOKEN}` };
            const [result, registration] = await Promise.all([
                api('/api/results', { method: 'POST', headers, body: JSON.stringify({ examId: '00000000-0000-0000-0000-000000000001', score: 100, isReleased: true }) }),
                api('/api/auth/register', { method: 'POST', headers, body: JSON.stringify({ username: 'lecturer-admin-smoke-test', password: 'TestPassword123!', type: 'admin' }) })
            ]);
            assert.strictEqual(result.status, 403);
            assert.strictEqual(registration.status, 403);
        });

        test('Lecturer cannot update or release another lecturer examination', async (t) => {
            if (!LECTURER_TOKEN || !OTHER_LECTURER_EXAM_ID) return t.skip('LECTURER_TOKEN and OTHER_LECTURER_EXAM_ID fixtures required');
            const headers = { Authorization: `Bearer ${LECTURER_TOKEN}` };
            const [update, release] = await Promise.all([
                api('/api/exams', {
                    method: 'POST', headers,
                    body: JSON.stringify({ id: OTHER_LECTURER_EXAM_ID, title: 'forged', classes: [], questions: [] })
                }),
                api('/api/result-releases', {
                    method: 'POST', headers,
                    body: JSON.stringify({ examId: OTHER_LECTURER_EXAM_ID, isReleased: true })
                })
            ]);
            assert.strictEqual(update.status, 403);
            assert.strictEqual(release.status, 403);
        });

        test('Lecturer cannot delete another lecturer material or announcement', async (t) => {
            if (!LECTURER_TOKEN || !OTHER_LECTURER_MATERIAL_ID || !OTHER_LECTURER_ANNOUNCEMENT_ID) {
                return t.skip('Lecturer token and other-owner material/announcement fixtures required');
            }
            const headers = { Authorization: `Bearer ${LECTURER_TOKEN}` };
            const [material, announcement] = await Promise.all([
                api(`/api/materials/${OTHER_LECTURER_MATERIAL_ID}`, { method: 'DELETE', headers }),
                api(`/api/announcements/${OTHER_LECTURER_ANNOUNCEMENT_ID}`, { method: 'DELETE', headers })
            ]);
            assert.ok([403, 404].includes(material.status));
            assert.strictEqual(announcement.status, 404);
        });

        test('Student cannot mark another user notification as read', async (t) => {
            if (!STUDENT_TOKEN || !OTHER_NOTIFICATION_ID) return t.skip('STUDENT_TOKEN and OTHER_NOTIFICATION_ID fixtures required');
            const res = await api(`/api/notifications/${OTHER_NOTIFICATION_ID}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${STUDENT_TOKEN}` },
                body: '{}'
            });
            assert.ok([403, 404].includes(res.status));
        });

        test('Student cannot forge score or release status during exam submission', async (t) => {
            if (!STUDENT_TOKEN || !SECURITY_TEST_EXAM_ID) return t.skip('Student token and dedicated eligible exam fixture required');
            const res = await api('/api/results', {
                method: 'POST',
                headers: { Authorization: `Bearer ${STUDENT_TOKEN}` },
                body: JSON.stringify({
                    examId: SECURITY_TEST_EXAM_ID,
                    answers: [],
                    score: 100,
                    correctAnswers: 999,
                    isReleased: true,
                    studentId: '00000000-0000-0000-0000-000000000001'
                })
            });
            assert.strictEqual(res.status, 201);
            assert.notStrictEqual(res.body.score, 100);
            assert.strictEqual(res.body.isReleased, false);
            assert.notStrictEqual(res.body.correctAnswers, 999);
        });
        assert.ok([403, 401].includes(res.status));
    });

    test('GET /api/ping returns 200', async () => {
        const res = await api('/api/ping');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.ok, true);
    });

    test('POST /api/auth/login with bad credentials returns 401', async () => {
        const res = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'nonexistent-user', password: 'wrong', type: 'admin' })
        });
        assert.strictEqual(res.status, 401);
    });

    test('POST /api/auth/login missing fields returns 400', async () => {
        const res = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'x' })
        });
        assert.strictEqual(res.status, 400);
    });

    test('GET /api/users without token returns 401', async () => {
        const res = await api('/api/users');
        assert.strictEqual(res.status, 401);
    });

    test('GET /api/users with admin token returns 200', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/users', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body.students));
        assert.ok(Array.isArray(res.body.lecturers));
        const allUsers = [...res.body.students, ...res.body.lecturers, ...(res.body.admin ? [res.body.admin] : [])];
        assert.ok(allUsers.every(user => !Object.prototype.hasOwnProperty.call(user, 'password') && !Object.prototype.hasOwnProperty.call(user, 'password_hash')));
    });

    test('GET /api/classes is public and returns array', async () => {
        const res = await api('/api/classes');
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    test('GET /api/courses returns array', async () => {
        const res = await api('/api/courses');
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    test('GET /api/exams without token returns 401', async () => {
        const res = await api('/api/exams');
        assert.strictEqual(res.status, 401);
    });

    test('GET /api/exams with admin token returns array', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/exams?minimal=true', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    test('GET /api/results with admin token returns array', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/results', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    test('GET /api/announcements with admin token returns array', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/announcements', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    test('GET /api/materials with admin token returns array', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/materials', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    test('GET /api/registration-keys with admin token returns array', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/registration-keys', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    test('GET /api/audit-logs with admin token returns paginated', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/audit-logs?page=1&limit=10', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body.data));
        assert.ok(typeof res.body.count === 'number');
    });

    test('GET /api/written-marks with admin token returns object', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/written-marks', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(typeof res.body, 'object');
    });

    test('GET /api/result-releases with admin token returns object', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/result-releases', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(typeof res.body, 'object');
    });

    test('GET /api/health with admin token returns full snapshot', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/health', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.ok);
        assert.strictEqual(res.body.db.status, 'connected');
        assert.ok(res.body.tables && typeof res.body.tables === 'object');
    });

    test('GET /api/health without token returns 401', async () => {
        const res = await api('/api/health');
        assert.strictEqual(res.status, 401);
    });

    test('POST /api/cleanup without token returns 401', async () => {
        const res = await api('/api/cleanup', { method: 'POST', body: '{}' });
        assert.strictEqual(res.status, 401);
    });

    test('POST /api/cleanup with admin token succeeds', async (t) => {
        if (!adminToken) return t.skip('no admin token');
        const res = await api('/api/cleanup', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: '{}'
        });
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.ok);
        assert.ok(res.body.deleted && typeof res.body.deleted === 'object');
    });

    test('Login rate limit kicks in after 10 rapid failed attempts', async () => {
        // Fire 12 bad logins in parallel
        const attempts = await Promise.all(
            Array.from({ length: 12 }, () => api('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username: 'nonexistent', password: 'x', type: 'admin' })
            }))
        );
        const rateLimited = attempts.filter(r => r.status === 429).length;
        assert.ok(rateLimited > 0, `Expected at least one 429 response but got ${JSON.stringify(attempts.map(a => a.status))}`);
    });

    test('Unknown route returns 404', async () => {
        const res = await api('/api/nonexistent-endpoint');
        assert.strictEqual(res.status, 404);
    });
});
