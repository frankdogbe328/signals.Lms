import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    canAssignWrittenMark, canManageExam, canTargetAnnouncementClasses,
    getEligibleExam, getRegistrationAssignments, gradeObjectiveQuestions,
    gradeSubmission, isExamOpen, registerWithKey, toStudentSubmissionResponse
} from '../api/_security.js';
import { cors } from '../api/_cors.js';

test('backend grading ignores forged client score fields and grades stored answers', () => {
    const grade = gradeObjectiveQuestions([
        { question_type: 'multiple-choice', question_text: '1 + 1?', options: ['2', '3'], correct_answer: '2', points: 2 },
        { question_type: 'essay', question_text: 'Explain', options: [], correct_answer: null, points: 5 }
    ], ['2', 'client says full marks']);
    assert.deepEqual(
        { score: grade.score, correctAnswers: grade.correctAnswers, totalQuestions: grade.totalQuestions },
        { score: 100, correctAnswers: 1, totalQuestions: 2 }
    );
    assert.equal(grade.questionDetails[1].needsGrading, true);
    assert.equal(grade.questionDetails[1].isCorrect, null);
});

test('backend grading returns zero for empty or incorrect objective answers', () => {
    const questions = [{ question_type: 'multiple-choice', options: ['A', 'B'], correct_answer: 'A', points: 1 }];
    assert.equal(gradeObjectiveQuestions(questions, ['B']).score, 0);
    assert.equal(gradeObjectiveQuestions(questions, []).correctAnswers, 0);
});

test('scheduled examination availability respects activation, start time, and duration', () => {
    const now = new Date('2026-01-01T10:30:00Z');
    const exam = { is_activated: true, is_manually_active: false, start_time: '2026-01-01T10:00:00Z', duration: 60 };
    assert.equal(isExamOpen(exam, now), true);
    assert.equal(isExamOpen({ ...exam, is_activated: false }, now), false);
    assert.equal(isExamOpen({ ...exam, duration: 15 }, now), false);
});

test('only administrator or owning lecturer can manage an exam', async () => {
    let queries = 0;
    const db = { query: async (_sql, params) => { queries++; return { rows: params[1] === 'owner-id' ? [{}] : [] }; } };
    assert.equal(await canManageExam(db, { type: 'admin' }, 'exam-id'), true);
    assert.equal(queries, 0);
    assert.equal(await canManageExam(db, { type: 'lecturer', id: 'owner-id' }, 'exam-id'), true);
    assert.equal(await canManageExam(db, { type: 'lecturer', id: 'other-id' }, 'exam-id'), false);
    assert.equal(await canManageExam(db, { type: 'student', id: 'student-id' }, 'exam-id'), false);
});

test('public lecturer registration uses key scopes instead of requested assignments', () => {
    assert.deepEqual(
        getRegistrationAssignments(
            'lecturer',
            false,
            { classes: ['Class A'], subjects: ['Math'] },
            ['Class B'],
            ['Science'],
            'Class B'
        ),
        { classes: ['Class A'], subjects: ['Math'], className: 'Class A' }
    );
    assert.deepEqual(
        getRegistrationAssignments('lecturer', true, null, ['Class B'], ['Science'], null),
        { classes: ['Class B'], subjects: ['Science'], className: 'Class B' }
    );
});

test('student submission receipt excludes scores, submitted answers, and answer keys', () => {
    const receipt = toStudentSubmissionResponse({
        id: 'result-id',
        exam_id: 'exam-id',
        exam_title: 'Midterm',
        submitted_at: '2026-01-01T10:00:00Z',
        score: 100,
        answers: ['forged'],
        question_details: [{ correctAnswer: 'secret', isCorrect: true }],
        is_released: false
    });
    assert.deepEqual(receipt, {
        id: 'result-id',
        examId: 'exam-id',
        examTitle: 'Midterm',
        submittedAt: '2026-01-01T10:00:00Z',
        isReleased: false
    });
});

test('written marks require a student in the class and lecturer class/subject assignment', async () => {
    const db = {
        query: async (_sql, [lecturerId, className, subject, studentId, isAdmin]) => ({
            rows: [{
                student_in_class: studentId === 'student-a' && className === 'Class A',
                lecturer_in_scope: isAdmin || (lecturerId === 'lecturer-a' && className === 'Class A' && subject === 'Math')
            }]
        })
    };
    const lecturer = { id: 'lecturer-a', type: 'lecturer' };
    assert.equal(await canAssignWrittenMark(db, lecturer, 'Class A', 'Math', 'student-a'), true);
    assert.equal(await canAssignWrittenMark(db, lecturer, 'Class B', 'Math', 'student-a'), false);
    assert.equal(await canAssignWrittenMark(db, lecturer, 'Class A', 'Science', 'student-a'), false);
    assert.equal(await canAssignWrittenMark(db, lecturer, 'Class A', 'Math', 'student-b'), false);
    assert.equal(await canAssignWrittenMark(db, { id: 'admin-a', type: 'admin' }, 'Class A', 'Math', 'student-a'), true);
});

