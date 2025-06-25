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
    
    // Check and process VIP cycles for logged in users
    if (currentUser && currentUser.vipLevel > 0) {
        checkVIPCycle(currentUser);
    }
});

// VIP Cycle Management
function checkVIPCycle(user) {
    if (!user.vipApprovedDate) return;
    
    const now = new Date();
    const vipStartDate = new Date(user.vipApprovedDate);
    const daysCompleted = Math.floor((now - vipStartDate) / (1000 * 60 * 60 * 24));
    
    // Check if cycle completed
    if (daysCompleted >= 60) {
        const userIndex = usersDB.findIndex(u => u.id === user.id);
        if (userIndex !== -1) {
            usersDB[userIndex].vipLevel = 0;
            usersDB[userIndex].dailyProfit = 0;
            usersDB[userIndex].vipDaysCompleted = 60;
            localStorage.setItem('aab_users', JSON.stringify(usersDB));
            
            // Update session if current user
            if (currentUser && currentUser.id === user.id) {
                currentUser = usersDB[userIndex];
                sessionStorage.setItem('aab_currentUser', JSON.stringify(currentUser));
                alert('Your VIP cycle of 60 days has been completed successfully!');
            }
        }
        return;
    }
    
    // Add daily profit if needed
    const today = now.toISOString().split('T')[0];
    const lastProfitDay = user.lastProfitDate ? new Date(user.lastProfitDate).toISOString().split('T')[0] : null;
    
    if (!lastProfitDay || lastProfitDay !== today) {
        const userIndex = usersDB.findIndex(u => u.id === user.id);
        if (userIndex !== -1) {
            const profit = usersDB[userIndex].dailyProfit;
            usersDB[userIndex].balance += profit;
            usersDB[userIndex].totalEarnings += profit;
            usersDB[userIndex].lastProfitDate = now.toISOString();
            usersDB[userIndex].vipDaysCompleted = (usersDB[userIndex].vipDaysCompleted || 0) + 1;
            
            usersDB[userIndex].transactions.push({
                type: `VIP ${usersDB[userIndex].vipLevel} daily profit (Day ${usersDB[userIndex].vipDaysCompleted}/60)`,
                amount: profit,
                date: now.toISOString(),
                status: 'completed'
            });
            
            localStorage.setItem('aab_users', JSON.stringify(usersDB));
            
            // Update session if current user
            if (currentUser && currentUser.id === user.id) {
                currentUser = usersDB[userIndex];
                sessionStorage.setItem('aab_currentUser', JSON.stringify(currentUser));
                
                // Update UI if on index page
                if (document.getElementById('user-balance')) {
                    document.getElementById('user-balance').textContent = `UGX ${currentUser.balance.toLocaleString()}`;
                    document.getElementById('total-earnings').textContent = `UGX ${currentUser.totalEarnings.toLocaleString()}`;
                }
            }
        }
    }
}

// Enhanced Recharge Functionality
function setupRecharge() {
    const rechargeBtn = document.getElementById('recharge-btn');
    const rechargeForm = document.getElementById('recharge-form');
    
    if (rechargeBtn) {
        rechargeBtn.addEventListener('click', function() {
            document.getElementById('recharge-modal').classList.remove('modal-hidden');
        });
    }
    
    if (rechargeForm) {
        rechargeForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const amount = parseInt(document.getElementById('recharge-amount').value);
            const proof = document.getElementById('recharge-proof').files[0];
            
            if (amount < 10000) {
                alert('Minimum recharge amount is UGX 10,000');
                return;
            }
            
            if (!proof) {
                alert('Please upload payment proof');
                return;
            }
            
            try {
                // Create local recharge request
                const userIndex = usersDB.findIndex(u => u.id === currentUser.id);
                if (userIndex !== -1) {
                    const rechargeRequest = {
                        amount,
                        date: new Date().toISOString(),
                        status: 'pending',
                        proof: proof.name
                    };
                    
                    usersDB[userIndex].rechargeRequests.push(rechargeRequest);
                    usersDB[userIndex].transactions.push({
                        type: 'recharge',
                        amount,
                        date: new Date().toISOString(),
                        status: 'pending'
                    });
                    
                    localStorage.setItem('aab_users', JSON.stringify(usersDB));
                    
                    // Optional: Send to backend
                    try {
                        const formData = new FormData();
                        formData.append('amount', amount);
                        formData.append('proof', proof);
                        formData.append('userId', currentUser.id);
                        
                        await fetch("https://abb-backend.onrender.com/api/recharges", {
                            method: "POST",
                            body: formData
                        });
                    } catch (backendError) {
                        console.log('Backend recharge sync failed, using local only');
                    }
                    
                    // Update current user
                    currentUser = usersDB[userIndex];
                    sessionStorage.setItem('aab_currentUser', JSON.stringify(currentUser));
                    
                    alert('Recharge request submitted for approval');
                    document.getElementById('recharge-modal').classList.add('modal-hidden');
                    this.reset();
                }
            } catch (error) {
                console.error('Recharge error:', error);
                alert('Error submitting recharge request');
            }
        });
    }
}

