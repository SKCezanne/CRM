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

/**
 * Get a single lead by id (admin only)
 */
router.get("/:id", auth, (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM leads WHERE id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json(results[0]);
  });
});
/**
 * Update lead status (admin only)
 */
router.put("/:id", auth, (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  if (!["new", "contacted", "converted"].includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  const sql = "UPDATE leads SET status = ? WHERE id = ?";

  db.query(sql, [status, id], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json({ message: "Status updated" });
  });
});
/**
 * Add a note to a lead (admin only)
 */
router.post("/:id/notes", auth, (req, res) => {
  const { note } = req.body;
  const { id } = req.params;

  if (!note) {
    return res.status(400).json({ message: "Note is required" });
  }

  const sql =
    "INSERT INTO lead_notes (lead_id, note) VALUES (?, ?)";

  db.query(sql, [id, note], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });

    res.status(201).json({ message: "Note added" });
  });
});
/**
 * Get notes for a lead (admin only)
 */
router.get("/:id/notes", auth, (req, res) => {
  const { id } = req.params;

  const sql =
    "SELECT id, note, created_at FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC";

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(results);
  });
});

module.exports = router;