const API_BASE = 'https://abb-backend.onrender.com';
const JWT_KEY  = 'aab_token';
const USER_KEY = 'aab_currentUser';
const DEFAULT_INVITE_CODE = '2233';

// Helper to store session
function setSession(token, user) {
  sessionStorage.setItem(JWT_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(JWT_KEY, token);  // Store token in localStorage
  localStorage.setItem(USER_KEY, JSON.stringify(user));  // Store user data in localStorage
}

// Helper to send user data to the admin panel (or a monitoring system)
async function sendUserDataToAdminPanel(user) {
  try {
    const res = await fetch(API_BASE + '/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    console.log('User data sent to admin panel');
  } catch (err) {
    console.error('Error sending user data to admin panel:', err.message);
  }
}

// ======================
// ORIGINAL LOGIN/SIGNUP (UPDATED)
// ======================

// Login Form (Updated Code)
if (document.getElementById('login-form')) {
  document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const inviteCode = document.getElementById('login-invite').value || DEFAULT_INVITE_CODE;
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
      // User login (Updated Code - Send data to MongoDB and Admin Panel)
      fetch(API_BASE + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);

          // Send user data to admin panel
          await sendUserDataToAdminPanel(data.user);

          // Set session and redirect to index page
          setSession(data.token, data.user);
          window.location.href = 'index.html';
        })
        .catch((err) => {
          alert(err.message || 'Login failed');
        });
    }
  });
}

// Signup Form (Updated Code)
if (document.getElementById('signup-form')) {
  document.getElementById('signup-form').addEventListener('submit', function (e) {
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

    // Check if the email is already taken
    fetch(API_BASE + '/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, email, password, phone, inviteCode }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        // Original invitation processing (Updated)
        if (inviteCode && inviteCode !== '2233') {
          const inviter = await fetch(API_BASE + '/api/user?referralCode=' + inviteCode)
            .then((response) => response.json())
            .then((data) => data.user);

          if (inviter) {
            inviter.balance += 2000;  // Inviter bonus
            inviter.referralEarnings += 2000;
            inviter.transactions.push({
              type: 'referral',
              amount: 2000,
              status: 'approved',
              details: { referredUser: data.user.email },
            });
            // Save inviter to MongoDB
            await fetch(API_BASE + '/api/user/' + inviter._id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(inviter),
            });
          }
          
          // Set referral info for the new user
          data.user.referredBy = inviter._id;
          data.user.referralEarnings = 2000;
          data.user.transactions.push({
            type: 'bonus',
            amount: 2000,
            status: 'approved',
            details: { description: 'Signup referral bonus' },
          });
        }

        // Send user data to admin panel after successful signup
        await sendUserDataToAdminPanel(data.user);

        // Set session and redirect to index page
        setSession(data.token, data.user);
        window.location.href = 'index.html';
      })
      .catch((err) => {
        alert(err.message || 'Signup failed');
      });
  });
}

// LOGOUT
function setupLogout() {
  document.querySelectorAll('#logout-btn, #admin-logout-btn').forEach((btn) => {
    btn?.addEventListener('click', () => {
      sessionStorage.clear();
      localStorage.clear();  // Clear localStorage as well
      location.href = 'login.html';
    });
  });
}

document.addEventListener('DOMContentLoaded', setupLogout);
