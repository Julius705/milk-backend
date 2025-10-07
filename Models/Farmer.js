const mongoose = require("mongoose");

const farmerSchema = new mongoose.Schema({
  id: { type: String, required: true }, // e.g. F001
  name: { type: String, required: true },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  businessId: { type: String, required: true }, // 🔑 aligns with admin's businessId
  createdAt: { type: Date, default: Date.now }
});

// Composite unique index: farmer ID + business
farmerSchema.index({ id: 1, businessId: 1 }, { unique: true });

module.exports = mongoose.model("Farmer", farmerSchema);