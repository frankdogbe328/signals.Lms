export function isAdmin(token) {
    return token?.type === 'admin';
}

export function getRegistrationAssignments(type, isAdminCaller, registrationScopes, classes, subjects, className) {
    const assignedClasses = type === 'lecturer' && !isAdminCaller
        ? registrationScopes?.classes || []
        : ((classes && classes.length > 0) ? classes : (className ? [className] : []));
    const assignedSubjects = type === 'lecturer' && !isAdminCaller
        ? registrationScopes?.subjects || []
        : subjects || [];
    return {
        classes: assignedClasses,
        subjects: assignedSubjects,
        className: assignedClasses[0] || className
    };
}

export function toStudentSubmissionResponse(result) {
    return {
        id: result.id,
        examId: result.exam_id,
        examTitle: result.exam_title,
        submittedAt: result.submitted_at,
        isReleased: false
    };
}

export function toResultResponse(result) {
    return {
        id: result.id, examId: result.exam_id, examTitle: result.exam_title,
        studentId: result.student_id, studentName: result.student_name,
        subject: result.subject, type: result.type, score: parseFloat(result.score),
        correctAnswers: result.correct_answers, totalQuestions: result.total_questions,
        submittedAt: result.submitted_at, isWritten: result.is_written,
        isReleased: result.is_released, isComposite: result.is_composite,
        compositeBreakdown: result.composite_breakdown, securityReport: result.security_report,
        answers: result.answers || [], questionDetails: result.question_details || []
    };
}

export async function getResultAccess(db, token, id) {
    const { rows } = await db.query('SELECT * FROM results WHERE id = $1', [id]);
    if (!rows[0]) return { result: null, authorized: false };
    return {
        result: rows[0],
        authorized: await canManageExam(db, token, rows[0].exam_id)
    };
}

export async function getVisibleMaterials(db, token) {
    let query = `
        SELECT m.*, c.name AS class_name FROM materials m
        LEFT JOIN classes c ON c.id = m.class_id
    `;
    let values = [];
    if (token.type === 'student') {
        query += ` WHERE m.class_id IS NULL OR m.class_id = (
            SELECT class_id FROM users WHERE id = $1 AND type = 'student'
        )`;
        values = [token.id];
    } else if (token.type === 'lecturer') {
        query += ' WHERE m.uploaded_by = $1';
        values = [token.id];
    } else if (token.type !== 'admin') {
        return [];
    }
    const { rows } = await db.query(`${query} ORDER BY m.uploaded_at DESC`, values);
    return rows;
}

export async function getVisibleAnnouncements(db, token) {
    let query = `
        SELECT a.*, u.full_name AS author_name FROM announcements a
        LEFT JOIN users u ON a.created_by = u.id
    `;
    let values = [];
    if (token.type === 'student') {
        query += ` WHERE NOT EXISTS (
            SELECT 1 FROM announcement_classes target
            WHERE target.announcement_id = a.id
        ) OR EXISTS (
            SELECT 1 FROM announcement_classes target
            JOIN users student ON student.id = $1 AND student.type = 'student'
            WHERE target.announcement_id = a.id AND target.class_id = student.class_id
        )`;
        values = [token.id];
    } else if (!['admin', 'lecturer'].includes(token.type)) {
        return [];
    }
    const { rows } = await db.query(`${query} ORDER BY a.created_at DESC`, values);
    return rows;
}

export async function canAssignWrittenMark(db, token, className, subject, studentId) {
    const { rows } = await db.query(`
        SELECT
            EXISTS (
                SELECT 1 FROM users student
                JOIN classes c ON c.id = student.class_id
                WHERE student.id = $4 AND student.type = 'student' AND c.name = $2
            ) AS student_in_class,
            ($5::boolean OR EXISTS (
                SELECT 1 FROM users lecturer
                WHERE lecturer.id = $1 AND lecturer.type = 'lecturer'
                  AND $2 = ANY(lecturer.classes) AND $3 = ANY(lecturer.subjects)
            )) AS lecturer_in_scope
    `, [token.id, className, subject, studentId, token.type === 'admin']);
    return rows[0]?.student_in_class === true && rows[0]?.lecturer_in_scope === true;
}

export async function canTargetAnnouncementClasses(db, token, targetClasses) {
    if (!Array.isArray(targetClasses) || targetClasses.some(name => typeof name !== 'string' || !name.trim())) return false;
    if (token.type === 'lecturer' && targetClasses.length === 0) return false;

    const names = [...new Set(targetClasses.map(name => name.trim()))];
    const { rows: classes } = await db.query(
        'SELECT name FROM classes WHERE name = ANY($1::text[])',
        [names]
    );
    if (classes.length !== names.length) return false;
    if (token.type === 'admin') return true;
    if (token.type !== 'lecturer') return false;

    const { rows: lecturer } = await db.query('SELECT classes FROM users WHERE id = $1 AND type = $2', [token.id, 'lecturer']);
    const assigned = new Set(lecturer[0]?.classes || []);
    return names.every(name => assigned.has(name));
}

