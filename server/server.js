
require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const moment   = require('moment');

const app = express();
app.use(express.json());
app.use(cors());

const { MONGO_URI, JWT_SECRET } = process.env;

const VIP_CONFIG = [
  { level: 1, price: 10000,  daily:  1800, duration: 60 },
  { level: 2, price: 30000,  daily:  6000, duration: 60 },
  { level: 3, price: 50000,  daily: 10000, duration: 60 },
  { level: 4, price: 80000,  daily: 13000, duration: 60 },
  { level: 5, price:120000,  daily: 28000, duration: 60 },
  { level: 6, price:240000,  daily: 60000, duration: 60 },
  { level: 7, price:300000,  daily: 75000, duration: 60 },
  { level: 8, price:600000,  daily:150000, duration: 60 },
  { level: 9, price:1200000, daily:400000, duration: 60 },
  { level:10, price:2000000, daily:600000, duration: 60 }
];

mongoose.connect(MONGO_URI,{useNewUrlParser:true,useUnifiedTopology:true})
  .then(()=>console.log('✅ MongoDB connected'))
  .catch(err=>console.error('❌ MongoDB error:',err));

const transactionSchema = new mongoose.Schema({
  type   : { type:String, enum:['recharge','withdrawal','vip','profit','referral','bonus']},
  amount : Number,
  date   : { type:Date, default:Date.now },
  status : { type:String, enum:['pending','approved','rejected'], default:'pending' },
  details: mongoose.Schema.Types.Mixed
});

const userSchema = new mongoose.Schema({
  username          : String,
  email             : { type:String, unique:true },
  password          : String,
  balance           : { type:Number, default:2000 },
  totalEarnings     : { type:Number, default:0 },
  referralCode      : { type:String, unique:true },
  referredBy        : String,
  referralEarnings  : { type:Number, default:0 },
  hasFirstRechargeBonus:{type:Boolean, default:false},
  isVIP             : { type:Boolean, default:false },
  vipLevel          : { type:Number, default:0 },
  vipStartDate      : Date,
  vipEndDate        : Date,
  lastProfitDate    : Date,
  transactions      : [transactionSchema]
},{timestamps:true});

const adminSchema = new mongoose.Schema({
  email      : { type:String, unique:true },
  password   : String,
  permissions: { type:[String], default:['all'] }
});

const User  = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);

function signToken(payload){ return jwt.sign(payload, JWT_SECRET, {expiresIn:'8h'}); }

function verifyToken(req,res,next){
  const token = req.headers.authorization?.split(' ')[1];
  if(!token) return res.status(401).json({success:false,message:'Access denied'});
  try{
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  }catch{
    return res.status(401).json({success:false,message:'Invalid token'});
  }
}

function isAdmin(req,res,next){
  if(!req.user.isAdmin) return res.status(403).json({success:false,message:'Admin only'});
  next();
}

/* ---------- Create default admin ---------- */
async function createAdmin(){
  if(!(await Admin.findOne({email:'admin@aab.com'}))){
    await Admin.create({email:'admin@aab.com', password:await bcrypt.hash('admin123',10)});
    console.log('👑 Default admin created');
  }
}

/* ========= PUBLIC USER ROUTES ========= */
app.post('/api/signup', async (req,res)=>{
  try{
    const {username,email,password,phone,inviteCode} = req.body;
    if(await User.findOne({email})) return res.status(400).json({success:false,message:'Email exists'});
    const referral = inviteCode ? await User.findOne({referralCode:inviteCode}) : null;
    const user = new User({
      username,email,password:await bcrypt.hash(password,10),
      referralCode: Math.random().toString(36).substring(2,10).toUpperCase(),
      referredBy: referral?._id,
      transactions:[{type:'bonus',amount:2000,status:'approved',details:{description:'Signup bonus'}}]
    });
    if(referral){
      referral.balance += 2000;
      referral.referralEarnings += 2000;
      referral.transactions.push({type:'referral',amount:2000,status:'approved',details:{referredUser:user.email}});
      await referral.save();
    }
    await user.save();
    const token = signToken({id:user._id,email:user.email,isAdmin:false});
    res.status(201).json({success:true,message:'Registration successful',token,user});
  }catch(err){
    res.status(500).json({success:false,message:'Registration failed'});
  }
});

