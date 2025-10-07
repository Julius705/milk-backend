// routes/milk.js
const express = require("express");
const  {requireAuth } = require("../middleware/auth");
const router = express.Router();
const { read, write } = require("../utils/fs");
const ExcelJS = require("exceljs");

const { requireRole, requireRoles } = require("../middleware/roles");

console.log("milk.js routes loaded");
const multer = require("multer");

const fs = require("fs");
const path = require("path");

// Load milk records (replace this with DB fetch if needed)
const milkFile = path.join(__dirname, "../data/milk.json");

// ➕ Add milk record (Admin + Staff)
router.post("/", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  const { farmerId, date, session, litres } = req.body;

  if (!farmerId || !date || !session || !litres) {
    return res.status(400).json({ error: "Missing farmerId, date, session, or litres" });
  }

  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  const milk = await read("milk");
  const farmers = await read("farmers");

  const farmer = farmers.find(f => f.id === farmerId && f.businessId === loggedInUser.businessId);
  if (!farmer) {
    return res.status(404).json({ error: "Farmer not found or unauthorized" });
  }

  // ✅ Prevent duplicates within same business
  const duplicate = milk.find(
    r =>
      r.farmerId === farmerId &&
      r.date === date &&
      r.session === session &&
      r.businessId === loggedInUser.businessId
  );
  if (duplicate) {
    return res.status(400).json({ error: "Record already exists for this session today" });
  }

  const newRecord = {
    id: "M" + (milk.length + 1).toString().padStart(4, "0"),
    farmerId,
    litres,
    session,
    region: farmer.region || "Unassigned",
    date,
    createdBy: loggedInUser.id,
    createdAt: new Date(),
    businessId: loggedInUser.businessId // 🔐 scoped
  };

  milk.push(newRecord);
  await write("milk", milk);

  res.json(newRecord);
});
// 📖 Get all milk records (Admin + Staff, with optional region filter)
router.get("/", requireAuth,requireRoles(["admin", "staff"]), async (req, res) => {
  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  const { region, farmer, createdBy } = req.query;
  let milk = await read("milk");
  const farmers = await read("farmers");

  // ✅ Filter by businessId
  milk = milk.filter(m => m.businessId === loggedInUser.businessId);

  // ✅ Optional farmer filter
  if (farmer) {
    milk = milk.filter(m => m.farmerId === farmer);
  }

  // ✅ Optional staff-created filter
  if (createdBy) {
    milk = milk.filter(m => m.createdBy === createdBy);
  }

  // ✅ Optional region filter
  if (region) {
    milk = milk.filter(m => (m.region || "").toLowerCase() === region.toLowerCase());
  }

  // Enrich with farmer name
  const enriched = milk.map(m => {
    const farmerObj = farmers.find(
      f => f.id === m.farmerId && f.businessId === loggedInUser.businessId
    );
    return {
      ...m,
      farmerName: farmerObj ? farmerObj.name : "Unknown"
    };
  });

  res.json(enriched);
});
// 👤 Farmer views their own milk records
router.get("/my", requireAuth, requireRole("farmer"), async (req, res) => {
  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId || !loggedInUser.farmerId) {
    return res.status(403).json({ error: "Unauthorized: Missing business or farmer identity" });
  }

  const milk = await read("milk");
  const myRecords = milk.filter(
    m => m.farmerId === loggedInUser.farmerId && m.businessId === loggedInUser.businessId
  );

  res.json(myRecords);
});

// 📥 Download Milk Records Excel Template
router.get("/template", requireAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    if (!loggedInUser || !loggedInUser.businessId) {
      return res.status(403).json({ error: "Unauthorized: No business assigned" });
    }

    console.log("📥 Milk template requested");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Milk Records");

    // Headers
    sheet.columns = [
      { header: "farmerId", key: "farmerId", width: 15 },
      { header: "litres", key: "litres", width: 10 },
      { header: "session", key: "session", width: 12 },
      { header: "region", key: "region", width: 20 },
      { header: "date", key: "date", width: 15 }
    ];

    // Add spacing row between header and content
    sheet.addRow({});
    
    // Sample row
    sheet.addRow({
      farmerId: "F001",
      litres: 20,
      session: "Morning",
      region: "Mukurweini",
      date: "2025-09-17"
    });

    // Response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=MilkRecordsTemplate.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generating template:", err);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

// ✅ Get single milk record (Admin or Staff)
router.get("/:id", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  const { id } = req.params;
  const loggedInUser = req.user;

  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  const milk = await read("milk");
  const record = milk.find(m => m.id === id && m.businessId === loggedInUser.businessId);

  if (!record) {
    return res.status(404).json({ error: "Milk record not found or unauthorized" });
  }

  res.json(record);
});


// 🧹 Bulk delete milk records (Admin only)
router.post("/bulk-delete", requireAuth, requireRole("admin"), async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No IDs provided" });
  }

  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  let milk = await read("milk");

  // Filter out records to keep
  const beforeCount = milk.length;
  milk = milk.filter(m => !(ids.includes(m.id) && m.businessId === loggedInUser.businessId));
  const afterCount = milk.length;

  const deletedCount = beforeCount - afterCount;

  await write("milk", milk);

  res.json({ ok: true, deleted: deletedCount });
});

