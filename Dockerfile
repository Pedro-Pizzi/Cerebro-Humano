FROM ghcr.io/puppeteer/puppeteer:latest

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV WA_HEADLESS=true
ENV PORT=4000

USER root

# Create app and data directories
# /data is the Railway volume mount point for SQLite + session persistence
RUN mkdir -p /app /data
WORKDIR /app

# Install system deps: Chromium for Puppeteer + build tools for sqlite3 native module
RUN apt-get update && apt-get install -y chromium build-essential python3 && rm -rf /var/lib/apt/lists/*

# ── Backend ──────────────────────────────────
COPY package*.json ./
# Install all deps (incl. devDeps) — we need tsx to run TypeScript
RUN npm install && npm rebuild sqlite3 --build-from-source

# Copy backend source
COPY tsconfig.json ./
COPY src/ ./src/

# ── Dashboard Frontend ───────────────────────
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ ./
RUN npm run build

# Keep only the built output to save space
# The Express server serves dashboard/dist as static files
RUN rm -rf node_modules

# ── Runtime ──────────────────────────────────
WORKDIR /app
ENV NODE_ENV=production

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -sf http://localhost:4000/api/settings || exit 1

CMD ["npx", "tsx", "src/index.ts"]
