# 构建阶段
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# TypeORM 运行时动态 require 驱动，Nitro 无法静态追踪完整依赖闭包；
# 用 npm 安装一份生产依赖（含 mysql2 及其全部传递依赖），tar 合并进产物 node_modules（可覆盖符号链接）
RUN mkdir -p /prune \
    && cp package.json package-lock.json /prune/ \
    && cd /prune \
    && npm ci --omit=dev --ignore-scripts \
    && cd /prune/node_modules \
    && mkdir -p /app/.output/server/node_modules \
    && tar cf - . | tar xf - -C /app/.output/server/node_modules/

# 运行阶段（仅包含构建产物）
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=48980
# HOST/PORT 可通过 .env 覆盖（docker-compose.yml 透传），此处为容器内默认值

# 健康检查依赖的 wget 由 busybox 提供
RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

COPY --from=build /app/.output ./.output

EXPOSE 48980

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-48980}/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
