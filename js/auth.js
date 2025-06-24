// Current user session
let currentUser = JSON.parse(sessionStorage.getItem('aab_currentUser'));
let currentAdmin = JSON.parse(sessionStorage.getItem('aab_currentAdmin'));

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('login.html') || 
        window.location.pathname.includes('signup.html')) {
        // If already logged in, redirect to appropriate page
        if (currentUser) {
            window.location.href = 'index.html';
        } else if (currentAdmin) {
            window.location.href = 'admin.html';
        }
    } else if (window.location.pathname.includes('admin.html')) {
        if (!currentAdmin) {
            window.location.href = 'login.html';
        }
    } else if (!window.location.pathname.includes('login.html') && 
               !window.location.pathname.includes('signup.html')) {
        if (!currentUser && !currentAdmin) {
            window.location.href = 'login.html';
        }
    }
});

// Login Form
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const isAdmin = document.getElementById('login-admin').checked;
        
        try {
            if (isAdmin) {
                // Admin login (kept local as per your server doesn't have admin routes)
                if (email === 'admin@aab.com' && password === 'admin123') {
                    sessionStorage.setItem('aab_currentAdmin', JSON.stringify({
                        email: 'admin@aab.com',
                        name: 'Admin'
                    }));
                    window.location.href = 'admin.html';
                } else {
                    alert('Invalid admin credentials');
                }
            } else {
                // User login
                const response = await fetch("https://abb-backend.onrender.com/api/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, password }),
                });
                
                const data = await response.json();
                if (response.ok) {
                    sessionStorage.setItem('aab_currentUser', JSON.stringify({
                        id: data.user._id,
                        name: data.user.username,
                        email: data.user.email,
                        balance: data.user.balance,
                        isVIP: data.user.isVIP,
                        transactions: []
                    }));
                    window.location.href = 'index.html';
                } else {
                    alert(data.message || 'Invalid email or password');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('An error occurred during login');
        }
    });
}

// Signup Form
if (document.getElementById('signup-form')) {
    document.getElementById('signup-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm').value;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        try {
            const response = await fetch("https://abb-backend.onrender.com/api/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ 
                    username: name, 
                    email, 
                    password 
                }),
            });
            
            if (response.ok) {
                const data = await response.json();
                alert('Registration successful! Please login.');
                window.location.href = 'login.html';
            } else {
                const errorData = await response.json();
                alert(errorData.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            alert('An error occurred during registration');
        }
    });
}

// Logout functionality
function setupLogout() {
    const logoutButtons = document.querySelectorAll('#logout-btn, #admin-logout-btn');
    logoutButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                sessionStorage.removeItem('aab_currentUser');
                sessionStorage.removeItem('aab_currentAdmin');
                window.location.href = 'login.html';
            });
        }
    });
}

// Initialize logout buttons when DOM is loaded
document.addEventListener('DOMContentLoaded', setupLogout);
