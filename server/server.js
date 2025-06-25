require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const moment = require('moment');

const app = express();
app.use(express.json());
app.use(cors());

// ======================
// CONFIGURATION
// ======================
const { MONGO_URI, JWT_SECRET } = process.env;
const VIP_CONFIG = [
  { level: 1, price: 10000, daily: 1800, duration: 60 },
  { level: 2, price: 30000, daily: 6000, duration: 60 },
  { level: 3, price: 50000, daily: 10000, duration: 60 },
  { level: 4, price: 80000, daily: 13000, duration: 60 },
  { level: 5, price: 120000, daily: 28000, duration: 60 },
  { level: 6, price: 240000, daily: 60000, duration: 60 },
  { level: 7, price: 300000, daily: 75000, duration: 60 },
  { level: 8, price: 600000, daily: 150000, duration: 60 },
  { level: 9, price: 1200000, daily: 400000, duration: 60 },
  { level: 10, price: 2000000, daily: 600000, duration: 60 }
];

// ======================
// DATABASE SETUP
// ======================
mongoose.connect(MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['recharge', 'withdrawal', 'vip', 'profit', 'referral'] },
  amount: Number,
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  details: mongoose.Schema.Types.Mixed
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 2000 },
  totalEarnings: { type: Number, default: 0 },
  referralCode: { type: String, unique: true },
  referredBy: String,
  referralEarnings: { type: Number, default: 0 },
  isVIP: { type: Boolean, default: false },
  vipLevel: { type: Number, default: 0 },
  vipStartDate: Date,
  vipEndDate: Date,
  lastProfitDate: Date,
  transactions: [transactionSchema]
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  permissions: { type: [String], default: ['users', 'transactions', 'vip'] }
});

const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
};

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Access denied' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(400).json({ success: false, message: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};

const createAdmin = async () => {
  if (!await Admin.findOne({ email: 'admin@aab.com' })) {
    await Admin.create({
      email: 'admin@aab.com',
      password: await bcrypt.hash('admin123', 10),
      permissions: ['all']
    });
    console.log('👑 Default admin created');
  }
};

// ======================
// USER AUTH ROUTES (PUBLIC)
// ======================
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;
    
    if (await User.findOne({ email })) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const referral = referralCode ? await User.findOne({ referralCode }) : null;

    const user = new User({
      username,
      email,
      password: await bcrypt.hash(password, 10),
      referralCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
      referredBy: referral?._id,
      transactions: [{
        type: 'referral',
        amount: 2000,
        status: 'approved',
        details: { description: 'Signup bonus' }
      }]
    });

    if (referral) {
      referral.balance += 2000;
      referral.referralEarnings += 2000;
      referral.transactions.push({
        type: 'referral',
        amount: 2000,
        status: 'approved',
        details: { referredUser: user.email }
      });
      await referral.save();
    }

    await user.save();

    const token = generateToken({ 
      id: user._id, 
      email: user.email, 
      isAdmin: false 
    });

    res.status(201).json({ 
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        isVIP: user.isVIP,
        vipLevel: user.vipLevel
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Optional: Add daily VIP profit calculation here

    const token = generateToken({
      id: user._id,
      email: user.email,
      isAdmin: false
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        isVIP: user.isVIP,
        vipLevel: user.vipLevel,
        referralCode: user.referralCode
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

app.use(verifyToken);

app.get('/api/user', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -__v');
      
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

app.post('/api/recharge', async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.user.id);
    
    // Validate
    if (amount < 10000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Minimum recharge is UGX 10,000' 
      });
    }

    // Create transaction
    user.transactions.push({
      type: 'recharge',
      amount,
      status: 'pending',
      details: { method: 'Manual' }
    });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Recharge request submitted',
      transaction: user.transactions[user.transactions.length - 1]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Recharge failed' });
  }
});

app.post('/api/withdraw', async (req, res) => {
  try {
    const { amount, mobileNumber, network } = req.body;
    const user = await User.findById(req.user.id);
    
    // Validate
    if (amount < 5000 || amount > 2000000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount must be between UGX 5,000 and 2,000,000' 
      });
    }
    
    if (user.balance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    // Create transaction
    user.transactions.push({
      type: 'withdrawal',
      amount: -amount,
      status: 'pending',
      details: { mobileNumber, network }
    });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Withdrawal request submitted',
      transaction: user.transactions[user.transactions.length - 1]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Withdrawal failed' });
  }
});

