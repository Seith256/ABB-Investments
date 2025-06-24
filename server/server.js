require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));
const userSchema = new mongoose.Schema({
  username: String, email: String, password: String,
  isVIP: Boolean, balance: Number, recharges: [Number], withdrawals: [Number]
});
const User = mongoose.model("User", userSchema);
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;
  const user = new User({ username, email, password, isVIP: false, balance: 0, recharges: [], withdrawals: [] });
  await user.save(); res.status(201).json({ message: "User registered" });
});
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  res.json({ message: "Login successful", user });
});
app.post("/api/recharge", async (req, res) => {
  const { email, amount } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });
  user.recharges.push(amount); user.balance += amount;
  await user.save(); res.json({ message: "Recharge successful", balance: user.balance });
});
app.post("/api/withdraw", async (req, res) => {
  const { email, amount } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.balance < amount) return res.status(400).json({ message: "Insufficient balance" });
  user.withdrawals.push(amount); user.balance -= amount;
  await user.save(); res.json({ message: "Withdrawal requested", balance: user.balance });
});
app.post("/api/vip-approve", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });
  user.isVIP = true; await user.save();
  res.json({ message: "VIP status approved" });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));