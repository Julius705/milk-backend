const mongoose = require("mongoose");

const milkRecordSchema = new mongoose.Schema({
  farmerId: { type: String, required: true },
  date: { type: Date, required: true },
  quantity: { type: Number, required: true },
  shift: { type: String, enum: ["morning", "evening"], required: true },
  price: { type: Number, default: 0 },
  recordedBy: { type: String }, // staff name or id
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MilkRecord", milkRecordSchema);