app.post('/api/upgrade-vip', async (req, res) => {
  try {
    const { level } = req.body;
    const user = await User.findById(req.user.id);
    const vip = VIP_CONFIG.find(v => v.level === level);
    
    // Validate
    if (!vip) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid VIP level' 
      });
    }
    
    if (user.balance < vip.price) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    // Create transaction
    user.transactions.push({
      type: 'vip',
      amount: -vip.price,
      status: 'pending',
      details: { vipLevel: level }
    });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'VIP upgrade requested',
      transaction: user.transactions[user.transactions.length - 1]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'VIP upgrade failed' });
  }
});

// ======================
// ADMIN ROUTES
// ======================
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    
    // Validate
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid admin credentials' 
      });
    }

    // Generate token
    const token = generateToken({
      id: admin._id,
      email: admin.email,
      isAdmin: true,
      permissions: admin.permissions
    });

    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        permissions: admin.permissions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Admin login failed' });
  }
});

app.use(verifyToken);
app.use(isAdmin);

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    // Get pending requests
    const pendingRecharges = await User.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.type": "recharge", "transactions.status": "pending" } },
      { $project: { 
        userId: "$_id",
        email: 1,
        transaction: "$transactions" 
      }}
    ]);
    
    const pendingWithdrawals = await User.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.type": "withdrawal", "transactions.status": "pending" } },
      { $project: { 
        userId: "$_id",
        email: 1,
        transaction: "$transactions" 
      }}
    ]);
    
    const pendingVIP = await User.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.type": "vip", "transactions.status": "pending" } },
      { $project: { 
        userId: "$_id",
        email: 1,
        transaction: "$transactions" 
      }}
    ]);

    // Get stats
    const totalUsers = await User.countDocuments();
    const activeVIP = await User.countDocuments({ isVIP: true });
    const totalBalance = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$balance" } } }
    ]);
    
    res.json({
      success: true,
      dashboard: {
        pendingRecharges,
        pendingWithdrawals,
        pendingVIP,
        stats: {
          totalUsers,
          activeVIP,
          totalBalance: totalBalance[0]?.total || 0
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
});

app.post('/api/admin/approve', async (req, res) => {
  try {
    const { userId, transactionId, action } = req.body;
    const user = await User.findById(userId);
    
    // Find transaction
    const transaction = user.transactions.id(transactionId);
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }
    
    // Process based on type
    switch (transaction.type) {
      case 'recharge':
        if (action === 'approve') {
          user.balance += transaction.amount;
        }
        break;
        
      case 'withdrawal':
        if (action === 'approve') {
          user.balance += transaction.amount; // Withdrawal amount is negative
        }
        break;
        
      case 'vip':
        if (action === 'approve') {
          const vipLevel = transaction.details.vipLevel;
          const vip = VIP_CONFIG.find(v => v.level === vipLevel);
          
          user.isVIP = true;
          user.vipLevel = vipLevel;
          user.vipStartDate = new Date();
          user.vipEndDate = moment().add(vip.duration, 'days').toDate();
          user.balance += transaction.amount; // VIP amount is negative
        }
        break;
    }
    
    // Update transaction
    transaction.status = action;
    await user.save();
    
    res.json({
      success: true,
      message: `Transaction ${action}d successfully`,
      user: {
        balance: user.balance,
        isVIP: user.isVIP,
        vipLevel: user.vipLevel
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Approval failed' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -__v')
      .sort({ createdAt: -1 });
      
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

app.get('/api/admin/transactions', async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (type) query['transactions.type'] = type;
    if (status) query['transactions.status'] = status;
    
    const users = await User.find(query)
      .select('email transactions')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
      
    // Flatten transactions
    const transactions = users.reduce((acc, user) => {
      user.transactions.forEach(t => {
        if ((!type || t.type === type) && (!status || t.status === status)) {
          acc.push({
            ...t.toObject(),
            userId: user._id,
            userEmail: user.email
          });
        }
      });
      return acc;
    }, []);
    
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await createAdmin();
  console.log(`🚀 Server running on port ${PORT}`);
});
