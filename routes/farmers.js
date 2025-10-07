// routes/farmers.js
const express = require("express");
const router = express.Router();
const { read, write } = require("../utils/fs");
const {requireAuth} = require("../middleware/auth");
const { requireRole, requireRoles } = require("../middleware/roles");
const { requireActiveSubscription } = require("../middleware/subscription");


// 🟢 Only admin can add farmers
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const { name, phone, region } = req.body || {};
  if (!name || !phone || !region) {
    return res.status(400).json({ error: "name, phone, and region are required" });
  }

  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  const farmers = await read("farmers");
  const users = await read("users");

  // Filter farmers belonging to this business
const businessFarmers = farmers.filter(f => f.businessId === loggedInUser.businessId);

// Generate next farmer number for this business
const nextNumber = businessFarmers.length + 1;

// Create scoped ID like F001, F002, etc.
const newFarmerId = "F" + nextNumber.toString().padStart(3, "0");

  const newFarmer = {
    id: newFarmerId,
    name,
    phone,
    region,
    createdAt: new Date(),
    isActive: true,
    businessId: loggedInUser.businessId // 🔐 scoped
  };

  farmers.push(newFarmer);
  await write("farmers", farmers);

  const username = name.split(" ")[0].toLowerCase();
  const newUser = {
    id: "U" + Date.now().toString(36),
    username,
    password: newFarmerId,
    role: "farmer",
    farmerId: newFarmerId,
    businessId: loggedInUser.businessId, // 🔐 scoped
    createdAt: new Date()
  };

  users.push(newUser);
  await write("users", users);

  res.json({
    farmer: newFarmer,
    user: { username: newUser.username, password: newUser.password, role: newUser.role }
  });
});
// 🟢 Farmers can view only their own data
router.get("/:id", requireAuth, requireRoles(["admin", "staff", "farmer"]), async (req, res) => {
  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  const farmers = await read("farmers");
  const farmer = farmers.find(f => f.id === req.params.id && f.businessId === loggedInUser.businessId);

  if (!farmer) {
    return res.status(404).json({ error: "Farmer not found or unauthorized" });
  }

  // ✅ Farmers can only access their own data
  if (loggedInUser.role === "farmer" && loggedInUser.farmerId !== farmer.id) {
    return res.status(403).json({ error: "Forbidden: cannot access other farmers" });
  }

  res.json(farmer);
});
// 🟢 Bulk import farmers (Admin only)
router.post("/import", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { farmers } = req.body;

    if (!Array.isArray(farmers)) {
      return res.status(400).json({ error: "Invalid farmers payload" });
    }

    const loggedInUser = req.user;
    if (!loggedInUser || !loggedInUser.businessId) {
      return res.status(403).json({ error: "Unauthorized: No business assigned" });
    }

    const dbFarmers = await read("farmers");
    const dbUsers = await read("users");

    const createdAccounts = [];

    for (const f of farmers) {
      const businessFarmers = dbFarmers.filter(f => f.businessId === loggedInUser.businessId);
      const nextNumber = businessFarmers.length + 1;
      const newId = f.id || "F" + nextNumber.toString().padStart(3, "0");

      // Check for duplicates within the same business
      const exists = dbFarmers.find(
        farmer => (farmer.id === newId || farmer.phone === f.phone) &&
                  farmer.businessId === loggedInUser.businessId
      );

      if (!exists) {
        const newFarmer = {
          id: newId,
          name: f.name || "Unknown",
          phone: f.phone || "-",
          region: f.region || "Unassigned",
          createdAt: new Date().toISOString(),
          isActive: f.isActive !== false,
          businessId: loggedInUser.businessId // 🔐 scoped
        };

        dbFarmers.push(newFarmer);

        const baseUsername = newFarmer.name.split(" ")[0].toLowerCase();
        let username = baseUsername;
        let counter = 1;

        while (dbUsers.find(u => u.username === username)) {
          username = baseUsername + counter++;
        }

        const password = newFarmer.id;

        const newUser = {
          id: "U" + Date.now().toString(36) + Math.floor(Math.random() * 1000),
          username,
          password,
          role: "farmer",
          farmerId: newFarmer.id,
          businessId: loggedInUser.businessId, // 🔐 scoped
          createdAt: new Date().toISOString()
        };

        dbUsers.push(newUser);

        createdAccounts.push({
          farmerId: newFarmer.id,
          name: newFarmer.name,
          username: newUser.username,
          password: newUser.password
        });
      }
    }

    await write("farmers", dbFarmers);
    await write("users", dbUsers);

    console.log(`✅ Imported ${createdAccounts.length} farmers. Total now: ${dbFarmers.length}`);

    res.json({
      success: true,
      imported: createdAccounts.length,
      accounts: createdAccounts
    });
  } catch (err) {
    console.error("❌ Import error:", err);
    res.status(500).json({ error: "Failed to import farmers" });
  }
});
module.exports = router;
