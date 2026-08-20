# ── Backend Dockerfile ──
# Node.js 20 Alpine — Express API server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies (with dev deps for potential build steps)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source
COPY . .

# Remove dev dependencies for a leaner production image
RUN npm prune --production --legacy-peer-deps

# ── Production stage ──
FROM node:20-alpine

RUN apk add --no-cache tini curl

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S careconnect && adduser -u 1001 -S careconnect -G careconnect

# Copy production node_modules and source
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src

# Use tini as init so signals (SIGTERM) are forwarded correctly
ENTRYPOINT ["/sbin/tini", "--"]

USER careconnect

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "src/server.js"]
