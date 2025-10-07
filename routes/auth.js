const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../Models/User'); // MongoDB model

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// 🔹 Register (for admin or staff)
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role, adminId } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const newUser = await User.create({
      username,
      email,
      password: hashed,
      role: role || "staff",
      adminId: role !== "admin" ? adminId || null : null,
      subscription: role === "admin"
        ? {
            plan: "trial",
            startDate: now.toISOString(),
            expiryDate: expiry.toISOString(),
            status: "active"
          }
        : null
    });

    res.status(201).json({ message: "User registered successfully", userId: newUser._id });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// 🔹 Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        adminId: user.adminId || user._id
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        subscription: user.subscription
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;