// 📤 Export Milk Records to Excel (with Farmer Name)
router.get("/export", requireAuth, async (req, res) => {
  console.log("📤 /api/milk/export route HIT");

  try {
    const loggedInUser = req.user;
    if (!loggedInUser || !loggedInUser.businessId) {
      return res.status(403).json({ error: "Unauthorized: No business assigned" });
    }

    // 1. Load records
    console.log("📖 Reading milk records...");
    const milkRecords = await read("milk");
    console.log("✅ Milk records loaded:", milkRecords.length);

    console.log("📖 Reading farmers...");
    const farmers = await read("farmers");
    console.log("✅ Farmers loaded:", farmers.length);

    // 2. Filter by businessId
    const scopedMilk = milkRecords.filter(m => m.businessId === loggedInUser.businessId);
    const scopedFarmers = farmers.filter(f => f.businessId === loggedInUser.businessId);

    if (!scopedMilk || scopedMilk.length === 0) {
      console.log("⚠ No milk records to export");
      return res.status(400).json({ error: "No milk records to export" });
    }

    // 3. Create workbook
    console.log("📒 Creating Excel workbook...");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Milk Records");

    // 4. Add headers
    console.log("📝 Adding headers...");
    sheet.addRow(["Farmer ID", "Farmer Name", "Litres", "Session", "Region", "Date"]);

    // 5. Add spacing row
    sheet.addRow({});

    // 6. Populate rows
    console.log("📝 Populating rows...");
    scopedMilk.forEach((record, i) => {
      const farmer = scopedFarmers.find(f => f.id === record.farmerId);
      const farmerName = farmer ? farmer.name : "Unknown";

      sheet.addRow([
        record.farmerId,
        farmerName,
        record.litres,
        record.session,
        record.region,
        record.date,
      ]);

      if (i < 5) {
        console.log(`➡ Row ${i + 1}:`, record.farmerId, farmerName, record.litres);
      }
    });

    // 7. Set response headers
    console.log("📤 Setting response headers...");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=MilkRecords.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // 8. Write workbook
    console.log("💾 Writing workbook to response...");
    await workbook.xlsx.write(res);

    console.log("✅ Export successful:", scopedMilk.length, "records");
    res.end();
  } catch (err) {
    console.error("❌ Error exporting milk records:", err.message);
    console.error(err.stack);
    res.status(500).json({ error: "Failed to export records" });
  }
});
// ✏ Edit milk record (Admin only)
router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { litres, date } = req.body;

  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  const milk = await read("milk");
  const record = milk.find(m => m.id === id && m.businessId === loggedInUser.businessId);

  if (!record) {
    return res.status(404).json({ error: "Milk record not found or unauthorized" });
  }

  if (litres !== undefined) record.litres = litres;
  if (date !== undefined) record.date = date;

  await write("milk", milk);
  res.json({ ok: true, record });
});
// ❌ Delete milk record (Admin only)
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  let milk = await read("milk");
  const recordIndex = milk.findIndex(
    m => m.id === id && m.businessId === loggedInUser.businessId
  );

  if (recordIndex === -1) {
    return res.status(404).json({ error: "Milk record not found or unauthorized" });
  }

  const deleted = milk.splice(recordIndex, 1);
  await write("milk", milk);

  res.json({ ok: true, deleted });
});
// Configure multer (store file in memory)
const upload = multer({ storage: multer.memoryStorage() });

// 📤 Import Milk Records from Excel
router.post("/import", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const loggedInUser = req.user;
    if (!loggedInUser || !loggedInUser.businessId) {
      return res.status(403).json({ error: "Unauthorized: No business assigned" });
    }

    console.log("📥 Import request received");

    if (!req.file) {
      console.log("❌ No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("✅ File uploaded:", req.file.originalname);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    console.log("✅ Workbook loaded");

    const sheet = workbook.getWorksheet("Milk Records");
    if (!sheet) {
      console.log("❌ No sheet named 'Milk Records'");
      return res.status(400).json({ error: "Sheet 'Milk Records' not found" });
    }

    const farmers = await read("farmers");
    const scopedFarmers = farmers.filter(f => f.businessId === loggedInUser.businessId);

    const imported = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const [farmerId, litres, session, region, date] = row.values.slice(1);

      if (!farmerId || !litres || !session || !region || !date) {
        console.log(`⚠ Skipping row ${rowNumber} - missing fields`);
        return;
      }

      const farmer = scopedFarmers.find(
        f => f.id.trim().toUpperCase() === farmerId.trim().toUpperCase()
      );
      if (!farmer) {
        console.log(`⚠ Skipping row ${rowNumber} - farmer not found or unauthorized`);
        return;
      }

      imported.push({
        id: "M" + Date.now().toString(36) + Math.floor(Math.random() * 1000),
        farmerId,
        litres,
        session,
        region,
        date,
        createdAt: new Date().toISOString(),
        businessId: loggedInUser.businessId // 🔐 scoped
      });
    });

    console.log("✅ Parsed rows:", imported.length);

    const existingRecords = await read("milk");
    const updatedRecords = [...existingRecords, ...imported];
    await write("milk", updatedRecords);

    console.log("✅ Records saved:", updatedRecords.length);
    res.json({ success: true, count: imported.length });
  } catch (err) {
    console.error("❌ Error importing milk records:", err);
    res.status(500).json({ error: "Failed to import records" });
  }
});


module.exports = router;