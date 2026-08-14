-- Signals Training School LMS - PostgreSQL Schema
-- Run this in your Neon dashboard SQL editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200),
    email VARCHAR(200),
    telephone VARCHAR(50),
    type VARCHAR(20) NOT NULL CHECK (type IN ('student', 'lecturer', 'admin')),
    rank VARCHAR(100),
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    subjects TEXT[] DEFAULT '{}',
    classes TEXT[] DEFAULT '{}',
    can_print_results BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject VARCHAR(200) NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    lecturer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    type VARCHAR(50),
    subject VARCHAR(200),
    start_time TIMESTAMPTZ,
    duration INTEGER DEFAULT 60,
    is_activated BOOLEAN DEFAULT false,
    is_manually_active BOOLEAN DEFAULT false,
    is_written BOOLEAN DEFAULT false,
    is_general BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE(exam_id, class_id)
);

CREATE TABLE IF NOT EXISTS exam_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    question_type VARCHAR(50),
    question_text TEXT,
    options JSONB DEFAULT '[]',
    correct_answer TEXT,
    points INTEGER DEFAULT 1,
    word_limit INTEGER,
    question_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    exam_title VARCHAR(200),
    student_id UUID REFERENCES users(id) ON DELETE SET NULL,
    student_name VARCHAR(200),
    subject VARCHAR(200),
    type VARCHAR(50),
    score DECIMAL(10,2),
    correct_answers INTEGER,
    total_questions INTEGER,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    is_written BOOLEAN DEFAULT false,
    is_released BOOLEAN DEFAULT false,
    is_composite BOOLEAN DEFAULT false,
    composite_breakdown JSONB,
    security_report JSONB,
    answers JSONB DEFAULT '[]',
    question_details JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS result_releases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    is_released BOOLEAN DEFAULT false,
    released_at TIMESTAMPTZ,
    UNIQUE(exam_id)
);

CREATE TABLE IF NOT EXISTS materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    content TEXT,
    file_url TEXT,
    file_name VARCHAR(200),
    uploaded_file TEXT,
    subject VARCHAR(200),
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'general',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE(announcement_id, class_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_type VARCHAR(20),
    type VARCHAR(50),
    title VARCHAR(200),
    message TEXT,
    link TEXT,
    data JSONB,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID,
    student_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT,
    file_url TEXT,
    grade DECIMAL(10,2),
    feedback TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type VARCHAR(100),
    description TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS written_marks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject VARCHAR(200),
    class_name VARCHAR(100),
    exam_type VARCHAR(50),
    student_id UUID REFERENCES users(id) ON DELETE SET NULL,
    mark DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject, class_name, exam_type, student_id)
);

CREATE TABLE IF NOT EXISTS registration_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default admin user (password: admin123)
INSERT INTO users (username, password_hash, full_name, type)
VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Indexes on hot query paths
CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);
CREATE INDEX IF NOT EXISTS idx_users_class_id ON users(class_id);
CREATE INDEX IF NOT EXISTS idx_results_exam_student ON results(exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_submitted_at ON results(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_classes_class ON announcement_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_classes_class ON exam_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_courses_class ON courses(class_id);
CREATE INDEX IF NOT EXISTS idx_materials_class ON materials(class_id);
CREATE INDEX IF NOT EXISTS idx_written_marks_student ON written_marks(student_id);
