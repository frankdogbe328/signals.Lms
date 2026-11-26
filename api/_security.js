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
