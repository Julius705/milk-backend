
// server.js
require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");


//console.log("🔑 Consumer Key:", process.env.MPESA_CONSUMER_KEY);
const { read, write } = require("../utils/fs");
const express = require("express");
const cors = require("cors");
const app = express();
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => console.error("❌ MongoDB Connection Failed:", err.message));
// ✅ Global middlewares
app.use(cors()); // CORS first
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Import middleware
const { requireAuth } = require("../middleware/auth");
const { requireActiveSubscription } = require("../middleware/subscription");

// ✅ Import routes
const devRoutes = require("../routes/dev");
const milkRoutes = require("../routes/milk");
const farmerRoutes = require("../routes/farmers");
const reportRoutes = require("../routes/reports");
const authRoutes = require("../routes/auth");
const advancesRoutes = require("../routes/advances");
const summaryRoutes = require("../routes/summary");
const milkExportRoutes = require("../routes/milkExport");
const dataRoutes = require("../routes/data");
const usersRoutes = require("../routes/users");
const subscriptionRoutes = require("../routes/subscription");

// const mpesaRoutes = require("../routes/mpesa");

// ✅ Routes
app.use("/dev", devRoutes);
app.post("/callback", (req, res) => {
  //console.log("STK Callback Received:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// app.use("/api/mpesa", mpesaRoutes);
app.use("/api/auth", authRoutes); // login/register
app.use("/api/data", dataRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/farmers", requireAuth, requireActiveSubscription, farmerRoutes);
app.use("/api/milk", requireAuth, requireActiveSubscription, milkRoutes);
app.use("/api/milk", milkExportRoutes); // export-related endpoints
app.use("/api/users", requireAuth, requireActiveSubscription, usersRoutes);
app.use("/api/reports", requireAuth, requireActiveSubscription, reportRoutes);
app.use("/api/advances", requireAuth, requireActiveSubscription, advancesRoutes);
app.use("/api/summary", requireAuth, requireActiveSubscription, summaryRoutes);
app.use("/api/subscription", require("../routes/subscription"));

// ✅ Example test route
app.get("/api/reports/monthly-collections",
  requireAuth,
  requireActiveSubscription,
  (req, res) => {
    res.json({ message: "Here’s your monthly report" });
  }
);

// ✅ Default root route
app.get("/", (req, res) => {
  res.send("Milk Management Backend is running 🚀");
});

// ✅ Start server (only once!)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
/* ---------- Farmers Helpers ----------*/
function nextFarmerId(farmers) {
  // Find highest numeric part of "Fxxx"
  const maxNum = farmers.reduce((max, f) => {
    const num = parseInt(String(f.id || '').replace(/\D/g, ''), 10);
    return Number.isFinite(num) && num > max ? num : max;
  }, 0);
  const next = maxNum + 1;
  return 'F' + String(next).padStart(3, '0');
}

/* ---------- Farmers Routes ----------*/ 
// ✅ GET all farmers (filtered by businessId and optional active status)
app.get('/api/farmers', async (req, res) => {
  try {
    const user = req.user; // injected by auth middleware

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const onlyActive = String(req.query.active || 'true') === 'true';
    const farmers = await read('farmers');

    // ✅ Filter by businessId (so each business only sees their farmers)
    let data = farmers.filter(f => f.businessId === user.businessId);

    // ✅ Further filter active/inactive if needed
    if (onlyActive) {
      data = data.filter(f => f.isActive !== false);
    }

    res.json(data);
  } catch (err) {
    console.error("Error fetching farmers:", err);
    res.status(500).json({ error: "Server error fetching farmers" });
  }
});
// ✅ GET farmer by ID (filter by businessId)
app.get('/api/farmers/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const user = req.user; // logged-in user injected by auth middleware

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const farmers = await read('farmers');

    // ✅ Filter by both farmerId + businessId
    const farmer = farmers.find(
      f =>
        f.id === farmerId &&
        f.isActive !== false &&
        f.businessId === user.businessId // ✅ match business, not individual owner
    );

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found or inactive' });
    }

    res.json(farmer);
  } catch (err) {
    console.error('Error fetching farmer by ID:', err);
    res.status(500).json({ error: 'Server error fetching farmer' });
  }
});
// POST create farmer { name, phone }
app.post('/api/farmers', async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }

  // ✅ Ensure the logged in user is attached
  const loggedInUser = req.user; 
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  const farmers = await read('farmers');

  const farmer = {
    id: nextFarmerId(farmers),
    name,
    phone,
    isActive: true,
    createdAt: new Date().toISOString(),
    businessId: loggedInUser.businessId   // 🔑 attach farmer to this business
  };

  farmers.push(farmer);
  await write('farmers', farmers);

  res.status(201).json(farmer);
});
// ✅ PUT update farmer by id (scoped by businessId)
app.put('/api/farmers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, isActive, region } = req.body || {};
    const { businessId } = req.user; // 🔑 enforce ownership

    // Normalize ID
    let farmerId = String(id).toUpperCase();
    if (!farmerId.startsWith("F")) farmerId = "F" + farmerId;

    let farmers = await read('farmers');
    const farmer = farmers.find(f => f.id === farmerId && f.businessId === businessId);

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found in your business' });
    }

    // 🔄 Apply updates if provided
    if (name !== undefined) farmer.name = name;
    if (phone !== undefined) farmer.phone = phone;
    if (region !== undefined) farmer.region = region;
    if (isActive !== undefined) farmer.isActive = !!isActive;

    await write('farmers', farmers);

    res.json(farmer);
  } catch (err) {
    console.error("Error updating farmer:", err);
    res.status(500).json({ error: "Server error updating farmer" });
  }
});
// ✅ DELETE (soft delete) farmer by id, scoped by businessId
app.delete('/api/farmers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.user; // 🔑 enforce ownership

    // Normalize ID (auto-add "F")
    let farmerId = String(id).toUpperCase();
    if (!farmerId.startsWith("F")) farmerId = "F" + farmerId;

    let farmers = await read('farmers');
    const farmer = farmers.find(f => f.id === farmerId && f.businessId === businessId);

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found in your business' });
    }

    farmer.isActive = false; // 🔄 soft delete
    await write('farmers', farmers);

    res.json({ ok: true, farmerId, scopedToBusiness: businessId });
  } catch (err) {
    console.error("Error soft-deleting farmer:", err);
    res.status(500).json({ error: "Server error soft deleting farmer" });
  }
});






