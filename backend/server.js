const express = require('express');
const cors = require('cors');
const db = require('./db/database');
const qrsRoutes = require('./routes/qrs');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow Vite dev server (5173), production preview (4173), or custom origin via env
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());

// ── QR redirect ────────────────────────────────────────────────────────────────
app.get('/q/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM qrs WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).send('QR code not found');

    console.log(`QR scanned: ${id} | timestamp: ${new Date().toISOString()}`);
    res.redirect(302, row.destination_url);
  });
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/qrs', qrsRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
