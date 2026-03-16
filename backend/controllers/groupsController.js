const db = require('../db/database');

// ── GET /api/groups ────────────────────────────────────────────────────────────
const getAll = (req, res) => {
  db.all('SELECT * FROM groups ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ── POST /api/groups ───────────────────────────────────────────────────────────
const create = (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  db.run('INSERT INTO groups (name) VALUES (?)', [name.trim()], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'A group with that name already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
    db.get('SELECT * FROM groups WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json(row);
    });
  });
};

// ── PUT /api/groups/:id ────────────────────────────────────────────────────────
const rename = (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  db.run('UPDATE groups SET name = ? WHERE id = ?', [name.trim(), id], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'A group with that name already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) return res.status(404).json({ error: 'Group not found' });
    db.get('SELECT * FROM groups WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });
};

// ── DELETE /api/groups/:id ─────────────────────────────────────────────────────
// SQLite foreign key enforcement is off by default, so we unassign QRs manually.
const remove = (req, res) => {
  const { id } = req.params;
  db.run('UPDATE qrs SET group_id = NULL WHERE group_id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM groups WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Group not found' });
      res.json({ message: 'Group deleted' });
    });
  });
};

module.exports = { getAll, create, rename, remove };