/* ---------- Milk Routes ---------- */
// ✅ GET milk records (all or filtered by farmerId) - scoped by businessId
app.get('/api/milk', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { businessId } = req.user;
  const milk = await read('milkRecords');
  const farmers = await read('farmers');

  const { farmer } = req.query;
  let filtered = milk.filter(r => r.businessId === businessId);

  // 👇 Staff only sees their own records
  if (req.user.role === "staff") {
    filtered = filtered.filter(r => r.createdBy === req.user.id);
  }

  // ✅ farmer filter (by ID or name)
  if (farmer) {
    filtered = filtered.filter(r => {
      const f = farmers.find(fm => fm.id === r.farmerId && fm.businessId === businessId);
      return (
        r.farmerId.toLowerCase() === farmer.toLowerCase() ||
        (f && f.name.toLowerCase().includes(farmer.toLowerCase()))
      );
    });
  }

  const enriched = filtered.map(r => ({
    ...r,
    farmerName: (farmers.find(f => f.id === r.farmerId && f.businessId === businessId) || {}).name || 'Unknown'
  }));

  res.json(enriched);
});


// ✅ GET a single milk record by ID
app.get('/api/milk/:id', async (req, res) => {
  const { businessId } = req.user;
  const milk = await read('milkRecords');
  const farmers = await read('farmers');

  const record = milk.find(r => r.id === req.params.id && r.businessId === businessId);

  if (!record) {
    return res.status(404).json({ error: "Milk record not found" });
  }

  // 👇 Staff can only access their own records
  if (req.user.role === "staff" && record.createdBy !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const farmer = farmers.find(f => f.id === record.farmerId && f.businessId === businessId);
  res.json({
    ...record,
    farmerName: farmer ? farmer.name : 'Unknown'
  });
});


// ✅ PUT update milk record by ID
app.put('/api/milk/:id', async (req, res) => {
  const { id } = req.params;
  const { farmerId, date, litres, session } = req.body || {};
  const { businessId } = req.user;

  if (!farmerId || !date || !session || isNaN(litres) || litres <= 0) {
    return res.status(400).json({ error: 'Invalid milk record' });
  }

  const milk = await read('milkRecords');
  const index = milk.findIndex(r => r.id === id && r.businessId === businessId);

  if (index === -1) {
    return res.status(404).json({ error: 'Record not found' });
  }

  // Normalize farmerId
  let normFarmerId = String(farmerId).toUpperCase();
  if (!normFarmerId.startsWith("F")) normFarmerId = "F" + normFarmerId;

  // ✅ Prevent duplicate (same farmer/date/session but different ID)
  const duplicate = milk.find(r =>
    r.businessId === businessId &&
    r.farmerId === normFarmerId &&
    r.date === date &&
    r.session === session &&
    r.id !== id
  );
  if (duplicate) {
    return res.status(400).json({ error: 'Duplicate record exists for this farmer, date & session' });
  }

  milk[index] = {
    ...milk[index],
    farmerId: normFarmerId,
    date,
    litres: Number(litres),
    session,
    updatedAt: new Date().toISOString(),
  };

  await write('milkRecords', milk);
  res.json(milk[index]);
});


// ✅ DELETE (soft delete) milk record by ID
app.delete('/api/milk/:id', async (req, res) => {
  const { id } = req.params;
  const { businessId } = req.user;
  const milk = await read('milkRecords');

  const index = milk.findIndex(r => r.id === id && r.businessId === businessId);
  if (index === -1) {
    return res.status(404).json({ error: 'Record not found' });
  }

  milk[index].isActive = false; // ✅ soft delete instead of removing
  milk[index].deletedAt = new Date().toISOString();

  await write('milkRecords', milk);
  res.json({ message: 'Record soft-deleted successfully', deleted: milk[index] });
});

/* ---------- Advances Routes ----------*/ 
app.get('/api/advances', async (req, res) => {
  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  const advances = await read('advances');
  const filtered = advances.filter(a => a.businessId === loggedInUser.businessId);
  res.json(filtered);
});

// ✅ POST add advance { farmerId, date, amount }
app.post('/api/advances', async (req, res) => {
  const { farmerId, date, amount } = req.body || {};
  if (!farmerId || !date || !amount) {
    return res.status(400).json({ error: 'farmerId, date, amount required' });
  }

  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  const advances = await read('advances');
  const record = {
    id: 'A' + Date.now(),
    farmerId,
    date,
    amount: Number(amount),
    businessId: loggedInUser.businessId, // 🔑 attach to business
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  advances.push(record);
  await write('advances', advances);
  res.status(201).json(record);
});

// ✅ PUT update advance by ID
app.put('/api/advances/:id', async (req, res) => {
  const { id } = req.params;
  const { farmerId, date, amount } = req.body || {};

  if (!farmerId || !date || !amount) {
    return res.status(400).json({ error: 'farmerId, date, amount required' });
  }

  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  const advances = await read('advances');
  const index = advances.findIndex(a => a.id === id && a.businessId === loggedInUser.businessId);

  if (index === -1) {
    return res.status(404).json({ error: 'Advance not found or unauthorized' });
  }

  advances[index] = {
    ...advances[index],
    farmerId,
    date,
    amount: Number(amount),
    updatedAt: new Date().toISOString(),
  };

  await write('advances', advances);
  res.json(advances[index]);
});
// ✅ DELETE advance by ID
app.delete('/api/advances/:id', async (req, res) => {
  const { id } = req.params;

  const loggedInUser = req.user;
  if (!loggedInUser || !loggedInUser.businessId) {
    return res.status(403).json({ error: "Unauthorized: No business assigned" });
  }

  let advances = await read('advances');
  const index = advances.findIndex(a => a.id === id && a.businessId === loggedInUser.businessId);

  if (index === -1) {
    return res.status(404).json({ error: 'Advance not found or unauthorized' });
  }

  const deleted = advances[index];
  advances.splice(index, 1);

  await write('advances', advances);
  res.json({ success: true, deleted });
});
// ✅ POST bulk import farmers (per business)
app.post("/api/farmers/import", async (req, res) => {
  try {
    const farmers = Array.isArray(req.body) ? req.body : req.body.farmers;
    if (!farmers || !Array.isArray(farmers)) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const { businessId } = req.user; // 🔑 get business context

    const dbFarmers = await read("farmers");
    const dbUsers = await read("users");

    // ✅ Only count farmers for this business when generating IDs
    const businessFarmers = dbFarmers.filter(f => f.businessId === businessId);
    let nextIdNum = businessFarmers.length + 1;

    const createdAccounts = [];

    for (const f of farmers) {
      // ✅ Normalize farmerId per business
      let rawId = f.id || String(nextIdNum++).padStart(3, "0");
      let farmerId = rawId.startsWith("F") ? rawId : "F" + rawId;

      const newFarmer = {
        id: farmerId,
        name: f.name || f.Name || "Unknown",
        phone: f.phone || f.CONTACTS || f["Phone Number"] || "-",
        region: f.region || "-",
        isActive: f.isActive !== undefined ? f.isActive : true,
        businessId, // 🔑 tie farmer to the correct business
        createdAt: f.createdAt || new Date().toISOString()
      };

      const exists = dbFarmers.find(
        farmer =>
          (farmer.id === newFarmer.id && farmer.businessId === businessId) ||
          (farmer.phone === newFarmer.phone && farmer.businessId === businessId)
      );

      if (!exists) {
        dbFarmers.push(newFarmer);

        // 🔑 Create unique username (per business)
        let baseUsername = newFarmer.name.split(" ")[0].toLowerCase();
        let username = baseUsername;
        let counter = 1;

        while (
          dbUsers.find(
            u => u.username === username && u.businessId === businessId
          )
        ) {
          username = baseUsername + counter++;
        }

        // ✅ Password always matches farmerId
        const password = farmerId;

        const newUser = {
          id:
            "U" +
            Date.now().toString(36) +
            Math.floor(Math.random() * 1000),
          username,
          password,
          role: "farmer",
          farmerId: farmerId,
          businessId, // 🔑 tie login to business
          createdAt: new Date().toISOString()
        };

        dbUsers.push(newUser);

        createdAccounts.push({
          farmerId,
          name: newFarmer.name,
          username: newUser.username,
          password: newUser.password
        });
      }
    }

    console.log(
      `Saving farmers for business ${businessId}:`,
      dbFarmers.filter(f => f.businessId === businessId).length
    );
    await write("farmers", dbFarmers);
    await write("users", dbUsers);

    res.json({
      success: true,
      count: createdAccounts.length,
      accounts: createdAccounts
    });
  } catch (err) {
    console.error("Error importing farmers:", err);
    res.status(500).json({ error: "Server error importing farmers" });
  }
});
// ✅ Bulk delete farmers (scoped by businessId, PERMANENT + auto-fix missing F)
app.post("/api/farmers/bulk-delete", async (req, res) => {
  try {
    let { ids } = req.body;
    const { businessId } = req.user; // 🔑 enforce business ownership

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No farmer IDs provided" });
    }

    // Normalize requested IDs (ensure they all start with "F")
    ids = ids.map(id => {
      id = String(id).toUpperCase();
      return id.startsWith("F") ? id : "F" + id;
    });

    let farmers = await read("farmers");
    let users = await read("users");

    const beforeFarmers = farmers.length;
    const beforeUsers = users.length;

    // 🔧 Auto-fix stored farmer IDs missing "F"
    farmers = farmers.map(f => {
      let fixedId = String(f.id).toUpperCase();
      if (!fixedId.startsWith("F")) fixedId = "F" + fixedId;
      return { ...f, id: fixedId };
    });

    users = users.map(u => {
      if (!u.farmerId) return u;
      let fixedFarmerId = String(u.farmerId).toUpperCase();
      if (!fixedFarmerId.startsWith("F")) fixedFarmerId = "F" + fixedFarmerId;
      return { ...u, farmerId: fixedFarmerId };
    });

    // ✅ Only delete farmers & users that belong to THIS business
    const farmersToDelete = farmers.filter(
      f => ids.includes(f.id) && f.businessId === businessId
    ).map(f => f.id);

    if (farmersToDelete.length === 0) {
      return res.status(404).json({ error: "No matching farmers found in your business" });
    }

    // Perform delete
    farmers = farmers.filter(f => !farmersToDelete.includes(f.id));
    users = users.filter(u => !farmersToDelete.includes(u.farmerId));

    await write("farmers", farmers);
    await write("users", users);

    res.json({
      success: true,
      deletedFarmers: beforeFarmers - farmers.length,
      deletedUsers: beforeUsers - users.length,
      scopedToBusiness: businessId
    });
  } catch (err) {
    console.error("Error bulk deleting farmers:", err);
    res.status(500).json({ error: "Server error bulk deleting farmers" });
  }
});
// ✅ Bulk import milk records (scoped by businessId)
app.post("/api/milk/bulk-import", async (req, res) => {
  try {
    const { records } = req.body;
    const { businessId } = req.user; // 🔑 enforce ownership

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "No milk records provided" });
    }

    let milkRecords = await read("milkRecords");

    // Helper to generate milk record IDs like M0001, M0002...
    const generateMilkId = (index) => {
      const nextNumber = milkRecords.length + index + 1;
      return "M" + nextNumber.toString().padStart(4, "0");
    };

    const newRecords = records
      .map((rec, i) => {
        if (!rec.farmerId || !rec.litres || !rec.date) {
          return null; // skip invalid
        }

        // Normalize farmerId
        let farmerId = String(rec.farmerId).toUpperCase();
        if (!farmerId.startsWith("F")) farmerId = "F" + farmerId;

        return {
          id: generateMilkId(i),
          businessId, // 🔑 link to business
          farmerId,
          litres: Number(rec.litres),
          session: rec.session || "Morning",
          region: rec.region || "Default",
          date: rec.date,
          createdAt: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (newRecords.length === 0) {
      return res.status(400).json({ error: "No valid milk records found" });
    }

    milkRecords.push(...newRecords);
    await write("milkRecords", milkRecords);

    res.json({ success: true, imported: newRecords.length });
  } catch (err) {
    console.error("Error bulk importing milk records:", err);
    res.status(500).json({ error: "Server error bulk importing milk records" });
  }
});
app.get("/test-export", async (req, res) => {
  const ExcelJS = require("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Test Sheet");

  worksheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Name", key: "name", width: 20 },
  ];

  worksheet.addRow({ id: 1, name: "Mary" });
  worksheet.addRow({ id: 2, name: "John" });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=test.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});