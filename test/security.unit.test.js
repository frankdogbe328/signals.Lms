import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManageExam, getEligibleExam, getRegistrationAssignments, gradeObjectiveQuestions, isExamOpen } from '../api/_security.js';
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
