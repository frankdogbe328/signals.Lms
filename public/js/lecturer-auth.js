// Lecturer Authentication

document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize storage first
        if (typeof initializeStorage === 'function') {
            initializeStorage();
        } else {
            console.error('initializeStorage function not found! Make sure app.js is loaded.');
            // Don't return - continue with page setup even if storage init fails
        }
        
        // Ensure course data is initialized
        if (typeof initializeSampleData === 'function') {
            initializeSampleData();
        }
        
        // Check current page with more robust logic for production (Vercel clean URLs)
        const pathname = window.location.pathname;
        const href = window.location.href;
        const registerForm = document.getElementById('registerForm');
        const loginForm = document.getElementById('loginForm');
        
        const isRegisterPage = pathname.includes('register.html') || 
                               pathname.endsWith('/register') || 
                               href.includes('register.html') || 
                               !!registerForm;
                               
        const isLoginPage = pathname.includes('login.html') || 
                            pathname.endsWith('/login') || 
                            href.includes('login.html') || 
                            !!loginForm;
        
        if (isRegisterPage) {
            console.log('Detected Lecturer Registration Page');
            // Small delay to ensure data is loaded
            setTimeout(() => {
                if (typeof loadSubjectsAndClasses === 'function') {
                    loadSubjectsAndClasses();
                }
                if (typeof setupRegistration === 'function') {
                    setupRegistration();
                }
            }, 300);
        } else if (isLoginPage) {
            console.log('Detected Lecturer Login Page');
            // Small delay to ensure all scripts are loaded
            setTimeout(() => {
                if (typeof setupLogin === 'function') {
                    setupLogin();
                } else {
                    console.error('setupLogin function not found');
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error initializing lecturer auth:', error);
        // Don't let errors break the page
    }
});

// Setup login with retry logic
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(setupLogin, 100);
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
    
    // Prevent default form submission via attributes
    newForm.setAttribute('method', 'post');
    newForm.setAttribute('action', 'javascript:void(0);');
    
    // Add new submit listener
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
                body: JSON.stringify({ username, password, type: 'lecturer' })
            });
            const data = await res.json();
            if (!res.ok) {
                showAlert(data.error || 'Invalid username or password', 'error');
                return;
            }
            if (typeof window.setApiToken === 'function') window.setApiToken(data.token);
            setCurrentUser({ ...data.user, type: 'lecturer' });
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
        return;
    }
    
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            const secretKeyElement = document.getElementById('secretKey');
            const enteredKeyRaw = secretKeyElement ? secretKeyElement.value.trim() : '';

            if (!enteredKeyRaw) {
                showAlert('Please enter a registration key', 'error');
                return;
            }

            // Key is validated server-side on submit — skip client-side check
            const isUniqueMatch = false;
            const isTokenMatch = true; // Let server decide
            const preCreatedLecturer = null;
            const users = { lecturers: [] };
            
            
            const rank = document.getElementById('rank').value.trim();
            const fullName = document.getElementById('fullName').value.trim();
            const username = document.getElementById('username').value.trim();
            const telephone = document.getElementById('telephone').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            
            if (!rank) {
                showAlert('Please enter your rank', 'error');
                return;
            }
            
            // Get subjects from checkboxes or select
            let subjects = [];
            const subjectCheckboxes = document.querySelectorAll('#subjectsContainer input[type="checkbox"]:checked');
            if (subjectCheckboxes.length > 0) {
                subjects = Array.from(subjectCheckboxes).map(cb => cb.value);
            } else {
                const subjectsSelect = document.getElementById('subjects');
                if (subjectsSelect) {
                    subjects = Array.from(subjectsSelect.selectedOptions).map(opt => opt.value);
                }
            }
            
            // Get classes from checkboxes or select
            let classes = [];
            const classCheckboxes = document.querySelectorAll('#classesContainer input[type="checkbox"]:checked');
            if (classCheckboxes.length > 0) {
                classes = Array.from(classCheckboxes).map(cb => cb.value);
            } else {
                const classesSelect = document.getElementById('classes');
                if (classesSelect) {
                    classes = Array.from(classesSelect.selectedOptions).map(opt => opt.value);
                }
            }
            
            
            if (password !== confirmPassword) {
                showAlert('Passwords do not match', 'error');
                return;
            }
            
            if (!telephone) {
                showAlert('Please enter your telephone number', 'error');
                return;
            }
            
            if (subjects.length === 0 || subjects.includes('')) {
                showAlert('Please select at least one subject', 'error');
                return;
            }
            
            if (classes.length === 0 || classes.includes('')) {
                showAlert('Please select at least one class', 'error');
                return;
            }
            
            // Users already fetched above
            
            // Check if username or email already exists
            if (users.lecturers.some(l => l.username === username || l.email === email)) {
                showAlert('Username or email already exists', 'error');
                return;
            }
            
            // Validate all fields
            if (!fullName || !username || !email || !password) {
                showAlert('Please fill in all required fields', 'error');
                return;
            }
            
            let lecturerToSave;
            if (isUniqueMatch) {
                // Update existing pre-created lecturer
                lecturerToSave = {
                    ...preCreatedLecturer,
                    rank,
                    fullName,
                    username,
                    telephone,
                    email,
                    password,
                    subjects: subjects.filter(s => s !== ''),
                    classes: classes.filter(c => c !== ''),
                    registeredAt: new Date().toISOString(),
                    type: 'lecturer'
                };
            } else {
                // Create new lecturer from scratch (token match)
                lecturerToSave = {
                    id: Date.now().toString(),
                    rank,
                    fullName,
                    username,
                    telephone,
                    email,
                    password,
                    subjects: subjects.filter(s => s !== ''),
                    classes: classes.filter(c => c !== ''),
                    registeredAt: new Date().toISOString(),
                    type: 'lecturer',
                    registrationKey: enteredKeyRaw
                };
            }
            
            // Save to Supabase or localStorage
            if (typeof saveUser === 'function') {
                try {
                    await saveUser(lecturerToSave);
                } catch (error) {
                    showAlert(error.message || 'Registration failed. Please try again.', 'error');
                    return;
                }
            } else {
                if (isUniqueMatch) {
                    const idx = users.lecturers.findIndex(l => l.id === preCreatedLecturer.id);
                    users.lecturers[idx] = lecturerToSave;
                } else {
                    users.lecturers.push(lecturerToSave);
                }
                saveData('lms_users', users);
            }

            // Consume registration token if used
            if (isTokenMatch) {
                try {
                    await deleteRegistrationKey(enteredKeyRaw);
                    console.log('Registration token consumed successfully');
                } catch (error) {
                    console.error('Error consuming token:', error);
                }
            }
            
            showAlert('Registration successful! Redirecting to login...', 'success');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            
        } catch (error) {
            showAlert('Registration failed: ' + (error.message || 'Unknown error'), 'error');
        }
        });
        
        // Also add click handler to button as backup (using ID for reliability)
        const submitButton = document.getElementById('register-btn') || form.querySelector('button[type="submit"]');
        if (submitButton) {
            
            // Remove any existing onclick handlers
            submitButton.onclick = null;
            
            // Add click handler
            submitButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                // Trigger form submit
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                form.dispatchEvent(submitEvent);
            });
        } else {
        }
        
        // Test form validation
        
}

