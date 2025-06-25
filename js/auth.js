const DEFAULT_INVITE_CODE = '2233';
const API_BASE = 'https://abb-backend.onrender.com';

// Load session
let currentUser = JSON.parse(sessionStorage.getItem('aab_currentUser'));
let currentAdmin = JSON.parse(sessionStorage.getItem('aab_currentAdmin'));

// Admin login fallback
const adminDB = [
  { email: 'admin@aab.com', password: 'admin123', name: 'Admin' }
];

// Admin login
if (document.getElementById('login-form')) {
  document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const inviteCode = document.getElementById('login-invite').value || DEFAULT_INVITE_CODE;
    const isAdmin = document.getElementById('login-admin').checked;

    try {
      if (isAdmin) {
        const admin = adminDB.find(a => a.email === email && a.password === password);
        if (!admin) throw new Error('Invalid admin credentials');
        sessionStorage.setItem('aab_currentAdmin', JSON.stringify(admin));
        return window.location.href = 'admin.html';
      }

      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Login failed');
      }

      const { token, user } = await res.json();
      sessionStorage.setItem('aab_token', token);
      sessionStorage.setItem('aab_currentUser', JSON.stringify(user));
      window.location.href = 'index.html';
    } catch (err) {
      alert(err.message || 'Login failed');
    }
  });
}

// Signup
if (document.getElementById('signup-form')) {
  document.getElementById('signup-form').addEventListener('submit', async function (e) {
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
      const res = await fetch(`${API_BASE}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: name,
          email,
          password,
          phone,
          inviteCode
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Signup failed');
      }

      const { token, user } = await res.json();
      sessionStorage.setItem('aab_token', token);
      sessionStorage.setItem('aab_currentUser', JSON.stringify(user));
      window.location.href = 'index.html';
    } catch (err) {
      alert(err.message || 'Signup failed');
    }
  });
}

// Logout
function setupLogout() {
  const logoutButtons = document.querySelectorAll('#logout-btn, #admin-logout-btn');
  logoutButtons.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        sessionStorage.removeItem('aab_currentUser');
        sessionStorage.removeItem('aab_currentAdmin');
        sessionStorage.removeItem('aab_token');
        window.location.href = 'login.html';
      });
    }
  });
}
document.addEventListener('DOMContentLoaded', setupLogout);
