const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

// ✅ Define filePath ONCE here
const filePath = path.join(__dirname, "../data", "users.json");

// === GET all users ===
router.get("/", (req, res) => {
  fs.readFile(filePath, "utf-8", (err, data) => {
    if (err) {
      console.error("❌ Failed to read users file:", err);
      return res.status(500).json({ error: "Failed to load users" });
    }

    let users = [];
    try {
      users = JSON.parse(data);
    } catch (e) {
      console.warn("⚠ Users file is empty or corrupted, resetting...");
      users = [];
    }

    res.json(users);
  });
});

// === POST add new user ===
router.post("/", (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  fs.readFile(filePath, "utf-8", (err, data) => {
    if (err) {
      console.error("❌ Failed to read users file:", err);
      return res.status(500).json({ error: "Failed to read users file" });
    }

    let users = [];
    try {
      users = JSON.parse(data);
    } catch {
      users = [];
    }

    const newUser = {
      id: "U" + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      username,
      password, // ⚠ In production: hash this
      role,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    fs.writeFile(filePath, JSON.stringify(users, null, 2), (err) => {
      if (err) {
        console.error("❌ Failed to save user:", err);
        return res.status(500).json({ error: "Failed to save user" });
      }

      console.log(`✅ User saved to ${filePath}:`, newUser);
      res.status(201).json(newUser);
    });
  });
});


// === DELETE user by ID ===
router.delete("/:id", (req, res) => {
  const userId = req.params.id;

  fs.readFile(filePath, "utf-8", (err, data) => {
    if (err) return res.status(500).json({ error: "Failed to read users file" });

    let users = [];
    try {
      users = JSON.parse(data);
    } catch (parseErr) {
      return res.status(500).json({ error: "Corrupted users file" });
    }

    const updatedUsers = users.filter(u => u.id !== userId);

    if (updatedUsers.length === users.length) {
      return res.status(404).json({ error: "User not found" });
    }

    fs.writeFile(filePath, JSON.stringify(updatedUsers, null, 2), (err) => {
      if (err) return res.status(500).json({ error: "Failed to delete user" });
      res.json({ message: `User ${userId} deleted successfully` });
    });
  });
});


module.exports = router;