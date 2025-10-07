const Subscription = require("../Models/Subscription");
const User = require("../Models/User"); // Make sure this matches your actual User model filename

// Subscription plan durations in days
const PLAN_DURATIONS = {
  monthly: 30,
  quarterly: 90,
  yearly: 365
};

// 🔹 Create or renew subscription (Admin only)
exports.subscribe = async (req, res) => {
  try {
    const { plan, amount } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized: missing user info" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ Only admin can activate subscription
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can manage subscriptions" });
    }

    // ✅ Validate plan
    if (!PLAN_DURATIONS[plan]) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const now = new Date();
    const startDate = now;
    const endDate = new Date(now.getTime() + PLAN_DURATIONS[plan] * 24 * 60 * 60 * 1000);

    // ✅ Expire all other active subscriptions
    await Subscription.updateMany({ status: "active" }, { status: "expired" });

    // ✅ Create new subscription
    const newSub = await Subscription.create({
  userId: user._id,
  plan,
  amount,
  startDate,
  endDate,
  status: "active",
  createdBy: user.username || user.email || "admin"
});
    res.status(201).json({
      message: `✅ Subscription activated successfully (${plan})`,
      subscription: newSub
    });

  } catch (error) {
    console.error("❌ Subscription error:", error);
    res.status(500).json({
      message: "Server error while managing subscription",
      error: error.message
    });
  }
};

// 🔹 Check subscription status (for any user)
exports.checkStatus = async (req, res) => {
  try {
    const activeSub = await Subscription.findOne({ status: "active" }).sort({ createdAt: -1 });

    if (!activeSub) {
      return res.json({ status: "expired", message: "No active subscription found" });
    }

    const now = new Date();
    const expiry = new Date(activeSub.endDate);
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      activeSub.status = "expired";
      await activeSub.save();
      return res.json({ status: "expired", message: "Subscription expired" });
    }

    res.json({
      status: "active",
      plan: activeSub.plan,
      daysLeft,
      expiryDate: expiry.toISOString()
    });

  } catch (error) {
    console.error("❌ Check subscription error:", error);
    res.status(500).json({
      message: "Server error while checking subscription",
      error: error.message
    });
  }
};