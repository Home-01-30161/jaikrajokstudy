FROM node:22-alpine AS build

WORKDIR /app

# Install locked dependencies before copying source so Docker can reuse the
# dependency layer when only application code changes.
# npm ci on Alpine may skip the musl-specific rollup binary (npm bug #4828),
# so we force-install it afterwards.
COPY package.json package-lock.json ./
RUN npm ci && npm i @rollup/rollup-linux-x64-musl --no-save 2>/dev/null || true

COPY tsconfig.json vite.config.ts ./
COPY client ./client
RUN npm run check && npm run build -- --outDir /app/dist

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:3000/healthz >/dev/null || exit 1
