import { getDb } from './_db.js';
import { verifyToken, createToken } from './_auth.js';
import { cors } from './_cors.js';
import { canManageExam, getEligibleExam, getRegistrationAssignments, gradeObjectiveQuestions, isExamOpen } from './_security.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Send an email via Resend to every student that has a result for the given
// exam. No-op if RESEND_API_KEY isn't configured. Errors are logged but do
// not propagate — result release itself must succeed even if email fails.
async function sendResultReleaseEmails(db, examId) {
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddr = process.env.RESEND_FROM || 'Signals LMS <noreply@signals-lms.local>';
    if (!apiKey) return;

    const { rows: exRows } = await db.query('SELECT title, subject FROM exams WHERE id = $1', [examId]);
    if (!exRows[0]) return;
    const exam = exRows[0];

    const { rows: recipients } = await db.query(`
        SELECT DISTINCT u.email, u.full_name, r.score
        FROM results r
        JOIN users u ON u.id = r.student_id
        WHERE r.exam_id = $1 AND u.email IS NOT NULL AND u.email <> ''
    `, [examId]);

    if (recipients.length === 0) return;
    console.log(`Sending ${recipients.length} result-release email(s) for exam ${exam.title}`);

    const results = await Promise.allSettled(recipients.map(r => fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: fromAddr,
            to: [r.email],
            subject: `Your result for "${exam.title}" is now available`,
            html: `
                <p>Hi ${r.full_name || 'there'},</p>
                <p>Your result for <strong>${exam.title}</strong>${exam.subject ? ` (${exam.subject})` : ''} has been released.</p>
                <p>You scored <strong>${parseFloat(r.score || 0).toFixed(1)}%</strong>. Log in to the student portal to see the full breakdown.</p>
                <p>— Signals Training School</p>
            `
        })
    }).then(async res => {
        if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    })));

    const failures = results.filter(r => r.status === 'rejected').length;
    if (failures) console.warn(`${failures} of ${recipients.length} result-release emails failed to send`);
}

// In-memory sliding-window rate limit for /auth/login.
// Note: serverless functions on Vercel are per-instance, so this caps
// per-instance not truly global — but any single attacker will usually
// hit the same warm instance, and this is still enough to blunt basic
// credential-stuffing without adding a Redis dependency.
const LOGIN_ATTEMPTS = new Map();
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 10;

function loginRateLimitExceeded(req) {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || 'unknown';
    const now = Date.now();
    const attempts = (LOGIN_ATTEMPTS.get(ip) || []).filter(ts => now - ts < LOGIN_WINDOW_MS);
    attempts.push(now);
    LOGIN_ATTEMPTS.set(ip, attempts);
    // Opportunistic cleanup so the map doesn't grow forever
    if (LOGIN_ATTEMPTS.size > 500) {
        for (const [k, v] of LOGIN_ATTEMPTS.entries()) {
            if (v[v.length - 1] < now - LOGIN_WINDOW_MS) LOGIN_ATTEMPTS.delete(k);
        }
    }
    return attempts.length > LOGIN_MAX_ATTEMPTS;
}

