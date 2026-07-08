# syntax=docker/dockerfile:1.7

FROM node:22.20.0-bookworm AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --prod=false

COPY . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prod=false --offline
RUN pnpm build && pnpm --filter buildingai-client build:web
RUN find . -name node_modules -type d -prune -exec rm -rf '{}' +

FROM node:22.20.0-bookworm-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV SERVER_PORT=4090

WORKDIR /app

RUN corepack enable

COPY --from=builder /app ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store CI=true pnpm install --prod --frozen-lockfile \
    && mkdir -p logs/pm2 storage

EXPOSE 4090

WORKDIR /app/packages/api

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://localhost:' + (process.env.SERVER_PORT || 4090) + '/consoleapi/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
