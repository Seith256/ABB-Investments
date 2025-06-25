require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, 
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  balance: { type: Number, default: 2000 }, // Welcome bonus
  isVIP: { type: Boolean, default: false },
  vipLevel: { type: Number, default: 0 },
  vipApprovedDate: Date,
  lastProfitDate: Date,
  vipDaysCompleted: { type: Number, default: 0 },
  invitationCode: String,
  invitedBy: String,
  hasUsedInvite: { type: Boolean, default: false },
  referralEarnings: { type: Number, default: 0 },
  transactions: [{
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    status: { type: String, default: "pending" }
  }],
  rechargeRequests: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: "pending" },
    proof: String
  }],
  withdrawalRequests: [{
    amount: Number,
    phone: String,
    network: String,
    date: { type: Date, default: Date.now },
    status: { type: String, default: "pending" }
  }],
  vipRequests: [{
    level: Number,
    amount: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: "pending" },
    daysRemaining: { type: Number, default: 60 }
  }],
  referrals: [{
    email: String,
    date: Date,
    bonus: Number,
    lastBonusDate: Date
  }]
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  permissions: { type: [String], default: ["basic"] },
  lastLogin: Date
});

// Models
const User = mongoose.model("User", userSchema);
const Admin = mongoose.model("Admin", adminSchema);

// VIP Configuration
const VIP_DAILY_PROFITS = [1800, 6000, 10000, 13000, 28000, 60000, 75000, 150000, 400000, 600000];
const VIP_PRICES = [10000, 30000, 50000, 80000, 120000, 240000, 300000, 600000, 1200000, 2000000];

// Helper Functions
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, isAdmin: user instanceof Admin },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Routes

// Admin Authentication
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken(admin);
    res.json({
      message: "Admin login successful",
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        permissions: admin.permissions
      },
      token
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// User Authentication
app.post("/api/users/register", async (req, res) => {
  try {
    const { username, email, password, phone, inviteCode } = req.body;
    
    // Check if user exists
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with welcome bonus
    const newUser = new User({
      username,
      email,
      phone,
      password: hashedPassword,
      balance: 2000,
      invitationCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
      transactions: [{
        type: "bonus",
        amount: 2000,
        status: "completed"
      }]
    });

    // Process invitation if provided
    if (inviteCode && inviteCode !== "2233") {
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
    
    res.status(201).json({ 
      message: "User registered successfully",
      user: newUser
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/users/login", async (req, res) => {
  try {
    const { email, password, inviteCode } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Process invitation code if provided
    if (inviteCode && inviteCode !== "2233" && !user.hasUsedInvite) {
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

    // Process VIP daily profit if applicable
    if (user.vipLevel > 0 && user.vipApprovedDate) {
      const now = new Date();
      const lastProfitDate = user.lastProfitDate || user.vipApprovedDate;
      const today = now.toISOString().split('T')[0];
      const lastProfitDay = new Date(lastProfitDate).toISOString().split('T')[0];
      
      if (today !== lastProfitDay) {
        const profit = VIP_DAILY_PROFITS[user.vipLevel - 1] || 0;
        user.balance += profit;
        user.lastProfitDate = now;
        user.vipDaysCompleted = (user.vipDaysCompleted || 0) + 1;
        
        user.transactions.push({
          type: `VIP ${user.vipLevel} daily profit`,
          amount: profit,
          status: "completed"
        });
        
        await user.save();
      }
    }

    const token = generateToken(user);
    res.json({
      message: "Login successful",
      user,
      token
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// Financial Endpoints
app.post("/api/recharges", async (req, res) => {
  try {
    const { userId, amount, proof } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.rechargeRequests.push({
      amount,
      proof,
      status: "pending"
    });

    user.transactions.push({
      type: "recharge",
      amount,
      status: "pending"
    });

    await user.save();
    res.json({ message: "Recharge request submitted", user });
  } catch (error) {
    console.error("Recharge error:", error);
    res.status(500).json({ message: "Recharge failed" });
  }
});

app.post("/api/recharges/approve", async (req, res) => {
  try {
    const { userId, requestId } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const request = user.rechargeRequests.id(requestId);
    if (!request || request.status !== "pending") {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Update balance and request status
    user.balance += request.amount;
    request.status = "approved";
    
    // Update transaction status
    const transaction = user.transactions.find(
      t => t.amount === request.amount && 
           t.type === "recharge" && 
           t.status === "pending"
    );
    if (transaction) transaction.status = "completed";

    // Process referral bonus if applicable
    if (user.invitedBy) {
      const inviter = await User.findOne({ email: user.invitedBy });
      if (inviter) {
        const bonus = Math.floor(request.amount * 0.15); // 15% bonus
        inviter.balance += bonus;
        inviter.referralEarnings += bonus;
        
        const referral = inviter.referrals.find(r => r.email === user.email);
        if (referral) {
          referral.bonus += bonus;
          referral.lastBonusDate = new Date();
        }
        
        inviter.transactions.push({
          type: `Referral bonus from ${user.email}`,
          amount: bonus,
          status: "completed"
        });
        
        await inviter.save();
      }
    }

    await user.save();
    res.json({ message: "Recharge approved", user });
  } catch (error) {
    console.error("Approval error:", error);
    res.status(500).json({ message: "Approval failed" });
  }
});

// VIP Endpoints
app.post("/api/vip/purchase", async (req, res) => {
  try {
    const { userId, vipLevel } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const price = VIP_PRICES[vipLevel - 1];
    if (user.balance < price) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    user.vipRequests.push({
      level: vipLevel,
      amount: price,
      status: "pending"
    });

    user.transactions.push({
      type: `VIP ${vipLevel} purchase`,
      amount: -price,
      status: "pending"
    });

    await user.save();
    res.json({ message: "VIP purchase requested", user });
  } catch (error) {
    console.error("VIP purchase error:", error);
    res.status(500).json({ message: "VIP purchase failed" });
  }
});

app.post("/api/vip/approve", async (req, res) => {
  try {
    const { userId, requestId } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const request = user.vipRequests.id(requestId);
    if (!request || request.status !== "pending") {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Deduct balance and activate VIP
    user.balance -= request.amount;
    user.vipLevel = request.level;
    user.isVIP = true;
    user.vipApprovedDate = new Date();
    user.dailyProfit = VIP_DAILY_PROFITS[request.level - 1];
    request.status = "approved";
    
    // Update transaction status
    const transaction = user.transactions.find(
      t => t.amount === -request.amount && 
           t.type.includes("VIP") && 
           t.status === "pending"
    );
    if (transaction) transaction.status = "completed";

    await user.save();
    res.json({ message: "VIP approved", user });
  } catch (error) {
    console.error("VIP approval error:", error);
    res.status(500).json({ message: "VIP approval failed" });
  }
});

// Initialize Default Admin
async function initializeAdmin() {
  const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL || "admin@aab.com" });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 10);
    await Admin.create({
      name: "Admin",
      email: process.env.ADMIN_EMAIL || "admin@aab.com",
      password: hashedPassword,
      permissions: ["full"]
    });
    console.log("Default admin created");
  }
}

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeAdmin();
});
