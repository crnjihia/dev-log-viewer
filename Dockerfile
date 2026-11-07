# Multi-stage build for Dev Log Viewer Web Shell
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Cache dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile=false

# Build production assets
COPY . .
RUN pnpm run build

# Serve with lightweight Alpine Nginx
FROM nginx:alpine-slim

LABEL org.opencontainers.image.title="Dev Log Viewer" \
      org.opencontainers.image.description="High-performance desktop and web log viewer for multi-gigabyte log streams" \
      org.opencontainers.image.url="https://github.com/crnjihia/dev-log-viewer" \
      org.opencontainers.image.source="https://github.com/crnjihia/dev-log-viewer" \
      org.opencontainers.image.licenses="MIT"

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
