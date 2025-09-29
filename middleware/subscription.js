/*
// middleware/subscription.js
const { read, write } = require("../utils/fs");
async function requireActiveSubscription(req, res, next) {
  const users = await read("users");
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  // Admin’s subscription
  let subscription = user.subscription;

  if (!subscription) {
    return res.status(403).json({ message: "No subscription found" });
  }

  const now = new Date();
  const expiry = new Date(subscription.expiryDate);

  // 🔴 Auto-expire if past expiry date
  if (expiry < now) {
    subscription.status = "inactive";
    await write("users", users);
    return res.status(403).json({ message: "Subscription expired" });
  }

  // 🟡 Warn if 7 days remaining
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 7) {
    res.setHeader("X-Subscription-Warning", `Only ${daysLeft} days remaining`);
  }

  // ✅ Still active
  next();
}

module.exports = { requireActiveSubscription };
*/
const { read, write } = require("../utils/fs");

async function requireActiveSubscription(req, res, next) {
  const users = await read("users");
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  let subscription = user.subscription;

  if (!subscription) {
    return res.status(403).json({ message: "No subscription found" });
  }

  const now = new Date();
  const expiry = new Date(subscription.expiryDate);

  // 🔴 Auto-expire if past expiry date
  if (expiry < now) {
    subscription.status = "inactive";
    await write("users", users);
    return res.status(403).json({ message: "Subscription expired" });
  }

  // 🟢 Allow access if trial is still valid
  if (subscription.status === "trial") {
    const trialStart = new Date(subscription.trialStartDate);
    const trialEnd = new Date(trialStart.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    if (now <= trialEnd) {
      res.setHeader("X-Subscription-Status", "Trial active");
      return next();
    } else {
      subscription.status = "inactive";
      await write("users", users);
      return res.status(403).json({ message: "Trial expired" });
    }
  }

  // 🟡 Warn if 7 days remaining
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 7) {
    res.setHeader("X-Subscription-Warning", `Only ${daysLeft} days remaining`);
  }

  // ✅ Still active
  next();
}

module.exports = { requireActiveSubscription };