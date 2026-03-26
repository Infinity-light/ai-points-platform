FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile

COPY backend/ ./backend/
WORKDIR /app/backend
RUN pnpm build

FROM node:20-alpine AS production
WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/backend/dist /app/backend/dist

RUN mkdir -p /app/backend/uploads /app/backend/data

WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
