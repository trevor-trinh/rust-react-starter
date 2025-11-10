# Stage 1: Builder
FROM rust:1.90-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy entire workspace
COPY . .

# Build backend in offline mode
ENV SQLX_OFFLINE=true
RUN cargo build --release --bin backend

# Stage 2: Runtime
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/target/release/backend /app/backend

# Copy migrations
COPY apps/backend/src/db/pg/migrations /app/migrations

ENV HOST=0.0.0.0
ENV PORT=8888
ENV RUST_LOG=info

EXPOSE 8888

CMD ["/app/backend"]
