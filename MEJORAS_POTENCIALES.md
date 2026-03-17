# Mejoras Potenciales — Interaktive QR Manager

Documento de referencia para escalar el proyecto. Dividido en etapas progresivas.
Cada etapa asume que la anterior está completada.

---

## Estado actual del código

| Componente | Tecnología | Limitación principal |
|---|---|---|
| Backend | Node.js + Express | Sin auth, un solo usuario, SQLite |
| Base de datos | SQLite (`backend/db/database.js`) | No soporta concurrencia alta ni multi-tenant |
| Auth | Hardcodeado en `frontend/app/page.tsx` (`admin/admin123`) | Sin JWT, sin sesiones reales |
| QR caché | `Map` en memoria (`backend/controllers/qrsController.js`) | Se pierde al reiniciar el proceso |
| Frontend | Next.js + Tailwind | Sin roles, sin analytics, un solo tenant |
| Deploy | Easypanel + Vercel | Funciona, escala hasta ~500 usuarios activos |

---

## Etapa 1 — Base sólida (0 → 100 usuarios)

> Objetivo: que el producto sea usable por clientes reales sin romperse.

### 1.1 Auth real con JWT

**Por qué:** hoy el login es un `if` hardcodeado en `page.tsx`. Cualquier usuario puede entrar.

**Cómo aplicarlo:**

Backend — instalar dependencias:
```bash
cd backend && npm install jsonwebtoken bcryptjs
```

Crear `backend/controllers/authController.js`:
```js
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const db = require('../db/database')

const SECRET = process.env.JWT_SECRET || 'cambiar-en-produccion'

exports.login = (req, res) => {
  const { email, password } = req.body
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Credenciales inválidas' })
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' })
    const token = jwt.sign({ userId: user.id, email: user.email }, SECRET, { expiresIn: '7d' })
    res.json({ token })
  })
}
```

Crear `backend/middleware/auth.js`:
```js
const jwt = require('jsonwebtoken')
const SECRET = process.env.JWT_SECRET || 'cambiar-en-produccion'

module.exports = (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' })
  try {
    req.user = jwt.verify(header.slice(7), SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
```

Agregar en `backend/server.js`:
```js
const authRoutes = require('./routes/auth')
app.use('/api/auth', authRoutes)
// Proteger rutas existentes:
const authMiddleware = require('./middleware/auth')
app.use('/api/qrs',    authMiddleware, qrsRoutes)
app.use('/api/groups', authMiddleware, groupsRoutes)
```

Frontend — actualizar `lib/api.ts`:
```ts
// Agregar token a todas las requests
async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('qr-token')
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
  if (res.status === 401) { localStorage.removeItem('qr-token'); window.location.href = '/' }
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`) }
  return res.json()
}
```

### 1.2 Tabla users en la BD

Agregar en `backend/db/database.js` dentro del `db.serialize()`:
```js
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER   PRIMARY KEY AUTOINCREMENT,
    email         TEXT      NOT NULL UNIQUE,
    password_hash TEXT      NOT NULL,
    plan          TEXT      NOT NULL DEFAULT 'free',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`)
// Crear admin inicial (correr una vez)
// bcrypt.hash('tu-password', 10) → guardar el hash
```

### 1.3 Variables de entorno en el backend

Hoy `JWT_SECRET` y `BASE_URL` no están obligados. Agregar validación al inicio de `server.js`:
```js
const required = ['JWT_SECRET', 'BASE_URL']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`ERROR: Variable de entorno ${key} no configurada`)
    process.exit(1)
  }
}
```

Agregar en `docker-compose.yml`:
```yaml
environment:
  JWT_SECRET: "un-secreto-largo-y-random-de-al-menos-32-chars"
  BASE_URL: "https://backends-interaktive-qrservice.u8ww2k.easypanel.host"
  ALLOWED_ORIGINS: "https://interaktive-qr-manager.vercel.app"
```

### 1.4 Rate limiting

Evitar que alguien martille la API o haga fuerza bruta al login:
```bash
cd backend && npm install express-rate-limit
```

En `server.js`:
```js
const rateLimit = require('express-rate-limit')

app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }))
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 200 }))
```

---

## Etapa 2 — Multi-tenancy (100 → 1.000 usuarios)