// Global variables for selection modal
let currentSelectionType = null;
let tempSelectedItems = [];

// Toggle selection modal
window.toggleSelectionModal = function(type) {
    currentSelectionType = type;
    const modal = document.getElementById('selectionModal');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    
    if (!modal || !modalContent) return;
    
    // Get current selections
    const checkboxes = type === 'subjects' 
        ? document.querySelectorAll('#subjectsContainer input[type="checkbox"]:checked')
        : document.querySelectorAll('#classesContainer input[type="checkbox"]:checked');
    tempSelectedItems = Array.from(checkboxes).map(cb => cb.value);
    
    // Set title
    modalTitle.textContent = type === 'subjects' ? 'Select Subjects' : 'Select Classes';
    
    // Load items into modal
    const container = type === 'subjects' ? document.getElementById('subjectsContainer') : document.getElementById('classesContainer');
    if (container) {
        modalContent.innerHTML = container.innerHTML;
        
        // Restore checked state
        tempSelectedItems.forEach(item => {
            const checkbox = modalContent.querySelector(`input[value="${item}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
};

// Close selection modal
window.closeSelectionModal = function() {
    const modal = document.getElementById('selectionModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    currentSelectionType = null;
    tempSelectedItems = [];
};

// Confirm selection
window.confirmSelection = function() {
    if (!currentSelectionType) return;
    
    const modalContent = document.getElementById('modal-content');
    const checkboxes = modalContent.querySelectorAll('input[type="checkbox"]:checked');
    const selected = Array.from(checkboxes).map(cb => cb.value);
    
    // Update hidden containers
    const container = currentSelectionType === 'subjects' 
        ? document.getElementById('subjectsContainer')
        : document.getElementById('classesContainer');
    
    if (container) {
        // Update checkboxes in hidden container
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = selected.includes(cb.value);
        });
    }
    
    // Update hidden select
    const select = currentSelectionType === 'subjects'
        ? document.getElementById('subjects')
        : document.getElementById('classes');
    
    if (select) {
        Array.from(select.options).forEach(opt => {
            opt.selected = selected.includes(opt.value);
        });
    }
    
    // Update display
    updateSelectionDisplay(currentSelectionType, selected);
    
    // Close modal
    closeSelectionModal();
};

// Update selection display
function updateSelectionDisplay(type, selected) {
    const display = type === 'subjects' 
        ? document.getElementById('subjects-display')
        : document.getElementById('classes-display');
    const selectedDiv = type === 'subjects'
        ? document.getElementById('selected-subjects')
        : document.getElementById('selected-classes');
    
    if (display) {
        if (selected.length === 0) {
            display.textContent = type === 'subjects' ? 'Click to select subjects' : 'Click to select classes';
        } else if (selected.length === 1) {
            display.textContent = selected[0];
        } else {
            display.textContent = `${selected.length} ${type === 'subjects' ? 'subjects' : 'classes'} selected`;
        }
    }
    
    if (selectedDiv && selected.length > 0) {
        selectedDiv.innerHTML = selected.map(item => 
            `<span style="display: inline-block; background: var(--primary-color); color: white; padding: 4px 10px; border-radius: 4px; margin: 4px; font-size: 0.85rem;">${item}</span>`
        ).join('');
    } else if (selectedDiv) {
        selectedDiv.innerHTML = '';
    }
}

async function loadSubjectsAndClasses() {
    // Ensure initialization runs first
    if (typeof initializeSampleData === 'function') {
        initializeSampleData();
    }
    
    let courses = [];
    let classes = [];
    
    if (typeof getCourses === 'function') {
        try {
            courses = await getCourses();
        } catch (error) {
            courses = getData('lms_courses') || [];
        }
    } else {
        courses = getData('lms_courses') || [];
    }
    
    if (typeof getClasses === 'function') {
        try {
            classes = await getClasses();
        } catch (error) {
            classes = getData('lms_classes') || [];
        }
    } else {
        classes = getData('lms_classes') || [];
    }
    
    const subjectsSelect = document.getElementById('subjects');
    const classesSelect = document.getElementById('classes');
    const subjectsContainer = document.getElementById('subjectsContainer');
    const classesContainer = document.getElementById('classesContainer');
    
    // Clear existing options
    if (subjectsSelect) {
        subjectsSelect.innerHTML = '<option value="">-- Select Subjects --</option>';
    }
    if (subjectsContainer) {
        subjectsContainer.innerHTML = '';
    }
    if (classesSelect) {
        classesSelect.innerHTML = '<option value="">-- Select Classes --</option>';
    }
    if (classesContainer) {
        classesContainer.innerHTML = '';
    }
    
    // Load subjects - get unique subjects from all courses
    if (courses && courses.length > 0) {
        const uniqueSubjects = [...new Set(courses.map(c => c.subject))].sort();
        
        uniqueSubjects.forEach(subject => {
            // Add to hidden select
            if (subjectsSelect) {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                subjectsSelect.appendChild(option);
            }
            
            // Add to checkbox group (hidden, used for modal)
            if (subjectsContainer) {
                const checkboxItem = document.createElement('div');
                checkboxItem.className = 'checkbox-item';
                const safeId = subject.replace(/[^a-zA-Z0-9]/g, '_');
                checkboxItem.innerHTML = `
                    <input type="checkbox" id="subject_${safeId}" value="${subject}">
                    <label for="subject_${safeId}">${subject}</label>
                `;
                subjectsContainer.appendChild(checkboxItem);
            }
        });
    } else {
        if (subjectsContainer) {
            subjectsContainer.innerHTML = '<p style="color: var(--text-light); padding: 15px;">No subjects available. Please contact admin.</p>';
        }
    }
    
    // Load classes - sorted alphabetically
    if (classes && classes.length > 0) {
        const sortedClasses = [...classes].sort((a, b) => a.name.localeCompare(b.name));
        
        sortedClasses.forEach(cls => {
            // Add to hidden select
            if (classesSelect) {
                const option = document.createElement('option');
                option.value = cls.name;
                option.textContent = cls.name;
                classesSelect.appendChild(option);
            }
            
            // Add to checkbox group (hidden, used for modal)
            if (classesContainer) {
                const checkboxItem = document.createElement('div');
                checkboxItem.className = 'checkbox-item';
                const safeId = cls.name.replace(/[^a-zA-Z0-9]/g, '_');
                checkboxItem.innerHTML = `
                    <input type="checkbox" id="class_${safeId}" value="${cls.name}">
                    <label for="class_${safeId}">${cls.name}</label>
                `;
                classesContainer.appendChild(checkboxItem);
            }
        });
    } else {
        if (classesContainer) {
            classesContainer.innerHTML = '<p style="color: var(--text-light); padding: 15px;">No classes available. Please contact admin.</p>';
        }
    }
    
    // Initialize displays
    updateSelectionDisplay('subjects', []);
    updateSelectionDisplay('classes', []);
}

// Make functions globally accessible for inline event handlers
window.updateSubjectSelection = function() {
    const checkboxes = document.querySelectorAll('#subjectsContainer input[type="checkbox"]');
    const select = document.getElementById('subjects');
    
    if (!select) return;
    
    Array.from(select.options).forEach(opt => opt.selected = false);
    
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const option = Array.from(select.options).find(opt => opt.value === checkbox.value);
            if (option) option.selected = true;
            const checkboxItem = checkbox.closest('.checkbox-item');
            if (checkboxItem) checkboxItem.classList.add('checked');
        } else {
            const checkboxItem = checkbox.closest('.checkbox-item');
            if (checkboxItem) checkboxItem.classList.remove('checked');
        }
    });
};

window.updateClassSelectionReg = function() {
    const checkboxes = document.querySelectorAll('#classesContainer input[type="checkbox"]');
    const select = document.getElementById('classes');
    
    if (!select) return;
    
    Array.from(select.options).forEach(opt => opt.selected = false);
    
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const option = Array.from(select.options).find(opt => opt.value === checkbox.value);
            if (option) option.selected = true;
            const checkboxItem = checkbox.closest('.checkbox-item');
            if (checkboxItem) checkboxItem.classList.add('checked');
        } else {
            const checkboxItem = checkbox.closest('.checkbox-item');
            if (checkboxItem) checkboxItem.classList.remove('checked');
        }
    });
};

function showAlert(message, type) {
    const container = document.getElementById('alert-container');
    if (!container) {
        // Fallback to browser alert
        alert(message);
        return;
    }
    
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
                    users = getData('lms_users') || { lecturers: [] };
                }
            } else {
                users = getData('lms_users') || { lecturers: [] };
            }
            
            const lecturer = users.lecturers.find(l => 
                (l.username === username || l.email === username)
            );
            
            if (!lecturer) {
                alertContainer.innerHTML = '<div class="alert alert-error">User not found. Please check your username or email.</div>';
                return;
            }
            
            // Verify telephone number
            if (lecturer.telephone !== telephone) {
                alertContainer.innerHTML = '<div class="alert alert-error">Telephone number does not match. Please try again.</div>';
                return;
            }
            
            // Reset password - use Supabase or localStorage
            if (typeof updateUser === 'function') {
                try {
                    await updateUser(lecturer.id, 'lecturer', { password: newPassword });
                } catch (error) {
                    console.warn('Supabase updateUser failed, using localStorage:', error);
                    lecturer.password = newPassword;
                    saveData('lms_users', users);
                }
            } else {
                lecturer.password = newPassword;
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