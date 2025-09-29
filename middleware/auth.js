// middleware/auth.js
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  //console.log("🔑 Incoming auth header:", authHeader);

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Malformed token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
/*
//const jwt = require("jsonwebtoken");
//const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  //console.log("🔑 Incoming auth header:", authHeader);

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Malformed token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    //console.log("✅ Token is valid:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
     // console.log("⏰ Token has expired");
      return res.status(403).json({ error: "Token expired" });
    } else {
      console.log("❌ Invalid token:", err.message);
      return res.status(403).json({ error: "Invalid token" });
    }
  }
}

module.exports = { requireAuth };
*/