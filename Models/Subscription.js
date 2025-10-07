const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  plan: { type: String, enum: ["monthly", "quarterly", "yearly"], required: true },
  amount: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ["active", "expired"], default: "active" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Subscription", subscriptionSchema);