> Objetivo: que cada cliente tenga sus propios datos aislados.

### 2.1 Agregar user_id a todas las tablas

Migración en `backend/db/database.js`:
```js
db.run(`ALTER TABLE qrs    ADD COLUMN user_id INTEGER REFERENCES users(id)`)
db.run(`ALTER TABLE groups ADD COLUMN user_id INTEGER REFERENCES users(id)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_qrs_user_id    ON qrs(user_id)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id)`)
```

### 2.2 Filtrar todas las queries por user_id

Actualizar `backend/controllers/qrsController.js`:
```js
// Antes:
db.all('SELECT * FROM qrs ORDER BY created_at DESC', [], ...)

// Después (req.user viene del middleware JWT):
db.all('SELECT * FROM qrs WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId], ...)
```

Lo mismo para `create`, `update`, `delete` y `assignGroup` — siempre filtrar por `req.user.userId`.

### 2.3 Migrar de SQLite a PostgreSQL

SQLite no soporta múltiples writes concurrentes. Con más de ~50 usuarios activos simultaneos empieza a dar errores.

```bash
cd backend && npm install pg
```

Reemplazar `backend/db/database.js` con un cliente pg:
```js
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
module.exports = pool
```

Actualizar todas las queries de callbacks SQLite al estilo async/await de pg:
```js
// SQLite (actual):
db.all('SELECT * FROM qrs WHERE user_id = ?', [userId], (err, rows) => { ... })

// PostgreSQL:
const { rows } = await pool.query('SELECT * FROM qrs WHERE user_id = $1', [userId])
```

Opciones de PostgreSQL:
- **Mismo VPS** — gratis, instalar con `apt install postgresql`
- **Supabase** — free tier 500MB, interfaz visual incluida
- **Neon** — serverless PostgreSQL, free tier generoso

Agregar en `docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: qrmanager
      POSTGRES_USER: qruser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data

  backend:
    environment:
      DATABASE_URL: "postgresql://qruser:${DB_PASSWORD}@postgres:5432/qrmanager"
```

### 2.4 Caché de imágenes QR con Redis

Hoy el caché es un `Map` en `qrsController.js` que se pierde al reiniciar. Con múltiples instancias del backend tampoco funciona.

```bash
cd backend && npm install ioredis
```

Reemplazar en `qrsController.js`:
```js
// Antes:
const imageCache = new Map()
// imageCache.has(id) → imageCache.get(id) → imageCache.set(id, buffer)

// Después:
const Redis = require('ioredis')
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// En getImage:
const cached = await redis.getBuffer(`qr:img:${id}`)
if (cached) { res.setHeader('Content-Type', 'image/png'); return res.send(cached) }
// ... generar buffer ...
await redis.set(`qr:img:${id}`, buffer, 'EX', 60 * 60 * 24 * 365) // 1 año
```

Agregar en `docker-compose.yml`:
```yaml
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

### 2.5 Analytics básicos de scans

El hook comercial más importante. Registrar cada escaneo en `server.js`:

```js
// Migración: nueva tabla
db.run(`
  CREATE TABLE IF NOT EXISTS scans (
    id         INTEGER   PRIMARY KEY AUTOINCREMENT,
    qr_id      INTEGER   NOT NULL REFERENCES qrs(id) ON DELETE CASCADE,
    user_id    INTEGER   NOT NULL,
    ip         TEXT,
    country    TEXT,
    device     TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_scans_qr_id    ON scans(qr_id)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_scans_created  ON scans(created_at)`)

