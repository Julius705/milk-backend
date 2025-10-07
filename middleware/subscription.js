const { read, write } = require("../utils/fs");

async function requireActiveSubscription(req, res, next) {
  const users = await read("users");
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(401).json({ message: "User not found" });

  // 🟢 Farmers can always access their own data
  if (user.role === "farmer") {
    console.log("✅ Farmer accessing own account - skip subscription check");
    return next();
  }

  let accountToCheck;

  if (user.role === "admin") {
    accountToCheck = user;
  } else {
    if (!user.businessId)
      return res.status(403).json({ message: "User not linked to a business" });

    const admin = users.find(
      u => u.role === "admin" && u.businessId === user.businessId
    );

    if (!admin)
      return res.status(403).json({ message: "No admin found for this business" });

    accountToCheck = admin;
  }

  return checkSubscription(accountToCheck, users, res, next);
}

async function checkSubscription(account, users, res, next) {
  let subscription = account.subscription;
  console.log("🔍 Subscription:", subscription);

  if (!subscription) {
    return res
      .status(403)
      .json({ message: "No subscription found. Contact admin." });
  }

  const now = new Date();
  const expiry = new Date(subscription.expiryDate);

  // 🔴 Auto-expire if past expiry date
  if (expiry < now) {
    subscription.status = "inactive";
    await write("users", users);
    return res
      .status(403)
      .json({ message: "Subscription expired. Contact admin." });
  }

  // 🟢 Allow access if trial is still valid
  if (subscription.status === "trial") {
    const trialStart = new Date(subscription.trialStartDate);
    const trialEnd = new Date(
      trialStart.getTime() + 30 * 24 * 60 * 60 * 1000
    ); // 30 days

    if (now <= trialEnd) {
      res.setHeader("X-Subscription-Status", "Trial active");
      return next();
    } else {
      subscription.status = "inactive";
      await write("users", users);
      return res
        .status(403)
        .json({ message: "Trial expired. Contact admin." });
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