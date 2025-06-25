require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// VIP Configuration (matches client-side)
const VIP_DAILY_PROFITS = [1800, 6000, 10000, 13000, 28000, 60000, 75000, 150000, 400000, 600000];
const VIP_PRICES = [10000, 30000, 50000, 80000, 120000, 240000, 300000, 600000, 1200000, 2000000];

// User Schema (matches client-side structure)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  balance: { type: Number, default: 2000 },
  invitationCode: { type: String, default: () => Math.floor(1000 + Math.random() * 9000).toString() },
  invitedBy: String,
  hasUsedInvite: { type: Boolean, default: false },
  vipLevel: { type: Number, default: 0 },
  dailyProfit: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 },
  referrals: [{
    email: String,
    date: { type: Date, default: Date.now },
    bonus: Number
  }],
  transactions: [{
    type: String,
    amount: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'completed' }
  }],
  rechargeRequests: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' },
    proof: String
  }],
  withdrawalRequests: [{
    amount: Number,
    phone: String,
    network: String,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' }
  }],
  vipRequests: [{
    level: Number,
    amount: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' }
  }],
  vipApprovedDate: Date,
  lastProfitDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Admin Schema
const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, default: 'Admin' }
});

// Models
const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);

// Helper Functions
const generateToken = (user, isAdmin = false) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      isAdmin,
      name: user.name,
      balance: user.balance,
      vipLevel: user.vipLevel
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
};

// Initialize Default Admin
const initAdmin = async () => {
  const adminExists = await Admin.findOne({ email: 'admin@aab.com' });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({
      email: 'admin@aab.com',
      password: hashedPassword,
      name: 'Admin'
    });
    console.log('Default admin created');
  }
};

// Routes

// Admin Login (matches client-side)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = generateToken(admin, true);
    res.json({
      message: 'Admin login successful',
      admin: {
        email: admin.email,
        name: admin.name
      },
      token
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User Registration (matches client-side)
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, phone, password, inviteCode = '2233' } = req.body;
    
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      balance: 2000,
      transactions: [{
        type: 'bonus',
        amount: 2000,
        status: 'completed'
      }]
    });

    // Process invitation
    if (inviteCode && inviteCode !== '2233') {
      const inviter = await User.findOne({ invitationCode: inviteCode });
      if (inviter) {
        newUser.invitedBy = inviter.email;
        newUser.hasUsedInvite = true;
        
        inviter.referrals.push({
          email: newUser.email,
          bonus: 0
        });
        await inviter.save();
      }
    }

    await newUser.save();
    
    const token = generateToken(newUser);
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        balance: newUser.balance,
        vipLevel: newUser.vipLevel
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// User Login (matches client-side)
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password, inviteCode = '2233' } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Process invitation code
    if (inviteCode && inviteCode !== '2233' && !user.hasUsedInvite) {
      const inviter = await User.findOne({ invitationCode: inviteCode });
      if (inviter) {
        inviter.balance += 2000;
        inviter.referralEarnings += 2000;
        inviter.referrals.push({
          email: user.email,
          bonus: 2000,
          date: new Date()
        });
        await inviter.save();
        
        user.invitedBy = inviter.email;
        user.hasUsedInvite = true;
        await user.save();
      }
    }

    // Process VIP daily profit
    if (user.vipLevel > 0 && user.vipApprovedDate) {
      const now = new Date();
      const vipStartDate = new Date(user.vipApprovedDate);
      const daysCompleted = Math.floor((now - vipStartDate) / (1000 * 60 * 60 * 24));

      // Complete VIP cycle after 60 days
      if (daysCompleted >= 60) {
        user.vipLevel = 0;
        user.dailyProfit = 0;
        await user.save();
      } else {
        // Add daily profit if not already added today
        const today = now.toISOString().split('T')[0];
        const lastProfitDay = user.lastProfitDate ? 
          new Date(user.lastProfitDate).toISOString().split('T')[0] : null;

        if (!lastProfitDay || lastProfitDay !== today) {
          const profit = VIP_DAILY_PROFITS[user.vipLevel - 1] || 0;
          user.balance += profit;
          user.totalEarnings += profit;
          user.lastProfitDate = now;
          user.transactions.push({
            type: `VIP ${user.vipLevel} daily profit`,
            amount: profit,
            status: 'completed'
          });
          await user.save();
        }
      }
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        vipLevel: user.vipLevel,
        dailyProfit: user.dailyProfit
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Middleware to verify tokens
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token' });
  }
};

// Protected Routes