// Enhanced Withdrawal Functionality
function setupWithdrawal() {
    const withdrawBtn = document.getElementById('withdraw-btn');
    const withdrawForm = document.getElementById('withdraw-form');
    
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', function() {
            document.getElementById('withdraw-modal').classList.remove('modal-hidden');
        });
    }
    
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const amount = parseInt(document.getElementById('withdraw-amount').value);
            const phone = document.getElementById('withdraw-number').value;
            const network = document.getElementById('withdraw-network').value;
            
            if (amount < 5000 || amount > 2000000) {
                alert('Withdrawal amount must be between UGX 5,000 and UGX 2,000,000');
                return;
            }
            
            if (amount > currentUser.balance) {
                alert('Insufficient balance for this withdrawal');
                return;
            }
            
            try {
                // Create local withdrawal request
                const userIndex = usersDB.findIndex(u => u.id === currentUser.id);
                if (userIndex !== -1) {
                    const withdrawalRequest = {
                        amount,
                        phone,
                        network,
                        date: new Date().toISOString(),
                        status: 'pending'
                    };
                    
                    usersDB[userIndex].withdrawalRequests.push(withdrawalRequest);
                    usersDB[userIndex].transactions.push({
                        type: 'withdrawal',
                        amount: -amount,
                        date: new Date().toISOString(),
                        status: 'pending'
                    });
                    
                    localStorage.setItem('aab_users', JSON.stringify(usersDB));
                    
                    // Optional: Send to backend
                    try {
                        await fetch("https://abb-backend.onrender.com/api/withdrawals", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                userId: currentUser.id,
                                amount,
                                phone,
                                network
                            }),
                        });
                    } catch (backendError) {
                        console.log('Backend withdrawal sync failed, using local only');
                    }
                    
                    // Update current user
                    currentUser = usersDB[userIndex];
                    sessionStorage.setItem('aab_currentUser', JSON.stringify(currentUser));
                    
                    alert('Withdrawal request submitted for approval');
                    document.getElementById('withdraw-modal').classList.add('modal-hidden');
                    this.reset();
                }
            } catch (error) {
                console.error('Withdrawal error:', error);
                alert('Error submitting withdrawal request');
            }
        });
    }
}

// Enhanced VIP Purchase Functionality
function setupVIPPurchase() {
    const confirmVIPBtn = document.getElementById('confirm-vip-btn');
    
    if (confirmVIPBtn) {
        confirmVIPBtn.addEventListener('click', async function() {
            const modalTitle = document.getElementById('vip-modal-title').textContent;
            const vipLevel = parseInt(modalTitle.replace('Upgrade to VIP ', ''));
            const prices = [10000, 30000, 50000, 80000, 120000, 240000, 300000, 600000, 1200000, 2000000];
            const dailyProfits = [1800, 6000, 10000, 13000, 28000, 60000, 75000, 150000, 400000, 600000];
            const price = prices[vipLevel - 1];
            
            try {
                // Create local VIP request
                const userIndex = usersDB.findIndex(u => u.id === currentUser.id);
                if (userIndex !== -1 && usersDB[userIndex].balance >= price) {
                    const vipRequest = {
                        level: vipLevel,
                        amount: price,
                        date: new Date().toISOString(),
                        status: 'pending',
                        daysRemaining: 60
                    };
                    
                    usersDB[userIndex].vipRequests.push(vipRequest);
                    usersDB[userIndex].transactions.push({
                        type: `VIP ${vipLevel} purchase`,
                        amount: -price,
                        date: new Date().toISOString(),
                        status: 'pending'
                    });
                    
                    localStorage.setItem('aab_users', JSON.stringify(usersDB));
                    
                    // Optional: Send to backend
                    try {
                        await fetch("https://abb-backend.onrender.com/api/vip/purchase", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                userId: currentUser.id,
                                vipLevel
                            }),
                        });
                    } catch (backendError) {
                        console.log('Backend VIP sync failed, using local only');
                    }
                    
                    // Update current user
                    currentUser = usersDB[userIndex];
                    sessionStorage.setItem('aab_currentUser', JSON.stringify(currentUser));
                    
                    alert(`VIP ${vipLevel} purchase request submitted for approval.`);
                    document.getElementById('vip-modal').classList.add('modal-hidden');
                    
                    if (window.location.pathname.includes('products.html')) {
                        window.location.reload();
                    }
                } else {
                    alert('Insufficient balance. Please recharge your account.');
                }
            } catch (error) {
                console.error('VIP purchase error:', error);
                alert('Error submitting VIP purchase');
            }
        });
    }
}

