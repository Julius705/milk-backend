const mongoose = require("mongoose");

const advanceSchema = new mongoose.Schema({
  farmerId: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Advance", advanceSchema);