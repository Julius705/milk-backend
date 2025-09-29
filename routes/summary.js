// routes/summary.js
const express = require("express");
const { read } = require("../utils/fs");
const {requireAuth} = require("../middleware/auth");
const { requireRole, requireRoles } = require("../middleware/roles");

const router = express.Router();

// 📊 Monthly summary for ALL farmers (all regions combined)
router.get("/monthly", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  const { month, rate } = req.query; // month = "YYYY-MM"
  if (!month) {
    return res.status(400).json({ error: "Month (YYYY-MM) is required" });
  }

  const rRate = rate !== undefined ? Number(rate) : null;
  if (rate !== undefined && (isNaN(rRate) || rRate <= 0)) {
    return res.status(400).json({ error: 'Query param "rate" must be a positive number if provided' });
  }

  const milk = await read("milk");
  const advances = await read("advances");
  const farmers = await read("farmers");

  const results = farmers.map(f => {
    const farmerMilk = milk.filter(
      m => m.farmerId === f.id && m.date.startsWith(month)
    );
    const farmerAdvances = advances.filter(
      a => a.farmerId === f.id && a.date.startsWith(month)
    );

    // Calculate morning/evening split
    let morningLitres = 0, eveningLitres = 0;
    farmerMilk.forEach(m => {
      const litres = Number(m.litres) || 0;
      if ((m.session || "").toLowerCase() === "evening") {
        eveningLitres += litres;
      } else {
        morningLitres += litres;
      }
    });

    const totalMilk = morningLitres + eveningLitres;
    const totalAdvance = farmerAdvances.reduce((sum, a) => sum + Number(a.amount), 0);

    // Gross and net (if rate provided)
    const gross = rRate != null ? totalMilk * rRate : null;
    const net   = rRate != null ? gross - totalAdvance : null;

    return {
      farmerId: f.id,
      farmerName: f.name,
      phone: f.phone || "N/A",
      region: f.region || "Unassigned",
      morningLitres: Number(morningLitres.toFixed(2)),
      eveningLitres: Number(eveningLitres.toFixed(2)),
      totalLitres: Number(totalMilk.toFixed(2)),
      rate: rRate,
      gross: gross != null ? Number(gross.toFixed(2)) : null,
      advance: Number(totalAdvance.toFixed(2)),
      net: net != null ? Number(net.toFixed(2)) : null,
    };
  });

  res.json({
    month,
    rate: rRate,
    monthLabel: new Date(month + "-01").toLocaleString(undefined, { month: "long", year: "numeric" }),
    rows: results
  });
});

// 📊 Monthly summary by region
router.get("/monthly/region", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  const { month } = req.query; // YYYY-MM
  if (!month) {
    return res.status(400).json({ error: "Month (YYYY-MM) is required" });
  }

  try {
    const milk = await read("milk");
    const advances = await read("advances");
    const farmers = await read("farmers");

    // Group by region
    const regions = {};

    farmers.forEach(f => {
      const farmerMilk = milk.filter(
        m => m.farmerId === f.id && m.date.startsWith(month)
      );
      const farmerAdvances = advances.filter(
        a => a.farmerId === f.id && a.date.startsWith(month)
      );

      const totalMilk = farmerMilk.reduce((sum, r) => sum + Number(r.litres), 0);
      const totalAdvance = farmerAdvances.reduce((sum, a) => sum + Number(a.amount), 0);

      if (!regions[f.region]) {
        regions[f.region] = {
          region: f.region,
          totalMilk: 0,
          totalAdvance: 0,
          farmers: []
        };
      }

      regions[f.region].totalMilk += totalMilk;
      regions[f.region].totalAdvance += totalAdvance;
      regions[f.region].farmers.push({
        farmerId: f.id,
        name: f.name,
        totalMilk,
        totalAdvance,
        balance: totalMilk * 50 - totalAdvance // TODO: replace 50 with configurable rate
      });
    });

    // Convert object into array
    let results = Object.keys(regions).map(region => {
      const { totalMilk, totalAdvance } = regions[region];
      return {
        region,
        totalMilk,
        totalAdvance,
        balance: totalMilk * 50 - totalAdvance,
        farmers: regions[region].farmers
      };
    });

    // Sort regions by totalMilk descending
    results.sort((a, b) => (b.totalMilk || 0) - (a.totalMilk || 0));

    res.json({ rows: results });
  } catch (err) {
    console.error("Monthly region summary error:", err);
    res.status(500).json({ error: "Server error computing region summary" });
  }
});

// 📊 Custom summary for multiple farmers within date range
router.post("/custom", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  const { farmerIds, start, end } = req.body;

  if (!Array.isArray(farmerIds) || farmerIds.length === 0) {
    return res.status(400).json({ error: "farmerIds array is required" });
  }
  if (!start || !end) {
    return res.status(400).json({ error: "Start and end dates are required" });
  }

  const farmers = await read("farmers");
  const milk = await read("milk");
  const advances = await read("advances");

  const startDate = new Date(start);
  const endDate = new Date(end);

  const results = farmerIds.map(farmerId => {
    const farmer = farmers.find(f => f.id === farmerId);
    if (!farmer) {
      return { farmerId, error: "Farmer not found" };
    }

    // Filter milk + advances by farmer + date range
    const milkRecords = milk.filter(m => {
      return (
        m.farmerId === farmerId &&
        new Date(m.date) >= startDate &&
        new Date(m.date) <= endDate
      );
    });

    const advanceRecords = advances.filter(a => {
      return (
        a.farmerId === farmerId &&
        new Date(a.date) >= startDate &&
        new Date(a.date) <= endDate
      );
    });

    const totalMilk = milkRecords.reduce((sum, m) => sum + Number(m.litres), 0);
    const totalAdvances = advanceRecords.reduce((sum, a) => sum + Number(a.amount), 0);

    return {
      farmer: { id: farmer.id, name: farmer.name, Phone: farmer.phone || "N/A" , region: farmer.region || "Unassigned" },
      milk: { total: totalMilk, records: milkRecords },
      advances: { total: totalAdvances, records: advanceRecords },
      balance: totalMilk * 50 - totalAdvances // later replace 50 with dynamic rate
    };
  });

  res.json(results);
});
module.exports = router;