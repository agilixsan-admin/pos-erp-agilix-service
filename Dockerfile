# ====================================================================
# Build Stage
# ====================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and configuration files
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
COPY documentation/ ./documentation/

# Compile TypeScript application
RUN npm run build

# ====================================================================
# Production Runner Stage
# ====================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled artifacts and static documentation from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/documentation ./documentation

# Use existing non-root user 'node' for security
USER node

# Default port
EXPOSE 4500

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-4500}/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]

