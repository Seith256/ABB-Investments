// Database simulation (unchanged)
const usersDB = JSON.parse(localStorage.getItem('aab_users')) || [];
const adminDB = JSON.parse(localStorage.getItem('aab_admin')) || [
    { email: 'admin@aab.com', password: 'admin123', name: 'Admin' }
];
const DEFAULT_INVITE_CODE = '2233';

// Initialize default admin (unchanged)
if (!localStorage.getItem('aab_admin')) {
    localStorage.setItem('aab_admin', JSON.stringify(adminDB));
}

// Current user session (unchanged)
let currentUser = JSON.parse(sessionStorage.getItem('aab_currentUser'));
let currentAdmin = JSON.parse(sessionStorage.getItem('aab_currentAdmin'));

// Check login status (unchanged)
document.addEventListener('DOMContentLoaded', function() {
    // ... (keep existing redirect logic)
});

// Enhanced Login Form
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const inviteCode = document.getElementById('login-invite').value || DEFAULT_INVITE_CODE;
        const isAdmin = document.getElementById('login-admin').checked;
        
        try {
            if (isAdmin) {
                // Admin login (unchanged local version)
                const admin = adminDB.find(a => a.email === email && a.password === password);
                if (admin) {
                    sessionStorage.setItem('aab_currentAdmin', JSON.stringify(admin));
                    window.location.href = 'admin.html';
                    return;
                }
                throw new Error('Invalid admin credentials');
            }

            // User login - verify with backend but use local data
            const authResponse = await fetch("https://abb-backend.onrender.com/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (!authResponse.ok) {
                throw new Error('Invalid email or password');
            }

            // Find or create local user record
            let user = usersDB.find(u => u.email === email);
            if (!user) {
                // Create new user with all original fields
                user = {
                    id: Date.now().toString(),
                    name: email.split('@')[0], // Default name
                    email,
                    phone: '',
                    password, // Note: Only stored locally
                    balance: 2000, // Welcome bonus
                    invitationCode: Math.floor(1000 + Math.random() * 9000).toString(),
                    invitedBy: null,
                    hasUsedInvite: false,
                    vipLevel: 0,
                    dailyProfit: 0,
                    totalEarnings: 0,
                    referralEarnings: 0,
                    referrals: [],
                    transactions: [{
                        type: 'bonus',
                        amount: 2000,
                        date: new Date().toISOString(),
                        status: 'completed'
                    }],
                    rechargeRequests: [],
                    withdrawalRequests: [],
                    vipRequests: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                usersDB.push(user);
                localStorage.setItem('aab_users', JSON.stringify(usersDB));
            }

            // Process invitation code (original logic)
            if (inviteCode && inviteCode !== DEFAULT_INVITE_CODE && !user.hasUsedInvite) {
                const inviter = usersDB.find(u => u.invitationCode === inviteCode);
                if (inviter) {
                    inviter.balance += 2000;
                    inviter.referralEarnings += 2000;
                    inviter.referrals.push({
                        email: user.email,
                        date: new Date().toISOString(),
                        bonus: 2000
                    });
                    user.invitedBy = inviter.email;
                    user.hasUsedInvite = true;
                    localStorage.setItem('aab_users', JSON.stringify(usersDB));
                }
            }

            sessionStorage.setItem('aab_currentUser', JSON.stringify(user));
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Login error:', error);
            alert(error.message || 'Login failed');
        }
    });
}

// Enhanced Signup Form
if (document.getElementById('signup-form')) {
    document.getElementById('signup-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const phone = document.getElementById('signup-phone').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm').value;
        const inviteCode = document.getElementById('signup-invite').value || DEFAULT_INVITE_CODE;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        try {
            // Register with backend
            const authResponse = await fetch("https://abb-backend.onrender.com/api/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: name, email, password, phone }),
            });

            if (!authResponse.ok) {
                const errorData = await authResponse.json();
                throw new Error(errorData.message || 'Registration failed');
            }

            // Create complete local user record
            const newUser = {
                id: Date.now().toString(),
                name,
                email,
                phone,
                password, // Stored locally only
                balance: 2000, // Welcome bonus
                invitationCode: Math.floor(1000 + Math.random() * 9000).toString(),
                invitedBy: null,
                hasUsedInvite: false,
                vipLevel: 0,
                dailyProfit: 0,
                totalEarnings: 0,
                referralEarnings: 0,
                referrals: [],
                transactions: [{
                    type: 'bonus',
                    amount: 2000,
                    date: new Date().toISOString(),
                    status: 'completed'
                }],
                rechargeRequests: [],
                withdrawalRequests: [],
                vipRequests: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Process invitation code
            if (inviteCode && inviteCode !== DEFAULT_INVITE_CODE) {
                const inviter = usersDB.find(u => u.invitationCode === inviteCode);
                if (inviter) {
                    newUser.invitedBy = inviter.email;
                    newUser.hasUsedInvite = true;
                    inviter.referrals.push({
                        email: newUser.email,
                        date: new Date().toISOString(),
                        bonus: 0
                    });
                }
            }

            usersDB.push(newUser);
            localStorage.setItem('aab_users', JSON.stringify(usersDB));
            sessionStorage.setItem('aab_currentUser', JSON.stringify(newUser));
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Signup error:', error);
            alert(error.message || 'Registration failed');
        }
    });
}

// Logout functionality (unchanged)
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

// Initialize (unchanged)
document.addEventListener('DOMContentLoaded', setupLogout);
