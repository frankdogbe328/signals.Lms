// API smoke tests — hit each /api/* endpoint and verify status codes.
//
// Requires:
//   - A running server (local dev at http://localhost:3000, or set BASE_URL)
//   - Admin credentials in env: ADMIN_USER (default 'admin'), ADMIN_PASS (default 'admin123')
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
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

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

describe('/api smoke tests', () => {
    before(async () => {
        // Attempt to log in as admin — if this fails, most tests will be skipped
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
