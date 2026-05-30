// Student Authentication

document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');

    const pathname = window.location.pathname;
    const href = window.location.href;

    const isRegisterPage = pathname.includes('register') || href.includes('register') || !!registerForm;
    const isLoginPage = pathname.includes('login') || href.includes('login') || !!loginForm;

    if (isRegisterPage) {
        loadClasses();
        setupRegistration();
    } else if (isLoginPage) {
        setupLogin();
    }
});


function setupLogin() {
    const form = document.getElementById('loginForm');
    if (!form) {
        console.error('Login form not found');
        setTimeout(setupLogin, 200);
        return;
    }
    
    // Check required functions
    if (typeof getData === 'undefined' || typeof setCurrentUser === 'undefined') {
        console.error('Required functions (getData, setCurrentUser) not available');
        setTimeout(setupLogin, 200);
        return;
    }

    // Remove existing event listeners by cloning the form
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    newForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showAlert('Please enter both username and password', 'error');
            return;
        }

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, type: 'student' })
            });
            const data = await res.json();
            if (!res.ok) {
                showAlert(data.error || 'Invalid username or password', 'error');
                return;
            }
            if (typeof window.setApiToken === 'function') window.setApiToken(data.token);
            setCurrentUser({ ...data.user, type: 'student' });
            showAlert('Login successful! Redirecting...', 'success');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
        } catch (error) {
            console.error('Login error:', error);
            showAlert('An error occurred during login. Please try again.', 'error');
        }
    });
}

function setupRegistration() {
    const form = document.getElementById('registerForm');
    if (!form) {
        console.error('Registration form not found');
        return;
    }
    
    // Check if required functions are available
    if (typeof getData !== 'function' || typeof saveData !== 'function') {
        console.error('Required functions (getData/saveData) not found. Make sure app.js is loaded.');
        return;
    }
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            const rank = document.getElementById('rank').value.trim();
            const fullName = document.getElementById('fullName').value.trim();
            const username = document.getElementById('username').value.trim();
            const telephone = document.getElementById('telephone').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const studentClass = document.getElementById('class').value;
            
            if (!rank) {
                showAlert('Please enter your rank', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showAlert('Passwords do not match', 'error');
                return;
            }
            
            if (!studentClass) {
                showAlert('Please select a class', 'error');
                return;
            }

            if (!telephone) {
                showAlert('Please enter your telephone number', 'error');
                return;
            }

            const selectedCourses = Array.from(
                document.querySelectorAll('input[name="subjects"]:checked')
            ).map(cb => cb.value);

            const coursesAvailable = document.querySelectorAll('input[name="subjects"]').length > 0;
            if (coursesAvailable && selectedCourses.length === 0) {
                showAlert('Please select at least one course', 'error');
                return;
            }

            const newStudent = {
                rank,
                fullName,
                username,
                telephone,
                email,
                password,
                class: studentClass,
                subjects: selectedCourses,
                type: 'student'
            };

            await saveUser(newStudent);

            showAlert('Registration successful! Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } catch (error) {
            console.error('Registration error:', error);
            showAlert(error.message || 'An error occurred during registration. Please try again.', 'error');
        }
    });
}

async function loadClasses() {
    const select = document.getElementById('class');
    if (!select) return;

    select.innerHTML = '<option value="">-- Loading Classes --</option>';

    try {
        const response = await fetch('/api/classes');
        if (!response.ok) throw new Error('Failed to load classes');
        const classes = await response.json();

        select.innerHTML = '<option value="">-- Select Class --</option>';

        if (!classes || classes.length === 0) {
            select.innerHTML = '<option value="">No classes available</option>';
            return;
        }

        classes
            .filter(cls => cls && cls.name)
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.name;
                option.textContent = cls.name;
                select.appendChild(option);
            });

        select.addEventListener('change', function() {
            const selectedClass = this.value;
            if (selectedClass) {
                loadSubjectsForClass(selectedClass);
            } else {
                const group = document.getElementById('subjectsGroup');
                const container = document.getElementById('subjectsContainer');
                if (group) group.style.display = 'none';
                if (container) container.innerHTML = '';
            }
        });
    } catch (err) {
        console.error('loadClasses error:', err);
        select.innerHTML = '<option value="">Could not load classes — check connection</option>';
    }
}

