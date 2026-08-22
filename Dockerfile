# ── Frontend Dockerfile (multi-stage) ──
# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build
COPY . .
# REACT_APP_API_URL is baked into the JS bundle at build time. Defaulting to
# "/api" makes the browser call same-origin URLs, which nginx.conf proxies to
# the api container (no CORS, works from any host). Override via build arg if
# the API lives on a separate domain (e.g. --build-arg REACT_APP_API_URL=https://api.example.com/api).
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine
  
# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
