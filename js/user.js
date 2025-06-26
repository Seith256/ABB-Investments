// user.js
import { authFetch } from './auth.js';

document.addEventListener('DOMContentLoaded', async function () {
    const token = sessionStorage.getItem('aab_user_token');
    if (!token) return;

    try {
        const res = await authFetch('https://abb-backend.onrender.com/api/user/me');
        if (!res.ok) throw new Error('Failed to fetch user data');
        const user = await res.json();

        updateUserUI(user);
        handleVIPProfit(user);
    } catch (err) {
        console.error(err);
    }
});

function updateUserUI(user) {
    const el = id => document.getElementById(id);
    if (!el('user-balance')) return;

    el('user-balance').textContent = `UGX ${user.balance.toLocaleString()}`;
    el('total-earnings').textContent = `UGX ${user.totalEarnings.toLocaleString()}`;
    el('daily-profit').textContent = `UGX ${user.dailyProfit.toLocaleString()}`;
    el('vip-level').textContent = user.vipLevel > 0 ? `VIP ${user.vipLevel}` : 'None';
}

function handleVIPProfit(user) {
    // Logic handled on backend, this displays data only
}