const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const usersFile = path.join(__dirname, "../data/users.json");

// Utility: read/write users
function readUsers() {
  return JSON.parse(fs.readFileSync(usersFile, "utf-8"));
}
function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Generate new ID for admins
function generateId(users) {
  const last = users.filter(u => u.role === "admin").length;
  return `U${String(last + 1).padStart(3, "0")}`;
}
// Add Admin (developer adds the real business owner)
router.post("/add-admin", (req, res) => {
  const { name, phone, password } = req.body;
  let users = readUsers();

  const id = generateId(users);

  // Generate username based on name + id
  let baseUsername = name.toLowerCase().replace(/\s+/g, "");
  let username = baseUsername + id;

  // Ensure uniqueness
  let counter = 1;
  while (users.find(u => u.username === username)) {
    username = baseUsername + id + counter;
    counter++;
  }

  // 🔑 Generate businessId (B001, B002, ...)
  const businessCount = users.filter(u => u.createdBy === "developer").length;
  const businessId = `B${String(businessCount + 1).padStart(3, "0")}`;

  const newAdmin = {
    id,
    name,
    username,
    phone,
    role: "admin",
    password,
    createdBy: "developer",   // Mark this as the owner account
    businessId,               // 🔑 Each owner gets their own businessId
    subscription: {
      plan: "trial",
      startDate: new Date().toISOString(),
      expiryDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
      status: "active"
    }
  };

  users.push(newAdmin);
  saveUsers(users);

  res.json({ message: "Admin (owner) added", admin: newAdmin });
});
// Get all admins
router.get("/admins", (req, res) => {
  const users = readUsers();
  const admins = users.filter(u => u.role === "admin");
  res.json(admins);
});

// Manage subscription
router.patch("/subscription/:id", (req, res) => {
  const { id } = req.params;
  const { action, days } = req.body;

  let users = readUsers();
  const user = users.find(u => u.id === id && u.role === "admin");
  if (!user) return res.status(404).json({ message: "Admin not found" });

  if (action === "extend") {
    const now = new Date();
    const expiry = user.subscription?.expiryDate
      ? new Date(user.subscription.expiryDate)
      : now;

    expiry.setDate(expiry.getDate() + days);
    user.subscription = {
      plan: "manual",
      startDate: user.subscription?.startDate || now.toISOString(),
      expiryDate: expiry.toISOString(),
      status: "active",
    };
  }

  if (action === "deactivate") {
    if (user.subscription) {
      user.subscription.status = "inactive";
    }
  }

  saveUsers(users);
  res.json({ message: "Subscription updated", subscription: user.subscription });
});

module.exports = router;