export async function gradeSubmission(db, token, id, grade, feedback) {
    if (token.type === 'admin') {
        return db.query(
            'UPDATE submissions SET grade = $1, feedback = $2 WHERE id = $3 RETURNING *',
            [grade, feedback, id]
        );
    }
    if (token.type !== 'lecturer') return { rows: [] };
    return db.query(`
        UPDATE submissions SET grade = $1, feedback = $2 WHERE id = $3 AND EXISTS (
            SELECT 1 FROM users student
            JOIN classes c ON c.id = student.class_id
            WHERE student.id = submissions.student_id AND student.type = 'student'
              AND c.name = ANY((SELECT classes FROM users WHERE id = $4 AND type = 'lecturer'))
        ) RETURNING *
    `, [grade, feedback, id, token.id]);
}

export async function registerWithKey(client, key, createAccount) {
    await client.query('BEGIN');
    try {
        const { rows } = await client.query(`
            UPDATE registration_keys SET used_at = NOW()
            WHERE key = $1 AND used_at IS NULL AND expires_at > NOW()
            RETURNING classes, subjects
        `, [key]);
        if (!rows.length) {
            await client.query('ROLLBACK');
            return null;
        }
        const account = await createAccount(rows[0]);
        await client.query('COMMIT');
        return account;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}

export async function canManageExam(db, token, examId) {
    if (isAdmin(token)) return true;
    if (token?.type !== 'lecturer' || !token.id) return false;
    const { rows } = await db.query('SELECT 1 FROM exams WHERE id = $1 AND created_by = $2', [examId, token.id]);
    return rows.length > 0;
}

export async function getEligibleExam(db, studentId, examId, now = new Date()) {
    const { rows } = await db.query(`
        SELECT e.*, u.class_id
        FROM exams e
        JOIN users u ON u.id = $2 AND u.type = 'student'
        WHERE e.id = $1
        FOR UPDATE OF e
    `, [examId, studentId]);
    const exam = rows[0];
    if (!exam || !exam.is_activated) return null;

    const { rows: classes } = await db.query('SELECT class_id FROM exam_classes WHERE exam_id = $1', [examId]);
    const eligibleByClass = exam.is_general || (exam.class_id && classes.some(row => row.class_id === exam.class_id));
    if (!eligibleByClass) return null;

    if (!isExamOpen(exam, now)) return null;

    return exam;
}

export function isExamOpen(exam, now = new Date()) {
    if (!exam?.is_activated) return false;
    if (exam.is_manually_active) return true;
    const startsAt = exam.start_time ? new Date(exam.start_time) : null;
    const endsAt = startsAt && Number.isFinite(Number(exam.duration))
        ? new Date(startsAt.getTime() + Number(exam.duration) * 60_000)
        : null;
    return !!startsAt && !!endsAt && now >= startsAt && now <= endsAt;
}

function answerAt(answers, index) {
    if (Array.isArray(answers)) return answers[index];
    if (answers && typeof answers === 'object') return answers[index] ?? answers[String(index)];
    return undefined;
}

function normalizeAnswer(value) {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value.trim() : JSON.stringify(value);
}

export function gradeObjectiveQuestions(questions, answers) {
    let earned = 0;
    let possible = 0;
    let correctAnswers = 0;
    const details = questions.map((question, index) => {
        const type = String(question.question_type || '').toLowerCase();
        const isEssay = type.includes('essay') || type.includes('written') ||
            (!Array.isArray(question.options) || question.options.length === 0);
        const points = Math.max(0, Number(question.points) || 1);
        const studentAnswer = answerAt(answers, index);
        const isCorrect = !isEssay &&
            normalizeAnswer(studentAnswer) === normalizeAnswer(question.correct_answer);
        if (!isEssay) {
            possible += points;
            if (isCorrect) {
                earned += points;
                correctAnswers++;
            }
        }
        return {
            type: question.question_type,
            question: question.question_text,
            options: question.options || [],
            correctAnswer: question.correct_answer,
            studentAnswer: studentAnswer ?? null,
            isCorrect: isEssay ? null : isCorrect,
            needsGrading: isEssay,
            points
        };
    });

    return {
        score: possible ? Math.round((earned / possible) * 100) : 0,
        correctAnswers,
        totalQuestions: questions.length,
        questionDetails: details
    };
}
