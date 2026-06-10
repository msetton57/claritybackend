FROM --platform=linux/amd64 node:24-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.5.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile --config.dangerously-allow-all-builds=true

EXPOSE 5000 5173
