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

# Build tools needed for native modules (bcrypt uses node-gyp on Alpine/musl)
RUN apk add --no-cache python3 make g++

RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Remove 'prepare' lifecycle (husky) before prod install — not needed in Docker
COPY backend/package.json /tmp/backend.orig.json
RUN node -e " \
  const fs = require('fs'); \
  const pkg = JSON.parse(fs.readFileSync('/tmp/backend.orig.json', 'utf8')); \
  if (pkg.scripts) delete pkg.scripts.prepare; \
  fs.mkdirSync('./backend', {recursive: true}); \
  fs.writeFileSync('./backend/package.json', JSON.stringify(pkg, null, 2)); \
"
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/backend/dist /app/backend/dist

RUN mkdir -p /app/backend/uploads /app/backend/data

WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
