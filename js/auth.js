// ======================
// Configuration
// ======================
const API_BASE_URL = "https://abb-backend.onrender.com/api";
const DEFAULT_INVITE_CODE = '2233';
const ADMIN_EMAIL = "admin@aab.com"; // Default admin email (fallback)
const VIP_DAILY_PROFITS = [1800, 6000, 10000, 13000, 28000, 60000, 75000, 150000, 400000, 600000];
const VIP_PRICES = [10000, 30000, 50000, 80000, 120000, 240000, 300000, 600000, 1200000, 2000000];

// ======================
// Database Initialization
// ======================
const usersDB = JSON.parse(localStorage.getItem('aab_users')) || [];
const adminDB = JSON.parse(localStorage.getItem('aab_admin')) || [
    { 
        email: ADMIN_EMAIL, 
        password: 'admin123', 
        name: 'Admin',
        permissions: ['full'],
        lastLogin: null
    }
];

// Initialize default admin if not exists
if (!localStorage.getItem('aab_admin')) {
    localStorage.setItem('aab_admin', JSON.stringify(adminDB));
}

// Current session
let currentUser = JSON.parse(sessionStorage.getItem('aab_currentUser'));
let currentAdmin = JSON.parse(sessionStorage.getItem('aab_currentAdmin'));

// ======================
// Authentication Functions
// ======================

/**
 * Authenticate admin (tries backend first, falls back to local)
 */
async function authenticateAdmin(email, password) {
    try {
        // Try backend authentication first
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            return {
                ...data.admin,
                isAuthenticated: true,
                authSource: 'backend',
                token: data.token
            };
        }
    } catch (error) {
        console.warn("Backend admin auth failed, trying local:", error);
    }

    // Fallback to local authentication
    const admin = adminDB.find(a => a.email === email && a.password === password);
    return admin 
        ? { ...admin, isAuthenticated: true, authSource: 'local' }
        : { isAuthenticated: false, error: "Invalid credentials" };
}

/**
 * Authenticate user (backend only)
 */
async function authenticateUser(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Login failed");
        }

        return await response.json();
    } catch (error) {
        console.error("User auth failed:", error);
        throw error;
    }
}

/**
 * Register new user
 */
async function registerUser(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Registration failed");
        }

        return await response.json();
    } catch (error) {
        console.error("Registration failed:", error);
        throw error;
    }
}

// ======================
// Session Management
// ======================

function startUserSession(user) {
    const userSession = {
        id: user._id || user.id,
        name: user.username || user.name,
        email: user.email,
        phone: user.phone || '',
        balance: user.balance || 2000, // Default welcome bonus
        vipLevel: user.vipLevel || 0,
        dailyProfit: VIP_DAILY_PROFITS[user.vipLevel] || 0,
        lastProfitDate: user.lastProfitDate || null,
        vipApprovedDate: user.vipApprovedDate || null,
        transactions: user.transactions || [
            {
                type: 'bonus',
                amount: 2000,
                date: new Date().toISOString(),
                status: 'completed'
            }
        ]
    };

    sessionStorage.setItem('aab_currentUser', JSON.stringify(userSession));
    return userSession;
}

function startAdminSession(admin, token = null) {
    const adminSession = {
        email: admin.email,
        name: admin.name,
        permissions: admin.permissions || ['basic'],
        lastLogin: new Date().toISOString(),
        authSource: admin.authSource,
        token
    };

    if (token) {
        sessionStorage.setItem('admin_token', token);
    }
    sessionStorage.setItem('aab_currentAdmin', JSON.stringify(adminSession));
    return adminSession;
}

function endSession() {
    sessionStorage.removeItem('aab_currentUser');
    sessionStorage.removeItem('aab_currentAdmin');
    sessionStorage.removeItem('admin_token');
}

// ======================
// VIP Management
// ======================

function processVIPDailyProfit(user) {
    if (!user.vipLevel || !user.vipApprovedDate) return user;

    const now = new Date();
    const vipStartDate = new Date(user.vipApprovedDate);
    const daysCompleted = Math.floor((now - vipStartDate) / (1000 * 60 * 60 * 24));

    // Check if cycle completed
    if (daysCompleted >= 60) {
        user.vipLevel = 0;
        user.dailyProfit = 0;
        alert('Your VIP cycle of 60 days has been completed successfully!');
        return user;
    }

    // Add daily profit if needed
    const today = now.toISOString().split('T')[0];
    const lastProfitDay = user.lastProfitDate 
        ? new Date(user.lastProfitDate).toISOString().split('T')[0] 
        : null;

    if (!lastProfitDay || lastProfitDay !== today) {
        const profit = VIP_DAILY_PROFITS[user.vipLevel - 1] || 0;
        user.balance += profit;
        user.lastProfitDate = now.toISOString();
        user.transactions.push({
            type: `VIP ${user.vipLevel} daily profit (Day ${daysCompleted + 1}/60)`,
            amount: profit,
            date: now.toISOString(),
            status: 'completed'
        });
    }

    return user;
}

// ======================
// Form Handlers
// ======================

