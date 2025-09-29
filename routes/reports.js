// routes/reports.js
const express = require("express");
const router = express.Router();
const { read } = require("../utils/fs");
const {requireAuth} = require("../middleware/auth");
const { requireRoles } = require("../middleware/roles");

// ✅ Daily Collections with optional ?date=YYYY-MM-DD
router.get("/daily-collections", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split("T")[0]; // default today

    const milk = await read("milk");
    const farmers = await read("farmers");
    const users = await read("users");

    // Filter by chosen date (normalize to YYYY-MM-DD)
    const records = milk.filter(r => {
      return new Date(r.date).toISOString().split("T")[0] === targetDate;
    });

    let totalLitres = 0;
    let byStaff = {};
    let byRegion = {};

    for (const r of records) {
      const litres = parseFloat(r.litres);
      totalLitres += litres;

      // ✅ Staff totals (using username)
      const staff = users.find(u => u.id === r.createdBy);
      const staffName = staff ? staff.username : "Unknown Staff";
      byStaff[staffName] = (byStaff[staffName] || 0) + litres;

      // ✅ Region totals
      const farmer = farmers.find(f => f.id === r.farmerId);
      const region = farmer ? farmer.region : "Unassigned";
      byRegion[region] = (byRegion[region] || 0) + litres;
    }

    res.json({
      date: targetDate,
      totalLitres,
      byStaff,
      byRegion
    });
  } catch (err) {
    console.error("Daily collections report error:", err);
    res.status(500).json({ error: "Failed to generate daily collections report" });
  }
});
// --- Monthly collections ---
router.get("/monthly-collections", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  try {
    const { month } = req.query; 
    // Expected format: "YYYY-MM" e.g. "2025-09"
    if (!month) {
      return res.status(400).json({ error: "Month (YYYY-MM) is required" });
    }

    const milk = await read("milk");
    const farmers = await read("farmers");
    const users = await read("users");

    // Filter by month
    const records = milk.filter(r => r.date.startsWith(month));

    let byRegion = {};
    let byStaff = {};
    let totalLitres = 0;

    for (const r of records) {
      totalLitres += parseFloat(r.litres);

      // Group by Region
      const farmer = farmers.find(f => f.id === r.farmerId);
      const region = farmer ? farmer.region : "Unassigned";
      byRegion[region] = (byRegion[region] || 0) + parseFloat(r.litres);

      // Group by Staff
      const staff = users.find(u => u.id === r.createdBy);
      const staffName = staff ? staff.username : r.createdBy;
      byStaff[staffName] = (byStaff[staffName] || 0) + parseFloat(r.litres);
    }

    // Sort results (descending order)
    const sortedRegions = Object.entries(byRegion)
      .sort((a, b) => b[1] - a[1])
      .map(([region, litres]) => ({ region, litres }));

    const sortedStaff = Object.entries(byStaff)
      .sort((a, b) => b[1] - a[1])
      .map(([staff, litres]) => ({ staff, litres }));

    res.json({
      month,
      totalLitres,
      byRegion: sortedRegions,
      byStaff: sortedStaff
    });
  } catch (err) {
    console.error("Monthly collections report error:", err);
    res.status(500).json({ error: "Failed to generate monthly collections report" });
  }
});
// 🟢 Farmer-wise report
router.get("/farmer-wise/:farmerId", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  try {
    const { farmerId } = req.params;
    const milk = await read("milk");
    const farmers = await read("farmers");
    const advances = await read("advances");

    const farmer = farmers.find(f => f.id.toLowerCase() === farmerId.toLowerCase());
    if (!farmer) {
      return res.status(404).json({ error: "Farmer not found" });
    }

    // Filter milk records for this farmer
    const records = milk.filter(r => r.farmerId.toLowerCase() === farmerId.toLowerCase());

    // ✅ Group by date → session
    const byDate = {};
    records.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = {};
      byDate[r.date][r.session] = (byDate[r.date][r.session] || 0) + parseFloat(r.litres);
    });

    // ✅ Total litres
    const totalLitres = records.reduce((sum, r) => sum + parseFloat(r.litres), 0);

    // ✅ Total advances
    const farmerAdvances = advances[farmer.id] || [];
    const totalAdvance = farmerAdvances.reduce((sum, a) => sum + parseFloat(a.amount), 0);

    res.json({
      farmer: {
        id: farmer.id,
        name: farmer.name,
        region: farmer.region
      },
      totalLitres,
      totalAdvance,
      byDate // 📅 detailed records per date and session
    });
  } catch (err) {
    console.error("Farmer-wise report error:", err);
    res.status(500).json({ error: "Failed to generate farmer-wise report" });
  }
});
module.exports = router;