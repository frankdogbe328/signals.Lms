import { getDb } from './_db.js';
import { verifyToken, createToken } from './_auth.js';
import { cors } from './_cors.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (cors(req, res)) return;

    const raw = req.query.path;
    let segments = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    // Fallback: extract path from req.url when catch-all query param is missing
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

        // ── AUTH ─────────────────────────────────────────────────────────────
        if (seg0 === 'auth') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

            if (seg1 === 'login') {
                const { username, password, type } = req.body;
                if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
                const q = type
                    ? 'SELECT u.*, c.name as class_name FROM users u LEFT JOIN classes c ON u.class_id = c.id WHERE (u.username = $1 OR u.email = $1) AND u.type = $2 LIMIT 1'
                    : 'SELECT u.*, c.name as class_name FROM users u LEFT JOIN classes c ON u.class_id = c.id WHERE (u.username = $1 OR u.email = $1) LIMIT 1';
                const { rows } = await db.query(q, type ? [username, type] : [username]);
                const user = rows[0];
                if (!user) return res.status(401).json({ error: 'Invalid username or password' });
                const match = user.password_hash.startsWith('$2')
                    ? await bcrypt.compare(password, user.password_hash)
                    : user.password_hash === password;
                if (!match) return res.status(401).json({ error: 'Invalid username or password' });
                return res.json({
                    token: createToken(user),
                    user: {
                        id: user.id, username: user.username, password: user.password_hash,
                        fullName: user.full_name, email: user.email, telephone: user.telephone,
                        type: user.type, rank: user.rank, class: user.class_name,
                        classId: user.class_id, subjects: user.subjects || [],
                        classes: user.classes || [], canPrintResults: user.can_print_results
                    }
                });
            }

            if (seg1 === 'register') {
                const { username, password, fullName, email, telephone, type, rank, className, classes, subjects, registrationKey } = req.body;
                if (!username || !password || !type) return res.status(400).json({ error: 'Missing required fields' });
                const { rows: ex } = await db.query('SELECT id FROM users WHERE username = $1', [username]);
                if (ex.length) return res.status(409).json({ error: 'Username already exists' });
                if (type === 'lecturer') {
                    if (!registrationKey) return res.status(400).json({ error: 'Registration key required for lecturers' });
                    const { rows: keys } = await db.query('SELECT id FROM registration_keys WHERE key = $1', [registrationKey]);
                    if (!keys.length) return res.status(401).json({ error: 'Invalid registration key' });
                }
                let classId = null;
                if (className) {
                    const { rows: cl } = await db.query('SELECT id FROM classes WHERE name = $1', [className]);
                    classId = cl[0]?.id || null;
                }
                const passwordHash = await bcrypt.hash(password, 10);
                const classesArr = (classes && classes.length) ? classes : (className ? [className] : []);
                const { rows } = await db.query(
                    `INSERT INTO users (username,password_hash,full_name,email,telephone,type,rank,class_id,subjects,classes)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,username,full_name,email,type`,
                    [username, passwordHash, fullName, email, telephone, type, rank, classId, subjects || [], classesArr]
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
                const mapUser = u => ({
                    id: u.id, username: u.username, password: u.password_hash,
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
            if (req.method === 'PUT') {
                const { username, fullName, email, telephone, rank, subjects, classes, password, className, canPrintResults } = req.body;
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
                if (fullName !== undefined) add('full_name', fullName);
                if (email !== undefined) add('email', email);
                if (telephone !== undefined) add('telephone', telephone);
                if (rank !== undefined) add('rank', rank);
                if (subjects !== undefined) add('subjects', subjects);
                if (classes !== undefined) add('classes', classes);
                if (canPrintResults !== undefined) add('can_print_results', canPrintResults);
                if (classId !== undefined) add('class_id', classId);
                if (password) add('password_hash', await bcrypt.hash(password, 10));
                if (!updates.length) return res.json({ id });
                values.push(id);
                const { rows } = await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values);
                return res.json(rows[0]);
            }
            if (req.method === 'DELETE') {
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
                    const { rows: exams } = await db.query('SELECT * FROM exams ORDER BY created_at DESC');
                    const { rows: ec } = await db.query(`
                        SELECT ec.exam_id, c.name FROM exam_classes ec JOIN classes c ON ec.class_id = c.id
                    `);
                    const classMap = {};
                    ec.forEach(r => { if (!classMap[r.exam_id]) classMap[r.exam_id] = []; classMap[r.exam_id].push(r.name); });
                    if (minimal) return res.json(exams.map(e => ({
                        id: e.id, title: e.title, type: e.type, subject: e.subject,
                        classes: classMap[e.id] || [], startTime: e.start_time,
                        duration: e.duration, isActivated: e.is_activated, isManuallyActive: e.is_manually_active
                    })));
                    const { rows: questions } = await db.query('SELECT * FROM exam_questions ORDER BY question_order');
                    const qMap = {};
                    questions.forEach(q => {
                        if (!qMap[q.exam_id]) qMap[q.exam_id] = [];
                        qMap[q.exam_id].push({
                            id: q.id, type: q.question_type, question: q.question_text,
                            options: q.options || [], correctAnswer: q.correct_answer,
                            points: q.points, wordLimit: q.word_limit
                        });
                    });
                    return res.json(exams.map(e => txExam(e, classMap[e.id] || [], qMap[e.id] || [])));
                }

                if (req.method === 'POST') {
                    const exam = req.body;
                    const client = await db.connect();
                    try {
                        await client.query('BEGIN');
                        const classIds = [];
                        for (const name of (exam.classes || [])) {
                            const { rows } = await client.query('SELECT id FROM classes WHERE name = $1', [name]);
                            if (rows[0]) classIds.push(rows[0].id);
                        }
                        let createdBy = exam.createdBy || exam.lecturerId;
                        if (!createdBy || !/^[0-9a-f-]{36}$/.test(createdBy)) {
                            const { rows } = await client.query('SELECT id FROM users WHERE username = $1', [token.username]);
                            createdBy = rows[0]?.id || null;
                        }
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
                    const { rows } = await db.query('SELECT * FROM results ORDER BY submitted_at DESC');
                    return res.json(rows.map(txR));
                }
                if (req.method === 'POST') {
                    const r = req.body;
                    const { rows } = await db.query(
                        `INSERT INTO results (exam_id,exam_title,student_id,student_name,subject,type,score,
                         correct_answers,total_questions,submitted_at,is_written,is_released,is_composite,
                         composite_breakdown,security_report,answers,question_details)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
                         ON CONFLICT DO NOTHING RETURNING *`,
                        [r.examId, r.examTitle, r.studentId, r.studentName, r.subject, r.type,
                         r.score, r.correctAnswers, r.totalQuestions,
                         r.submittedAt || new Date().toISOString(),
                         r.isWritten || false, r.isReleased || false, r.isComposite || false,
                         r.compositeBreakdown ? JSON.stringify(r.compositeBreakdown) : null,
                         r.securityReport ? JSON.stringify(r.securityReport) : null,
                         JSON.stringify(r.answers || []), JSON.stringify(r.questionDetails || [])]
                    );
                    return res.status(201).json(rows[0] ? txR(rows[0]) : r);
                }
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const id = seg1;
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
            if (req.method === 'GET') {
                const { rows } = await db.query('SELECT * FROM result_releases');
                const releases = {};
                rows.forEach(r => { releases[r.exam_id] = r.is_released; });
                return res.json(releases);
            }
            if (req.method === 'POST') {
                const { examId, isReleased } = req.body;
                const { rows } = await db.query(
                    `INSERT INTO result_releases (exam_id, is_released, released_at) VALUES ($1,$2,$3)
                     ON CONFLICT (exam_id) DO UPDATE SET is_released = EXCLUDED.is_released, released_at = EXCLUDED.released_at
                     RETURNING *`,
                    [examId, isReleased, isReleased ? new Date().toISOString() : null]
                );
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
                    const { title, description, content, fileUrl, fileName, uploadedFile, subject, className, uploadedBy } = req.body;
                    if (!title) return res.status(400).json({ error: 'Title required' });
                    let classId = null;
                    if (className) {
                        const { rows: cl } = await db.query('SELECT id FROM classes WHERE name = $1', [className]);
                        classId = cl[0]?.id || null;
                    }
                    let uploaderId = uploadedBy;
                    if (!uploaderId || !/^[0-9a-f-]{36}$/.test(uploadedBy)) {
                        const { rows: u } = await db.query('SELECT id FROM users WHERE username = $1', [token.username]);
                        uploaderId = u[0]?.id || null;
                    }
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
                await db.query('DELETE FROM materials WHERE id = $1', [id]);
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
                    const { title, message, type, targetClasses, createdBy } = req.body;
                    const client = await db.connect();
                    try {
                        await client.query('BEGIN');
                        let creatorId = createdBy;
                        if (!creatorId || !/^[0-9a-f-]{36}$/.test(creatorId)) {
                            const { rows } = await client.query('SELECT id FROM users WHERE username = $1', [token.username]);
                            creatorId = rows[0]?.id || null;
                        }
                        const { rows } = await client.query(
                            'INSERT INTO announcements (title, message, type, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
                            [title, message, type || 'general', creatorId]
                        );
                        const ann = rows[0];
                        if (targetClasses?.length) {
                            for (const name of targetClasses) {
                                const { rows: cl } = await client.query('SELECT id FROM classes WHERE name = $1', [name]);
                                if (cl[0]) await client.query(
                                    'INSERT INTO announcement_classes (announcement_id, class_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                                    [ann.id, cl[0].id]
                                );
                            }
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
            if (req.method === 'DELETE') {
                await db.query('DELETE FROM announcements WHERE id = $1', [id]);
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
                    const { rows } = await db.query(
                        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
                        [req.query.userId]
                    );
                    return res.json(rows.map(txN));
                }
                if (req.method === 'POST') {
                    const { userId, userType, type, title, message, link, data } = req.body;
                    const { rows } = await db.query(
                        `INSERT INTO notifications (user_id,user_type,type,title,message,link,data)
                         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                        [userId, userType, type, title, message, link, data ? JSON.stringify(data) : null]
                    );
                    return res.status(201).json(txN(rows[0]));
                }
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const id = seg1;
            if (req.method === 'PUT') {
                await db.query('UPDATE notifications SET read = true WHERE id = $1', [id]);
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── SETTINGS ──────────────────────────────────────────────────────────
        if (seg0 === 'settings') {
            const token = verifyToken(req);
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
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
            if (req.method === 'GET') {
                const { rows } = await db.query('SELECT * FROM written_marks');
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
            if (req.method === 'GET') {
                const { rows } = await db.query('SELECT * FROM registration_keys ORDER BY created_at DESC');
                return res.json(rows.map(k => ({ key: k.key, createdAt: k.created_at })));
            }
            if (req.method === 'POST') {
                const { key } = req.body;
                if (!key) return res.status(400).json({ error: 'Key required' });
                const { rows } = await db.query(
                    'INSERT INTO registration_keys (key) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *',
                    [key]
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
                const { rows } = await db.query(
                    assignmentId
                        ? 'SELECT * FROM submissions WHERE assignment_id = $1 ORDER BY submitted_at DESC'
                        : 'SELECT * FROM submissions ORDER BY submitted_at DESC',
                    assignmentId ? [assignmentId] : []
                );
                return res.json(rows);
            }
            if (req.method === 'POST') {
                const { assignmentId, studentId, content, fileUrl } = req.body;
                const { rows } = await db.query(
                    'INSERT INTO submissions (assignment_id, student_id, content, file_url) VALUES ($1,$2,$3,$4) RETURNING *',
                    [assignmentId, studentId, content, fileUrl]
                );
                return res.status(201).json(rows[0]);
            }
            if (req.method === 'PUT') {
                const { id, grade, feedback } = req.body;
                const { rows } = await db.query(
                    'UPDATE submissions SET grade = $1, feedback = $2 WHERE id = $3 RETURNING *',
                    [grade, feedback, id]
                );
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
