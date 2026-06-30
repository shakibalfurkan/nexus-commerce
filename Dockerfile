# ─── BUILD STAGE ───
FROM node:24-alpine AS builder

WORKDIR /app

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@11 --activate

# Copy manifest files first to maximize Docker layer caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy configurations and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN pnpm build

# CMD [ "pnpm", "dev" ]

# ─── RUNNER STAGE ───
FROM node:24-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11 --activate

ENV NODE_ENV=production

# Copy lockfile and manifests as the non-root node user
COPY --chown=node:node package.json pnpm-lock.yaml ./

# Install only production dependencies and clear out the pnpm store cache immediately
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# Copy the compiled JS from the builder stage with correct permissions
COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 8080

# Switch to non-root user before execution
USER node

CMD ["node", "dist/server.js"]