const db = require('../db/database');
const QRCode = require('qrcode');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// In-memory QR image cache — the encoded URL (/q/:id) never changes for a given ID
const imageCache = new Map();

// ── GET /api/qrs ───────────────────────────────────────────────────────────────
const getAll = (req, res) => {
  db.all('SELECT * FROM qrs ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ── GET /api/qrs/:id ───────────────────────────────────────────────────────────
const getOne = (req, res) => {
  db.get('SELECT * FROM qrs WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'QR not found' });
    res.json(row);
  });
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const isValidUrl = (str) => {
  try {
    const { protocol } = new URL(str);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

// ── POST /api/qrs ──────────────────────────────────────────────────────────────
const create = (req, res) => {
  const { name, destination_url, group_id } = req.body;

  if (!name || !destination_url) {
    return res.status(400).json({ error: 'name and destination_url are required' });
  }

  if (!isValidUrl(destination_url)) {
    return res.status(400).json({ error: 'destination_url must be a valid http or https URL' });
  }

  const gId = group_id ? parseInt(group_id, 10) : null;

  db.run(
    'INSERT INTO qrs (name, destination_url, group_id) VALUES (?, ?, ?)',
    [name, destination_url, gId || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      db.get('SELECT * FROM qrs WHERE id = ?', [this.lastID], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json(row);
      });
    }
  );
};

// ── PUT /api/qrs/:id ───────────────────────────────────────────────────────────
const update = (req, res) => {
  const { id } = req.params;
  const { destination_url } = req.body;

  if (!destination_url) {
    return res.status(400).json({ error: 'destination_url is required' });
  }

  if (!isValidUrl(destination_url)) {
    return res.status(400).json({ error: 'destination_url must be a valid http or https URL' });
  }

  db.run(
    'UPDATE qrs SET destination_url = ? WHERE id = ?',
    [destination_url, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'QR not found' });

      db.get('SELECT * FROM qrs WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
      });
    }
  );
};

// ── DELETE /api/qrs/:id ────────────────────────────────────────────────────────
const remove = (req, res) => {
  db.run('DELETE FROM qrs WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'QR not found' });
    imageCache.delete(String(req.params.id));
    res.json({ message: 'QR deleted successfully' });
  });
};

// ── GET /api/qrs/:id/image ─────────────────────────────────────────────────────
const getImage = (req, res) => {
  const { id } = req.params;

  if (imageCache.has(id)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(imageCache.get(id));
  }

  db.get('SELECT id FROM qrs WHERE id = ?', [id], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'QR not found' });

    try {
      const buffer = await QRCode.toBuffer(`${BASE_URL}/q/${id}`, { type: 'png', width: 300 });
      imageCache.set(id, buffer);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(buffer);
    } catch {
      res.status(500).json({ error: 'Failed to generate QR image' });
    }
  });
};

// ── PATCH /api/qrs/:id/group ──────────────────────────────────────────────────
const assignGroup = (req, res) => {
  const { id } = req.params;
  const { group_id } = req.body;

  const gId = (group_id != null && group_id !== '') ? parseInt(group_id, 10) : null;
  if (gId !== null && isNaN(gId)) {
    return res.status(400).json({ error: 'group_id must be a valid integer or null' });
  }

  db.run('UPDATE qrs SET group_id = ? WHERE id = ?', [gId, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'QR not found' });
    db.get('SELECT * FROM qrs WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });
};

module.exports = { getAll, getOne, create, update, assignGroup, remove, getImage };
