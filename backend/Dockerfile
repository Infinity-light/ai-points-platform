FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests for dependency caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile

COPY backend/ ./backend/
WORKDIR /app/backend
RUN pnpm build

FROM node:20-alpine AS production
WORKDIR /app

# Copy workspace node_modules from builder (avoids re-running prepare/husky in --prod)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist /app/backend/dist

RUN mkdir -p /app/backend/uploads /app/backend/data

WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
