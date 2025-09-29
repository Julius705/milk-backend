// routes/mpesa.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const shortcode = process.env.MPESA_TILL; // Your Till or Paybill
const passkey = process.env.MPESA_PASSKEY; // From Daraja portal
const callbackUrl = "https://yourdomain.com/api/mpesa/callback";

// Generate access token
async function getToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return res.data.access_token;
}

// STK Push
router.post("/stkpush", async (req, res) => {
  try {
    const token = await getToken();
    const { phone, amount } = req.body;

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
        PartyA: phone, // Customer phone
        PartyB: shortcode, // Till/Paybill
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: "MilkApp Subscription",
        TransactionDesc: "Subscription Payment"
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ message: "STK push sent", response: response.data });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "M-Pesa request failed" });
  }
});
// Callback from Safaricom (after user enters PIN)
router.post("/callback", async (req, res) => {
  console.log("📩 M-Pesa Callback:", JSON.stringify(req.body, null, 2));

  const { Body } = req.body;
  const stk = Body.stkCallback;

  if (!stk) {
    return res.status(400).json({ message: "Invalid callback" });
  }

  if (stk.ResultCode === 0) {
    // ✅ Payment successful
    const amountPaid = stk.CallbackMetadata.Item.find(i => i.Name === "Amount").Value;
    const phone = stk.CallbackMetadata.Item.find(i => i.Name === "PhoneNumber").Value;

    console.log(`💰 Payment received: KES ${amountPaid} from ${phone}`);

    // 🔎 Load users
    const users = await read("users");
    const admin = users.find(u => u.role === "admin");

    if (admin && admin.subscription) {
      // Verify if amount >= expected
      if (amountPaid >= admin.subscription.amount) {
        admin.subscription.status = "active";
        await write("users", users);
        console.log("✅ Subscription activated");
      } else {
        admin.subscription.status = "failed";
        await write("users", users);
        console.log("❌ Payment less than required, subscription not activated");
      }
    }
  } else {
    console.log(`❌ Payment failed: ${stk.ResultDesc}`);
  }

  // Always respond with success to Safaricom
  res.json({ ResultCode: 0, ResultDesc: "Callback received successfully" });
});

module.exports = router;