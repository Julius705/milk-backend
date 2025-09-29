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
router.post("/",requireAuth , requireRoles(["admin", "staff"]), async (req, res) => {
  const { farmerId, date, session, litres } = req.body;

  if (!farmerId || !date || !session || !litres) {
    return res.status(400).json({ error: "Missing farmerId, date, session, or litres" });
  }

  const milk = await read("milk");
  const farmers = await read("farmers");

  const farmer = farmers.find(f => f.id === farmerId);
  if (!farmer) {
    return res.status(404).json({ error: "Farmer not found" });
  }

  // ✅ Prevent duplicates (same farmer + date + session)
  const duplicate = milk.find(
    r => r.farmerId === farmerId && r.date === date && r.session === session
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
    createdBy: req.user.id,   // ✅ track which staff/admin added it
    createdAt: new Date()
  };

  milk.push(newRecord);
  await write("milk", milk);

  res.json(newRecord);
});
// 📖 Get all milk records (Admin + Staff, with optional region filter)
router.get("/", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  const { region } = req.query;
  let milk = await read("milk");
  const farmers = await read("farmers");

  if (region) {
    milk = milk.filter(m => (m.region || "").toLowerCase() === region.toLowerCase());
  }

  // 🔹 Join farmer names
  const enriched = milk.map(m => {
    const farmer = farmers.find(f => f.id === m.farmerId);
    return {
      ...m,
      farmerName: farmer ? farmer.name : "Unknown"
    };
  });

  res.json(enriched);
});
// 👤 Farmer views their own milk records
router.get("/my", requireAuth, requireRole("farmer"), async (req, res) => {
  
  const milk = await read("milk");
  const myRecords = milk.filter(m => m.farmerId === req.user.farmerId);
  res.json(myRecords);
});

// 📥 Download Milk Records Excel Template


router.get("/template", async (req, res) => {
  try {
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

    // Add one sample row
    sheet.addRow({
      farmerId: "F001",
      litres: 20,
      session: "Morning",
      region: "Mukurweini",
      date: "2025-09-17"
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=MilkRecordsTemplate.xlsx"
    );

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generating template:", err);
    res.status(500).json({ error: "Failed to generate template" });
  }
});



// 📖 Get milk records for a specific farmer (Admin + Staff)
router.get("/:farmerId", requireAuth, requireRoles(["admin", "staff"]), async (req, res) => {
  const { farmerId } = req.params;
  const milk = await read("milk");

  const farmerRecords = milk.filter(
    m => m.farmerId.trim().toUpperCase() === farmerId.trim().toUpperCase()
  );

  if (!farmerRecords.length) {
    return res.status(404).json({ error: "Milk record not found" });
  }

  res.json(farmerRecords);
});
// 📤 Export Milk Records to Excel (with Farmer Name)
router.get("/export", requireAuth, async (req, res) => {
  console.log("📤 /api/milk/export route HIT");   // ✅ Route reached

  try {
    // 1. Load existing records
    console.log("📖 Reading milk records...");
    const milkRecords = await read("milk");
    console.log("✅ Milk records loaded:", milkRecords.length);

    console.log("📖 Reading farmers...");
    const farmers = await read("farmers");
    console.log("✅ Farmers loaded:", farmers.length);

    if (!milkRecords || milkRecords.length === 0) {
      console.log("⚠ No milk records to export");
      return res.status(400).json({ error: "No milk records to export" });
    }

    // 2. Create workbook + worksheet
    console.log("📒 Creating Excel workbook...");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Milk Records");

    // 3. Add headers
    console.log("📝 Adding headers...");
    sheet.addRow(["Farmer ID", "Farmer Name", "Litres", "Session", "Region", "Date"]);

    // 4. Add data with farmer names
    console.log("📝 Populating rows...");
    milkRecords.forEach((record, i) => {
      const farmer = farmers.find(f => f.id === record.farmerId);
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

    // 5. Set response headers for file download
    console.log("📤 Setting response headers...");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=MilkRecords.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // 6. Write workbook to response
    console.log("💾 Writing workbook to response...");
    await workbook.xlsx.write(res);

    console.log("✅ Export successful:", milkRecords.length, "records");
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

  const milk = await read("milk");
  const record = milk.find(m => m.id === id);

  if (!record) {
    return res.status(404).json({ error: "Milk record not found" });
  }

  if (litres !== undefined) record.litres = litres;
  if (date !== undefined) record.date = date;

  await write("milk", milk);
  res.json({ ok: true, record });
});

// ❌ Delete milk record (Admin only)
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  let milk = await read("milk");

  const recordIndex = milk.findIndex(m => m.id === id);
  if (recordIndex === -1) {
    return res.status(404).json({ error: "Milk record not found" });
  }

  const deleted = milk.splice(recordIndex, 1);
  await write("milk", milk);

  res.json({ ok: true, deleted });
});
// Configure multer (store file in memory)
const upload = multer({ storage: multer.memoryStorage() });

// 📤 Import Milk Records from Excel
router.post("/import", upload.single("file"), async (req, res) => {
  try {
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

    const imported = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header row

      const [farmerId, litres, session, region, date] = row.values.slice(1);

      if (!farmerId || !litres || !session || !region || !date) {
        console.log(`⚠ Skipping row ${rowNumber} - missing fields`);
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
      });
    });

    console.log("✅ Parsed rows:", imported.length);

    // Save records
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