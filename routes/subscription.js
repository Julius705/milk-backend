
// routes/subscription.js
const express = require("express");
const router = express.Router();
const  {requireAuth}  = require("../middleware/auth");
const { read, write } = require("../utils/fs");

router.post("/subscribe", requireAuth, async (req, res) => {
  const { plan } = req.body;
  const user = req.user; // ✅ from JWT

  if (user.role !== "admin") {
    return res.status(403).json({ message: "Only admin can manage subscription" });
  }

  // ✅ Decide duration + price based on plan
  let duration, amount;
  if (plan === "monthly") { duration = 30; amount = 1000; }
  else if (plan === "quarterly") { duration = 90; amount = 2500; }
  else if (plan === "yearly") { duration = 365; amount = 9000; }
  else return res.status(400).json({ message: "Invalid plan" });

  // Load users
  const users = await read("users");
  const admin = users.find(u => u.id === user.id);

  if (!admin) {
    return res.status(404).json({ message: "Admin not found" });
  }

  const now = new Date();
  const newExpiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

  // ✅ Mark as pending until payment confirmed
  admin.subscription = {
    plan,
    amount,
    startDate: now.toISOString(),
    expiryDate: newExpiry.toISOString(),
    status: "pending_payment",
  };

  await write("users", users);

  res.json({
    message: `Subscription created. Awaiting payment of KES ${amount}`,
    subscription: admin.subscription,
  });
});

module.exports = router;
router.get("/status", requireAuth, async (req, res) => {
  const users = await read("users");
  const admin = users.find(u => u.id === req.user.id);

  if (!admin) {
    return res.status(404).json({ message: "Admin not found" });
  }

  // Auto-mark expired subscriptions
  const now = new Date();
  if (admin.subscription && new Date(admin.subscription.expiryDate) < now) {
    admin.subscription.status = "expired";
    await write("users", users);
  }

  res.json({ subscription: admin.subscription || null });
});

module.exports = router;