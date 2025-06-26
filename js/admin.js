// admin.js
import { authFetch } from '.js/auth.js';

document.addEventListener('DOMContentLoaded', async function () {
    const token = sessionStorage.getItem('aab_admin_token');
    if (!token) return;

    try {
        const [usersRes, withdrawRes, rechargeRes, vipRes] = await Promise.all([
            authFetch('https://abb-backend.onrender.com/api/users'),
            authFetch('https://abb-backend.onrender.com/api/withdraw'),
            authFetch('https://abb-backend.onrender.com/api/recharge'),
            authFetch('https://abb-backend.onrender.com/api/vip-requests')
        ]);

        const [users, withdrawals, recharges, vipRequests] = await Promise.all([
            usersRes.json(),
            withdrawRes.json(),
            rechargeRes.json(),
            vipRes.json()
        ]);

        renderAdminData({ users, withdrawals, recharges, vipRequests });
    } catch (err) {
        console.error('Admin data load error:', err);
    }
});

function renderAdminData(data) {
    // Render into admin.html table elements
}
