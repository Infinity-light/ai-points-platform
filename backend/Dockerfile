FROM node:20-alpine AS builder
WORKDIR /app

# Use China mirrors for Alpine and npm
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
RUN npm install -g pnpm --registry https://registry.npmmirror.com
RUN pnpm config set registry https://registry.npmmirror.com

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

# Use China mirrors for Alpine and npm
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Build tools needed for native modules (bcrypt uses node-gyp on Alpine/musl)
RUN apk add --no-cache python3 make g++

RUN npm install -g pnpm --registry https://registry.npmmirror.com
RUN pnpm config set registry https://registry.npmmirror.com

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Remove 'prepare' lifecycle (husky) before prod install
COPY backend/package.json /tmp/backend.orig.json
RUN node -e " \
  const fs = require('fs'); \
  const pkg = JSON.parse(fs.readFileSync('/tmp/backend.orig.json', 'utf8')); \
  if (pkg.scripts) delete pkg.scripts.prepare; \
  fs.mkdirSync('./backend', {recursive: true}); \
  fs.writeFileSync('./backend/package.json', JSON.stringify(pkg, null, 2)); \
"
COPY frontend/package.json ./frontend/

# Allow native module build scripts (bcrypt, msgpackr-extract need to compile)
RUN node -e "\
  const fs=require('fs');\
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));\
  pkg.pnpm=pkg.pnpm||{};\
  pkg.pnpm.onlyBuiltDependencies=['bcrypt','msgpackr-extract','unrs-resolver'];\
  fs.writeFileSync('package.json',JSON.stringify(pkg,null,2));\
"

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/backend/dist /app/backend/dist

RUN mkdir -p /app/backend/uploads /app/backend/data

WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
