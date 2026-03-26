FROM node:20-alpine AS builder

WORKDIR /app


RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories


RUN echo "registry=https://registry.npmmirror.com" > /root/.npmrc


COPY package*.json ./

RUN apk add --no-cache python3 make g++

RUN npm ci && npm cache clean --force

COPY . .
RUN undefined

FROM node:20-alpine AS production

WORKDIR /app


RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories


RUN echo "registry=https://registry.npmmirror.com" > /root/.npmrc


COPY --from=builder /app/package*.json ./

RUN apk add --no-cache python3 make g++

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 4100

CMD ["docker", "compose", "-f", "docker-compose.prod.yml", "up", "-d"]
