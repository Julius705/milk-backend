
// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
// ✅ Import routes
const milkRoutes = require("../routes/milk");
const farmerRoutes = require("../routes/farmers");
const reportRoutes = require("../routes/reports");
const authRoutes = require("../routes/auth");
const advancesRoutes = require("../routes/advances");
const summaryRoutes = require("../routes/summary");
const milkExportRoutes = require("../routes/milkExport");
const dataRoutes = require("../routes/data");
const mpesaRoutes = require("../routes/mpesa");

// ✅ Middleware
const  {requireAuth}  = require("../middleware/auth");
const { requireActiveSubscription } = require("../middleware/subscription");
const app = express();

// ✅ Global middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Routes
app.use("/api/mpesa", mpesaRoutes);
app.use("/api/auth", authRoutes); // login/register
app.use("/api", require("../routes/data"));
app.use("/api/farmers", requireAuth, requireActiveSubscription, farmerRoutes);
app.use("/api/milk", requireAuth, requireActiveSubscription, milkRoutes);
app.use("/api/milk", milkExportRoutes); // export-related endpoints
app.use("/api/reports", requireAuth, requireActiveSubscription, reportRoutes);
app.use("/api/advances", requireAuth, requireActiveSubscription, advancesRoutes);
app.use("/api/summary", requireAuth, requireActiveSubscription, summaryRoutes);
app.use("/api/data", dataRoutes);
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

// GET all farmers (optionally only active)
app.get('/api/farmers', async (req, res) => {
  const onlyActive = String(req.query.active || 'true') === 'true';
  const farmers = await read('farmers');
  const data = onlyActive ? farmers.filter(f => f.isActive !== false) : farmers;
  res.json(data);
});
// ✅ GET farmer by ID (skip inactive)
app.get('/api/farmers/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const farmers = await read('farmers');
    const farmer = farmers.find(f => f.id === farmerId && f.isActive !== false);

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found or inactive' });
    }

    res.json(farmer);
  } catch (err) {
    console.error('Error fetching farmer by ID:', err);
    res.status(500).json({ error: 'Server error fetching farmer' });
  }
});
// POST create farmer  { name, phone }
app.post('/api/farmers', async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }

  const farmers = await read('farmers');
  const farmer = {
    id: nextFarmerId(farmers),
    name,
    phone,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  farmers.push(farmer);
  await write('farmers', farmers);
  res.status(201).json(farmer);
});

// PUT update farmer by id
app.put('/api/farmers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, isActive, region} = req.body || {};

  const farmers = await read('farmers');
  const idx = farmers.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Farmer not found' });

  if (name !== undefined) farmers[idx].name = name;
  if (phone !== undefined) farmers[idx].phone = phone;
  if(region !== undefined) farmers[idx].region = region;
  if (isActive !== undefined) farmers[idx].isActive = !!isActive;

  await write('farmers', farmers);
  res.json(farmers[idx]);
});

