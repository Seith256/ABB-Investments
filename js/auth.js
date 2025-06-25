// Current user session
let currentUser = JSON.parse(sessionStorage.getItem('aab_currentUser'));
let currentAdmin = JSON.parse(sessionStorage.getItem('aab_currentAdmin'));

// VIP Configuration (unchanged from original)
const VIP_DAILY_PROFITS = [1800, 6000, 10000, 13000, 28000, 60000, 75000, 150000, 400000, 600000];
const VIP_PRICES = [10000, 30000, 50000, 80000, 120000, 240000, 300000, 600000, 1200000, 2000000];

// ======================
// ORIGINAL LOGIN/SIGNUP (UNCHANGED)
// ======================

// Login Form (original code)
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const inviteCode = document.getElementById('login-invite').value || '2233';
        const isAdmin = document.getElementById('login-admin').checked;
        
        if (isAdmin) {
            // Admin login (original)
            const admin = adminDB.find(a => a.email === email && a.password === password);
            if (admin) {
                sessionStorage.setItem('aab_currentAdmin', JSON.stringify(admin));
                window.location.href = 'admin.html';
            } else {
                alert('Invalid admin credentials');
            }
        } else {
            // User login (original)
            const user = usersDB.find(u => u.email === email && u.password === password);
            if (user) {
                // Original invitation code processing
                if (inviteCode && inviteCode !== '2233' && !user.hasUsedInvite) {
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
            } else {
                alert('Invalid email or password');
            }
        }
    });
}

// Signup Form (original code)
if (document.getElementById('signup-form')) {
    document.getElementById('signup-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const phone = document.getElementById('signup-phone').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm').value;
        const inviteCode = document.getElementById('signup-invite').value || '2233';
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        if (usersDB.some(u => u.email === email)) {
            alert('Email already registered');
            return;
        }
        
        // Original user creation
        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            phone,
            password,
            balance: 2000,
            invitationCode: Math.floor(1000 + Math.random() * 9000).toString(),
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
        
        // Original invitation processing
        if (inviteCode && inviteCode !== '2233') {
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
    });
}

// ======================
// NEW FUNCTIONALITY ADDED BELOW
// ======================

// VIP Profit Processing (new)
function processVIPProfit(user) {
    if (!user.vipLevel || !user.vipApprovedDate) return user;

    const now = new Date();
    const vipStartDate = new Date(user.vipApprovedDate);
    const daysCompleted = Math.floor((now - vipStartDate) / (1000 * 60 * 60 * 24));

    // Complete VIP cycle after 60 days
    if (daysCompleted >= 60) {
        user.vipLevel = 0;
        user.dailyProfit = 0;
        alert('VIP cycle completed!');
        return user;
    }

    // Add daily profit
    const today = now.toISOString().split('T')[0];
    const lastProfitDay = user.lastProfitDate ? 
        new Date(user.lastProfitDate).toISOString().split('T')[0] : null;

    if (!lastProfitDay || lastProfitDay !== today) {
        const profit = VIP_DAILY_PROFITS[user.vipLevel - 1] || 0;
        user.balance += profit;
        user.totalEarnings += profit;
        user.lastProfitDate = now.toISOString();
        user.transactions.push({
            type: `VIP ${user.vipLevel} daily profit`,
            amount: profit,
            date: now.toISOString(),
            status: 'completed'
        });
    }

    return user;
}

// Recharge Functionality (new)
function setupRecharge() {
    const rechargeForm = document.getElementById('recharge-form');
    if (!rechargeForm) return;

    rechargeForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const amount = parseInt(document.getElementById('recharge-amount').value);
        const proof = "proof.jpg"; // In real app, handle file upload

        if (amount < 10000) {
            alert('Minimum recharge is UGX 10,000');
            return;
        }

        const userIndex = usersDB.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
            usersDB[userIndex].rechargeRequests.push({
                amount,
                date: new Date().toISOString(),
                status: 'pending',
                proof
            });

            usersDB[userIndex].transactions.push({
                type: 'recharge',
                amount,
                date: new Date().toISOString(),
                status: 'pending'
            });

            localStorage.setItem('aab_users', JSON.stringify(usersDB));
            alert('Recharge request submitted!');
            rechargeForm.reset();
        }
    });
}

