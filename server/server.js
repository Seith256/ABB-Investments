require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

// Config
const { MONGO_URI, JWT_SECRET } = process.env;
const ADMIN_EMAIL = "admin@aab.com";
const ADMIN_PASS = "admin123";
const VIP_LEVELS = [
  { price: 10000, dailyProfit: 1800 },
  { price: 30000, dailyProfit: 6000 },
  { price: 50000, dailyProfit: 10000 },
  { price: 80000, dailyProfit: 13000 },
  { price: 120000, dailyProfit: 28000 },
  { price: 240000, dailyProfit: 60000 },
  { price: 300000, dailyProfit: 75000 },
  { price: 600000, dailyProfit: 150000 },
  { price: 1200000, dailyProfit: 400000 },
  { price: 2000000, dailyProfit: 600000 }
];

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

// Schemas
const transactionSchema = new mongoose.Schema({
  type: String,
  amount: Number,
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' }
}, { _id: false });

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
  transactions: [transactionSchema],
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

const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', {
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, default: 'Admin' }
});

// Helper Functions
const generateToken = (user, isAdmin = false) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      isAdmin,
      name: user.name || user.username,
      balance: user.balance,
      vipLevel: user.vipLevel
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
};

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  next();
};

// Initialize Default Admin
const initAdmin = async () => {
  const adminExists = await Admin.findOne({ email: ADMIN_EMAIL });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash(ADMIN_PASS, 10);
    await Admin.create({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      name: 'Admin'
    });
    console.log('👑 Default admin created');
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
    const { username, email, password, phone, inviteCode = '2233' } = req.body;
    
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      phone,
      password: hashedPassword,
      balance: 2000,
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
      user: {
        id: newUser._id,
        username: newUser.username,
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

// User Login
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
        user.isVIP = false;
        user.dailyProfit = 0;
        await user.save();
      } else {
        // Add daily profit if not already added today
        const today = now.toISOString().split('T')[0];
        const lastProfitDay = user.lastProfitDate ? 
          new Date(user.lastProfitDate).toISOString().split('T')[0] : null;

        if (!lastProfitDay || lastProfitDay !== today) {
          const profit = VIP_LEVELS[user.vipLevel - 1]?.dailyProfit || 0;
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
        username: user.username,
        email: user.email,
        balance: user.balance,
        vipLevel: user.vipLevel,
        dailyProfit: VIP_LEVELS[user.vipLevel - 1]?.dailyProfit || 0
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Protected Routes
app.use(verifyToken);

// Get User Data
app.get('/api/users/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        balance: user.balance,
        vipLevel: user.vipLevel,
        dailyProfit: VIP_LEVELS[user.vipLevel - 1]?.dailyProfit || 0,
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

// Recharge Request
app.post('/api/recharges', async (req, res) => {
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

// Withdrawal Request
app.post('/api/withdrawals', async (req, res) => {
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

// VIP Purchase
app.post('/api/vip/purchase', async (req, res) => {
  try {
    const { vipLevel } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const price = VIP_LEVELS[vipLevel - 1]?.price;
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
app.use(verifyAdmin);

// Approve Recharge
app.post('/api/admin/recharges/approve', async (req, res) => {
  try {
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

// Approve Withdrawal
app.post('/api/admin/withdrawals/approve', async (req, res) => {
  try {
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

// Approve VIP
app.post('/api/admin/vip/approve', async (req, res) => {
  try {
    const { userId, requestId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const request = user.vipRequests.id(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const vipInfo = VIP_LEVELS[request.level - 1];
    if (!vipInfo) return res.status(400).json({ message: 'Invalid VIP level' });

    user.isVIP = true;
    user.vipLevel = request.level;
    user.vipApprovedDate = new Date();
    user.dailyProfit = vipInfo.dailyProfit;
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

// Get All Users
app.get('/api/admin/users', async (req, res) => {
  try {
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
  console.log(`🚀 Server running on port ${PORT}`);
});
