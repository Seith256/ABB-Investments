// JWT Token Management
let authToken = null;
let currentUser = null;

// VIP Configuration (unchanged)
const VIP_DAILY_PROFITS = [1800, 6000, 10000, 13000, 28000, 60000, 75000, 150000, 400000, 600000];
const VIP_PRICES = [10000, 30000, 50000, 80000, 120000, 240000, 300000, 600000, 1200000, 2000000];

// API Configuration
const API_BASE_URL = 'http://localhost:5000/api'; // Update with your backend URL

// Helper Functions
const storeToken = (token) => {
  authToken = token;
  localStorage.setItem('aab_authToken', token);
};

const getToken = () => {
  if (!authToken) {
    authToken = localStorage.getItem('aab_authToken');
  }
  return authToken;
};

const clearAuth = () => {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('aab_authToken');
};

const decodeToken = (token) => {
  try {
    if (!token) return null;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

const fetchWithAuth = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Token expired or invalid
    clearAuth();
    window.location.href = 'login.html';
    return;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};

const loadCurrentUser = async () => {
  try {
    const data = await fetchWithAuth('/users/me');
    currentUser = data.user;
    return currentUser;
  } catch (error) {
    console.error('Failed to load user:', error);
    return null;
  }
};

// ======================
// UPDATED LOGIN/SIGNUP
// ======================

// Login Form
if (document.getElementById('login-form')) {
  document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const inviteCode = document.getElementById('login-invite').value || '2233';
    const isAdmin = document.getElementById('login-admin').checked;
    
    try {
      if (isAdmin) {
        // Admin login
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
          throw new Error('Invalid admin credentials');
        }

        const data = await response.json();
        storeToken(data.token);
        window.location.href = 'admin.html';
      } else {
        // User login
        const response = await fetch(`${API_BASE_URL}/users/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password, inviteCode })
        });

        if (!response.ok) {
          throw new Error('Invalid email or password');
        }

        const data = await response.json();
        storeToken(data.token);
        currentUser = data.user;
        window.location.href = 'index.html';
      }
    } catch (error) {
      alert(error.message);
      console.error('Login error:', error);
    }
  });
}

// Signup Form
if (document.getElementById('signup-form')) {
  document.getElementById('signup-form').addEventListener('submit', async function(e) {
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

    try {
      const response = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, phone, password, inviteCode })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      const data = await response.json();
      storeToken(data.token);
      currentUser = data.user;
      window.location.href = 'index.html';
    } catch (error) {
      alert(error.message);
      console.error('Registration error:', error);
    }
  });
}

// ======================
// UPDATED FUNCTIONALITY
// ======================

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', async function() {
  // Check for existing token
  const token = getToken();
  if (token) {
    const decoded = decodeToken(token);
    if (decoded) {
      currentUser = {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        balance: decoded.balance,
        vipLevel: decoded.vipLevel
      };
      
      // Load full user data if needed
      if (window.location.pathname !== '/login.html') {
        await loadCurrentUser();
      }
    }
  }

  // Logout functionality
  const logoutButtons = document.querySelectorAll('#logout-btn, #admin-logout-btn');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      clearAuth();
      window.location.href = 'login.html';
    });
  });

  // Process VIP profits on page load for authenticated users
  if (currentUser && currentUser.vipLevel > 0) {
    // This is now handled server-side during login
    // We just need to display the updated user data
    await loadCurrentUser();
  }

  // Setup other functionality
  setupRecharge();
  setupWithdrawal();
  setupVIPPurchase();
});

// Recharge Functionality (updated)
function setupRecharge() {
  const rechargeForm = document.getElementById('recharge-form');
  if (!rechargeForm) return;

  rechargeForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const amount = parseInt(document.getElementById('recharge-amount').value);
    const proof = "proof.jpg"; // In real app, handle file upload

    if (amount < 10000) {
      alert('Minimum recharge is UGX 10,000');
      return;
    }

    try {
      const response = await fetchWithAuth('/recharges', {
        method: 'POST',
        body: JSON.stringify({ amount, proof })
      });

      alert('Recharge request submitted!');
      rechargeForm.reset();
      
      // Refresh user data
      await loadCurrentUser();
      updateUI();
    } catch (error) {
      alert(error.message);
      console.error('Recharge error:', error);
    }
  });
}

// Withdrawal Functionality (updated)
function setupWithdrawal() {
  const withdrawForm = document.getElementById('withdraw-form');
  if (!withdrawForm) return;

  withdrawForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    const phone = document.getElementById('withdraw-number').value;
    const network = document.getElementById('withdraw-network').value;

    if (amount < 5000 || amount > 2000000) {
      alert('Amount must be between UGX 5,000 and 2,000,000');
      return;
    }

    try {
      const response = await fetchWithAuth('/withdrawals', {
        method: 'POST',
        body: JSON.stringify({ amount, phone, network })
      });

      alert('Withdrawal request submitted!');
      withdrawForm.reset();
      
      // Refresh user data
      await loadCurrentUser();
      updateUI();
    } catch (error) {
      alert(error.message);
      console.error('Withdrawal error:', error);
    }
  });
}

// VIP Purchase (updated)
function setupVIPPurchase() {
  const confirmBtn = document.getElementById('confirm-vip-btn');
  if (!confirmBtn) return;

  confirmBtn.addEventListener('click', async function() {
    const vipLevel = parseInt(document.getElementById('vip-modal-title').textContent.match(/\d+/)[0]);
    const price = VIP_PRICES[vipLevel - 1];

    try {
      const response = await fetchWithAuth('/vip/purchase', {
        method: 'POST',
        body: JSON.stringify({ vipLevel })
      });

      alert('VIP purchase requested!');
      
      // Refresh user data
      await loadCurrentUser();
      updateUI();
    } catch (error) {
      alert(error.message);
      console.error('VIP purchase error:', error);
    }
  });
}

// Update UI with current user data
function updateUI() {
  if (!currentUser) return;

  // Update balance display
  const balanceElements = document.querySelectorAll('.user-balance');
  balanceElements.forEach(el => {
    el.textContent = currentUser.balance;
  });

  // Update VIP status
  if (currentUser.vipLevel > 0) {
    const vipElements = document.querySelectorAll('.vip-status');
    vipElements.forEach(el => {
      el.textContent = `VIP ${currentUser.vipLevel}`;
    });
  }

  // Update other user-specific UI elements as needed
}
