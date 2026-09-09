# ====================================================================
# Build Stage
# ====================================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
COPY documentation/ ./documentation/

RUN npm run build

# ====================================================================
# Production Runner Stage
# ====================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/documentation ./documentation

USER node

EXPOSE 4500

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-4500}/health || exit 1

CMD ["node", "dist/main"]