// Get User Data
app.get('/api/users/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        balance: user.balance,
        vipLevel: user.vipLevel,
        dailyProfit: user.dailyProfit,
        totalEarnings: user.totalEarnings,
        referralEarnings: user.referralEarnings,
        invitationCode: user.invitationCode,
        invitedBy: user.invitedBy,
        transactions: user.transactions,
        referrals: user.referrals
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user data' });
  }
});

// Recharge Request (matches client-side)
app.post('/api/recharges', verifyToken, async (req, res) => {
  try {
    const { amount, proof = "proof.jpg" } = req.body;
    if (amount < 10000) {
      return res.status(400).json({ message: 'Minimum recharge is UGX 10,000' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.rechargeRequests.push({
      amount,
      proof,
      status: 'pending'
    });

    user.transactions.push({
      type: 'recharge',
      amount,
      status: 'pending'
    });

    await user.save();
    res.json({ 
      message: 'Recharge request submitted!',
      user: {
        balance: user.balance,
        transactions: user.transactions
      }
    });
  } catch (error) {
    console.error('Recharge error:', error);
    res.status(500).json({ message: 'Recharge failed' });
  }
});

// Withdrawal Request (matches client-side)
app.post('/api/withdrawals', verifyToken, async (req, res) => {
  try {
    const { amount, phone, network } = req.body;
    if (amount < 5000 || amount > 2000000) {
      return res.status(400).json({ message: 'Amount must be between UGX 5,000 and 2,000,000' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.withdrawalRequests.push({
      amount,
      phone,
      network,
      status: 'pending'
    });

    user.transactions.push({
      type: 'withdrawal',
      amount: -amount,
      status: 'pending'
    });

    await user.save();
    res.json({ 
      message: 'Withdrawal request submitted!',
      user: {
        balance: user.balance,
        transactions: user.transactions
      }
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ message: 'Withdrawal failed' });
  }
});

// VIP Purchase (matches client-side)
app.post('/api/vip/purchase', verifyToken, async (req, res) => {
  try {
    const { vipLevel } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const price = VIP_PRICES[vipLevel - 1];
    if (!price) return res.status(400).json({ message: 'Invalid VIP level' });
    if (user.balance < price) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.vipRequests.push({
      level: vipLevel,
      amount: price,
      status: 'pending'
    });

    user.transactions.push({
      type: `VIP ${vipLevel} purchase`,
      amount: -price,
      status: 'pending'
    });

    await user.save();
    res.json({ 
      message: 'VIP purchase requested!',
      user: {
        balance: user.balance,
        transactions: user.transactions
      }
    });
  } catch (error) {
    console.error('VIP purchase error:', error);
    res.status(500).json({ message: 'VIP purchase failed' });
  }
});

// Admin Routes

// Approve Recharge (Admin)
app.post('/api/admin/recharges/approve', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const { userId, requestId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const request = user.rechargeRequests.id(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    user.balance += request.amount;
    request.status = 'approved';
    
    const transaction = user.transactions.find(
      t => t.amount === request.amount && t.type === 'recharge' && t.status === 'pending'
    );
    if (transaction) transaction.status = 'completed';

    await user.save();
    res.json({ message: 'Recharge approved', user });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ message: 'Approval failed' });
  }
});

// Approve Withdrawal (Admin)
app.post('/api/admin/withdrawals/approve', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const { userId, requestId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const request = user.withdrawalRequests.id(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    request.status = 'approved';
    
    const transaction = user.transactions.find(
      t => t.amount === -request.amount && t.type === 'withdrawal' && t.status === 'pending'
    );
    if (transaction) transaction.status = 'completed';

    await user.save();
    res.json({ message: 'Withdrawal approved', user });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ message: 'Approval failed' });
  }
});

// Approve VIP (Admin)
app.post('/api/admin/vip/approve', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const { userId, requestId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const request = user.vipRequests.id(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const dailyProfit = VIP_DAILY_PROFITS[request.level - 1];
    if (!dailyProfit) return res.status(400).json({ message: 'Invalid VIP level' });

    user.vipLevel = request.level;
    user.dailyProfit = dailyProfit;
    user.vipApprovedDate = new Date();
    request.status = 'approved';
    
    const transaction = user.transactions.find(
      t => t.amount === -request.amount && t.type.includes('VIP') && t.status === 'pending'
    );
    if (transaction) transaction.status = 'completed';

    await user.save();
    res.json({ message: 'VIP approved', user });
  } catch (error) {
    console.error('VIP approval error:', error);
    res.status(500).json({ message: 'VIP approval failed' });
  }
});

// Get All Users (Admin)
app.get('/api/admin/users', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const users = await User.find({}, { password: 0 });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await initAdmin();
  console.log(`Server running on port ${PORT}`);
});