// DELETE (soft delete) farmer by id
app.delete('/api/farmers/:id', async (req, res) => {
  const { id } = req.params;
  const farmers = await read('farmers');
  const idx = farmers.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Farmer not found' });

  farmers[idx].isActive = false; // soft delete
  await write('farmers', farmers);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
/* ---------- Milk Routes ---------- */

// GET milk records (all or filtered by farmerId)
app.get('/api/milk', async (req, res) => {
  const milk = await read('milk');
  const farmers = await read('farmers');
  const { farmer } = req.query;

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let filtered = milk;

  // 👇 Staff only sees their own records
  if (req.user.role === "staff") {
    filtered = filtered.filter(r => r.createdBy === req.user.id);
  }

  // ✅ farmer filter (works for both staff/admin)
  if (farmer) {
    filtered = filtered.filter(r => {
      const f = farmers.find(fm => fm.id === r.farmerId);
      return (
        r.farmerId.toLowerCase() === farmer.toLowerCase() ||
        (f && f.name.toLowerCase().includes(farmer.toLowerCase()))
      );
    });
  }

  const enriched = filtered.map(r => ({
    ...r,
    farmerName: (farmers.find(f => f.id === r.farmerId) || {}).name || 'Unknown'
  }));

  res.json(enriched);
});
// GET a single milk record by its recordId
app.get('/api/milk/:id', async (req, res) => {
  const milk = await read('milk');
  const farmers = await read('farmers');
  const record = milk.find(r => r.id === req.params.id);

  if (!record) {
    return res.status(404).json({ error: "Milk record not found" });
  }

  // 👇 Staff can only access their own records
  if (req.user.role === "staff" && record.createdBy !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const farmer = farmers.find(f => f.id === record.farmerId);
  res.json({
    ...record,
    farmerName: farmer ? farmer.name : 'Unknown'
  });
});

// PUT update milk record by ID
app.put('/api/milk/:id', async (req, res) => {
  const { id } = req.params;
  const { farmerId, date, litres, session } = req.body || {};

  if (!farmerId || !date || !session || isNaN(litres) || litres <= 0) {
    return res.status(400).json({ error: 'Invalid milk record' });
  }

  const milk = await read('milk');
  const index = milk.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Record not found' });
  }

  // ✅ Prevent duplicate (same farmer/date/session but different ID)
  const duplicate = milk.find(r =>
    r.farmerId === farmerId &&
    r.date === date &&
    r.session === session &&
    r.id !== id
  );
  if (duplicate) {
    return res.status(400).json({ error: 'Duplicate record exists for this farmer, date & session' });
  }

  milk[index] = {
    ...milk[index],
    farmerId,
    date,
    litres: Number(litres),
    session,
    updatedAt: new Date().toISOString(),
  };
  
  console.log("Updating ID:", id);
  console.log("Incoming data:", { farmerId, date, session, litres });
  console.log("Current record:", milk[index]);
  console.log("Duplicate check against:", milk.map(r => ({ id: r.id, farmerId: r.farmerId, date: r.date, session: r.session })));
  
  await write('milk', milk);
  res.json(milk[index]);
});


// DELETE milk record by ID
app.delete('/api/milk/:id', async (req, res) => {
  const { id } = req.params;
  const milk = await read('milk');

  const index = milk.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Record not found' });
  }

  const deleted = milk.splice(index, 1)[0];
  await write('milk', milk);

  res.json({ message: 'Record deleted successfully', deleted });
});

/* ---------- Advances Routes ----------*/ 

// ✅ GET all advances
app.get('/api/advances', async (req, res) => {
  const advances = await read('advances');
  res.json(advances);
});

// ✅ POST add advance { farmerId, date, amount }
app.post('/api/advances', async (req, res) => {
  const { farmerId, date, amount } = req.body || {};
  if (!farmerId || !date || !amount) {
    return res.status(400).json({ error: 'farmerId, date, amount required' });
  }

  const advances = await read('advances');
  const record = {
    id: 'A' + Date.now(),
    farmerId,
    date,
    amount: Number(amount),
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

  const advances = await read('advances');
  const index = advances.findIndex(a => a.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Advance not found' });
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
  let advances = await read('advances');
  const index = advances.findIndex(a => a.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Advance not found' });
  }

  const deleted = advances[index];
  advances.splice(index, 1);

  await write('advances', advances);
  res.json({ success: true, deleted });
});



const path = require("path");

// Middlewares


// Import routes
const usersRoute = require("../routes/users");
const farmersRoute = require("../routes/farmers");
const milkRoute = require("../routes/milk");
const advancesRoute = require("../routes/advances");
const summaryRoute = require("../routes/summary");
const authRoute = require("../routes/auth");

// Use routes
app.use(express.json());
app.use("/api/users", usersRoute);
app.use("/api/farmers", farmersRoute);
app.use("/api/milk", milkRoute);
app.use("/api/advances", advancesRoute);
app.use("/api/summary", summaryRoute);
app.use("/api/auth", authRoute);
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// POST bulk import farmers
app.post("/api/farmers/import", async (req, res) => {
  try {
    const farmers = Array.isArray(req.body) ? req.body : req.body.farmers;
    if (!farmers || !Array.isArray(farmers)) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const dbFarmers = await read("farmers");
    const dbUsers = await read("users");

    let nextIdNum = dbFarmers.length + 1;

    const createdAccounts = [];

    for (const f of farmers) {
      // ✅ Normalize farmerId
      let rawId = f.id || String(nextIdNum++).padStart(3, "0");
      let farmerId = rawId.startsWith("F") ? rawId : "F" + rawId;

      const newFarmer = {
        id: farmerId,
        name: f.name || f.Name || "Unknown",
        phone: f.phone || f.CONTACTS || f["Phone Number"] || "-",
        region: f.region || "-",
        isActive: f.isActive !== undefined ? f.isActive : true,
        createdAt: f.createdAt || new Date().toISOString()
      };

      const exists = dbFarmers.find(
        farmer => farmer.id === newFarmer.id || farmer.phone === newFarmer.phone
      );

      if (!exists) {
        dbFarmers.push(newFarmer);

        // 🔑 Create unique username
        let baseUsername = newFarmer.name.split(" ")[0].toLowerCase();
        let username = baseUsername;
        let counter = 1;

        while (dbUsers.find(u => u.username === username)) {
          username = baseUsername + counter++;
        }

        // ✅ Password always matches farmerId
        const password = farmerId;

        const newUser = {
          id: "U" + Date.now().toString(36) + Math.floor(Math.random() * 1000),
          username,
          password,
          role: "farmer",
          farmerId: farmerId,
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

    console.log("Saving farmers:", dbFarmers.length);
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
// ✅ Bulk delete farmers (PERMANENT + auto-fix missing F)
app.post("/api/farmers/bulk-delete", async (req, res) => {
  try {
    let { ids } = req.body; 
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

    // Now actually delete matching IDs
    farmers = farmers.filter(f => !ids.includes(f.id));
    users = users.filter(u => !ids.includes(u.farmerId));

    await write("farmers", farmers);
    await write("users", users);

    res.json({
      success: true,
      deletedFarmers: beforeFarmers - farmers.length,
      deletedUsers: beforeUsers - users.length
    });
  } catch (err) {
    console.error("Error bulk deleting farmers:", err);
    res.status(500).json({ error: "Server error bulk deleting farmers" });
  }
});
// ✅ Bulk import milk records
app.post("/api/milk/bulk-import", async (req, res) => {
  try {
    const { records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "No milk records provided" });
    }

    let milkRecords = await read("milkRecords");

    // Helper to generate milk record IDs like M001, M002...
    const generateMilkId = (index) => {
      const nextNumber = milkRecords.length + index + 1;
      return "M" + nextNumber.toString().padStart(4, "0");
    };

    const newRecords = records.map((rec, i) => ({
      id: generateMilkId(i),
      farmerId: rec.farmerId,
      litres: Number(rec.litres),
      session: rec.session || "Morning",
      region: rec.region || "Default",
      date: rec.date,
      createdAt: new Date().toISOString(),
    }));

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