// controllers/subscriptionController.js
const { read, write } = require("../data/users");

const plans = {
  monthly: 30,  // days
  quarterly: 90,
  yearly: 365
};

// 🔹 Create or renew subscription
async function subscribe(req, res) {
  const { plan } = req.body;
  if (!plans[plan]) {
    return res.status(400).json({ message: "Invalid subscription plan" });
  }

  const users = await read("users");
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  const now = new Date();
  let startDate = now;
  let expiryDate;

  // If subscription exists & still active → extend from current expiry
  if (user.subscription && new Date(user.subscription.expiryDate) > now) {
    startDate = new Date(user.subscription.expiryDate);
  }

  expiryDate = new Date(startDate);
  expiryDate.setDate(expiryDate.getDate() + plans[plan]);

  // Save subscription
  user.subscription = {
    plan,
    startDate: now.toISOString(),
    expiryDate: expiryDate.toISOString(),
    status: "active"
  };

  await write("users", users);

  res.json({
    message: `Subscription updated successfully: ${plan}`,
    subscription: user.subscription
  });
}

module.exports = { subscribe };