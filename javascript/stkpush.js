/*
require('dotenv').config({ path: './javascript/.env' });
console.log('✅ Consumer Key:', process.env.CONSUMER_KEY);
console.log('🔒 Consumer Secret:', process.env.CONSUMER_SECRET);
const axios = require('axios');
require('dotenv').config();

async function getAccessToken() {
  const { CONSUMER_KEY, CONSUMER_SECRET } = process.env;
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

  const res = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${auth}` }
  });

  return res.data.access_token;
}

function generatePassword() {
  const { SHORTCODE, PASSKEY } = process.env;
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');
  return { password, timestamp };
}

async function initiateSTKPush() {
  const token = await getAccessToken();
  const { password, timestamp } = generatePassword();
  const { SHORTCODE, CALLBACK_URL } = process.env;

  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: '1',
    PartyA: '254708374149',
    PartyB: SHORTCODE,
    PhoneNumber: '254708374149',
    CallBackURL: CALLBACK_URL,
    AccountReference: 'TestPayment',
    TransactionDesc: 'Sandbox STK push'
  };

  const res = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', payload, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('STK Push Response:', res.data);
}

initiateSTKPush();
*/
