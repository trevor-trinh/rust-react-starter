# Stage 1: Builder
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy entire workspace
COPY . .

# Install dependencies (initial pass)
RUN bun install --frozen-lockfile --ignore-scripts

# Build SDK first (required for frontend)
WORKDIR /app/packages/sdk/typescript
RUN bun run build

# Re-install to fix file: dependency symlinks after SDK build
WORKDIR /app
RUN bun install --frozen-lockfile --ignore-scripts

# Build frontend
WORKDIR /app/apps/frontend

ARG NEXT_PUBLIC_API_URL=http://localhost:8888
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8888

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# Stage 2: Runtime
FROM oven/bun:1-slim

WORKDIR /app

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "apps/frontend/server.js"]
