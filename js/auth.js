// Current user session
let currentUser = JSON.parse(sessionStorage.getItem('aab_currentUser'));
let currentAdmin = JSON.parse(sessionStorage.getItem('aab_currentAdmin'));

// Check login status (unchanged)
document.addEventListener('DOMContentLoaded', function() {
    // ... (keep existing redirect logic)
});

// Login Form - Fixed Version
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const isAdmin = document.getElementById('login-admin').checked;

        console.log('Login attempt:', {email, password, isAdmin}); // Debug log
        
        try {
            if (isAdmin) {
                // Admin login (local fallback)
                if (email === 'admin@aab.com' && password === 'admin123') {
                    sessionStorage.setItem('aab_currentAdmin', JSON.stringify({
                        email: 'admin@aab.com',
                        name: 'Admin'
                    }));
                    window.location.href = 'admin.html';
                    return;
                }
                throw new Error('Invalid admin credentials');
            }

            // User login
            const response = await fetch("https://abb-backend.onrender.com/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            console.log('Login response:', response); // Debug log
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Login failed');
            }

            const data = await response.json();
            console.log('Login data:', data); // Debug log

            if (!data.user) {
                throw new Error('User data missing in response');
            }

            // Map backend response to frontend expected format
            const userData = {
                id: data.user._id || Date.now().toString(),
                name: data.user.username || 'New User',
                email: data.user.email,
                phone: data.user.phone || '',
                balance: data.user.balance || 0,
                isVIP: data.user.isVIP || false,
                vipLevel: data.user.isVIP ? 1 : 0,
                dailyProfit: 0,
                transactions: [],
                invitationCode: data.user.invitationCode || Math.random().toString(36).substr(2, 8),
                referrals: []
            };

            sessionStorage.setItem('aab_currentUser', JSON.stringify(userData));
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Login error:', error);
            alert(error.message || 'Login failed. Please try again.');
        }
    });
}

// Signup Form - Fixed Version
if (document.getElementById('signup-form')) {
    document.getElementById('signup-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const phone = document.getElementById('signup-phone').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm').value;

        console.log('Signup attempt:', {username, email, phone}); // Debug log
        
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
                    username, 
                    email, 
                    password,
                    phone 
                }),
            });

            console.log('Signup response:', response); // Debug log
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Registration failed');
            }

            const data = await response.json();
            console.log('Signup data:', data); // Debug log

            // Create complete user object for frontend
            const newUser = {
                id: data.user?._id || Date.now().toString(),
                name: data.user?.username || username,
                email: data.user?.email || email,
                phone: data.user?.phone || phone,
                balance: 2000, // Initial bonus
                isVIP: false,
                vipLevel: 0,
                dailyProfit: 0,
                transactions: [{
                    type: 'bonus',
                    amount: 2000,
                    date: new Date().toISOString(),
                    status: 'completed'
                }],
                invitationCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
                referrals: []
            };

            sessionStorage.setItem('aab_currentUser', JSON.stringify(newUser));
            alert('Registration successful!');
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Signup error:', error);
            alert(error.message || 'Registration failed. Please try again.');
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