// En el redirect /q/:id:
app.get('/q/:id', (req, res) => {
  db.get('SELECT * FROM qrs WHERE id = ?', [id], (err, row) => {
    if (!row) return res.status(404).send('Not found')
    // Registrar scan de forma async (no bloquea el redirect)
    const ip = req.headers['x-forwarded-for'] || req.ip
    const device = /Mobile|Android|iPhone/i.test(req.headers['user-agent'] || '') ? 'mobile' : 'desktop'
    db.run('INSERT INTO scans (qr_id, user_id, ip, device) VALUES (?, ?, ?, ?)',
      [row.id, row.user_id, ip, device])
    res.redirect(302, row.destination_url)
  })
})
```

Nuevo endpoint en `routes/qrs.js`:
```js
router.get('/:id/stats', ctrl.getStats)
```

En `qrsController.js`:
```js
const getStats = (req, res) => {
  const { id } = req.params
  db.all(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM scans WHERE qr_id = ? AND user_id = ?
    GROUP BY DATE(created_at)
    ORDER BY date DESC LIMIT 30
  `, [id, req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
}
```

---

## Etapa 3 — Monetización (planes y pagos)

> Objetivo: cobrar por el servicio de forma automatizada.

### 3.1 Modelo de planes

Agregar columna `plan` en tabla `users` (ya incluida en Etapa 1).

Crear `backend/config/plans.js`:
```js
module.exports = {
  free:    { qrLimit: 5,   analytics: false, customSlug: false, price: 0 },
  starter: { qrLimit: 50,  analytics: true,  customSlug: false, price: 5 },
  pro:     { qrLimit: null, analytics: true,  customSlug: true,  price: 15 },
  agency:  { qrLimit: null, analytics: true,  customSlug: true,  price: 39 },
}
```

Middleware de límites en `backend/middleware/planLimits.js`:
```js
const plans = require('../config/plans')
const db = require('../db/database')

module.exports = async (req, res, next) => {
  const user = await getUserWithPlan(req.user.userId) // query a users
  const plan = plans[user.plan]
  if (plan.qrLimit !== null) {
    const count = await getQrCount(req.user.userId)
    if (count >= plan.qrLimit)
      return res.status(403).json({ error: `Límite de ${plan.qrLimit} QRs alcanzado en tu plan ${user.plan}` })
  }
  next()
}
```

Aplicar en `routes/qrs.js`:
```js
const planLimits = require('../middleware/planLimits')
router.post('/', authMiddleware, planLimits, ctrl.create)
```

### 3.2 Integración con Lemon Squeezy (más fácil que Stripe para Latam)

```bash
cd backend && npm install @lemonsqueezy/lemonsqueezy.js
```

Crear `backend/routes/billing.js`:
```js
// POST /api/billing/checkout — crear sesión de pago
// POST /api/billing/webhook  — recibir eventos de LS (pago, cancelación)
// GET  /api/billing/portal   — portal de gestión del cliente
```

En el webhook, al recibir `order_created`:
```js
// Activar plan del usuario
db.run('UPDATE users SET plan = ? WHERE email = ?', [planName, customerEmail])
```

Variables a agregar en `docker-compose.yml`:
```yaml
LEMONSQUEEZY_API_KEY: "..."
LEMONSQUEEZY_WEBHOOK_SECRET: "..."
LEMONSQUEEZY_STORE_ID: "..."
```

### 3.3 Frontend — página de pricing

Nueva ruta `frontend/app/pricing/page.tsx` — página pública (sin auth) con los 4 planes, botón "Contratar" que llama a `POST /api/billing/checkout`.

### 3.4 Frontend — billing en el dashboard

En `frontend/app/home/page.tsx` agregar badge del plan actual y botón "Mejorar plan" si el usuario está en free/starter.

---

## Etapa 4 — Features premium

> Objetivo: justificar los planes de mayor valor.

### 4.1 Custom slugs

Agregar columna en la BD:
```sql
ALTER TABLE qrs ADD COLUMN slug TEXT UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_qrs_slug ON qrs(slug);
```

Cambiar el redirect en `server.js`:
```js
// Buscar por slug primero, luego por id numérico
app.get('/q/:identifier', (req, res) => {
  const { identifier } = req.params
  const isNumeric = /^\d+$/.test(identifier)
  const query = isNumeric
    ? 'SELECT * FROM qrs WHERE id = ?'
    : 'SELECT * FROM qrs WHERE slug = ?'
  db.get(query, [identifier], ...)
})
```

### 4.2 QR con marca propia (logo + colores)

En `qrsController.js`, el endpoint `/api/qrs/:id/image` acepta query params:
```js
// GET /api/qrs/1/image?color=8b5cf6&bg=ffffff&logo=1
const { color = '000000', bg = 'ffffff' } = req.query
const buffer = await QRCode.toBuffer(url, {
  color: { dark: `#${color}`, light: `#${bg}` },
  width: 400,
})
// Si logo=1, usar sharp para incrustar el logo del usuario encima del QR
```

```bash
cd backend && npm install sharp
```

### 4.3 QR con expiración

Agregar columnas:
```sql
ALTER TABLE qrs ADD COLUMN expires_at  TIMESTAMP;
ALTER TABLE qrs ADD COLUMN scan_limit  INTEGER;
ALTER TABLE qrs ADD COLUMN scan_count  INTEGER DEFAULT 0;
```

En el redirect `/q/:id` verificar antes de redirigir:
```js
if (row.expires_at && new Date(row.expires_at) < new Date())
  return res.status(410).send('Este QR ha expirado')