// Login Form
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const isAdmin = document.getElementById('login-admin').checked;

        try {
            if (isAdmin) {
                // Admin login flow
                const authResult = await authenticateAdmin(email, password);
                
                if (!authResult.isAuthenticated) {
                    throw new Error(authResult.error || "Admin authentication failed");
                }

                currentAdmin = startAdminSession(authResult, authResult.token);
                window.location.href = 'admin.html';
            } else {
                // User login flow
                const authResult = await authenticateUser(email, password);
                currentUser = startUserSession(authResult.user);
                
                // Process local user data
                const localUser = usersDB.find(u => u.email === email) || {
                    ...currentUser,
                    invitationCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
                    referrals: [],
                    rechargeRequests: [],
                    withdrawalRequests: [],
                    vipRequests: []
                };
                
                if (!usersDB.some(u => u.email === email)) {
                    usersDB.push(localUser);
                    localStorage.setItem('aab_users', JSON.stringify(usersDB));
                }

                // Process VIP status if applicable
                if (currentUser.vipLevel > 0) {
                    currentUser = processVIPDailyProfit(currentUser);
                    sessionStorage.setItem('aab_currentUser', JSON.stringify(currentUser));
                }

                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error("Login error:", error);
            alert(error.message || "Authentication failed");
        }
    });
}

// Signup Form
if (document.getElementById('signup-form')) {
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userData = {
            username: document.getElementById('signup-name').value,
            email: document.getElementById('signup-email').value,
            phone: document.getElementById('signup-phone').value,
            password: document.getElementById('signup-password').value
        };

        if (userData.password !== document.getElementById('signup-confirm').value) {
            alert("Passwords don't match");
            return;
        }

        try {
            // Register with backend
            const result = await registerUser(userData);
            
            // Create local user record
            const newUser = {
                ...result.user,
                balance: 2000, // Welcome bonus
                invitationCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
                transactions: [
                    {
                        type: 'bonus',
                        amount: 2000,
                        date: new Date().toISOString(),
                        status: 'completed'
                    }
                ],
                referrals: [],
                rechargeRequests: [],
                withdrawalRequests: [],
                vipRequests: []
            };

            usersDB.push(newUser);
            localStorage.setItem('aab_users', JSON.stringify(usersDB));
            
            // Start session
            currentUser = startUserSession(newUser);
            alert("Registration successful!");
            window.location.href = 'index.html';

        } catch (error) {
            console.error("Signup error:", error);
            alert(error.message || "Registration failed");
        }
    });
}

// ======================
// Admin Approval Functions
// ======================

async function approveRequest(type, userId, requestId) {
    if (!currentAdmin) {
        alert("Admin session expired");
        window.location.href = 'admin-login.html';
        return;
    }

    try {
        // Update locally
        const userIndex = usersDB.findIndex(u => u.id === userId);
        if (userIndex === -1) throw new Error("User not found");

        const requestArray = `${type}Requests`;
        const requestIndex = usersDB[userIndex][requestArray].findIndex(r => r.id === requestId);
        if (requestIndex === -1) throw new Error("Request not found");

        // Process based on type
        switch (type) {
            case 'recharge':
                usersDB[userIndex].balance += usersDB[userIndex][requestArray][requestIndex].amount;
                break;
                
            case 'withdrawal':
                usersDB[userIndex].balance -= usersDB[userIndex][requestArray][requestIndex].amount;
                break;
                
            case 'vip':
                const vipLevel = usersDB[userIndex][requestArray][requestIndex].level;
                usersDB[userIndex].vipLevel = vipLevel;
                usersDB[userIndex].dailyProfit = VIP_DAILY_PROFITS[vipLevel - 1];
                usersDB[userIndex].vipApprovedDate = new Date().toISOString();
                break;
        }

        usersDB[userIndex][requestArray][requestIndex].status = 'approved';

        // Sync with backend
        try {
            await fetch(`${API_BASE_URL}/${type}/approve`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${sessionStorage.getItem('admin_token')}`
                },
                body: JSON.stringify({ userId, requestId })
            });
        } catch (syncError) {
            console.warn("Backend sync failed, proceeding locally");
        }

        localStorage.setItem('aab_users', JSON.stringify(usersDB));
        return { success: true, user: usersDB[userIndex] };

    } catch (error) {
        console.error(`Approval failed (${type}):`, error);
        return { success: false, error: error.message };
    }
}

// ======================
// Initialization
// ======================

function initAuth() {
    // Check authentication state on page load
    if (window.location.pathname.includes('admin') && !currentAdmin) {
        window.location.href = 'login.html';
        return;
    }

    if (!window.location.pathname.includes('login') && 
        !window.location.pathname.includes('signup') && 
        !currentUser && !currentAdmin) {
        window.location.href = 'login.html';
        return;
    }

    // Process VIP profits if user is VIP
    if (currentUser?.vipLevel > 0) {
        currentUser = processVIPDailyProfit(currentUser);
        sessionStorage.setItem('aab_currentUser', JSON.stringify(currentUser));
        
        // Check every hour for VIP updates
        setInterval(() => {
            currentUser = processVIPDailyProfit(JSON.parse(sessionStorage.getItem('aab_currentUser')));
            sessionStorage.setItem('aab_currentUser', JSON.stringify(currentUser));
        }, 3600000);
    }
}

// Logout functionality
function setupLogout() {
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            endSession();
            window.location.href = 'login.html';
        });
    });
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    setupLogout();
});

// In auth.js login/signup functions:
try {
  const response = await fetch(/* ... */);
  
  // Check if response is JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Invalid response: ${text.slice(0, 100)}`);
  }

  const data = await response.json();
  // ... rest of your code
} catch (error) {
  console.error('Request failed:', error);
  alert(`Request failed: ${error.message}`);
}
