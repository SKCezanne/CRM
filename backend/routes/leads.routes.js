const express = require("express");
const db = require("../config/db");
const auth = require("../middleware/auth");

const router = express.Router();

/**
 * Create a new lead
 * This can be used by website forms or admin
 */
router.post("/", (req, res) => {
  const { name, email, phone, source } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: "Name and email required" });
  }

  const sql =
    "INSERT INTO leads (name, email, phone, source) VALUES (?, ?, ?, ?)";

  db.query(sql, [name, email, phone, source], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });

    res.status(201).json({
      message: "Lead created",
      leadId: result.insertId,
    });
  });
});

/**
 * Get all leads (admin only)
 */
router.get("/", auth, (req, res) => {
  const sql = "SELECT * FROM leads ORDER BY created_at DESC";

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(results);
  });
});

module.exports = router;