// routes/farmers.js
const express = require("express");
const router = express.Router();
const { read, write } = require("../utils/fs");
const {requireAuth} = require("../middleware/auth");
const { requireRole, requireRoles } = require("../middleware/roles");



// 🟢 Only admin can add farmers
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const farmers = await read("farmers");
  const users = await read("users");

  // Generate Farmer ID
  const newFarmerId = "F" + (farmers.length + 1).toString().padStart(3, "0");

  const newFarmer = {
    id: newFarmerId,
    name: req.body.name,
    phone: req.body.phone,
    region: req.body.region || "Unassigned",
    createdAt: new Date(),
    isActive: true
  };

  farmers.push(newFarmer);
  await write("farmers", farmers);

  // ✅ Auto-create farmer login user
  const username = req.body.name.split(" ")[0].toLowerCase(); // first name only
  const newUser = {
    id: "U" + Date.now().toString(36),
    username,
    password: newFarmerId, // farmerId as password
    role: "farmer",
    farmerId: newFarmerId,
    createdAt: new Date()
  };

  users.push(newUser);
  await write("users", users);

  res.json({
    farmer: newFarmer,
    user: { username: newUser.username, password: newUser.password, role: newUser.role }
  });
});

// 🟢 Admin + staff can view farmers (with optional region filter)
router.get("/", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  const farmers = await read("farmers");
  const { region } = req.query;

  let filtered = farmers;
  if (region) {
    filtered = farmers.filter(f => f.region === region);
  }

  res.json(filtered);
});

// 🟢 Farmers can view only their own data
router.get("/:id", requireAuth, requireRoles(["admin", "staff", "farmer"]), async (req, res) => {
  const farmers = await read("farmers");
  const farmer = farmers.find(f => f.id === req.params.id);

  if (!farmer) {
    return res.status(404).json({ error: "Farmer not found" });
  }

  // ✅ Farmers can only access their own data
  if (req.user.role === "farmer" && req.user.farmerId !== farmer.id) {
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

    const dbFarmers = await read("farmers");
    const dbUsers = await read("users");

    const createdAccounts = [];

    for (const f of farmers) {
      // Generate farmer ID if missing
      const newId = f.id || "F" + (dbFarmers.length + 1).toString().padStart(3, "0");

      // Check if farmer already exists
      const exists = dbFarmers.find(
        farmer => farmer.id === newId || farmer.phone === f.phone
      );

      if (!exists) {
        const newFarmer = {
          id: newId,
          name: f.name || "Unknown",
          phone: f.phone || "-",
          region: f.region || "Unassigned",
          createdAt: new Date().toISOString(),
          isActive: f.isActive !== false
        };

        dbFarmers.push(newFarmer);

        // 🔑 Create login account
        const baseUsername = newFarmer.name.split(" ")[0].toLowerCase();
        let username = baseUsername;
        let counter = 1;

        while (dbUsers.find(u => u.username === username)) {
          username = baseUsername + counter++;
        }

        const password = newFarmer.id; // FarmerId = password

        const newUser = {
          id: "U" + Date.now().toString(36) + Math.floor(Math.random() * 1000),
          username,
          password,
          role: "farmer",
          farmerId: newFarmer.id,
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

    // Save both farmers + users
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
