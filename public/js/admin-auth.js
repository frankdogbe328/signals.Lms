// Admin Authentication

document.addEventListener('DOMContentLoaded', function() {
    // Ensure storage is initialized
    if (typeof initializeStorage === 'function') {
        initializeStorage();
    } else {
        // Retry after a short delay if function not available
        setTimeout(() => {
            if (typeof initializeStorage === 'function') {
                initializeStorage();
            } else {
                console.error('initializeStorage function not found');
            }
        }, 100);
    }
    
    // Setup login with retry logic
    setTimeout(() => {
        setupLogin();
    }, 100);
});

function setupLogin() {
    const form = document.getElementById('loginForm');
    if (!form) {
        console.error('Login form not found');
        // Retry after delay
        setTimeout(() => {
            setupLogin();
        }, 200);
        return;
    }
    
    // Remove existing event listeners by cloning the form
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // Check if required functions are available
    if (typeof getData === 'undefined' || typeof setCurrentUser === 'undefined') {
        console.error('Required functions (getData, setCurrentUser) not available');
        // Retry after delay
        setTimeout(() => {
            setupLogin();
        }, 200);
        return;
    }
    
    newForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        
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
                body: JSON.stringify({ username, password, type: 'admin' })
            });
            const data = await res.json();
            if (!res.ok) {
                showAlert(data.error || 'Invalid username or password', 'error');
                return;
            }
            if (typeof window.setApiToken === 'function') window.setApiToken(data.token);
            setCurrentUser({ ...data.user, type: 'admin' });
            showAlert('Login successful! Redirecting...', 'success');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
        } catch (error) {
            console.error('Login error:', error);
            showAlert('An error occurred during login. Please try again.', 'error');
        }
    });
}

function showAlert(message, type) {
    const container = document.getElementById('alert-container');
    if (!container) return;
    
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}
