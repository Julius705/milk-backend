const express = require("express");
const router = express.Router();
const  {requireAuth}  = require("../middleware/auth");
const { requireActiveSubscription } = require("../middleware/subscription");
const { read, write } = require("../utils/fs"); // adjust path if needed

// Milk records
router.get("/milk-records", requireAuth, requireActiveSubscription, async (req, res) => {
  const records = await read("milkRecords");
  res.json(records);
});

// Advances
router.post("/advances", requireAuth, requireActiveSubscription, async (req, res) => {
  const { farmerId, amount } = req.body;
  if (!farmerId || !amount) return res.status(400).json({ error: "Missing fields" });

  const advances = await read("advances");
  advances.push({
    id: "A" + Date.now().toString(36),
    farmerId,
    amount,
    createdAt: new Date().toISOString(),
  });

  await write("advances", advances);
  res.json({ message: "Advance added successfully" });
});

module.exports = router;