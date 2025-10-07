const mongoose = require("mongoose");

// Models
const Farmer = require("../Models/Farmer");
const MilkRecord = require("../Models/MilkRecord");
const User = require("../Models/User");

// Data
const farmersData = require("../data/farmers.json");
const milkData = require("../data/milk.json");
const usersData = require("../data/users.json");
/*
// Migration functions
async function migrateFarmers() {
  for (const item of farmersData) {
    try {
      const existing = await Farmer.findOne({ id: item.id, businessId: item.businessId });
      if (!existing) {
        await Farmer.create(item);
      } else {
        console.log(`⚠️ Skipped duplicate farmer: ${item.id} for business ${item.businessId}`);
      }
    } catch (err) {
      console.error("❌ Error migrating farmer:", err.message);
    }
  }
  console.log("✅ Farmers migrated successfully");
}
*/
async function migrateMilkRecords() {
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of milkData) {
    try {
      const transformed = {
        farmerId: item.farmerId,
        date: new Date(item.date),
        quantity: item.litres,
        shift: item.session?.toLowerCase(), // "Morning" → "morning"
        price: item.price || 0,
        recordedBy: item.createdBy,
        createdAt: new Date(item.createdAt)
      };

      if (transformed.farmerId && transformed.date && transformed.shift && transformed.quantity) {
        await MilkRecord.create(transformed);
        inserted++;
      } else {
        console.warn("⚠️ Skipped invalid milk record:", item);
        skipped++;
      }
    } catch (err) {
      console.error("❌ Error migrating milk record:", err.message);
      failed++;
    }
  }

  console.log("✅ Milk records migration complete");
  console.log(`📦 Inserted: ${inserted}`);
  console.log(`🚫 Skipped (missing fields): ${skipped}`);
  console.log(`❌ Failed (errors): ${failed}`);
}
/*
async function migrateUsers() {
  for (const item of usersData) {
    try {
      await User.create(item);
    } catch (err) {
      console.error("❌ Error migrating user:", err.message);
    }
  }
  console.log("✅ Users migrated successfully");
}
*/
// Runner
async function runMigration() {
  await mongoose.connect("mongodb://127.0.0.1:27017/milk");
  console.log("🚀 Connected to MongoDB");

  //await migrateFarmers();
  await migrateMilkRecords();
  //await migrateUsers();

  mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
}

runMigration();