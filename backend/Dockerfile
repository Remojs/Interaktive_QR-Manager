# ── Stage 1: build native deps ────────────────────────────────────────────────
FROM node:20-alpine AS builder

# sqlite3 requires Python + build tools to compile its native binding
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy compiled node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY . .

# Directory for the SQLite database (mounted as a volume in production)
RUN mkdir -p /app/db

EXPOSE 3000

CMD ["node", "server.js"]