app.post('/api/login', async (req,res)=>{
  try{
    const {email,password} = req.body;
    const user = await User.findOne({email});
    if(!user || !(await bcrypt.compare(password,user.password)))
      return res.status(401).json({success:false,message:'Invalid credentials'});

    // daily vip profit
    if(user.isVIP && user.vipStartDate){
      const now = moment();
      const last = moment(user.lastProfitDate || user.vipStartDate);
      if(now.diff(last,'days')>0){
        const vip = VIP_CONFIG.find(v=>v.level===user.vipLevel);
        if(vip){
          user.balance += vip.daily;
          user.totalEarnings += vip.daily;
          user.lastProfitDate = new Date();
          user.transactions.push({type:'profit',amount:vip.daily,status:'approved',details:{vipLevel:user.vipLevel}});
          await user.save();
        }
      }
    }

    const token = signToken({id:user._id,email:user.email,isAdmin:false});
    res.json({success:true,message:'Login successful',token,user});
  }catch(err){
    res.status(500).json({success:false,message:'Login failed'});
  }
});

/* ========= PUBLIC ADMIN LOGIN ========= */
app.post('/api/admin/login', async (req,res)=>{
  try{
    const {email,password}=req.body;
    const admin = await Admin.findOne({email});
    if(!admin || !(await bcrypt.compare(password,admin.password)))
      return res.status(401).json({success:false,message:'Invalid admin credentials'});
    const token = signToken({id:admin._id,email:admin.email,isAdmin:true});
    res.json({success:true,message:'Admin login successful',token,admin:{id:admin._id,email:admin.email}});
  }catch(err){
    res.status(500).json({success:false,message:'Admin login failed'});
  }
});

/* ========= PROTECTED USER ROUTES ========= */
app.use(verifyToken);

app.get('/api/user', async (req,res)=>{
  const user = await User.findById(req.user.id).select('-password -__v');
  res.json({success:true,user});
});

app.post('/api/recharge', async (req,res)=>{
  const {amount}=req.body;
  if(amount<10000) return res.status(400).json({success:false,message:'Minimum recharge UGX 10,000'});
  const user = await User.findById(req.user.id);
  user.transactions.push({type:'recharge',amount,status:'pending',details:{}});
  await user.save();
  res.json({success:true,message:'Recharge request submitted'});
});

app.post('/api/withdraw', async (req,res)=>{
  const {amount,mobileNumber,network}=req.body;
  if(amount<5000 || amount>2000000) return res.status(400).json({success:false,message:'Amount must be 5k-2M'});
  const user = await User.findById(req.user.id);
  if(user.balance<amount) return res.status(400).json({success:false,message:'Insufficient balance'});
  user.transactions.push({type:'withdrawal',amount:-amount,status:'pending',details:{mobileNumber,network}});
  await user.save();
  res.json({success:true,message:'Withdrawal request submitted'});
});

app.post('/api/upgrade-vip', async (req,res)=>{
  const {level}=req.body;
  const vip = VIP_CONFIG.find(v=>v.level===level);
  if(!vip) return res.status(400).json({success:false,message:'Invalid VIP level'});
  const user = await User.findById(req.user.id);
  if(user.balance<vip.price) return res.status(400).json({success:false,message:'Insufficient balance'});
  user.transactions.push({type:'vip',amount:-vip.price,status:'pending',details:{vipLevel:level}});
  await user.save();
  res.json({success:true,message:'VIP upgrade requested'});
});

/* ========= ADMIN ROUTES ========= */
app.use(isAdmin);

app.get('/api/admin/users', async (req,res)=>{
  const users = await User.find().select('-password -__v');
  res.json({success:true,users});
});

app.post('/api/admin/approve', async (req,res)=>{
  const {userId,transactionId,action} = req.body;
  const user = await User.findById(userId);
  const txn = user.transactions.id(transactionId);
  if(!txn) return res.status(404).json({success:false,message:'Transaction not found'});

  if(txn.type==='recharge' && action==='approve'){
    user.balance += txn.amount;

    if(user.referredBy && !user.hasFirstRechargeBonus){
      const inviter = await User.findById(user.referredBy);
      if(inviter){
        const bonus = Math.floor(txn.amount*0.15);
        inviter.balance += bonus;
        inviter.referralEarnings += bonus;
        inviter.transactions.push({type:'referral',amount:bonus,status:'approved',details:{referredUser:user.email,fromRecharge:txn.amount}});
        await inviter.save();
        user.hasFirstRechargeBonus=true;
      }
    }
  }

  if(txn.type==='withdrawal' && action==='approve'){
    user.balance += txn.amount; // negative amount
  }

  if(txn.type==='vip' && action==='approve'){
    const vip = VIP_CONFIG.find(v=>v.level===txn.details.vipLevel);
    user.isVIP = true;
    user.vipLevel = vip.level;
    user.vipStartDate = new Date();
    user.vipEndDate = moment().add(vip.duration,'days').toDate();
    user.balance += txn.amount; // negative
  }

  txn.status = action;
  await user.save();
  res.json({success:true,message:`Transaction ${action}`});
});

const PORT = process.env.PORT || 5000;
app.listen(PORT,async ()=>{
  await createAdmin();
  console.log('🚀 Server running on',PORT);
});