async function loadSubjectsForClass(className) {
    const group = document.getElementById('subjectsGroup');
    const container = document.getElementById('subjectsContainer');
    if (!group || !container) return;

    container.innerHTML = '<span style="color:var(--text-light,#6b7280);font-size:0.9rem;">Loading courses...</span>';
    group.style.display = 'block';

    try {
        const response = await fetch('/api/courses');
        if (!response.ok) throw new Error('Failed to load courses');
        const courses = await response.json();

        const subjects = [...new Set(
            courses
                .filter(c => c && c.class === className && c.subject)
                .map(c => c.subject)
        )].sort();

        if (subjects.length === 0) {
            container.innerHTML = '<span style="color:var(--text-light,#6b7280);font-size:0.9rem;">No courses found for this class</span>';
            return;
        }

        container.innerHTML = '';
        subjects.forEach(subject => {
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--border-color,#e5e7eb);border-radius:6px;cursor:pointer;font-size:0.85rem;background:var(--card-bg,#fff);';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.name = 'subjects';
            cb.value = subject;
            cb.style.accentColor = 'var(--primary-color,#2563eb)';
            label.appendChild(cb);
            label.appendChild(document.createTextNode(' ' + subject));
            container.appendChild(label);
        });
    } catch (err) {
        console.error('loadSubjectsForClass error:', err);
        container.innerHTML = '<span style="color:#dc2626;font-size:0.9rem;">Could not load subjects</span>';
    }
}

function showAlert(message, type) {
    const container = document.getElementById('alert-container');
    if (!container) return;
    
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Forgot Password Functionality
window.showForgotPassword = function() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        document.getElementById('forgotPasswordForm').reset();
        document.getElementById('forgot-password-alert').innerHTML = '';
    }
};

window.closeForgotPassword = function() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('forgotPasswordForm').reset();
        document.getElementById('forgot-password-alert').innerHTML = '';
    }
};

// Setup forgot password form
document.addEventListener('DOMContentLoaded', function() {
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('resetUsername').value.trim();
            const telephone = document.getElementById('resetTelephone').value.trim();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;
            const alertContainer = document.getElementById('forgot-password-alert');
            
            // Validation
            if (!username) {
                alertContainer.innerHTML = '<div class="alert alert-error">Please enter your username or email</div>';
                return;
            }
            
            if (!telephone) {
                alertContainer.innerHTML = '<div class="alert alert-error">Please enter your telephone number</div>';
                return;
            }
            
            if (newPassword.length < 6) {
                alertContainer.innerHTML = '<div class="alert alert-error">Password must be at least 6 characters long</div>';
                return;
            }
            
            if (newPassword !== confirmPassword) {
                alertContainer.innerHTML = '<div class="alert alert-error">Passwords do not match</div>';
                return;
            }
            
            // Find user and verify
            let users = {};
            if (typeof getUsers === 'function') {
                try {
                    users = await getUsers();
                } catch (error) {
                    users = getData('lms_users') || { students: [] };
                }
            } else {
                users = getData('lms_users') || { students: [] };
            }
            
            const student = users.students.find(s => 
                (s.username === username || s.email === username)
            );
            
            if (!student) {
                alertContainer.innerHTML = '<div class="alert alert-error">User not found. Please check your username or email.</div>';
                return;
            }
            
            // Verify telephone number
            if (student.telephone !== telephone) {
                alertContainer.innerHTML = '<div class="alert alert-error">Telephone number does not match. Please try again.</div>';
                return;
            }
            
            // Reset password
            student.password = newPassword;
            
            // Update in Supabase or localStorage
            if (typeof updateUser === 'function') {
                try {
                    await updateUser(student.id, 'student', { password: newPassword });
                } catch (error) {
                    console.warn('Supabase updateUser failed, using localStorage:', error);
                    saveData('lms_users', users);
                }
            } else {
                saveData('lms_users', users);
            }
            
            alertContainer.innerHTML = '<div class="alert alert-success">Password reset successfully! Redirecting to login...</div>';
            
            setTimeout(() => {
                closeForgotPassword();
                showAlert('Password reset successfully! You can now login with your new password.', 'success');
            }, 2000);
        });
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        window.onclick = function(event) {
            if (event.target === modal) {
                closeForgotPassword();
            }
        };
    }
});