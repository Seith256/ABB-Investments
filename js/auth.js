// Simulated database
const usersDB = JSON.parse(localStorage.getItem('aab_users')) || [];
const adminDB = JSON.parse(localStorage.getItem('aab_admin')) || [
    { email: 'admin@aab.com', password: 'admin123', name: 'Admin' }
];
const DEFAULT_INVITE_CODE = '2233';

// Initialize default admin if not exists
if (!localStorage.getItem('aab_admin')) {
    localStorage.setItem('aab_admin', JSON.stringify(adminDB));
}

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
    document.getElementById('login-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const inviteCode = document.getElementById('login-invite').value || DEFAULT_INVITE_CODE;
        const isAdmin = document.getElementById('login-admin').checked;
        
        if (isAdmin) {
            // Admin login
            const admin = adminDB.find(a => a.email === email && a.password === password);
            if (admin) {
                sessionStorage.setItem('aab_currentAdmin', JSON.stringify(admin));
                window.location.href = 'admin.html';
            } else {
                alert('Invalid admin credentials');
            }
        } else {
            // User login
            const user = usersDB.find(u => u.email === email && u.password === password);
            if (user) {
                // Process invitation if this is first login with code
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
                        
                        // Save changes
                        localStorage.setItem('aab_users', JSON.stringify(usersDB));
                    }
                }
                
                sessionStorage.setItem('aab_currentUser', JSON.stringify(user));
                window.location.href = 'index.html';
            } else {
                alert('Invalid email or password');
            }
        }
    });
}

// Signup Form
if (document.getElementById('signup-form')) {
    document.getElementById('signup-form').addEventListener('submit', function(e) {
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
        
        if (usersDB.some(u => u.email === email)) {
            alert('Email already registered');
            return;
        }
        
        // Generate unique invitation code
        let invitationCode;
        do {
            invitationCode = Math.floor(1000 + Math.random() * 9000).toString();
        } while (usersDB.some(u => u.invitationCode === invitationCode));
        
        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            phone,
            password,
            balance: 2000, // Welcome bonus
            invitationCode,
            invitedBy: null,
            hasUsedInvite: false,
            vipLevel: 0,
            dailyProfit: 0,
            totalEarnings: 0,
            referralEarnings: 0,
            referrals: [],
            transactions: [
                {
                    type: 'bonus',
                    amount: 2000,
                    date: new Date().toISOString(),
                    status: 'completed'
                }
            ],
            rechargeRequests: [],
            withdrawalRequests: [],
            vipRequests: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Process invitation if code is provided and not default
if (inviteCode && inviteCode !== DEFAULT_INVITE_CODE) {
    const inviter = usersDB.find(u => u.invitationCode === inviteCode);
    if (inviter) {
        newUser.invitedBy = inviter.email;
        newUser.hasUsedInvite = true;
        // Removed immediate 2000 bonus
        inviter.referrals.push({
            email: newUser.email,
            date: new Date().toISOString(),
            bonus: 0 // No immediate bonus
        });
    }
}
        
        usersDB.push(newUser);
        localStorage.setItem('aab_users', JSON.stringify(usersDB));
        
        sessionStorage.setItem('aab_currentUser', JSON.stringify(newUser));
        window.location.href = 'index.html';
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