// Withdrawal Functionality (new)
function setupWithdrawal() {
    const withdrawForm = document.getElementById('withdraw-form');
    if (!withdrawForm) return;

    withdrawForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const amount = parseInt(document.getElementById('withdraw-amount').value);
        const phone = document.getElementById('withdraw-number').value;
        const network = document.getElementById('withdraw-network').value;

        if (amount < 5000 || amount > 2000000) {
            alert('Amount must be between UGX 5,000 and 2,000,000');
            return;
        }

        if (amount > currentUser.balance) {
            alert('Insufficient balance');
            return;
        }

        const userIndex = usersDB.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
            usersDB[userIndex].withdrawalRequests.push({
                amount,
                phone,
                network,
                date: new Date().toISOString(),
                status: 'pending'
            });

            usersDB[userIndex].transactions.push({
                type: 'withdrawal',
                amount: -amount,
                date: new Date().toISOString(),
                status: 'pending'
            });

            localStorage.setItem('aab_users', JSON.stringify(usersDB));
            alert('Withdrawal request submitted!');
            withdrawForm.reset();
        }
    });
}

// VIP Purchase (new)
function setupVIPPurchase() {
    const confirmBtn = document.getElementById('confirm-vip-btn');
    if (!confirmBtn) return;

    confirmBtn.addEventListener('click', function() {
        const vipLevel = parseInt(document.getElementById('vip-modal-title').textContent.match(/\d+/)[0]);
        const price = VIP_PRICES[vipLevel - 1];

        const userIndex = usersDB.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1 && usersDB[userIndex].balance >= price) {
            usersDB[userIndex].vipRequests.push({
                level: vipLevel,
                amount: price,
                date: new Date().toISOString(),
                status: 'pending'
            });

            usersDB[userIndex].transactions.push({
                type: `VIP ${vipLevel} purchase`,
                amount: -price,
                date: new Date().toISOString(),
                status: 'pending'
            });

            localStorage.setItem('aab_users', JSON.stringify(usersDB));
            alert('VIP purchase requested!');
        } else {
            alert('Insufficient balance');
        }
    });
}

// Admin Approvals (new)
function setupAdminApprovals() {
    // Approve recharge
    document.querySelectorAll('.approve-recharge').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.userId;
            const requestId = this.dataset.requestId;
            
            const userIndex = usersDB.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                const request = usersDB[userIndex].rechargeRequests.find(r => r.id === requestId);
                if (request) {
                    usersDB[userIndex].balance += request.amount;
                    request.status = 'approved';
                    localStorage.setItem('aab_users', JSON.stringify(usersDB));
                    alert('Recharge approved!');
                }
            }
        });
    });

    // Similar implementations for withdrawal and VIP approvals...
}

// Initialize Everything
document.addEventListener('DOMContentLoaded', function() {
    // Original logout setup
    const logoutButtons = document.querySelectorAll('#logout-btn, #admin-logout-btn');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            sessionStorage.removeItem('aab_currentUser');
            sessionStorage.removeItem('aab_currentAdmin');
            window.location.href = 'login.html';
        });
    });

    // Process VIP profits on page load
    if (currentUser && currentUser.vipLevel > 0) {
        currentUser = processVIPProfit(currentUser);
        sessionStorage.setItem('aab_currentUser', JSON.stringify(currentUser));
    }

    // Setup new functionality
    setupRecharge();
    setupWithdrawal();
    setupVIPPurchase();
    
    if (currentAdmin) {
        setupAdminApprovals();
    }
});