export default async function handler(req, res) {
    if (cors(req, res)) return;

    // Resolve segments from any of:
    //  1. Vercel catch-all: req.query.path = ['seg0', 'seg1', ...]
    //  2. Legacy vercel.json rewrite: req.query.p0='seg0', req.query.p1='seg1'
    //  3. Fallback URL parsing of req.url
    let segments = [];
    const raw = req.query.path;
    if (Array.isArray(raw)) segments = raw;
    else if (raw) segments = [raw];
    if (segments.length === 0 && (req.query.p0 || req.query.p1)) {
        segments = [req.query.p0, req.query.p1].filter(Boolean);
    }
    if (segments.length === 0 && req.url) {
        const urlPath = req.url.split('?')[0];
        const parts = urlPath.split('/').filter(Boolean);
        if (parts[0] === 'api') parts.shift();
        segments = parts;
    }
    const [seg0, seg1] = segments;
    const db = getDb();

    try {
        if (!seg0) return res.status(404).json({ error: 'Not found' });

        // ── PING ────────────────────────────────────────────────────────────
        if (seg0 === 'ping') {
            await db.query('SELECT 1');
            return res.json({ ok: true, ts: Date.now() });
        }

        // ── BACKUP (admin-only full JSON dump of core tables) ───────────────
        if (seg0 === 'backup') {
            const caller = verifyToken(req);
            const isAdmin = caller && caller.type === 'admin';
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });

            const backup = { generatedAt: new Date().toISOString(), version: 1 };
            const dumpTable = async (name, sql) => {
                try {
                    const { rows } = await db.query(sql || `SELECT * FROM ${name}`);
                    backup[name] = rows;
                } catch (err) {
                    backup[name] = { error: err.message };
                }
            };

            await dumpTable('users', 'SELECT id,username,full_name,email,telephone,type,rank,class_id,subjects,classes,can_print_results,created_at FROM users');
            await dumpTable('classes');
            await dumpTable('courses');
            await dumpTable('exams');
            await dumpTable('exam_questions');
            await dumpTable('exam_classes');
            await dumpTable('results');
            await dumpTable('materials');
            await dumpTable('written_marks');
            await dumpTable('result_releases');
            await dumpTable('announcements');
            await dumpTable('announcement_classes');
            await dumpTable('registration_keys');

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="signals-lms-backup-${new Date().toISOString().slice(0,10)}.json"`);
            return res.status(200).send(JSON.stringify(backup, null, 2));
        }

        // ── HEALTH ──────────────────────────────────────────────────────────
        if (seg0 === 'health') {
            const caller = verifyToken(req);
            const isAdmin = caller && caller.type === 'admin';
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });

            const health = { ok: true, ranAt: new Date().toISOString(), db: {}, tables: {} };
            const startDb = Date.now();
            try {
                await db.query('SELECT 1');
                health.db.status = 'connected';
                health.db.latencyMs = Date.now() - startDb;
            } catch (err) {
                health.ok = false;
                health.db.status = 'error';
                health.db.error = err.message;
                return res.status(500).json(health);
            }

            const tableNames = ['users', 'classes', 'courses', 'exams', 'exam_questions',
                'results', 'materials', 'announcements', 'notifications',
                'audit_logs', 'registration_keys', 'written_marks'];
            for (const t of tableNames) {
                try {
                    const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
                    health.tables[t] = rows[0].n;
                } catch (err) {
                    health.tables[t] = { error: err.message };
                }
            }

            try {
                const { rows } = await db.query(
                    `SELECT created_at FROM audit_logs WHERE action_type = 'DB_CLEANUP' ORDER BY created_at DESC LIMIT 1`
                );
                health.lastCleanupAt = rows[0]?.created_at || null;
            } catch { health.lastCleanupAt = null; }

            return res.json(health);
        }

        // ── CLEANUP (retention pruning) ─────────────────────────────────────
        if (seg0 === 'cleanup') {
            if (req.method !== 'POST' && req.method !== 'GET') {
                return res.status(405).json({ error: 'Method not allowed' });
            }
            const isVercelCron = req.headers['x-vercel-cron'] === '1'
                || (process.env.CRON_SECRET && req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`);
            let isAdmin = false;
            if (!isVercelCron) {
                const caller = verifyToken(req);
                isAdmin = caller && caller.type === 'admin';
                if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
            }

            const summary = {};
            const runQuery = async (label, sql) => {
                try {
                    const { rowCount } = await db.query(sql);
                    summary[label] = rowCount || 0;
                } catch (err) {
                    console.error(`Cleanup ${label} failed:`, err.message);
                    summary[label] = { error: err.message };
                }
            };

            await runQuery('audit_logs', `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days'`);
            await runQuery('notifications_read', `DELETE FROM notifications WHERE read = true AND created_at < NOW() - INTERVAL '14 days'`);
            await runQuery('notifications_stale', `DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '60 days'`);
            await runQuery('announcements', `DELETE FROM announcements WHERE created_at < NOW() - INTERVAL '90 days'`);
            await runQuery('registration_keys', `DELETE FROM registration_keys WHERE created_at < NOW() - INTERVAL '30 days'`);
            await runQuery('exam_questions', `
                DELETE FROM exam_questions WHERE exam_id IN (
                    SELECT e.id FROM exams e
                    WHERE e.created_at < NOW() - INTERVAL '30 days'
                      AND EXISTS (SELECT 1 FROM results r WHERE r.exam_id = e.id)
                )
            `);

            return res.json({ ok: true, ranAt: new Date().toISOString(), deleted: summary });
        }

        // ── AUTH ─────────────────────────────────────────────────────────────
        if (seg0 === 'auth') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

            if (seg1 === 'login') {
                if (loginRateLimitExceeded(req)) {
                    return res.status(429).json({ error: 'Too many login attempts. Please wait a minute and try again.' });
                }
                const { username, password, type } = req.body;
                if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
                const q = type
                    ? 'SELECT u.*, c.name as class_name FROM users u LEFT JOIN classes c ON u.class_id = c.id WHERE (u.username = $1 OR u.email = $1) AND u.type = $2 LIMIT 1'
                    : 'SELECT u.*, c.name as class_name FROM users u LEFT JOIN classes c ON u.class_id = c.id WHERE (u.username = $1 OR u.email = $1) LIMIT 1';
                const { rows } = await db.query(q, type ? [username, type] : [username]);
                const user = rows[0];
                if (!user) return res.status(401).json({ error: 'Invalid username or password' });
                const isBcryptHash = /^\$2[aby]\$/.test(user.password_hash || '');
                if (!isBcryptHash) {
                    // Legacy plaintext credentials are not accepted. Preserve access only through the migration procedure.
                    return res.status(401).json({ error: 'Invalid username or password' });
                }
                const match = await bcrypt.compare(password, user.password_hash);
                if (!match) return res.status(401).json({ error: 'Invalid username or password' });
                return res.json({
                    token: createToken(user),
                    user: {
                        id: user.id, username: user.username,
                        fullName: user.full_name, email: user.email, telephone: user.telephone,
                        type: user.type, rank: user.rank, class: user.class_name,
                        classId: user.class_id, subjects: user.subjects || [],
                        classes: user.classes || [], canPrintResults: user.can_print_results
                    }
                });
            }

            if (seg1 === 'register') {
                const { username, password, fullName, email, telephone, type, rank, className, classes, subjects, registrationKey, canPrintResults } = req.body;
                if (!username || !password || !type) return res.status(400).json({ error: 'Missing required fields' });
                if (typeof username !== 'string' || username.trim().length < 3 || username.length > 100) return res.status(400).json({ error: 'Invalid username' });
                if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8-128 characters' });
                const caller = verifyToken(req);
                const isAdminCaller = caller?.type === 'admin';
                if (!isAdminCaller && canPrintResults !== undefined) return res.status(400).json({ error: 'Privileged fields cannot be set during public registration' });
                if (!['student', 'lecturer', 'admin'].includes(type)) return res.status(400).json({ error: 'Invalid account type' });
                if (type === 'admin' && !isAdminCaller) return res.status(403).json({ error: 'Administrator accounts require authorization' });
                if (type !== 'admin' && type !== 'student' && type !== 'lecturer') return res.status(400).json({ error: 'Invalid account type' });
                const { rows: ex } = await db.query('SELECT id FROM users WHERE username = $1', [username]);
                if (ex.length) return res.status(409).json({ error: 'Username already exists' });
                let lecturerScopes = null;
                if (type === 'lecturer') {
                    if (!isAdminCaller) {
                        if (!registrationKey) return res.status(400).json({ error: 'Registration key required for lecturers' });
                        const { rows: keys } = await db.query(`
                            UPDATE registration_keys SET used_at = NOW()
                            WHERE key = $1 AND used_at IS NULL AND expires_at > NOW()
                            RETURNING classes, subjects
                        `, [registrationKey]);
                        if (!keys.length) return res.status(401).json({ error: 'Invalid registration key' });
                        lecturerScopes = keys[0];
                    }
                }
                const assignments = getRegistrationAssignments(type, isAdminCaller, lecturerScopes, classes, subjects, className);
                const { classes: assignedClasses, subjects: assignedSubjects, className: assignedClassName } = assignments;
                let classId = null;
                if (assignedClassName) {
                    const { rows: cl } = await db.query('SELECT id FROM classes WHERE name = $1', [String(assignedClassName).trim()]);
                    classId = cl[0]?.id || null;
                }
                const passwordHash = await bcrypt.hash(password, 10);
                const classesArr = assignedClasses;
                const { rows } = await db.query(
                    `INSERT INTO users (username,password_hash,full_name,email,telephone,type,rank,class_id,subjects,classes,can_print_results)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,username,full_name,email,type`,
                    [username, passwordHash, fullName, email, telephone, type, rank, classId, assignedSubjects, classesArr, isAdminCaller && canPrintResults === true]
                );
                return res.status(201).json({ user: rows[0] });
            }

            return res.status(404).json({ error: 'Not found' });
        }

        // ── USERS ─────────────────────────────────────────────────────────────
        if (seg0 === 'users') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });

            if (!seg1) {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                const { rows } = await db.query(`
                    SELECT u.*, c.name as class_name FROM users u
                    LEFT JOIN classes c ON u.class_id = c.id ORDER BY u.created_at DESC
                `);
                if (token.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
                const mapUser = u => ({
                    id: u.id, username: u.username,
                    fullName: u.full_name, email: u.email, telephone: u.telephone,
                    type: u.type, rank: u.rank, class: u.class_name, classId: u.class_id,
                    subjects: u.subjects || [], classes: u.classes || [],
                    canPrintResults: u.can_print_results, createdAt: u.created_at
                });
                return res.json({
                    students: rows.filter(u => u.type === 'student').map(mapUser),
                    lecturers: rows.filter(u => u.type === 'lecturer').map(mapUser),
                    admin: mapUser(rows.find(u => u.type === 'admin') || {})
                });
            }

            const id = seg1;
            const { rows: targets } = await db.query('SELECT id,type FROM users WHERE id = $1', [id]);
            const target = targets[0];
            if (!target) return res.status(404).json({ error: 'User not found' });
            if (token.type !== 'admin' && token.id !== id) return res.status(403).json({ error: 'Forbidden' });
            if (req.method === 'PUT') {
                const { username, fullName, email, telephone, rank, subjects, classes, password, className, canPrintResults, type, accountStatus } = req.body;
                if (type !== undefined && token.type !== 'admin') return res.status(403).json({ error: 'Account type cannot be changed' });
                if (type !== undefined && token.id === id) return res.status(403).json({ error: 'Cannot change your own account type' });
                if (accountStatus !== undefined) return res.status(403).json({ error: 'Protected account fields cannot be changed' });
                if (canPrintResults !== undefined && token.type !== 'admin') return res.status(403).json({ error: 'Protected account fields cannot be changed' });
                let classId;
                if (className !== undefined) {
                    classId = null;
                    if (className) {
                        const { rows: cl } = await db.query('SELECT id FROM classes WHERE name = $1', [className]);
                        classId = cl[0]?.id || null;
                    }
                }
                const updates = [], values = [];
                let i = 1;
                const add = (col, val) => { updates.push(`${col} = $${i++}`); values.push(val); };
                if (username !== undefined) add('username', username);
                if (type !== undefined && ['student', 'lecturer', 'admin'].includes(type)) add('type', type);
                if (fullName !== undefined) add('full_name', fullName);
                if (email !== undefined) add('email', email);
                if (telephone !== undefined) add('telephone', telephone);
                if (rank !== undefined) add('rank', rank);
                if (subjects !== undefined) add('subjects', subjects);
                if (classes !== undefined) add('classes', classes);
                if (canPrintResults !== undefined) add('can_print_results', canPrintResults);
                if (classId !== undefined) add('class_id', classId);
                if (password !== undefined) {
                    if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8-128 characters' });
                    add('password_hash', await bcrypt.hash(password, 10));
                }
                if (!updates.length) return res.json({ id });
                values.push(id);
                const { rows } = await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id,username,full_name,email,telephone,type,rank,class_id,subjects,classes,can_print_results,created_at`, values);
                const u = rows[0];
                return res.json(u ? { id:u.id, username:u.username, fullName:u.full_name, email:u.email, telephone:u.telephone, type:u.type, rank:u.rank, classId:u.class_id, subjects:u.subjects||[], classes:u.classes||[], canPrintResults:u.can_print_results, createdAt:u.created_at } : { id });
            }
            if (req.method === 'DELETE') {
                if (token.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
                await db.query('DELETE FROM users WHERE id = $1', [id]);
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── CLASSES ───────────────────────────────────────────────────────────
        if (seg0 === 'classes') {
            if (!seg1) {
                if (req.method === 'GET') {
                    const { rows } = await db.query('SELECT * FROM classes ORDER BY name');
                    return res.json(rows);
                }
                const token = verifyToken(req);
                if (!token) return res.status(401).json({ error: 'Unauthorized' });
                if (req.method === 'POST') {
                    if (token.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
                    const { name } = req.body;
                    if (!name) return res.status(400).json({ error: 'Name required' });
                    const { rows } = await db.query(
                        'INSERT INTO classes (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
                        [name]
                    );
                    return res.status(201).json(rows[0]);
                }
                return res.status(405).json({ error: 'Method not allowed' });
            }
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            const id = seg1;
            if (token.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
            if (req.method === 'PUT') {
                const { name } = req.body;
                const { rows } = await db.query('UPDATE classes SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
                return res.json(rows[0]);
            }
            if (req.method === 'DELETE') {
                await db.query('DELETE FROM classes WHERE id = $1', [id]);
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── COURSES ───────────────────────────────────────────────────────────
        if (seg0 === 'courses') {
            if (!seg1) {
                if (req.method === 'GET') {
                    const { rows } = await db.query(`
                        SELECT c.*, cl.name as class_name FROM courses c
                        LEFT JOIN classes cl ON c.class_id = cl.id ORDER BY c.subject
                    `);
                    return res.json(rows.map(c => ({
                        id: c.id, subject: c.subject, class: c.class_name,
                        lecturerId: c.lecturer_id, createdAt: c.created_at
                    })));
                }
                if (req.method === 'POST') {
                    const token = verifyToken(req);
                    if (!token) return res.status(401).json({ error: 'Unauthorized' });
                    if (token.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
                    const { subject, className } = req.body;
                    if (!subject) return res.status(400).json({ error: 'Subject required' });
                    let classId = null;
                    if (className) {
                        const { rows: cl } = await db.query('SELECT id FROM classes WHERE name = $1', [className]);
                        classId = cl[0]?.id || null;
                    }
                    const { rows } = await db.query(
                        'INSERT INTO courses (subject, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
                        [subject, classId]
                    );
                    return res.status(201).json({ ...rows[0], class: className });
                }
                return res.status(405).json({ error: 'Method not allowed' });
            }
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            if (token.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
            const id = seg1;
            if (req.method === 'PUT') {
                const { subject, className } = req.body;
                let classId = null;
                if (className) {
                    const { rows: cl } = await db.query('SELECT id FROM classes WHERE name = $1', [className]);
                    classId = cl[0]?.id || null;
                }
                const { rows } = await db.query(
                    'UPDATE courses SET subject = $1, class_id = $2 WHERE id = $3 RETURNING *',
                    [subject, classId, id]
                );
                return res.json({ ...rows[0], class: className });
            }
            if (req.method === 'DELETE') {
                await db.query('DELETE FROM courses WHERE id = $1', [id]);
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── EXAMS ─────────────────────────────────────────────────────────────
        if (seg0 === 'exams') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });

            const txExam = (e, classes, questions) => ({
                id: e.id, title: e.title, type: e.type, subject: e.subject,
                classes, startTime: e.start_time, duration: e.duration,
                isActivated: e.is_activated, isManuallyActive: e.is_manually_active,
                isWritten: e.is_written, isGeneral: e.is_general,
                createdBy: e.created_by, createdAt: e.created_at,
                questions, randomizedQuestions: questions
            });

            if (!seg1) {
                if (req.method === 'GET') {
                    const minimal = req.query.minimal === 'true';
                    const { rows: allExams } = await db.query('SELECT * FROM exams ORDER BY created_at DESC');
                    const { rows: ec } = await db.query(`
                        SELECT ec.exam_id, c.name FROM exam_classes ec JOIN classes c ON ec.class_id = c.id
                    `);
                    const classMap = {};
                    ec.forEach(r => { if (!classMap[r.exam_id]) classMap[r.exam_id] = []; classMap[r.exam_id].push(r.name); });
                    let exams = allExams;
                    if (token.type === 'lecturer') exams = exams.filter(exam => exam.created_by === token.id);
                    if (token.type === 'student') {
                        const { rows: students } = await db.query('SELECT c.name FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.id = $1', [token.id]);
                        const studentClass = students[0]?.name;
                        exams = exams.filter(exam => exam.is_general || (studentClass && (classMap[exam.id] || []).includes(studentClass)));
                    }
                    if (minimal) return res.json(exams.map(e => ({
                        id: e.id, title: e.title, type: e.type, subject: e.subject,
                        classes: classMap[e.id] || [], startTime: e.start_time,
                        duration: e.duration, isActivated: e.is_activated, isManuallyActive: e.is_manually_active
                    })));
                    const openExamIds = token.type === 'student' ? exams.filter(exam => isExamOpen(exam)).map(exam => exam.id) : null;
                    const { rows: questions } = await db.query(
                        token.type === 'student'
                            ? 'SELECT * FROM exam_questions WHERE exam_id = ANY($1::uuid[]) ORDER BY question_order'
                            : 'SELECT * FROM exam_questions ORDER BY question_order',
                        token.type === 'student' ? [openExamIds] : []
                    );
                    const qMap = {};
                    questions.forEach(q => {
                        if (!qMap[q.exam_id]) qMap[q.exam_id] = [];
                        qMap[q.exam_id].push({
                            id: q.id, type: q.question_type, question: q.question_text,
                            options: q.options || [],
                            ...(token.type === 'student' ? {} : { correctAnswer: q.correct_answer }),
                            points: q.points, wordLimit: q.word_limit
                        });
                    });
                    return res.json(exams.map(e => txExam(e, classMap[e.id] || [], qMap[e.id] || [])));
                }

                if (req.method === 'POST') {
                    if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
                    const exam = req.body;
                    const client = await db.connect();
                    try {
                        await client.query('BEGIN');
                        let existingExam = null;
                        if (exam.id) {
                            const { rows } = await client.query('SELECT id, created_by FROM exams WHERE id = $1 FOR UPDATE', [exam.id]);
                            existingExam = rows[0];
                            if (!existingExam) {
                                await client.query('ROLLBACK');
                                return res.status(404).json({ error: 'Exam not found' });
                            }
                            if (token.type === 'lecturer' && existingExam.created_by !== token.id) {
                                await client.query('ROLLBACK');
                                return res.status(403).json({ error: 'Forbidden' });
                            }
                        }
                        const classIds = [];
                        const classNames = Array.isArray(exam.classes) ? exam.classes : [];
                        if (classNames.some(name => typeof name !== 'string')) {
                            await client.query('ROLLBACK');
                            return res.status(400).json({ error: 'Invalid exam classes' });
                        }
                        if (token.type === 'lecturer' && exam.isGeneral === true) {
                            await client.query('ROLLBACK');
                            return res.status(403).json({ error: 'Lecturers cannot create school-wide examinations' });
                        }
                        if (token.type === 'lecturer' && classNames.length) {
                            const { rows: lecturer } = await client.query('SELECT classes FROM users WHERE id = $1', [token.id]);
                            const assigned = new Set(lecturer[0]?.classes || []);
                            if (classNames.some(name => !assigned.has(name))) {
                                await client.query('ROLLBACK');
                                return res.status(403).json({ error: 'Exam includes classes outside your assignment' });
                            }
                        }
                        for (const name of classNames) {
                            const { rows } = await client.query('SELECT id FROM classes WHERE name = $1', [name]);
                            if (rows[0]) classIds.push(rows[0].id);
                        }
                        const createdBy = existingExam ? existingExam.created_by : token.id;
                        const examData = [
                            exam.title, exam.type, exam.subject,
                            exam.startTime || new Date().toISOString(), exam.duration || 60,
                            exam.isActivated !== false, exam.isManuallyActive !== false,
                            exam.isWritten || false, exam.isGeneral || false, createdBy
                        ];
                        let savedExam;
                        if (exam.id && /^[0-9a-f-]{36}$/.test(exam.id)) {
                            const { rows } = await client.query(
                                `UPDATE exams SET title=$1,type=$2,subject=$3,start_time=$4,duration=$5,
                                 is_activated=$6,is_manually_active=$7,is_written=$8,is_general=$9,created_by=$10
                                 WHERE id=$11 RETURNING *`, [...examData, exam.id]
                            );
                            savedExam = rows[0];
                        } else {
                            const { rows } = await client.query(
                                `INSERT INTO exams (title,type,subject,start_time,duration,is_activated,is_manually_active,is_written,is_general,created_by)
                                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, examData
                            );
                            savedExam = rows[0];
                        }
                        await client.query('DELETE FROM exam_classes WHERE exam_id = $1', [savedExam.id]);
                        for (const cid of classIds) {
                            await client.query('INSERT INTO exam_classes (exam_id, class_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [savedExam.id, cid]);
                        }
                        if (exam.questions?.length) {
                            await client.query('DELETE FROM exam_questions WHERE exam_id = $1', [savedExam.id]);
                            for (let i = 0; i < exam.questions.length; i++) {
                                const q = exam.questions[i];
                                await client.query(
                                    `INSERT INTO exam_questions (exam_id,question_type,question_text,options,correct_answer,points,word_limit,question_order)
                                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                                    [savedExam.id, q.type, q.question, JSON.stringify(q.options || []), q.correctAnswer, q.points || 1, q.wordLimit, i]
                                );
                            }
                        }
                        await client.query('COMMIT');
                        return res.status(201).json(txExam(savedExam, exam.classes || [], exam.questions || []));
                    } catch (err) {
                        await client.query('ROLLBACK');
                        throw err;
                    } finally {
                        client.release();
                    }
                }
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const id = seg1;
            if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
            const { rows: examOwner } = await db.query('SELECT created_by FROM exams WHERE id = $1', [id]);
            if (!examOwner[0]) return res.status(404).json({ error: 'Exam not found' });
            if (token.type === 'lecturer') {
                const { rows: owner } = await db.query('SELECT id FROM users WHERE username = $1', [token.username]);
                if (examOwner[0].created_by !== owner[0]?.id) return res.status(403).json({ error: 'Forbidden' });
            }
            if (req.method === 'PUT') {
                const updates = req.body;
                const fields = [], values = [];
                let i = 1;
                const map = { title: 'title', type: 'type', subject: 'subject', startTime: 'start_time', duration: 'duration', isActivated: 'is_activated', isManuallyActive: 'is_manually_active', isWritten: 'is_written', isGeneral: 'is_general' };
                for (const [k, col] of Object.entries(map)) {
                    if (updates[k] !== undefined) { fields.push(`${col} = $${i++}`); values.push(updates[k]); }
                }
                if (!fields.length) return res.json({ id });
                values.push(id);
                const { rows } = await db.query(`UPDATE exams SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
                return res.json(rows[0]);
            }
            if (req.method === 'DELETE') {
                await db.query('DELETE FROM exams WHERE id = $1', [id]);
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── RESULTS ───────────────────────────────────────────────────────────
        if (seg0 === 'results') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            const txR = r => ({
                id: r.id, examId: r.exam_id, examTitle: r.exam_title,
                studentId: r.student_id, studentName: r.student_name,
                subject: r.subject, type: r.type, score: parseFloat(r.score),
                correctAnswers: r.correct_answers, totalQuestions: r.total_questions,
                submittedAt: r.submitted_at, isWritten: r.is_written,
                isReleased: r.is_released, isComposite: r.is_composite,
                compositeBreakdown: r.composite_breakdown, securityReport: r.security_report,
                answers: r.answers || [], questionDetails: r.question_details || []
            });

            if (!seg1) {
                if (req.method === 'GET') {
                    if (token.type === 'student') {
                        const { rows } = await db.query('SELECT * FROM results WHERE student_id = $1 AND is_released = true ORDER BY submitted_at DESC', [token.id]);
                        return res.json(rows.map(txR));
                    }
                    if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
                    const { rows } = await db.query(token.type === 'admin'
                        ? 'SELECT * FROM results ORDER BY submitted_at DESC'
                        : 'SELECT r.* FROM results r JOIN exams e ON e.id = r.exam_id WHERE e.created_by = $1 ORDER BY r.submitted_at DESC',
                    token.type === 'admin' ? [] : [token.id]);
                    return res.json(rows.map(txR));
                }
                if (req.method === 'POST') {
                    if (token.type !== 'student') return res.status(403).json({ error: 'Only students may submit exam results' });
                    const r = req.body;
                    if (!r.examId) return res.status(400).json({ error: 'Exam required' });
                    const client = await db.connect();
                    try {
                        await client.query('BEGIN');
                        const exam = await getEligibleExam(client, token.id, r.examId);
                        if (!exam) {
                            await client.query('ROLLBACK');
                            return res.status(403).json({ error: 'Not eligible to submit this examination' });
                        }
                        const { rows: existing } = await client.query(
                            'SELECT id FROM results WHERE exam_id = $1 AND student_id = $2 AND is_composite = false LIMIT 1 FOR UPDATE',
                            [r.examId, token.id]
                        );
                        if (existing.length) {
                            await client.query('ROLLBACK');
                            return res.status(409).json({ error: 'Exam already submitted' });
                        }
                        const { rows: questions } = await client.query(
                            'SELECT question_type, question_text, options, correct_answer, points FROM exam_questions WHERE exam_id = $1 ORDER BY question_order',
                            [r.examId]
                        );
                        const grade = gradeObjectiveQuestions(questions, r.answers);
                        const { rows: studentRows } = await client.query('SELECT full_name FROM users WHERE id = $1', [token.id]);
                        const { rows } = await client.query(
                            `INSERT INTO results (exam_id,exam_title,student_id,student_name,subject,type,score,
                             correct_answers,total_questions,submitted_at,is_written,is_released,is_composite,
                             answers,question_details)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,false,false,$11,$12) RETURNING *`,
                            [exam.id, exam.title, token.id, studentRows[0]?.full_name || '',
                                exam.subject, exam.type, grade.score, grade.correctAnswers,
                                grade.totalQuestions, exam.is_written, JSON.stringify(r.answers || []),
                                JSON.stringify(grade.questionDetails)]
                        );
                        await client.query('COMMIT');
                        return res.status(201).json(txR(rows[0]));
                    } catch (error) {
                        await client.query('ROLLBACK');
                        throw error;
                    } finally {
                        client.release();
                    }
                }
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const id = seg1;
            if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
            const { rows: existingResults } = await db.query('SELECT exam_id FROM results WHERE id = $1', [id]);
            if (!existingResults[0]) return res.status(404).json({ error: 'Result not found' });
            if (!await canManageExam(db, token, existingResults[0].exam_id)) return res.status(403).json({ error: 'Forbidden' });
            if (req.method === 'PUT') {
                const { isReleased, score, isWritten } = req.body;
                const fields = [], values = [];
                let i = 1;
                if (isReleased !== undefined) { fields.push(`is_released = $${i++}`); values.push(isReleased); }
                if (score !== undefined) { fields.push(`score = $${i++}`); values.push(score); }
                if (isWritten !== undefined) { fields.push(`is_written = $${i++}`); values.push(isWritten); }
                if (!fields.length) return res.json({ id });
                values.push(id);
                const { rows } = await db.query(`UPDATE results SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
                return res.json(rows[0]);
            }
            if (req.method === 'DELETE') {
                await db.query('DELETE FROM results WHERE id = $1', [id]);
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── RESULT-RELEASES ────────────────────────────────────────────────────
        if (seg0 === 'result-releases') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            if (!['admin', 'lecturer'].includes(token.type) && req.method !== 'GET') return res.status(403).json({ error: 'Forbidden' });
            if (req.method === 'GET') {
                const { rows } = await db.query(token.type === 'admin'
                    ? 'SELECT * FROM result_releases'
                    : 'SELECT rr.* FROM result_releases rr JOIN exams e ON e.id = rr.exam_id WHERE e.created_by = $1',
                token.type === 'admin' ? [] : [token.id]);
                const releases = {};
                rows.forEach(r => { releases[r.exam_id] = r.is_released; });
                return res.json(releases);
            }
            if (req.method === 'POST') {
                const { examId, isReleased } = req.body;
                if (!examId || typeof isReleased !== 'boolean') return res.status(400).json({ error: 'Exam and release status are required' });
                if (!await canManageExam(db, token, examId)) return res.status(403).json({ error: 'Forbidden' });
                const { rows } = await db.query(
                    `INSERT INTO result_releases (exam_id, is_released, released_at) VALUES ($1,$2,$3)
                     ON CONFLICT (exam_id) DO UPDATE SET is_released = EXCLUDED.is_released, released_at = EXCLUDED.released_at
                     RETURNING *`,
                    [examId, isReleased, isReleased ? new Date().toISOString() : null]
                );
                await db.query('UPDATE results SET is_released = $1 WHERE exam_id = $2', [isReleased, examId]);

                // Fire-and-forget email notifications when results are being released.
                // Silently skipped if RESEND_API_KEY isn't set.
                if (isReleased && process.env.RESEND_API_KEY) {
                    sendResultReleaseEmails(db, examId).catch(err =>
                        console.error('Result-release email send failed:', err.message));
                }

                return res.json(rows[0]);
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── MATERIALS ─────────────────────────────────────────────────────────
        if (seg0 === 'materials') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            const txM = m => ({
                id: m.id, title: m.title, description: m.description,
                content: m.content, fileUrl: m.file_url, fileName: m.file_name,
                uploadedFile: m.uploaded_file, subject: m.subject,
                class: m.class_name, lecturerId: m.uploaded_by,
                uploadedBy: m.uploaded_by, uploadedAt: m.uploaded_at
            });

            if (seg1 === 'upload-signature') {
                if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
                if (!process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
                    return res.status(503).json({ error: 'Upload integration is not configured' });
                }
                const timestamp = Math.round(Date.now() / 1000);
                const folder = 'signals-lms';
                const sortedStr = `folder=${folder}&timestamp=${timestamp}`;
                const signature = crypto.createHash('sha256')
                    .update(sortedStr + process.env.CLOUDINARY_API_SECRET).digest('hex');
                return res.json({ timestamp, signature, folder, apiKey: process.env.CLOUDINARY_API_KEY, cloudName: process.env.CLOUDINARY_CLOUD_NAME });
            }

            if (!seg1) {
                if (req.method === 'GET') {
                    const { rows } = await db.query(`
                        SELECT m.*, c.name as class_name FROM materials m
                        LEFT JOIN classes c ON m.class_id = c.id ORDER BY m.uploaded_at DESC
                    `);
                    return res.json(rows.map(txM));
                }
                if (req.method === 'POST') {
                    if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
                    const { title, description, content, fileUrl, fileName, uploadedFile, subject, className, uploadedBy } = req.body;
                    if (!title) return res.status(400).json({ error: 'Title required' });
                    let classId = null;
                    if (className) {
                        const { rows: cl } = await db.query('SELECT id FROM classes WHERE name = $1', [className]);
                        classId = cl[0]?.id || null;
                    }
                    const uploaderId = token.id;
                    const { rows } = await db.query(
                        `INSERT INTO materials (title,description,content,file_url,file_name,uploaded_file,subject,class_id,uploaded_by)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
                        [title, description, content, fileUrl, fileName, uploadedFile, subject, classId, uploaderId]
                    );
                    return res.status(201).json({ ...rows[0], class: className });
                }
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const id = seg1;
            if (req.method === 'DELETE') {
                if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
                const { rows } = await db.query(
                    token.type === 'admin'
                        ? 'DELETE FROM materials WHERE id = $1 RETURNING id'
                        : 'DELETE FROM materials WHERE id = $1 AND uploaded_by = $2 RETURNING id',
                    token.type === 'admin' ? [id] : [id, token.id]
                );
                if (!rows.length) return res.status(404).json({ error: 'Material not found or not authorized' });
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── ANNOUNCEMENTS ─────────────────────────────────────────────────────
        if (seg0 === 'announcements') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });

            if (!seg1) {
                if (req.method === 'GET') {
                    const { rows: anns } = await db.query(`
                        SELECT a.*, u.full_name as author_name FROM announcements a
                        LEFT JOIN users u ON a.created_by = u.id ORDER BY a.created_at DESC
                    `);
                    const { rows: ac } = await db.query(`
                        SELECT ac.announcement_id, c.name FROM announcement_classes ac
                        JOIN classes c ON ac.class_id = c.id
                    `);
                    const classMap = {};
                    ac.forEach(r => { if (!classMap[r.announcement_id]) classMap[r.announcement_id] = []; classMap[r.announcement_id].push(r.name); });
                    return res.json(anns.map(a => ({
                        id: a.id, title: a.title, message: a.message, content: a.message,
                        type: a.type || 'general', target: a.type || 'general',
                        createdBy: a.created_by, authorName: a.author_name || 'Admin',
                        createdAt: a.created_at,
                        targetClasses: classMap[a.id] || [], classes: classMap[a.id] || []
                    })));
                }
                if (req.method === 'POST') {
                    if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
                    const { title, message, type, targetClasses } = req.body;
                    const client = await db.connect();
                    try {
                        await client.query('BEGIN');
                        const { rows } = await client.query(
                            'INSERT INTO announcements (title, message, type, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
                            [title, message, type || 'general', token.id]
                        );
                        const ann = rows[0];
                        if (targetClasses?.length) {
                            const missing = [];
                            for (const name of targetClasses) {
                                const trimmed = String(name || '').trim();
                                if (!trimmed) continue;
                                const { rows: cl } = await client.query('SELECT id FROM classes WHERE name = $1', [trimmed]);
                                if (cl[0]) {
                                    await client.query(
                                        'INSERT INTO announcement_classes (announcement_id, class_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                                        [ann.id, cl[0].id]
                                    );
                                } else {
                                    missing.push(trimmed);
                                }
                            }
                            if (missing.length) console.warn('Announcement targeted unknown classes (ignored):', missing);
                        }
                        await client.query('COMMIT');
                        return res.status(201).json({ ...ann, classes: targetClasses || [] });
                    } catch (err) {
                        await client.query('ROLLBACK');
                        throw err;
                    } finally {
                        client.release();
                    }
                }
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const id = seg1;
            if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
            if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
            const { rows: deleted } = await db.query(
                token.type === 'admin'
                    ? 'DELETE FROM announcements WHERE id = $1 RETURNING id'
                    : 'DELETE FROM announcements WHERE id = $1 AND created_by = $2 RETURNING id',
                token.type === 'lecturer' ? [id, token.id] : [id]
            );
            if (!deleted.length) return res.status(404).json({ error: 'Announcement not found or not authorized' });
            if (req.method === 'DELETE') {
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── NOTIFICATIONS ─────────────────────────────────────────────────────
        if (seg0 === 'notifications') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            const txN = n => ({
                id: n.id, userId: n.user_id, userType: n.user_type,
                type: n.type, title: n.title, message: n.message,
                link: n.link, data: n.data, read: n.read, createdAt: n.created_at
            });

            if (!seg1) {
                if (req.method === 'GET') {
                    const requestedUserId = req.query.userId;
                    if (token.type !== 'admin' && requestedUserId && requestedUserId !== token.id) return res.status(403).json({ error: 'Forbidden' });
                    const userId = token.type === 'admin' ? requestedUserId : token.id;
                    if (!userId) return res.status(400).json({ error: 'User required' });
                    const { rows } = await db.query(
                        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
                        [userId]
                    );
                    return res.json(rows.map(txN));
                }
                if (req.method === 'POST') {
                    if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
                    const { userId, type, title, message, link, data } = req.body;
                    if (!userId || !title || !message) return res.status(400).json({ error: 'Recipient, title, and message are required' });
                    const { rows: recipient } = await db.query('SELECT id, type, class_id FROM users WHERE id = $1', [userId]);
                    if (!recipient[0]) return res.status(404).json({ error: 'Recipient not found' });
                    if (token.type === 'lecturer') {
                        const { rows: assignment } = await db.query(`
                            SELECT 1 FROM users lecturer
                            JOIN classes c ON c.name = ANY(lecturer.classes)
                            WHERE lecturer.id = $1 AND c.id = $2 AND $3 = 'student'
                        `, [token.id, recipient[0].class_id, recipient[0].type]);
                        if (!assignment.length) return res.status(403).json({ error: 'Recipient is outside your assigned classes' });
                    }
                    const { rows } = await db.query(
                        `INSERT INTO notifications (user_id,user_type,type,title,message,link,data)
                         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                        [userId, recipient[0].type, type, title, message, link, data ? JSON.stringify(data) : null]
                    );
                    return res.status(201).json(txN(rows[0]));
                }
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const id = seg1;
            if (req.method === 'PUT') {
                const { rows } = await db.query(
                    token.type === 'admin'
                        ? 'UPDATE notifications SET read = true WHERE id = $1 RETURNING id'
                        : 'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING id',
                    token.type === 'admin' ? [id] : [id, token.id]
                );
                if (!rows.length) return res.status(404).json({ error: 'Notification not found or not authorized' });
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── SETTINGS ──────────────────────────────────────────────────────────
        if (seg0 === 'settings') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            if (token.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
            if (req.method === 'GET') {
                const { key } = req.query;
                if (key) {
                    const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
                    return res.json({ value: rows[0]?.value || null });
                }
                const { rows } = await db.query('SELECT * FROM settings');
                return res.json(rows);
            }
            if (req.method === 'POST') {
                const { key, value } = req.body;
                const { rows } = await db.query(
                    `INSERT INTO settings (key, value, updated_at) VALUES ($1,$2,NOW())
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW() RETURNING *`,
                    [key, String(value)]
                );
                return res.json(rows[0]);
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── WRITTEN-MARKS ─────────────────────────────────────────────────────
        if (seg0 === 'written-marks') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
            if (req.method === 'GET') {
                const { rows } = await db.query(token.type === 'admin'
                    ? 'SELECT * FROM written_marks'
                    : `SELECT * FROM written_marks WHERE class_name = ANY((SELECT classes FROM users WHERE id = $1))
                       AND subject = ANY((SELECT subjects FROM users WHERE id = $1))`,
                token.type === 'admin' ? [] : [token.id]);
                const marks = {};
                rows.forEach(m => {
                    const key = m.subject ? `${m.subject}_${m.class_name}` : `general_${m.class_name}`;
                    if (!marks[key]) marks[key] = {};
                    if (!marks[key][m.exam_type]) marks[key][m.exam_type] = {};
                    marks[key][m.exam_type][m.student_id] = parseFloat(m.mark);
                });
                return res.json(marks);
            }
            if (req.method === 'POST') {
                const { subject, className, examType, studentId, mark } = req.body;
                if (token.type === 'lecturer') {
                    const { rows: assignment } = await db.query(
                        'SELECT 1 FROM users WHERE id = $1 AND $2 = ANY(classes) AND $3 = ANY(subjects)',
                        [token.id, className, subject]
                    );
                    if (!assignment.length) return res.status(403).json({ error: 'Mark is outside your assigned classes or subjects' });
                }
                const { rows } = await db.query(
                    `INSERT INTO written_marks (subject, class_name, exam_type, student_id, mark)
                     VALUES ($1,$2,$3,$4,$5)
                     ON CONFLICT (subject, class_name, exam_type, student_id) DO UPDATE SET mark = EXCLUDED.mark RETURNING *`,
                    [subject, className, examType, studentId, mark]
                );
                return res.json(rows[0]);
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── REGISTRATION-KEYS ─────────────────────────────────────────────────
        if (seg0 === 'registration-keys') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            if (token.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
            if (req.method === 'GET') {
                const { rows } = await db.query('SELECT * FROM registration_keys ORDER BY created_at DESC');
                return res.json(rows.map(k => ({ key: k.key, createdAt: k.created_at, expiresAt: k.expires_at, usedAt: k.used_at })));
            }
            if (req.method === 'POST') {
                const { key, classes, subjects } = req.body;
                if (typeof key !== 'string' || key.length < 16 || key.length > 100) return res.status(400).json({ error: 'Registration key must be 16-100 characters' });
                if (!Array.isArray(classes) || !Array.isArray(subjects) ||
                    classes.some(value => typeof value !== 'string') ||
                    subjects.some(value => typeof value !== 'string')) {
                    return res.status(400).json({ error: 'Registration key requires assigned class and subject lists' });
                }
                const { rows } = await db.query(
                    'INSERT INTO registration_keys (key, classes, subjects, expires_at) VALUES ($1,$2,$3,NOW() + INTERVAL \'7 days\') ON CONFLICT (key) DO UPDATE SET classes = EXCLUDED.classes, subjects = EXCLUDED.subjects, expires_at = NOW() + INTERVAL \'7 days\', used_at = NULL RETURNING id, key, classes, subjects, created_at, expires_at',
                    [key, classes, subjects]
                );
                return res.status(201).json(rows[0]);
            }
            if (req.method === 'DELETE') {
                const { key } = req.body;
                await db.query('DELETE FROM registration_keys WHERE key = $1', [key]);
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── AUDIT-LOGS ────────────────────────────────────────────────────────
        if (seg0 === 'audit-logs') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            if (token.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
            if (req.method === 'GET') {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 50;
                const offset = (page - 1) * limit;
                const { rows } = await db.query(`
                    SELECT al.*, u.full_name as performer_name FROM audit_logs al
                    LEFT JOIN users u ON al.performed_by = u.id
                    ORDER BY al.created_at DESC LIMIT $1 OFFSET $2
                `, [limit, offset]);
                const { rows: cnt } = await db.query('SELECT COUNT(*) FROM audit_logs');
                return res.json({
                    data: rows.map(l => ({
                        id: l.id, actionType: l.action_type, description: l.description,
                        performedBy: l.performer_name || l.performed_by || 'System',
                        metadata: l.metadata, createdAt: l.created_at
                    })),
                    count: parseInt(cnt[0].count)
                });
            }
            if (req.method === 'POST') {
                const { actionType, description, performedBy, metadata } = req.body;
                const token2 = verifyToken(req);
                let userId = performedBy;
                if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) {
                    const { rows } = await db.query('SELECT id FROM users WHERE username = $1', [token2?.username]);
                    userId = rows[0]?.id || null;
                }
                await db.query(
                    'INSERT INTO audit_logs (action_type, description, performed_by, metadata) VALUES ($1,$2,$3,$4)',
                    [actionType, description, userId, metadata ? JSON.stringify(metadata) : '{}']
                );
                return res.status(201).json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── SUBMISSIONS ───────────────────────────────────────────────────────
        if (seg0 === 'submissions') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            if (req.method === 'GET') {
                const { assignmentId } = req.query;
                if (token.type === 'student') {
                    const { rows } = await db.query(
                        assignmentId
                            ? 'SELECT * FROM submissions WHERE assignment_id = $1 AND student_id = $2 ORDER BY submitted_at DESC'
                            : 'SELECT * FROM submissions WHERE student_id = $1 ORDER BY submitted_at DESC',
                        assignmentId ? [assignmentId, token.id] : [token.id]
                    );
                    return res.json(rows);
                }
                if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
                if (token.type === 'lecturer') {
                    const { rows } = await db.query(`
                        SELECT s.* FROM submissions s
                        JOIN users student ON student.id = s.student_id
                        JOIN classes c ON c.id = student.class_id
                        WHERE c.name = ANY((SELECT classes FROM users WHERE id = $2))
                        ${assignmentId ? 'AND s.assignment_id = $1' : ''}
                        ORDER BY s.submitted_at DESC
                    `, assignmentId ? [assignmentId, token.id] : [token.id]);
                    return res.json(rows);
                }
                const { rows } = await db.query(
                    assignmentId
                        ? 'SELECT * FROM submissions WHERE assignment_id = $1 ORDER BY submitted_at DESC'
                        : 'SELECT * FROM submissions ORDER BY submitted_at DESC',
                    assignmentId ? [assignmentId] : []
                );
                return res.json(rows);
            }
            if (req.method === 'POST') {
                if (token.type !== 'student') return res.status(403).json({ error: 'Forbidden' });
                const { assignmentId, content, fileUrl } = req.body;
                if (!assignmentId) return res.status(400).json({ error: 'Assignment required' });
                const { rows } = await db.query(
                    'INSERT INTO submissions (assignment_id, student_id, content, file_url) VALUES ($1,$2,$3,$4) RETURNING *',
                    [assignmentId, token.id, content, fileUrl]
                );
                return res.status(201).json(rows[0]);
            }
            if (req.method === 'PUT') {
                if (!['admin', 'lecturer'].includes(token.type)) return res.status(403).json({ error: 'Forbidden' });
                const { id, grade, feedback } = req.body;
                const { rows } = await db.query(token.type === 'admin'
                    ? 'UPDATE submissions SET grade = $1, feedback = $2 WHERE id = $3 RETURNING *'
                    : `UPDATE submissions SET grade = $1, feedback = $2 WHERE id = $3 AND EXISTS (
                        SELECT 1 FROM users student JOIN classes c ON c.id = student.class_id
                        WHERE student.id = submissions.student_id
                        AND c.name = ANY((SELECT classes FROM users WHERE id = $4))
                    ) RETURNING *`,
                token.type === 'admin' ? [grade, feedback, id] : [grade, feedback, id, token.id]);
                if (!rows.length) return res.status(404).json({ error: 'Submission not found or not authorized' });
                return res.json(rows[0]);
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        return res.status(404).json({ error: 'Not found' });

    } catch (err) {
        console.error('[API Error]', err);
        return res.status(500).json({ error: 'Server error' });
    }
}
