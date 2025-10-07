const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  plan: { type: String, required: true }, // e.g. 'monthly', 'quarterly'
  amount: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ["active", "expired"], default: "active" },
  createdBy: { type: String }, // developer username or admin email
}, { timestamps: true });

module.exports = mongoose.model("Subscription", subscriptionSchema);