FROM node:22-alpine AS build

WORKDIR /app

# package-lock.json was generated on Windows, so it lacks musl-specific native
# binaries (rollup, lightningcss, etc.). npm ci would skip them (npm bug #4828).
# Use `npm install` instead which resolves platform-correct optional deps.
COPY package.json package-lock.json ./
RUN npm install --prefer-offline

COPY tsconfig.json vite.config.ts ./
COPY client ./client
RUN npm run check && npm run build -- --outDir /app/dist

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:3000/healthz >/dev/null || exit 1
