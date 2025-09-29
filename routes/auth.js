// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { read, write } = require('../utils/fs'); // adjust path if needed


const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";


// REGISTER
router.post('/register', async (req, res) => {
  console.log("📩 Incoming body:", req.body);

  const { username, password, role, adminId } = req.body; // accept adminId for staff/farmer

  if (!username || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const users = await read("users");

  // Check if username exists
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "Username already exists" });
  }

  // Hash password
  const hashed = await bcrypt.hash(password, 10);
  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days trial

  const newUser = {
    id: "U" + Date.now().toString(36),
    username,
    password: hashed,
    role: role || "staff",
    adminId: role !== "admin" ? adminId || null : null, // staff/farmers link to admin
    subscription: role === "admin" ? {  // ✅ subscription only for admins
      plan: "trial",
      startDate: now.toISOString(),
      expiryDate: expiry.toISOString(),
      status: "active"
    } : null,
    createdAt: now.toISOString(),
  };

  users.push(newUser);
  await write("users", users);

  return res.status(201).json({ message: "User registered successfully", userId: newUser.id });
});

// LOGIN
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  const users = await read("users");
  const user = users.find(u => u.username === username);

  if (!user) {
    return res.status(400).json({ error: "Invalid username or password" });
  }

  // Compare password (hashed for staff/admin, plain for farmers)
  let isMatch = false;
  if (user.password.startsWith("$2b$")) {
    isMatch = await bcrypt.compare(password, user.password);
  } else {
    isMatch = (password === user.password);
  }

  if (!isMatch) {
    return res.status(400).json({ error: "Invalid username or password" });
  }

  // Generate token (✅ now includes adminId)
  const token = jwt.sign(
    { 
      id: user.id, 
      role: user.role, 
      username: user.username, 
      farmerId: user.farmerId || null,
      adminId: user.adminId || null 
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  // Base response
  let userResponse = {
    id: user.id,
    username: user.username,
    role: user.role,
    subscription: user.subscription || null,
    adminId: user.adminId || null
  };

  // 🔑 Attach farmer details if farmer
  if (user.role === "farmer" && user.farmerId) {
    const farmers = await read("farmers");
    const farmer = farmers.find(f => f.id === user.farmerId);

    if (farmer) {
      userResponse = {
        ...userResponse,
        farmerId: farmer.id,
        name: farmer.name || null,
        phone: farmer.phone || null,
        region: farmer.region || null,
        createdAt: farmer.createdAt || null,
        isActive: farmer.isActive ?? true
      };
    } else {
      console.warn(`⚠ Farmer with ID ${user.farmerId} not found in farmers.json`);
    }
  }

  res.json({
    ok: true,
    token,
    user: userResponse
  });
});

module.exports = router;