document.addEventListener('DOMContentLoaded', function() {
    // Existing modal and navigation code remains the same...

    // Check and add daily profit for VIP users
    if (currentUser && currentUser.vipLevel > 0 && currentUser.vipApprovedDate) {
        const now = new Date();
        const lastProfitDate = currentUser.lastProfitDate ? new Date(currentUser.lastProfitDate) : null;
        const vipApprovedDate = new Date(currentUser.vipApprovedDate);
        
        // Calculate days since VIP was approved (floor to whole days)
        const timeDiff = now - vipApprovedDate;
        const daysSinceApproval = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        // Check if 60-day cycle is completed
        if (daysSinceApproval >= 60) {
            if (currentUser.vipLevel > 0) {
                const userIndex = usersDB.findIndex(u => u.id === currentUser.id);
                if (userIndex !== -1) {
                    // Reset VIP status
                    usersDB[userIndex].vipLevel = 0;
                    usersDB[userIndex].dailyProfit = 0;
                    usersDB[userIndex].vipDaysCompleted = 60;
                    localStorage.setItem('aab_users', JSON.stringify(usersDB));
                    
                    // Update current user session
                    currentUser = usersDB[userIndex];
                    sessionStorage.setItem('aab_currentUser', JSON.stringify(currentUser));
                    
                    // Show completion message
                    alert('Your VIP cycle of 60 days has been completed successfully!');
                    
                    // Refresh UI if on index page
                    if (document.getElementById('user-balance')) {
                        window.location.reload();
                    }
                }
            }
            return;
        }
        
        // Check if we should add today's profit
        const today = new Date().toISOString().split('T')[0]; // Get just the date part
        const lastProfitDay = lastProfitDate ? lastProfitDate.toISOString().split('T')[0] : null;
        
        if (!lastProfitDay || lastProfitDay !== today) {
            const userIndex = usersDB.findIndex(u => u.id === currentUser.id);
            if (userIndex !== -1) {
                const profit = currentUser.dailyProfit;
                usersDB[userIndex].balance += profit;
                usersDB[userIndex].totalEarnings += profit;
                usersDB[userIndex].lastProfitDate = now.toISOString();
                usersDB[userIndex].vipDaysCompleted = (usersDB[userIndex].vipDaysCompleted || 0) + 1;
                
                usersDB[userIndex].transactions.push({
                    type: `VIP ${currentUser.vipLevel} daily profit (Day ${usersDB[userIndex].vipDaysCompleted})`,
                    amount: profit,
                    date: now.toISOString(),
                    status: 'completed'
                });
                
                localStorage.setItem('aab_users', JSON.stringify(usersDB));
                
                // Update current user session
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
});