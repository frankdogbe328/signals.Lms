// Local development server — runs API + frontend together
// Usage: node dev-server.js

import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

// Load env from .env.local
try {
    const env = readFileSync('.env.local', 'utf8');
    env.split('\n').forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
} catch {}

const isLocal = (process.env.DATABASE_URL || '').includes('localhost');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } })
});
const JWT_SECRET = process.env.JWT_SECRET || 'lms_dev_secret';

// ---- uploads folder ----
const UPLOADS_DIR = join(__dirname, 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

// ---- helpers ----
function json(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' });
    res.end(JSON.stringify(data));
}

function verifyToken(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    try { return jwt.verify(auth.slice(7), JWT_SECRET); } catch { return null; }
}

async function body(req) {
    return new Promise(resolve => {
        let data = '';
        req.on('data', c => data += c);
        req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    });
}

function transformUser(u) {
    return { id: u.id, username: u.username, password: u.password_hash, fullName: u.full_name, email: u.email, telephone: u.telephone, type: u.type, rank: u.rank, class: u.class_name, classId: u.class_id, subjects: u.subjects || [], classes: u.classes || [], canPrintResults: u.can_print_results, createdAt: u.created_at };
}

// ---- static file server ----
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg']);

function serveStatic(res, filePath, acceptEncoding = '') {
    if (!existsSync(filePath)) return false;
    const ext = extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'text/plain';
    const content = readFileSync(filePath);

    const headers = {
        'Content-Type': mime,
        'Access-Control-Allow-Origin': '*',
        'Vary': 'Accept-Encoding',
    };

    // Cache-Control: HTML = no-cache, versioned assets = 1 year, others = 1 day
    if (ext === '.html') {
        headers['Cache-Control'] = 'no-cache';
    } else if (ext === '.jpeg' || ext === '.jpg' || ext === '.png' || ext === '.ico' || ext === '.mp4') {
        headers['Cache-Control'] = 'public, max-age=604800'; // 1 week
    } else {
        headers['Cache-Control'] = 'public, max-age=31536000'; // 1 year (JS/CSS have ?v= params)
    }

    // Gzip for text files if client supports it
    if (COMPRESSIBLE.has(ext) && acceptEncoding.includes('gzip')) {
        const compressed = gzipSync(content);
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = compressed.length;
        res.writeHead(200, headers);
        res.end(compressed);
    } else {
        headers['Content-Length'] = content.length;
        res.writeHead(200, headers);
        res.end(content);
    }
    return true;
}

// ---- API router ----
async function handleApi(req, res, pathname) {
    const method = req.method;
    const token = verifyToken(req);
    const b = ['POST', 'PUT', 'DELETE'].includes(method) ? await body(req) : {};
    const q = Object.fromEntries(new URL(req.url, 'http://x').searchParams);

    if (method === 'OPTIONS') { json(res, {}); return; }

    // Auth - no token required
    if (pathname === '/api/auth/login' && method === 'POST') {
        const { username, password, type } = b;
        if (!username || !password) { json(res, { error: 'Missing fields' }, 400); return; }
        const qText = type
            ? 'SELECT u.*, c.name as class_name FROM users u LEFT JOIN classes c ON u.class_id = c.id WHERE (u.username = $1 OR u.email = $1) AND u.type = $2 LIMIT 1'
            : 'SELECT u.*, c.name as class_name FROM users u LEFT JOIN classes c ON u.class_id = c.id WHERE (u.username = $1 OR u.email = $1) LIMIT 1';
        const { rows } = await pool.query(qText, type ? [username, type] : [username]);
        const user = rows[0];
        if (!user) { json(res, { error: 'Invalid username or password' }, 401); return; }
        const isHashed = user.password_hash.startsWith('$2');
        const match = isHashed ? await bcrypt.compare(password, user.password_hash) : user.password_hash === password;
        if (!match) { json(res, { error: 'Invalid username or password' }, 401); return; }
        const tok = jwt.sign({ id: user.id, type: user.type, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        json(res, { token: tok, user: transformUser(user) }); return;
    }

    // Local file upload — saves to uploads/ folder on this machine
    if (pathname === '/api/upload' && method === 'POST') {
        if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            try {
                const buf = Buffer.concat(chunks);
                const ct = req.headers['content-type'] || '';
                const boundary = ct.split('boundary=')[1];
                if (!boundary) { json(res, { error: 'No boundary' }, 400); return; }
                const parts = buf.toString('binary').split('--' + boundary);
                let fileData, fileName;
                for (const part of parts) {
                    if (part.includes('filename=')) {
                        const nameMatch = part.match(/filename="([^"]+)"/);
                        if (nameMatch) fileName = nameMatch[1];
                        const bodyStart = part.indexOf('\r\n\r\n') + 4;
                        const bodyEnd = part.lastIndexOf('\r\n');
                        fileData = Buffer.from(part.slice(bodyStart, bodyEnd), 'binary');
                    }
                }
                if (!fileData || !fileName) { json(res, { error: 'No file' }, 400); return; }
                const safeName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
                writeFileSync(join(UPLOADS_DIR, safeName), fileData);
                json(res, { url: `/uploads/${safeName}`, name: fileName });
            } catch (e) { json(res, { error: e.message }, 500); }
        });
        return;
    }

    // Serve uploaded files
    if (pathname.startsWith('/uploads/')) {
        const filePath = join(__dirname, pathname);
        if (serveStatic(res, filePath, req.headers['accept-encoding'] || '')) return;
        json(res, { error: 'Not found' }, 404); return;
    }

    // Keepalive ping
    if (pathname === '/api/ping') {
        try { await pool.query('SELECT 1'); json(res, { ok: true, ts: Date.now() }); } catch { json(res, { ok: false }, 500); } return;
    }

    // Classes GET is public — needed for registration page dropdown
    if (pathname === '/api/classes' && method === 'GET') {
        const { rows } = await pool.query('SELECT * FROM classes ORDER BY name');
        json(res, rows); return;
    }

    // Courses GET is public — needed for lecturer registration subject dropdown
    if (pathname === '/api/courses' && method === 'GET') {
        const { rows } = await pool.query('SELECT c.*, cl.name as class_name FROM courses c LEFT JOIN classes cl ON c.class_id = cl.id ORDER BY c.subject');
        json(res, rows.map(c => ({ id: c.id, subject: c.subject, class: c.class_name, lecturerId: c.lecturer_id, createdAt: c.created_at }))); return;
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
        const { username, password, fullName, email, telephone, type, rank, className, classes, subjects, registrationKey } = b;
        if (!username || !password || !type) { json(res, { error: 'Missing fields' }, 400); return; }
        const { rows: ex } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (ex.length) { json(res, { error: 'Username already exists' }, 409); return; }
        if (type === 'lecturer') {
            if (!registrationKey) { json(res, { error: 'Registration key required for lecturers' }, 400); return; }
            const { rows: keys } = await pool.query('SELECT id FROM registration_keys WHERE key = $1', [registrationKey]);
            if (!keys.length) { json(res, { error: 'Invalid registration key' }, 401); return; }
        }
        let classId = null;
        if (className) { const { rows: cl } = await pool.query('SELECT id FROM classes WHERE name = $1', [className]); classId = cl[0]?.id || null; }
        const hash = await bcrypt.hash(password, 10);
        const classesArr = (classes && classes.length > 0) ? classes : (className ? [className] : []);
        const { rows } = await pool.query(
            'INSERT INTO users (username,password_hash,full_name,email,telephone,type,rank,class_id,subjects,classes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,username,full_name,email,type',
            [username, hash, fullName, email, telephone, type, rank, classId, subjects || [], classesArr]
        );
        json(res, { user: rows[0] }, 201); return;
    }

    // All routes below require auth token
    if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }

    // Users
    if (pathname === '/api/users' && method === 'GET') {
        const { rows } = await pool.query('SELECT u.*, c.name as class_name FROM users u LEFT JOIN classes c ON u.class_id = c.id ORDER BY u.created_at DESC');
        json(res, { students: rows.filter(u => u.type === 'student').map(transformUser), lecturers: rows.filter(u => u.type === 'lecturer').map(transformUser), admin: transformUser(rows.find(u => u.type === 'admin') || {}) }); return;
    }

    const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch) {
        const id = userMatch[1];
        if (method === 'PUT') {
            const { username, fullName, email, telephone, rank, subjects, classes, password, className, canPrintResults } = b;
            let classId = undefined;
            if (className !== undefined) { const { rows } = await pool.query('SELECT id FROM classes WHERE name = $1', [className]); classId = rows[0]?.id || null; }
            const updates = [], values = []; let i = 1;
            const add = (col, val) => { updates.push(`${col} = $${i++}`); values.push(val); };
            if (username !== undefined) add('username', username);
            if (fullName !== undefined) add('full_name', fullName);
            if (email !== undefined) add('email', email);
            if (telephone !== undefined) add('telephone', telephone);
            if (rank !== undefined) add('rank', rank);
            if (subjects !== undefined) add('subjects', subjects);
            if (classes !== undefined) add('classes', classes);
            if (canPrintResults !== undefined) add('can_print_results', canPrintResults);
            if (classId !== undefined) add('class_id', classId);
            if (password) add('password_hash', await bcrypt.hash(password, 10));
            if (!updates.length) { json(res, { id }); return; }
            values.push(id);
            const { rows } = await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values);
            json(res, rows[0]); return;
        }
        if (method === 'DELETE') { await pool.query('DELETE FROM users WHERE id = $1', [id]); json(res, { success: true }); return; }
    }

    // Classes — GET is public (needed for registration dropdowns)
    if (pathname === '/api/classes') {
        if (method === 'GET') { const { rows } = await pool.query('SELECT * FROM classes ORDER BY name'); json(res, rows); return; }
        if (method === 'POST') { const { rows } = await pool.query('INSERT INTO classes (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *', [b.name]); json(res, rows[0], 201); return; }
    }
    const classMatch = pathname.match(/^\/api\/classes\/([^/]+)$/);
    if (classMatch) {
        const id = classMatch[1];
        if (method === 'PUT') { const { rows } = await pool.query('UPDATE classes SET name = $1 WHERE id = $2 RETURNING *', [b.name, id]); json(res, rows[0]); return; }
        if (method === 'DELETE') { await pool.query('DELETE FROM classes WHERE id = $1', [id]); json(res, { success: true }); return; }
    }

    // Courses
    if (pathname === '/api/courses') {
        if (method === 'GET') { const { rows } = await pool.query('SELECT c.*, cl.name as class_name FROM courses c LEFT JOIN classes cl ON c.class_id = cl.id ORDER BY c.subject'); json(res, rows.map(c => ({ id: c.id, subject: c.subject, class: c.class_name, lecturerId: c.lecturer_id, createdAt: c.created_at }))); return; }
        if (method === 'POST') {
            let classId = null;
            if (b.className) { const { rows: cl } = await pool.query('SELECT id FROM classes WHERE name = $1', [b.className]); classId = cl[0]?.id || null; }
            const { rows } = await pool.query('INSERT INTO courses (subject, class_id) VALUES ($1, $2) RETURNING *', [b.subject, classId]);
            json(res, { ...rows[0], class: b.className }, 201); return;
        }
    }
    const courseMatch = pathname.match(/^\/api\/courses\/([^/]+)$/);
    if (courseMatch) {
        const id = courseMatch[1];
        if (method === 'PUT') { let classId = null; if (b.className) { const { rows: cl } = await pool.query('SELECT id FROM classes WHERE name = $1', [b.className]); classId = cl[0]?.id || null; } const { rows } = await pool.query('UPDATE courses SET subject=$1,class_id=$2 WHERE id=$3 RETURNING *', [b.subject, classId, id]); json(res, { ...rows[0], class: b.className }); return; }
        if (method === 'DELETE') { await pool.query('DELETE FROM courses WHERE id = $1', [id]); json(res, { success: true }); return; }
    }

    // Exams
    if (pathname === '/api/exams') {
        if (method === 'GET') {
            const { rows: exams } = await pool.query('SELECT * FROM exams ORDER BY created_at DESC');
            const { rows: ec } = await pool.query('SELECT ec.exam_id, c.name FROM exam_classes ec JOIN classes c ON ec.class_id = c.id');
            const classMap = {}; ec.forEach(r => { if (!classMap[r.exam_id]) classMap[r.exam_id] = []; classMap[r.exam_id].push(r.name); });
            if (q.minimal === 'true') { json(res, exams.map(e => ({ id: e.id, title: e.title, type: e.type, subject: e.subject, classes: classMap[e.id] || [], startTime: e.start_time, duration: e.duration, isActivated: e.is_activated, isManuallyActive: e.is_manually_active }))); return; }
            const { rows: qs } = await pool.query('SELECT * FROM exam_questions ORDER BY question_order');
            const qMap = {}; qs.forEach(q => { if (!qMap[q.exam_id]) qMap[q.exam_id] = []; qMap[q.exam_id].push({ id: q.id, type: q.question_type, question: q.question_text, options: q.options || [], correctAnswer: q.correct_answer, points: q.points, wordLimit: q.word_limit }); });
            json(res, exams.map(e => ({ id: e.id, title: e.title, type: e.type, subject: e.subject, classes: classMap[e.id] || [], startTime: e.start_time, duration: e.duration, isActivated: e.is_activated, isManuallyActive: e.is_manually_active, isWritten: e.is_written, isGeneral: e.is_general, createdBy: e.created_by, createdAt: e.created_at, questions: qMap[e.id] || [], randomizedQuestions: qMap[e.id] || [] }))); return;
        }
        if (method === 'POST') {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const classIds = [];
                for (const name of (b.classes || [])) { const { rows } = await client.query('SELECT id FROM classes WHERE name = $1', [name]); if (rows[0]) classIds.push(rows[0].id); }
                let createdBy = b.createdBy || b.lecturerId;
                if (!createdBy || !/^[0-9a-f-]{36}$/.test(createdBy)) { const { rows } = await client.query('SELECT id FROM users WHERE username = $1', [token.username]); createdBy = rows[0]?.id || null; }
                let savedExam;
                const examData = [b.title, b.type, b.subject, b.startTime || new Date().toISOString(), b.duration || 60, b.isActivated !== false, b.isManuallyActive !== false, b.isWritten || false, b.isGeneral || false, createdBy];
                if (b.id && /^[0-9a-f-]{36}$/.test(b.id)) { const { rows } = await client.query('UPDATE exams SET title=$1,type=$2,subject=$3,start_time=$4,duration=$5,is_activated=$6,is_manually_active=$7,is_written=$8,is_general=$9,created_by=$10 WHERE id=$11 RETURNING *', [...examData, b.id]); savedExam = rows[0]; }
                else { const { rows } = await client.query('INSERT INTO exams (title,type,subject,start_time,duration,is_activated,is_manually_active,is_written,is_general,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', examData); savedExam = rows[0]; }
                await client.query('DELETE FROM exam_classes WHERE exam_id = $1', [savedExam.id]);
                for (const cid of classIds) await client.query('INSERT INTO exam_classes (exam_id,class_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [savedExam.id, cid]);
                if (b.questions?.length) { await client.query('DELETE FROM exam_questions WHERE exam_id = $1', [savedExam.id]); for (let i = 0; i < b.questions.length; i++) { const q2 = b.questions[i]; await client.query('INSERT INTO exam_questions (exam_id,question_type,question_text,options,correct_answer,points,word_limit,question_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [savedExam.id, q2.type, q2.question, JSON.stringify(q2.options || []), q2.correctAnswer, q2.points || 1, q2.wordLimit, i]); } }
                await client.query('COMMIT');
                json(res, { ...savedExam, classes: b.classes || [], questions: b.questions || [] }, 201);
            } catch (err) { await client.query('ROLLBACK'); json(res, { error: err.message }, 500); } finally { client.release(); }
            return;
        }
    }
    const examMatch = pathname.match(/^\/api\/exams\/([^/]+)$/);
    if (examMatch) {
        const id = examMatch[1];
        if (method === 'PUT') { const map = { title: 'title', type: 'type', subject: 'subject', startTime: 'start_time', duration: 'duration', isActivated: 'is_activated', isManuallyActive: 'is_manually_active', isWritten: 'is_written', isGeneral: 'is_general' }; const fields = [], values = []; let i = 1; for (const [k, col] of Object.entries(map)) if (b[k] !== undefined) { fields.push(`${col} = $${i++}`); values.push(b[k]); } if (!fields.length) { json(res, { id }); return; } values.push(id); const { rows } = await pool.query(`UPDATE exams SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values); json(res, rows[0]); return; }
        if (method === 'DELETE') { await pool.query('DELETE FROM exams WHERE id = $1', [id]); json(res, { success: true }); return; }
    }

    // Results
    if (pathname === '/api/results') {
        if (method === 'GET') { const { rows } = await pool.query('SELECT * FROM results ORDER BY submitted_at DESC'); json(res, rows.map(r => ({ id: r.id, examId: r.exam_id, examTitle: r.exam_title, studentId: r.student_id, studentName: r.student_name, subject: r.subject, type: r.type, score: parseFloat(r.score), correctAnswers: r.correct_answers, totalQuestions: r.total_questions, submittedAt: r.submitted_at, isWritten: r.is_written, isReleased: r.is_released, isComposite: r.is_composite, compositeBreakdown: r.composite_breakdown, securityReport: r.security_report, answers: r.answers || [], questionDetails: r.question_details || [] }))); return; }
        if (method === 'POST') {
            const r = b;
            // Block duplicate submissions — same student, same exam
            if (r.examId && r.studentId && !r.isComposite) {
                const { rows: existing } = await pool.query(
                    'SELECT id FROM results WHERE exam_id = $1 AND student_id = $2 AND is_composite = false LIMIT 1',
                    [r.examId, r.studentId]
                );
                if (existing.length) { json(res, { error: 'Exam already submitted' }, 409); return; }
            }
            const { rows } = await pool.query(
                'INSERT INTO results (exam_id,exam_title,student_id,student_name,subject,type,score,correct_answers,total_questions,submitted_at,is_written,is_released,is_composite,composite_breakdown,security_report,answers,question_details) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *',
                [r.examId, r.examTitle, r.studentId, r.studentName, r.subject, r.type, r.score, r.correctAnswers, r.totalQuestions, r.submittedAt || new Date().toISOString(), r.isWritten || false, r.isReleased || false, r.isComposite || false, r.compositeBreakdown ? JSON.stringify(r.compositeBreakdown) : null, r.securityReport ? JSON.stringify(r.securityReport) : null, JSON.stringify(r.answers || []), JSON.stringify(r.questionDetails || [])]
            );
            json(res, rows[0] || r, 201); return;
        }
    }
    const resultMatch = pathname.match(/^\/api\/results\/([^/]+)$/);
    if (resultMatch) {
        const id = resultMatch[1];
        if (method === 'PUT') { const fields = [], values = []; let i = 1; if (b.isReleased !== undefined) { fields.push(`is_released = $${i++}`); values.push(b.isReleased); } if (b.score !== undefined) { fields.push(`score = $${i++}`); values.push(b.score); } if (b.isWritten !== undefined) { fields.push(`is_written = $${i++}`); values.push(b.isWritten); } if (!fields.length) { json(res, { id }); return; } values.push(id); const { rows } = await pool.query(`UPDATE results SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values); json(res, rows[0]); return; }
        if (method === 'DELETE') { await pool.query('DELETE FROM results WHERE id = $1', [id]); json(res, { success: true }); return; }
    }

    // Result releases
    if (pathname === '/api/result-releases') {
        if (method === 'GET') { const { rows } = await pool.query('SELECT * FROM result_releases'); const releases = {}; rows.forEach(r => { releases[r.exam_id] = r.is_released; }); json(res, releases); return; }
        if (method === 'POST') { const { rows } = await pool.query('INSERT INTO result_releases (exam_id,is_released,released_at) VALUES ($1,$2,$3) ON CONFLICT (exam_id) DO UPDATE SET is_released=EXCLUDED.is_released,released_at=EXCLUDED.released_at RETURNING *', [b.examId, b.isReleased, b.isReleased ? new Date().toISOString() : null]); json(res, rows[0]); return; }
    }

    // Materials
    if (pathname === '/api/materials') {
        if (method === 'GET') { const { rows } = await pool.query('SELECT m.*, c.name as class_name FROM materials m LEFT JOIN classes c ON m.class_id = c.id ORDER BY m.uploaded_at DESC'); json(res, rows.map(m => ({ id: m.id, title: m.title, description: m.description, content: m.content, fileUrl: m.file_url, fileName: m.file_name, uploadedFile: m.uploaded_file, subject: m.subject, class: m.class_name, lecturerId: m.uploaded_by, uploadedBy: m.uploaded_by, uploadedAt: m.uploaded_at }))); return; }
        if (method === 'POST') { let classId = null; if (b.className) { const { rows: cl } = await pool.query('SELECT id FROM classes WHERE name = $1', [b.className]); classId = cl[0]?.id || null; } let uid = b.uploadedBy; if (!uid || !/^[0-9a-f-]{36}$/.test(uid)) { const { rows: u } = await pool.query('SELECT id FROM users WHERE username = $1', [token.username]); uid = u[0]?.id || null; } const { rows } = await pool.query('INSERT INTO materials (title,description,content,file_url,file_name,uploaded_file,subject,class_id,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [b.title, b.description, b.content, b.fileUrl, b.fileName, b.uploadedFile, b.subject, classId, uid]); json(res, { ...rows[0], class: b.className }, 201); return; }
    }
    if (pathname === '/api/materials/upload-signature') {
        const timestamp = Math.round(Date.now() / 1000);
        const folder = 'signals-lms';
        const sortedStr = `folder=${folder}&timestamp=${timestamp}`;
        const signature = crypto.createHash('sha256').update(sortedStr + process.env.CLOUDINARY_API_SECRET).digest('hex');
        json(res, { timestamp, signature, folder, apiKey: process.env.CLOUDINARY_API_KEY, cloudName: process.env.CLOUDINARY_CLOUD_NAME }); return;
    }
    const matMatch = pathname.match(/^\/api\/materials\/([^/]+)$/);
    if (matMatch) { if (method === 'DELETE') { await pool.query('DELETE FROM materials WHERE id = $1', [matMatch[1]]); json(res, { success: true }); return; } }

    // Announcements
    if (pathname === '/api/announcements') {
        if (method === 'GET') { const { rows: ann } = await pool.query('SELECT a.*, u.full_name as author_name FROM announcements a LEFT JOIN users u ON a.created_by = u.id ORDER BY a.created_at DESC'); const { rows: ac } = await pool.query('SELECT ac.announcement_id, c.name FROM announcement_classes ac JOIN classes c ON ac.class_id = c.id'); const classMap = {}; ac.forEach(r => { if (!classMap[r.announcement_id]) classMap[r.announcement_id] = []; classMap[r.announcement_id].push(r.name); }); json(res, ann.map(a => ({ id: a.id, title: a.title, message: a.message, content: a.message, type: a.type || 'general', target: a.type || 'general', createdBy: a.created_by, authorName: a.author_name || 'Admin', createdAt: a.created_at, targetClasses: classMap[a.id] || [], classes: classMap[a.id] || [] }))); return; }
        if (method === 'POST') { const client = await pool.connect(); try { await client.query('BEGIN'); let cid = b.createdBy; if (!cid || !/^[0-9a-f-]{36}$/.test(cid)) { const { rows } = await client.query('SELECT id FROM users WHERE username = $1', [token.username]); cid = rows[0]?.id || null; } const { rows } = await client.query('INSERT INTO announcements (title,message,type,created_by) VALUES ($1,$2,$3,$4) RETURNING *', [b.title, b.message || b.content, b.type || 'general', cid]); if (b.targetClasses?.length) { for (const name of b.targetClasses) { const { rows: cl } = await client.query('SELECT id FROM classes WHERE name = $1', [name]); if (cl[0]) await client.query('INSERT INTO announcement_classes (announcement_id,class_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, cl[0].id]); } } await client.query('COMMIT'); json(res, { ...rows[0], classes: b.targetClasses || [] }, 201); } catch (err) { await client.query('ROLLBACK'); json(res, { error: err.message }, 500); } finally { client.release(); } return; }
    }
    const annMatch = pathname.match(/^\/api\/announcements\/([^/]+)$/);
    if (annMatch) { if (method === 'DELETE') { await pool.query('DELETE FROM announcements WHERE id = $1', [annMatch[1]]); json(res, { success: true }); return; } }

    // Notifications
    if (pathname === '/api/notifications') {
        if (method === 'GET') { const { rows } = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [q.userId]); json(res, rows.map(n => ({ id: n.id, userId: n.user_id, userType: n.user_type, type: n.type, title: n.title, message: n.message, link: n.link, data: n.data, read: n.read, createdAt: n.created_at }))); return; }
        if (method === 'POST') { const { rows } = await pool.query('INSERT INTO notifications (user_id,user_type,type,title,message,link,data) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [b.userId, b.userType, b.type, b.title, b.message, b.link, b.data ? JSON.stringify(b.data) : null]); json(res, rows[0], 201); return; }
    }
    const notifMatch = pathname.match(/^\/api\/notifications\/([^/]+)$/);
    if (notifMatch) { if (method === 'PUT') { await pool.query('UPDATE notifications SET read = true WHERE id = $1', [notifMatch[1]]); json(res, { success: true }); return; } }

    // Settings
    if (pathname === '/api/settings') {
        if (method === 'GET') { if (q.key) { const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', [q.key]); json(res, { value: rows[0]?.value || null }); return; } const { rows } = await pool.query('SELECT * FROM settings'); json(res, rows); return; }
        if (method === 'POST') { const { rows } = await pool.query('INSERT INTO settings (key,value,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW() RETURNING *', [b.key, String(b.value)]); json(res, rows[0]); return; }
    }

    // Written marks
    if (pathname === '/api/written-marks') {
        if (method === 'GET') { const { rows } = await pool.query('SELECT * FROM written_marks'); const marks = {}; rows.forEach(m => { const key = m.subject ? `${m.subject}_${m.class_name}` : `general_${m.class_name}`; if (!marks[key]) marks[key] = {}; if (!marks[key][m.exam_type]) marks[key][m.exam_type] = {}; marks[key][m.exam_type][m.student_id] = parseFloat(m.mark); }); json(res, marks); return; }
        if (method === 'POST') { const { rows } = await pool.query('INSERT INTO written_marks (subject,class_name,exam_type,student_id,mark) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (subject,class_name,exam_type,student_id) DO UPDATE SET mark=EXCLUDED.mark RETURNING *', [b.subject, b.className, b.examType, b.studentId, b.mark]); json(res, rows[0]); return; }
    }

    // Registration keys
    if (pathname === '/api/registration-keys') {
        if (method === 'GET') { const { rows } = await pool.query('SELECT * FROM registration_keys ORDER BY created_at DESC'); json(res, rows.map(k => ({ key: k.key, createdAt: k.created_at }))); return; }
        if (method === 'POST') { const { rows } = await pool.query('INSERT INTO registration_keys (key) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *', [b.key]); json(res, rows[0], 201); return; }
        if (method === 'DELETE') { await pool.query('DELETE FROM registration_keys WHERE key = $1', [b.key]); json(res, { success: true }); return; }
    }

    // Audit logs
    if (pathname === '/api/audit-logs') {
        if (method === 'GET') { const page = parseInt(q.page) || 1; const limit = parseInt(q.limit) || 50; const offset = (page - 1) * limit; const { rows } = await pool.query('SELECT al.*, u.full_name as performer_name FROM audit_logs al LEFT JOIN users u ON al.performed_by = u.id ORDER BY al.created_at DESC LIMIT $1 OFFSET $2', [limit, offset]); const { rows: cnt } = await pool.query('SELECT COUNT(*) FROM audit_logs'); json(res, { data: rows.map(l => ({ id: l.id, actionType: l.action_type, description: l.description, performedBy: l.performer_name || l.performed_by || 'System', metadata: l.metadata, createdAt: l.created_at })), count: parseInt(cnt[0].count) }); return; }
        if (method === 'POST') { let uid = b.performedBy; if (!uid || !/^[0-9a-f-]{36}$/.test(uid)) { const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [token.username]); uid = rows[0]?.id || null; } await pool.query('INSERT INTO audit_logs (action_type,description,performed_by,metadata) VALUES ($1,$2,$3,$4)', [b.actionType, b.description, uid, b.metadata ? JSON.stringify(b.metadata) : '{}']); json(res, { success: true }, 201); return; }
    }

    // Submissions
    if (pathname === '/api/submissions') {
        if (method === 'GET') { const url = q.assignmentId ? 'SELECT * FROM submissions WHERE assignment_id = $1 ORDER BY submitted_at DESC' : 'SELECT * FROM submissions ORDER BY submitted_at DESC'; const { rows } = await pool.query(url, q.assignmentId ? [q.assignmentId] : []); json(res, rows); return; }
        if (method === 'POST') { const { rows } = await pool.query('INSERT INTO submissions (assignment_id,student_id,content,file_url) VALUES ($1,$2,$3,$4) RETURNING *', [b.assignmentId, b.studentId, b.content, b.fileUrl]); json(res, rows[0], 201); return; }
        if (method === 'PUT') { const { rows } = await pool.query('UPDATE submissions SET grade=$1,feedback=$2 WHERE id=$3 RETURNING *', [b.grade, b.feedback, b.id]); json(res, rows[0]); return; }
    }

    json(res, { error: 'Not found' }, 404);
}

// ---- main server ----
const PORT = 3000;
const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    try {
        if (pathname.startsWith('/api/')) {
            await handleApi(req, res, pathname);
            return;
        }

        // Serve static files — check root then public/ (Vite convention)
        const ae = req.headers['accept-encoding'] || '';
        const tryPaths = [
            join(__dirname, pathname),
            join(__dirname, 'public', pathname),
            join(__dirname, pathname, 'index.html'),
            join(__dirname, 'public', pathname, 'index.html'),
            join(__dirname, pathname.replace(/\/$/, '') + '.html'),
            join(__dirname, 'public', pathname.replace(/\/$/, '') + '.html'),
        ];
        for (const p of tryPaths) {
            if (serveStatic(res, p, ae)) return;
        }

        // Fallback to index.html
        serveStatic(res, join(__dirname, 'index.html'), ae);
    } catch (err) {
        console.error('Server error:', err);
        json(res, { error: 'Internal server error' }, 500);
    }
});

server.listen(PORT, () => {
    console.log(`\n✅ Dev server running at http://localhost:${PORT}`);
    console.log('   Student:  http://localhost:' + PORT + '/student/login.html');
    console.log('   Lecturer: http://localhost:' + PORT + '/lecturer/login.html');
    console.log('   Admin:    http://localhost:' + PORT + '/admin/login.html');
    console.log('\n   Admin login: admin / admin123\n');
});
