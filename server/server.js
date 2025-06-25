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

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  balance: { type: Number, default: 2000 },
  isVIP: { type: Boolean, default: false },
  vipLevel: { type: Number, default: 0 },
  vipApprovedDate: Date,
  lastProfitDate: Date,
  invitationCode: String,
  invitedBy: String,
  hasUsedInvite: { type: Boolean, default: false },
  referralEarnings: { type: Number, default: 0 },
  transactions: [{
    type: String,
    amount: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' }
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
  referrals: [{
    email: String,
    date: { type: Date, default: Date.now },
    bonus: Number
  }]
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

// VIP Configuration
const VIP_LEVELS = [
  { price: 10000, dailyProfit: 1800 },
  { price: 30000, dailyProfit: 6000 },
  // ... add all 10 VIP levels
  { price: 2000000, dailyProfit: 600000 }
];

// Helper Functions
const generateToken = (user, isAdmin = false) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      isAdmin 
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

// Admin Login
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

// User Registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, email, password, phone, inviteCode } = req.body;
    
    // Check if user exists
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new User({
      username,
      email,
      phone,
      password: hashedPassword,
      invitationCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
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
      user: newUser,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// User Login
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password, inviteCode } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Process invitation code
    if (inviteCode && inviteCode !== '2233' && !user.hasUsedInvite) {
      const inviter = await User.findOne({ invitationCode: inviteCode });
      if (inviter) {
        inviter.balance += 2000;
        inviter.referralEarnings += 2000;
        inviter.referrals.push({
          email: user.email,
          bonus: 2000
        });
        await inviter.save();
        
        user.invitedBy = inviter.email;
        user.hasUsedInvite = true;
        await user.save();
      }
    }

    // Process VIP daily profit
    if (user.isVIP && user.vipApprovedDate) {
      const now = new Date();
      const lastProfitDate = user.lastProfitDate || user.vipApprovedDate;
      const today = now.toISOString().split('T')[0];
      const lastProfitDay = new Date(lastProfitDate).toISOString().split('T')[0];
      
      if (today !== lastProfitDay) {
        const vipLevel = user.vipLevel - 1;
        const profit = VIP_LEVELS[vipLevel]?.dailyProfit || 0;
        
        user.balance += profit;
        user.lastProfitDate = now;
        user.transactions.push({
          type: `VIP ${user.vipLevel} daily profit`,
          amount: profit,
          status: 'completed'
        });
        
        await user.save();
      }
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      user,
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

// Recharge Request
app.post('/api/recharges', verifyToken, async (req, res) => {
  try {
    const { amount, proof } = req.body;
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
    res.json({ message: 'Recharge request submitted', user });
  } catch (error) {
    console.error('Recharge error:', error);
    res.status(500).json({ message: 'Recharge failed' });
  }
});

// Approve Recharge (Admin)
app.post('/api/recharges/approve', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const { userId, requestId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const request = user.rechargeRequests.id(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    // Update balance and status
    user.balance += request.amount;
    request.status = 'approved';
    
    // Update transaction
    const transaction = user.transactions.find(
      t => t.amount === request.amount && t.type === 'recharge' && t.status === 'pending'
    );
    if (transaction) transaction.status = 'completed';

    // Process referral bonus
    if (user.invitedBy) {
      const inviter = await User.findOne({ email: user.invitedBy });
      if (inviter) {
        const bonus = Math.floor(request.amount * 0.15);
        inviter.balance += bonus;
        inviter.referralEarnings += bonus;
        
        const referral = inviter.referrals.find(r => r.email === user.email);
        if (referral) {
          referral.bonus += bonus;
        } else {
          inviter.referrals.push({
            email: user.email,
            bonus
          });
        }
        
        await inviter.save();
      }
    }

    await user.save();
    res.json({ message: 'Recharge approved', user });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ message: 'Approval failed' });
  }
});

// Withdrawal Request
app.post('/api/withdrawals', verifyToken, async (req, res) => {
  try {
    const { amount, phone, network } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });

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
    res.json({ message: 'Withdrawal request submitted', user });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ message: 'Withdrawal failed' });
  }
});

// VIP Purchase
app.post('/api/vip/purchase', verifyToken, async (req, res) => {
  try {
    const { vipLevel } = req.body;
    const user = await User.findById(req.user.id);
    const vipInfo = VIP_LEVELS[vipLevel - 1];
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!vipInfo) return res.status(400).json({ message: 'Invalid VIP level' });
    if (user.balance < vipInfo.price) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.vipRequests.push({
      level: vipLevel,
      amount: vipInfo.price,
      status: 'pending'
    });

    user.transactions.push({
      type: `VIP ${vipLevel} purchase`,
      amount: -vipInfo.price,
      status: 'pending'
    });

    await user.save();
    res.json({ message: 'VIP purchase requested', user });
  } catch (error) {
    console.error('VIP purchase error:', error);
    res.status(500).json({ message: 'VIP purchase failed' });
  }
});

// Approve VIP (Admin)
app.post('/api/vip/approve', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const { userId, requestId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const request = user.vipRequests.id(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const vipInfo = VIP_LEVELS[request.level - 1];
    if (!vipInfo) return res.status(400).json({ message: 'Invalid VIP level' });

    // Update user VIP status
    user.balance -= request.amount;
    user.isVIP = true;
    user.vipLevel = request.level;
    user.vipApprovedDate = new Date();
    user.dailyProfit = vipInfo.dailyProfit;
    request.status = 'approved';
    
    // Update transaction
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

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await initAdmin();
  console.log(`Server running on port ${PORT}`);
});
