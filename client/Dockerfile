# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@10.4.1 --no-fund --no-audit

# Install dependencies first (layer cache)
COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches/ ./patches/
RUN pnpm install --no-frozen-lockfile

# Copy source files needed for build
COPY client/            ./client/
COPY shared/            ./shared/
COPY tsconfig.json      tsconfig.node.json vite.config.ts components.json ./

# Placeholder for optional @assets alias — build won't fail if nothing imports it
RUN mkdir -p attached_assets

# Build args → ENV so Vite embeds them at build time
ARG VITE_LINE_CHANNEL_ID
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_APP_ID
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_PATHUMMA_API_KEY
ARG VITE_THAILLM_API_KEY
ARG VITE_FRONTEND_FORGE_API_URL
ARG VITE_FRONTEND_FORGE_API_KEY
ENV VITE_LINE_CHANNEL_ID=$VITE_LINE_CHANNEL_ID \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_APP_ID=$VITE_APP_ID \
    VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL \
    VITE_PATHUMMA_API_KEY=$VITE_PATHUMMA_API_KEY \
    VITE_THAILLM_API_KEY=$VITE_THAILLM_API_KEY \
    VITE_FRONTEND_FORGE_API_URL=$VITE_FRONTEND_FORGE_API_URL \
    VITE_FRONTEND_FORGE_API_KEY=$VITE_FRONTEND_FORGE_API_KEY

# Only build the Vite frontend — skip the server/index.ts esbuild step
# (server/ is not needed here; nginx serves the static files)
RUN pnpm exec vite build

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist/public /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
