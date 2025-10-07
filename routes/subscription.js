const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");// ✅ move this up
const subscriptionController = require("../controllers/subscriptionController");

router.post("/set", requireAuth, subscriptionController.subscribe);
router.get("/status", requireAuth, subscriptionController.checkStatus);

module.exports = router;