if (row.scan_limit && row.scan_count >= row.scan_limit)
  return res.status(410).send('Este QR alcanzó su límite de escaneos')
db.run('UPDATE qrs SET scan_count = scan_count + 1 WHERE id = ?', [id])
```

### 4.4 Dashboard de analytics en el frontend

Nueva ruta `frontend/app/home/analytics/[id]/page.tsx`.

Instalar una librería de gráficos ligera:
```bash
cd frontend && pnpm add recharts
```

Mostrar:
- Gráfico de líneas: scans por día (últimos 30 días)
- Pie chart: mobile vs desktop
- Contador total de scans

---

## Etapa 5 — Escala de infraestructura

> Aplicar solo cuando los números lo justifiquen (guidance: +1.000 usuarios activos).

### 5.1 Mover el redirect /q/:id a Cloudflare Workers

El redirect es la ruta más crítica en latencia — la que escanean los usuarios finales.
Moverla a una Edge Function da latencia global de ~30ms en vez de depender de la ubicación del VPS.

```js
// cloudflare-worker/redirect.js
export default {
  async fetch(request, env) {
    const id = new URL(request.url).pathname.split('/q/')[1]
    const dest = await env.QR_KV.get(`qr:${id}`) // KV store de Cloudflare
    if (!dest) return new Response('Not found', { status: 404 })
    return Response.redirect(dest, 302)
  }
}
```

El backend sigue siendo la fuente de verdad — sincroniza a Cloudflare KV en cada CREATE/UPDATE/DELETE de QR.

### 5.2 Separar servicios

```
backend/
├── api-service/      ← CRUD de QRs, autenticación
├── redirect-service/ ← Solo /q/:id, ultra liviano
└── analytics-worker/ ← Procesa scans en background (queue)
```

### 5.3 CDN para imágenes QR

Mover las imágenes QR a **Cloudflare R2** (S3-compatible, gratis hasta 10GB, sin costo por egress):
```bash
cd backend && npm install @aws-sdk/client-s3
```

En `qrsController.js` reemplazar el buffer en Redis por una URL a R2:
```js
// PUT a R2 al generar
// Devolver URL pública: https://r2.tu-dominio.com/qr-images/:id.png
```

### 5.4 Múltiples instancias del backend

Cuando un solo proceso no alcance:
```yaml
# docker-compose.yml
deploy:
  replicas: 3
```

Requiere que el caché de imágenes esté en Redis (Etapa 2.4) y que la BD sea PostgreSQL (Etapa 2.3) — SQLite no funciona con múltiples procesos.

---

## Variables de entorno — estado final

| Variable | Dónde | Descripción |
|---|---|---|
| `JWT_SECRET` | Backend | Secreto para firmar tokens. Mínimo 32 chars aleatorios |
| `BASE_URL` | Backend | URL pública del backend, se encoda en el QR |
| `ALLOWED_ORIGINS` | Backend | Origins CORS permitidos (frontend URLs) |
| `DATABASE_URL` | Backend | Connection string de PostgreSQL |
| `REDIS_URL` | Backend | Redis para caché de imágenes |
| `LEMONSQUEEZY_API_KEY` | Backend | Para crear checkouts |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Backend | Para validar webhooks de pago |
| `NEXT_PUBLIC_API_URL` | Frontend (Vercel) | URL pública del backend |

---

## Prioridad recomendada

```
Etapa 1 → Etapa 2.1/2.2 → Etapa 3 → Etapa 2.3/2.4 → Etapa 4 → Etapa 5
```

No saltar a infra (Etapa 5) antes de tener monetización (Etapa 3) — es optimización prematura.
El negocio real empieza cuando el primer cliente paga.
