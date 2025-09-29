// routes/advances.js
const express = require("express");
const router = express.Router();
const { read, write } = require("../utils/fs");
const {requireAuth} = require("../middleware/auth");
const { requireRole, requireRoles } = require("../middleware/roles");



// ➕ Add advance (Admin only)
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const { farmerId, amount, date } = req.body;

  if (!farmerId || !amount) {
    return res.status(400).json({ error: "Missing farmerId or amount" });
  }

  const farmers = await read("farmers");
  const farmer = farmers.find(f => f.id === farmerId);
  if (!farmer) {
    return res.status(404).json({ error: "Farmer not found" });
  }

  const advances = await read("advances");

  const newAdvance = {
    id: "A" + (advances.length + 1).toString().padStart(4, "0"),
    farmerId,
    region: farmer.region || null, // attach farmer's region
    amount,
    date: date || new Date(),
    createdAt: new Date()
  };

  advances.push(newAdvance);
  await write("advances", advances);

  res.json(newAdvance);
});

// 📖 Get all advances (Admin + Staff, with optional ?region=Central)
router.get("/", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  const { region } = req.query;
  const advances = await read("advances");
  const farmers = await read("farmers");

  let filtered = advances;
  if (region) {
    filtered = filtered.filter(a => a.region && a.region.toLowerCase() === region.toLowerCase());
  }

  // Attach farmer info
  const enriched = filtered.map(a => {
    const farmer = farmers.find(f => f.id === a.farmerId);
    return {
      ...a,
      farmer: farmer ? { id: farmer.id, name: farmer.name } : { id: a.farmerId, name: "Unknown" }
    };
  });

  res.json(enriched);
});
// 👤 Farmer views their own advances
router.get("/my", requireAuth, requireRole("farmer"), async (req, res) => {
  const advances = await read("advances");
  const myRecords = advances.filter(a => a.farmerId === req.user.farmerId);
  res.json(myRecords);
});

router.get("/:farmerId", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  try {
    const advances = await read("advances");
    const farmers = await read("farmers");

    const farmerAdvances = advances.filter(a => a.farmerId === req.params.farmerId);
    const farmer = farmers.find(f => f.id === req.params.farmerId);

    if (farmerAdvances.length === 0) {
      return res.json([]);
    }

    const enriched = farmerAdvances.map(a => ({
      ...a,
      farmer: farmer ? { id: farmer.id, name: farmer.name } : { id: a.farmerId, name: "Unknown" }
    }));

    res.json(enriched);
  } catch (err) {
    console.error("Error in GET /:farmerId:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// ✏ Edit advance (Admin only)
router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { amount, date } = req.body;

  const advances = await read("advances");
  const record = advances.find(a => a.id === id);

  if (!record) {
    return res.status(404).json({ error: "Advance record not found" });
  }

  if (amount !== undefined) record.amount = amount;
  if (date !== undefined) record.date = date;

  await write("advances", advances);
  res.json({ ok: true, record });
});

// ❌ Delete advance (Admin only)
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  let advances = await read("advances");

  const index = advances.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Advance record not found" });
  }

  const deleted = advances.splice(index, 1);
  await write("advances", advances);

  res.json({ ok: true, deleted });
});

module.exports = router;