test('lecturer announcement targets are limited to assigned existing classes', async () => {
    const db = {
        query: async (sql, params) => sql.includes('SELECT name FROM classes')
            ? { rows: params[0].filter(name => ['Class A', 'Class B'].includes(name)).map(name => ({ name })) }
            : { rows: [{ classes: ['Class A'] }] }
    };
    const lecturer = { id: 'lecturer-a', type: 'lecturer' };
    assert.equal(await canTargetAnnouncementClasses(db, lecturer, ['Class A']), true);
    assert.equal(await canTargetAnnouncementClasses(db, lecturer, ['Class B']), false);
    assert.equal(await canTargetAnnouncementClasses(db, lecturer, []), false);
    assert.equal(await canTargetAnnouncementClasses(db, lecturer, ['Unknown']), false);
    assert.equal(await canTargetAnnouncementClasses(db, { id: 'admin-a', type: 'admin' }, []), true);
});

test('submission grading keeps lecturer updates within assigned student classes', async () => {
    const statements = [];
    const db = {
        query: async (sql, params) => {
            statements.push({ sql, params });
            return { rows: params[3] === 'lecturer-a' ? [{ id: params[2] }] : [] };
        }
    };
    assert.equal((await gradeSubmission(db, { id: 'lecturer-a', type: 'lecturer' }, 'submission-a', 90, 'ok')).rows.length, 1);
    assert.equal((await gradeSubmission(db, { id: 'lecturer-b', type: 'lecturer' }, 'submission-a', 90, 'forbidden')).rows.length, 0);
    assert.match(statements[0].sql, /student\.type = 'student'/);
    assert.match(statements[0].sql, /ANY\(\(SELECT classes FROM users WHERE id = \$4 AND type = 'lecturer'\)\)/);
    assert.equal(statements[0].params[2], 'submission-a');
    assert.deepEqual(await gradeSubmission(db, { id: 'student-a', type: 'student' }, 'submission-a', 90, 'forbidden'), { rows: [] });
});

test('registration key use commits only after account creation succeeds', async () => {
    const commands = [];
    const client = {
        query: async sql => {
            commands.push(sql.trim().split(/\s+/)[0]);
            if (sql.includes('UPDATE registration_keys')) return { rows: [{ classes: ['Class A'], subjects: ['Math'] }] };
            return { rows: [] };
        }
    };
    const account = await registerWithKey(client, 'one-time-key', async scopes => scopes);
    assert.deepEqual(account, { classes: ['Class A'], subjects: ['Math'] });
    assert.deepEqual(commands, ['BEGIN', 'UPDATE', 'COMMIT']);

    commands.length = 0;
    await assert.rejects(
        registerWithKey(client, 'one-time-key', async () => { throw new Error('account insert failed'); }),
        /account insert failed/
    );
    assert.deepEqual(commands, ['BEGIN', 'UPDATE', 'ROLLBACK']);

    commands.length = 0;
    client.query = async sql => {
        commands.push(sql.trim().split(/\s+/)[0]);
        return { rows: [] };
    };
    assert.equal(await registerWithKey(client, 'already-used-key', async () => assert.fail('must not create account')), null);
    assert.deepEqual(commands, ['BEGIN', 'UPDATE', 'ROLLBACK']);
});

test('student exam eligibility requires active exam and assigned class or general access', async () => {
    const db = {
        query: async (sql) => sql.includes('SELECT e.*')
            ? { rows: [{ id: 'exam', class_id: 'class-a', is_activated: true, is_manually_active: true }] }
            : { rows: [{ class_id: 'class-a' }] }
    };
    assert.ok(await getEligibleExam(db, 'student-id', 'exam'));
    const ineligibleDb = {
        query: async (sql) => sql.includes('SELECT e.*')
            ? { rows: [{ id: 'exam', class_id: 'class-b', is_activated: true, is_manually_active: true }] }
            : { rows: [{ class_id: 'class-a' }] }
    };
    assert.equal(await getEligibleExam(ineligibleDb, 'student-id', 'exam'), null);
});

test('CORS only reflects explicitly allowed origins', () => {
    const previous = process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGINS = 'https://lms.example.test';
    const headers = {};
    const response = {
        setHeader: (name, value) => { headers[name] = value; },
        status: () => ({ end: () => {} })
    };
    cors({ method: 'GET', headers: { origin: 'https://attacker.example' } }, response);
    assert.equal(headers['Access-Control-Allow-Origin'], undefined);
    cors({ method: 'GET', headers: { origin: 'https://lms.example.test' } }, response);
    assert.equal(headers['Access-Control-Allow-Origin'], 'https://lms.example.test');
    if (previous === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = previous;
});
