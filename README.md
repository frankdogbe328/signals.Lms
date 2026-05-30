# Signals Training School - LMS Portal

A comprehensive Learning Management System built with pure HTML, CSS, and JavaScript for Signals Training School.

## Features

### Student Portal
- **Registration & Login**: Students can register and select their class
- **Exams & Quizzes**: View and take scheduled exams/quizzes
- **Auto-Start Exams**: Exams automatically become available at scheduled start time
- **Live Timer**: Real-time countdown timer during exams
- **Results**: View mid-semester and final exam results
- **Course Materials**: Access and download materials uploaded by lecturers

### Lecturer Portal
- **Secret Key Registration**: Secure registration with admin-provided secret key
- **Exam Creation**: Create exams/quizzes with:
  - Custom questions (multiple choice)
  - Date and time scheduling
  - Duration settings
  - Multiple class selection
- **Auto-Start Functionality**: Exams start automatically at scheduled time
- **Material Upload**: Upload course materials for students
- **Results View**: View all student results for created exams

### Admin Portal
- **System Overview**: Dashboard with system statistics
- **Class Management**: Add and manage classes
- **Course Management**: Add courses/subjects for each class
- **User Management**: View all students and lecturers
- **Settings**: Manage lecturer secret key

## Getting Started

### Initial Setup

1. **Open the Application**
   - Open `index.html` in your web browser
   - Sample data will be automatically initialized

2. **Admin Login**
   - Username: `admin`
   - Password: `admin123`
   - Default lecturer secret key: `SIGNALS2024`

3. **Setup Classes and Courses**
   - Login as admin
   - Go to "Manage Classes" and add classes
   - Go to "Manage Courses" and add subjects for each class

### For Lecturers

1. **Registration**
   - Click on "Lecturer Portal" from the main page
   - Click "Register here"
   - Enter the secret key (default: `SIGNALS2024`)
   - Fill in your details
   - Select subjects and classes you'll be teaching

2. **Creating Exams**
   - Login to lecturer portal
   - Go to "Create Exam/Quiz"
   - Fill in exam details:
     - Title, Type (Mid Semester/Final Exam/Quiz)
     - Subject, Classes
     - Start date and time
     - Duration in minutes
   - Add questions with 4 options each
   - Select correct answer for each question
   - Click "Create Exam"

3. **Uploading Materials**
   - Go to "Upload Material"
   - Enter material details
   - Add content (HTML supported) or file URL
   - Select subject and class
   - Click "Upload Material"

### For Students

1. **Registration**
   - Click on "Student Portal"
   - Click "Register here"
   - Fill in your details
   - Select your class
   - Complete registration

2. **Taking Exams**
   - Login to student portal
   - View available exams in "Exams & Quizzes" tab
   - Exams automatically become active at scheduled start time
   - Click "Take Exam" when exam is active
   - Answer all questions
   - Timer shows remaining time
   - Click "Submit Exam" when done

3. **Viewing Results**
   - Go to "My Results" tab
   - View all submitted exam results
   - Results show score percentage and correct answers

4. **Accessing Materials**
   - Go to "Course Materials" tab
   - View or download materials uploaded by lecturers

## Technical Details

### Data Storage
- All data is stored in browser localStorage
- Data persists between sessions
- To reset: Clear browser localStorage

### Exam Auto-Start
- Exams automatically become active at scheduled start time
- Timer calculates remaining time from exam start time (not login time)
- If exam starts at 12:00 PM with 100-minute duration:
  - Student logging in at 12:20 PM will see 80 minutes remaining
  - Student logging in at 1:40 PM will see exam has ended

### Browser Compatibility
- Works on all modern browsers (Chrome, Firefox, Edge, Safari)
- Responsive design for mobile and desktop

## File Structure

```
.
├── index.html              # Main portal selection page
├── css/
│   └── style.css          # Main stylesheet
├── js/
│   ├── app.js             # Core application functions
│   ├── init-sample-data.js # Sample data initialization
│   ├── student-auth.js    # Student authentication
│   ├── student-dashboard.js # Student portal logic
│   ├── lecturer-auth.js   # Lecturer authentication
│   ├── lecturer-dashboard.js # Lecturer portal logic
│   ├── admin-auth.js      # Admin authentication
│   └── admin-dashboard.js # Admin portal logic
├── student/
│   ├── login.html
│   ├── register.html
│   └── dashboard.html
├── lecturer/
│   ├── login.html
│   ├── register.html
│   └── dashboard.html
└── admin/
    ├── login.html
    └── dashboard.html
```

## Notes

- This is a client-side only application (no backend server required)
- All data is stored locally in the browser
- For production use, consider implementing a backend server
- Default admin credentials should be changed for security
- Lecturer secret key should be kept confidential
