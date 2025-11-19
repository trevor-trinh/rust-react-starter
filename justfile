export DATABASE_URL := "postgresql://postgres:password@localhost:5432/rust-react-starter"

default:
  just --list

setup:
  just check-tools
  just install
  just build

backend:
  cd apps/backend && cargo run

frontend:
  just types
  bun run dev

# ================================
db:
  #!/usr/bin/env bash
  set -euo pipefail
  if docker ps --filter name=rust-react-starter --format '{{{{.Names}}}}' | grep -q rust-react-starter; then
    echo "✅ Database already running"
  else
    echo "🚀 Starting database..."
    docker-compose up postgres -d
    echo "⏳ Waiting for database to be ready..."
    sleep 3
  fi
  echo "📊 Running migrations..."
  just db-migrate
  echo "✅ Database is ready!"

db-stop:
  @docker-compose down
  @echo "✅ Database stopped (data preserved)"

db-reset:
  @echo "🔄 Resetting database (this will destroy all data)..."
  @docker-compose down -v
  @echo "🚀 Starting fresh database..."
  @docker-compose up postgres -d
  @echo "⏳ Waiting for database to be ready..."
  @sleep 3
  @echo "📊 Running migrations..."
  @just db-migrate
  @echo "✅ Database reset complete!"

db-migrate:
  cd apps/backend && cargo sqlx migrate run --source src/db/pg/migrations --database-url $DATABASE_URL

db-prepare:
  cd apps/backend && cargo sqlx prepare --database-url $DATABASE_URL

# ================================

# Check that all required tools are installed
check-tools:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🔍 Checking required tools..."

  MISSING_TOOLS=()

  # Check bun
  if ! command -v bun &> /dev/null; then
    echo "❌ bun is not installed"
    MISSING_TOOLS+=("bun")
  else
    echo "✅ bun $(bun --version)"
  fi

  # Check cargo/rust
  if ! command -v cargo &> /dev/null; then
    echo "❌ cargo is not installed"
    MISSING_TOOLS+=("cargo")
  else
    echo "✅ cargo $(cargo --version | cut -d' ' -f2)"
  fi

  # Check docker
  if ! command -v docker &> /dev/null; then
    echo "❌ docker is not installed"
    MISSING_TOOLS+=("docker")
  else
    echo "✅ docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
  fi

  # Check docker-compose (both standalone and plugin)
  if command -v docker-compose &> /dev/null; then
    echo "✅ docker-compose $(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  elif docker compose version &> /dev/null; then
    echo "✅ docker compose (plugin) $(docker compose version --short)"
  else
    echo "❌ docker-compose is not installed"
    MISSING_TOOLS+=("docker-compose")
  fi

  if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    echo ""
    echo "❌ Missing required tools: ${MISSING_TOOLS[*]}"
    echo ""
    echo "Installation instructions:"
    for tool in "${MISSING_TOOLS[@]}"; do
      case $tool in
        bun)
          echo "  • bun: https://bun.sh/docs/installation"
          ;;
        cargo)
          echo "  • cargo/rust: https://rustup.rs/"
          ;;
        docker)
          echo "  • docker: https://docs.docker.com/get-docker/"
          ;;
        docker-compose)
          echo "  • docker-compose: https://docs.docker.com/compose/install/"
          ;;
      esac
    done
    exit 1
  fi

  echo ""
  echo "✅ All required tools are installed!"

install:
  just check-tools
  bun install

build:
  bun run build:sdk
  SQLX_OFFLINE=true cargo build --workspace

build-test-image:
  @echo "🐳 Building Docker test image..."
  docker build -t rust-react-starter-backend:test -f apps/backend/Dockerfile .
  @echo "✅ Docker test image built"

test:
  just build-test-image
  @echo "🧪 Running Rust unit tests..."
  cargo test --workspace --lib
  @echo "🧪 Running Rust integration tests (sequentially to avoid port conflicts)..."
  cargo test --workspace --test "*" -- --test-threads=1
  @echo "🧪 Running TypeScript SDK tests..."
  bun --filter @rust-react-starter/test-utils build
  bun --filter @rust-react-starter/sdk test
  @echo "✅ All tests passed!"

# ================================

types:
  cd apps/backend && cargo run --bin generate_openapi
  bun --filter @rust-react-starter/sdk generate
  just fmt

fmt:
  bun run format
  cargo fmt --all

lint:
  bun run lint
  cargo clippy --workspace --all-targets

typecheck:
  bun run typecheck

clean:
  bun run clean
  cargo clean

ci:
  just install
  just types
  just fmt
  just lint
  just typecheck
  just db-prepare

