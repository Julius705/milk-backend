// routes/reports.js
const express = require("express");
const router = express.Router();
const { read } = require("../utils/fs");
const {requireAuth} = require("../middleware/auth");
const { requireRoles } = require("../middleware/roles");

// ✅ Daily Collections with optional ?date=YYYY-MM-DD
router.get("/daily-collections", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  try {
    const loggedInUser = req.user;
    if (!loggedInUser || !loggedInUser.businessId) {
      return res.status(403).json({ error: "Unauthorized: No business assigned" });
    }

    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split("T")[0];

    const milk = await read("milk");
    const farmers = await read("farmers");
    const users = await read("users");

    // ✅ Filter by businessId and date
    const records = milk.filter(
      r => r.businessId === loggedInUser.businessId &&
           new Date(r.date).toISOString().split("T")[0] === targetDate
    );

    let totalLitres = 0;
    let byStaff = {};
    let byRegion = {};

    for (const r of records) {
      const litres = parseFloat(r.litres);
      totalLitres += litres;

      const staff = users.find(u => u.id === r.createdBy && u.businessId === loggedInUser.businessId);
      const staffName = staff ? staff.username : "Unknown Staff";
      byStaff[staffName] = (byStaff[staffName] || 0) + litres;

      const farmer = farmers.find(f => f.id === r.farmerId && f.businessId === loggedInUser.businessId);
      const region = farmer ? farmer.region : "Unassigned";
      byRegion[region] = (byRegion[region] || 0) + litres;
    }

    res.json({ date: targetDate, totalLitres, byStaff, byRegion });
  } catch (err) {
    console.error("Daily collections report error:", err);
    res.status(500).json({ error: "Failed to generate daily collections report" });
  }
});
// --- Monthly collections ---
router.get("/monthly-collections", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  try {
    const loggedInUser = req.user;
    if (!loggedInUser || !loggedInUser.businessId) {
      return res.status(403).json({ error: "Unauthorized: No business assigned" });
    }

    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ error: "Month (YYYY-MM) is required" });
    }

    const milk = await read("milk");
    const farmers = await read("farmers");
    const users = await read("users");

    // ✅ Filter by businessId and month
    const records = milk.filter(
      r => r.businessId === loggedInUser.businessId && r.date.startsWith(month)
    );

    let byRegion = {};
    let byStaff = {};
    let totalLitres = 0;

    for (const r of records) {
      const litres = parseFloat(r.litres);
      totalLitres += litres;

      const farmer = farmers.find(f => f.id === r.farmerId && f.businessId === loggedInUser.businessId);
      const region = farmer ? farmer.region : "Unassigned";
      byRegion[region] = (byRegion[region] || 0) + litres;

      const staff = users.find(u => u.id === r.createdBy && u.businessId === loggedInUser.businessId);
      const staffName = staff ? staff.username : r.createdBy;
      byStaff[staffName] = (byStaff[staffName] || 0) + litres;
    }

    const sortedRegions = Object.entries(byRegion)
      .sort((a, b) => b[1] - a[1])
      .map(([region, litres]) => ({ region, litres }));

    const sortedStaff = Object.entries(byStaff)
      .sort((a, b) => b[1] - a[1])
      .map(([staff, litres]) => ({ staff, litres }));

    res.json({ month, totalLitres, byRegion: sortedRegions, byStaff: sortedStaff });
  } catch (err) {
    console.error("Monthly collections report error:", err);
    res.status(500).json({ error: "Failed to generate monthly collections report" });
  }
});
// 🟢 Farmer-wise report
router.get("/farmer-wise/:farmerId", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  try {
    const { farmerId } = req.params;
    const loggedInUser = req.user;
    if (!loggedInUser || !loggedInUser.businessId) {
      return res.status(403).json({ error: "Unauthorized: No business assigned" });
    }

    const milk = await read("milk");
    const farmers = await read("farmers");
    const advances = await read("advances");

    // ✅ Find farmer within same business
    const farmer = farmers.find(
      f => f.id.toLowerCase() === farmerId.toLowerCase() &&
           f.businessId === loggedInUser.businessId
    );
    if (!farmer) {
      return res.status(404).json({ error: "Farmer not found or unauthorized" });
    }

    // ✅ Filter milk records for this farmer and business
    const records = milk.filter(
      r => r.farmerId.toLowerCase() === farmerId.toLowerCase() &&
           r.businessId === loggedInUser.businessId
    );

    // ✅ Group by date → session
    const byDate = {};
    records.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = {};
      byDate[r.date][r.session] = (byDate[r.date][r.session] || 0) + parseFloat(r.litres);
    });

    // ✅ Total litres
    const totalLitres = records.reduce((sum, r) => sum + parseFloat(r.litres), 0);

    // ✅ Filter and sum advances for this farmer and business
    const farmerAdvances = advances.filter(
      a => a.farmerId === farmer.id && a.businessId === loggedInUser.businessId
    );
    const totalAdvance = farmerAdvances.reduce((sum, a) => sum + parseFloat(a.amount), 0);

    res.json({
      farmer: {
        id: farmer.id,
        name: farmer.name,
        region: farmer.region
      },
      totalLitres,
      totalAdvance,
      byDate
    });
  } catch (err) {
    console.error("Farmer-wise report error:", err);
    res.status(500).json({ error: "Failed to generate farmer-wise report" });
  }
});
module.exports = router;