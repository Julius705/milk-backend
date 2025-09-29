const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

// Paths to your JSON files
const milkFilePath = path.join(__dirname, "../data/milk.json");
const farmersFilePath = path.join(__dirname, "../data/farmers.json");

router.get("/export", async (req, res) => {
  try {
    const milkRecords = JSON.parse(fs.readFileSync(milkFilePath, "utf8"));
    const farmers = JSON.parse(fs.readFileSync(farmersFilePath, "utf8"));

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Milk Records");

    // Define columns
    worksheet.columns = [
      { header: "Farmer ID", key: "farmerId", width: 15 },
      { header: "Farmer Name", key: "farmerName", width: 25 },
      { header: "Litres", key: "litres", width: 10 },
      { header: "Session", key: "session", width: 12 },
      { header: "Region", key: "region", width: 20 },
      { header: "Date", key: "date", width: 20 },
    ];

    // Add rows
    milkRecords.forEach((record) => {
      const farmer = farmers.find((f) => f.id === record.farmerId);
      worksheet.addRow({
        farmerId: record.farmerId,
        farmerName: farmer ? farmer.name : "Unknown",
        litres: record.litres,
        session: record.session,
        region: record.region,
        date: new Date(record.date).toLocaleDateString(),
      });
    });

    // Set headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=MilkRecords.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("❌ Export error:", error);
    res.status(500).send("Error exporting milk records");
  }
});

module.exports = router;