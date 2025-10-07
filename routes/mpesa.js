/*
// routes/mpesa.js
const express = require("express");
const axios = require("axios");
const router = express.Router();
const { read, write } = require("../utils/fs");

const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const shortcode = process.env.MPESA_TILL; 
const passkey = process.env.MPESA_PASSKEY;
const callbackUrl = "http://localhost:5000/api/mpesa/callback";

// ✅ Phone formatter
function formatPhone(phone) {
  if (phone.startsWith("0")) return "254" + phone.slice(1);
  if (phone.startsWith("+")) return phone.slice(1);
  return phone;
}

// 🔑 Generate access token
async function getToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${auth}` } }
  );
  console.log("🔑 Access Token:", res.data.access_token);
  return res.data.access_token;
}

// 📲 STK Push
router.post("/stkpush", async (req, res) => {
  try {
    const token = await getToken();
    const { phone, amount } = req.body;
    const formattedPhone = formatPhone(phone);

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: formattedPhone, 
        PartyB: shortcode, 
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: "MilkApp Subscription",
        TransactionDesc: "Subscription Payment"
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ message: "STK push sent", response: response.data });
  } catch (err) {
    console.error("❌ M-Pesa Error:", err.response?.data || err.message);
    res.status(500).json({ message: "M-Pesa request failed" });
  }
});

// ✅ MOCK payment route – just forwards fake Safaricom payload to /callback
router.post("/mock", async (req, res) => {
  const { phone, amount } = req.body;
  const now = new Date();

  // Fake Safaricom-like response
  const mockPayload = {
    Body: {
      stkCallback: {
        ResultCode: 0,
        ResultDesc: "Processed successfully",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: amount },
            { Name: "MpesaReceiptNumber", Value: "TEST123XYZ" },
            { Name: "TransactionDate", Value: now.getTime() },
            { Name: "PhoneNumber", Value: formatPhone(phone) },
          ],
        },
      },
    },
    mock: true, // mark it as mock
  };

  // Forward to callback logic
  req.body = mockPayload;
  return router.handle(req, res); 
});

// ✅ Callback route (handles both mock & real)
router.post("/callback", async (req, res) => {
  try {
    const body = req.body;
    console.log("📥 Callback received:", JSON.stringify(body, null, 2));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return res.status(400).json({ message: "Invalid callback data" });
    }

    // Payment failed
    if (stkCallback.ResultCode !== 0) {
      return res.json({ success: false, message: stkCallback.ResultDesc });
    }

    // Extract metadata
    const metadata = stkCallback.CallbackMetadata.Item;
    const amount = metadata.find(item => item.Name === "Amount")?.Value || 0;
    const phone = metadata.find(item => item.Name === "PhoneNumber")?.Value;

    // Determine subscription plan
    let plan = "monthly", duration = 30;
    if (amount === 1000) { plan = "monthly"; duration = 30; }
    else if (amount === 2500) { plan = "quarterly"; duration = 90; }
    else if (amount === 8000) { plan = "yearly"; duration = 365; }

    const now = new Date();
    const expiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

    // Update admin subscription
    const users = await read("users");
    const admin = users.find(u => u.role === "admin");
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    admin.subscription = {
      plan,
      amount,
      startDate: now.toISOString(),
      expiryDate: expiry.toISOString(),
      status: "active",
    };

    await write("users", users);

    console.log("✅ Subscription updated:", admin.subscription);
    return res.json({ success: true, subscription: admin.subscription });
  } catch (err) {
    console.error("❌ Callback error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
*/