// Admin Approval Functions (unchanged but ensure they work with local data)
function approveRecharge(userId, date) {
    const userIndex = usersDB.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        const requestIndex = usersDB[userIndex].rechargeRequests.findIndex(r => 
            new Date(r.date).getTime() === new Date(date).getTime());
        
        if (requestIndex !== -1 && usersDB[userIndex].rechargeRequests[requestIndex].status === 'pending') {
            const rechargeAmount = usersDB[userIndex].rechargeRequests[requestIndex].amount;
            
            // Update request status
            usersDB[userIndex].rechargeRequests[requestIndex].status = 'approved';
            
            // Update user balance
            usersDB[userIndex].balance += rechargeAmount;
            
            // Update transaction status
            const txnIndex = usersDB[userIndex].transactions.findIndex(t => 
                t.type === 'recharge' && 
                t.amount === rechargeAmount && 
                t.status === 'pending');
            
            if (txnIndex !== -1) {
                usersDB[userIndex].transactions[txnIndex].status = 'completed';
            }
            
            // Process referral bonus if applicable
            if (usersDB[userIndex].invitedBy) {
                const inviter = usersDB.find(u => u.email === usersDB[userIndex].invitedBy);
                if (inviter) {
                    const inviterIndex = usersDB.indexOf(inviter);
                    const referralBonus = Math.floor(rechargeAmount * 0.15); // 15% of recharge
                    
                    // Update inviter's balance and records
                    usersDB[inviterIndex].balance += referralBonus;
                    usersDB[inviterIndex].referralEarnings += referralBonus;
                    
                    // Find and update the specific referral record
                    const referralIndex = usersDB[inviterIndex].referrals.findIndex(r => 
                        r.email === usersDB[userIndex].email);
                    
                    if (referralIndex !== -1) {
                        usersDB[inviterIndex].referrals[referralIndex].bonus += referralBonus;
                        usersDB[inviterIndex].referrals[referralIndex].lastBonusDate = new Date().toISOString();
                    }
                    
                    // Add transaction for inviter
                    usersDB[inviterIndex].transactions.push({
                        type: `Referral bonus from ${usersDB[userIndex].email}`,
                        amount: referralBonus,
                        date: new Date().toISOString(),
                        status: 'completed'
                    });
                }
            }
            
            localStorage.setItem('aab_users', JSON.stringify(usersDB));
            alert('Recharge approved successfully');
            
            // Optional: Sync with backend
            try {
                fetch("https://abb-backend.onrender.com/api/recharges/approve", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        userId,
                        date,
                        amount: rechargeAmount
                    }),
                });
            } catch (error) {
                console.log('Backend sync failed for recharge approval');
            }
        } else {
            alert('Recharge request has already been processed');
        }
    }
}

// Similar approveWithdrawal, approveVIP, reject* functions would be implemented here
// Following the same pattern as approveRecharge above

// Initialize all functionality
document.addEventListener('DOMContentLoaded', function() {
    setupLogout();
    setupRecharge();
    setupWithdrawal();
    setupVIPPurchase();
    
    // Check VIP cycle every minute
    if (currentUser && currentUser.vipLevel > 0) {
        setInterval(() => checkVIPCycle(currentUser), 60000);
    }
});
