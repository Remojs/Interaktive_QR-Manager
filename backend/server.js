const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./db/database');
const qrsRoutes    = require('./routes/qrs');
const groupsRoutes = require('./routes/groups');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow Next.js dev (3001), Vite dev (5173), production preview (4173), or custom origin via env
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://interaktive-qr-manager.vercel.app', 'https://interaqr.online', 'https://www.interaqr.online' ];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());

// ── Auth ───────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TOKEN_SECRET   = process.env.TOKEN_SECRET || 'change-in-production';

function makeToken() {
  return crypto.createHmac('sha256', TOKEN_SECRET)
    .update(`${ADMIN_EMAIL}:${ADMIN_PASSWORD}`)
    .digest('hex');
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  if (header.slice(7) !== makeToken()) return res.status(401).json({ error: 'Token inválido' });
  next();
}

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return res.status(500).json({ error: 'Servidor no configurado' });
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  res.json({ token: makeToken() });
});
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
app.use('/api/qrs',    requireAuth, qrsRoutes);
app.use('/api/groups', requireAuth, groupsRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

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
