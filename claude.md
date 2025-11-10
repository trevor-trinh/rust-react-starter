# Rust React Starter - Claude Development Guide

This file provides context for Claude Code when working on this codebase.

## Project Overview

This is a fullstack monorepo with:

- **Backend**: Rust (Axum) with REST + WebSocket APIs
- **Frontend**: Next.js (React 19) with TypeScript
- **Database**: PostgreSQL with SQLx
- **Type Generation**: Automatic TypeScript SDK from Rust OpenAPI schemas

## Architecture

### Backend Structure

```
apps/backend/src/
├── api/
│   ├── rest/           # REST API handlers
│   │   ├── mod.rs      # Router setup + OpenAPI config
│   │   ├── health.rs   # Health check endpoint
│   │   └── todos.rs    # RPC-style unified endpoint
│   └── ws/             # WebSocket handlers
│       ├── mod.rs      # WebSocket exports
│       └── handler.rs  # WS connection handling + broadcast
├── bin/
│   └── generate_openapi.rs  # Binary to generate OpenAPI spec
├── db/
│   ├── mod.rs          # Database abstraction
│   └── pg/             # PostgreSQL implementation
│       ├── mod.rs
│       ├── todos.rs    # Todo database operations
│       └── migrations/ # SQL migration files
├── models/
│   ├── mod.rs          # Model exports
│   ├── domain.rs       # Domain models (data structures with sqlx::FromRow)
│   └── api.rs          # API types (REST + WebSocket messages)
├── errors.rs           # Error handling
├── lib.rs              # Library entry point
└── main.rs             # Server entry point
```

### API Design

#### REST API (RPC-Style)

- **Single Endpoint**: `POST /api/todos`
- **Pattern**: Union type request/response
- **Location**: `apps/backend/src/api/rest/todos.rs:21`

Request types (defined in `models/api.rs`):

```rust
pub enum TodoRequest {
    List,
    Get { id: String },
    Create { title: String, description: Option<String> },
    Update { id: String, title: Option<String>, ... },
    Delete { id: String },
}
```

Response types:

```rust
pub enum TodoResponse {
    List { todos: Vec<ApiTodo> },
    Todo { todo: ApiTodo },
    Deleted { id: String },
}
```

**Why RPC-style?**: Simpler client code, better type safety, single endpoint for all operations.

#### WebSocket API (Real-time)

- **Endpoint**: `ws://localhost:8888/ws`
- **Pattern**: Broadcast to all connected clients
- **Location**: `apps/backend/src/api/ws/handler.rs:45`

Architecture:

1. Client connects → receives all current todos
2. Client sends message → server processes → broadcasts to ALL clients
3. Uses `tokio::sync::broadcast` channel for pub/sub

Client message types (defined in `models/api.rs` - WebSocket section):

```rust
pub enum ClientMessage {
    Create { title: String, description: Option<String> },
    Update { id: String, ... },
    Delete { id: String },
    Toggle { id: String },
}
```

Server message types:

```rust
pub enum ServerMessage {
    Connected { client_id: String, todos: Vec<ApiTodo> },
    Created { todo: ApiTodo },
    Updated { todo: ApiTodo },
    Deleted { id: String },
    Error { message: String },
}
```

**Key Implementation Detail**: Global state using `lazy_static` + `Arc<RwLock<WsState>>` at `handler.rs:40-42`

### Data Layer Architecture

The backend uses a 3-layer architecture for data handling:

1. **Domain Layer** (`models/domain.rs`): Core data structures
   - Structs with `#[derive(sqlx::FromRow)]`
   - Represents database records exactly
   - Example: `Todo` with `Uuid`, `DateTime<Utc>`, etc.

2. **Database Layer** (`db/`): Database operations
   - `db/mod.rs`: Main `Db` struct and connection
   - `db/todos.rs`: Query implementations as `impl Db` methods
   - `db/pg/mod.rs`: PostgreSQL pool setup
   - Uses `sqlx::query_as!` for compile-time verification

3. **API Layer** (`models/api.rs`): Wire format types
   - Request/Response types for REST API
   - WebSocket message types (`ClientMessage`, `ServerMessage`)
   - Conversion implementations (`From<domain::Todo> for ApiTodo`)
   - UUID as `String`, dates serialized for JSON

**Flow**: Database → Domain models → API types → JSON

### Database Layer

**PostgreSQL with SQLx**:

- Compile-time query verification
- Offline mode support (`.sqlx/` directory)
- Migration files named: `YYYYMMDDHHMMSS_description.sql`

**Database operations** (`apps/backend/src/db/todos.rs`):

- `get_all_todos()` - Fetch all todos
- `get_todo_by_id()` - Fetch single todo
- `create_todo()` - Create new todo
- `update_todo()` - Update todo (partial updates supported)
- `delete_todo()` - Delete todo

**Important**: All queries use `sqlx::query_as!` macro for compile-time verification. Operations are implemented as methods on the `Db` struct.

### Frontend Structure

```
apps/frontend/src/
├── app/                # Next.js App Router
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/
│   └── ui/             # shadcn/ui components
├── lib/                # Utilities
└── store/              # Zustand state management
```

### Type Generation Flow

1. **Define Rust types** with `#[derive(ToSchema)]` from `utoipa`
2. **Run**: `just types` (or `cargo run --bin generate_openapi`)
3. **Generates**: `packages/shared/openapi.json`
4. **SDK generation**: `bun --filter @rust-react-starter/sdk generate`
5. **Creates**: `packages/sdk/typescript/src/types/`

**Location**: Type generation binary at `apps/backend/src/bin/generate_openapi.rs`

## Development Commands

### Essential Commands

```bash
just setup          # First-time setup (checks tools + installs + builds)
just db             # Start database + run migrations
just db-prepare     # Generate .sqlx/ for offline mode (commit to git!)
just types          # Regenerate OpenAPI + TypeScript types
just backend        # Start backend (http://localhost:8888)
just frontend       # Start frontend (http://localhost:3000)
```

### Database Commands

```bash
just db             # Start DB + run migrations
just db-stop        # Stop DB (data preserved)
just db-reset       # Destroy all data + fresh start
just db-migrate     # Run migrations only
just db-prepare     # Generate SQLx offline data
```

### Build & Test

```bash
just build          # Build all (uses SQLX_OFFLINE=true)
just test           # Run all tests
just fmt            # Format Rust + TypeScript
just lint           # Lint all code
just typecheck      # TypeScript type checking
just ci             # Run all CI checks
```

## Important Conventions

### Adding a New Endpoint

1. **Define models** in `apps/backend/src/models/api.rs`:

   ```rust
   #[derive(Debug, Serialize, Deserialize, ToSchema)]
   pub struct MyRequest { /* ... */ }
   ```

2. **Create handler** in `apps/backend/src/api/rest/`:

   ```rust
   #[utoipa::path(post, path = "/api/my-endpoint", ...)]
   pub async fn handler(...) { /* ... */ }
   ```

3. **Register route** in `apps/backend/src/api/rest/mod.rs`:

   ```rust
   .route("/api/my-endpoint", post(handler))
   ```

4. **Add to OpenAPI** in `mod.rs`:

   ```rust
   #[openapi(
       paths(my_handler),
       components(schemas(MyRequest, MyResponse))
   )]
   ```

5. **Regenerate types**: `just types`

### Database Migrations

Create new migration:

```bash
# Create file: apps/backend/src/db/pg/migrations/YYYYMMDDHHMMSS_description.sql
# Run: just db-migrate
# Prepare: just db-prepare (commit .sqlx/ to git)
```

**Migration naming**: Use timestamp format `YYYYMMDDHHMMSS_description.sql`
**Example**: `20250101000000_init.sql`

### SQLx Offline Mode

- **Why**: Build without database connection (for CI/CD)
- **Setup**: Run `just db-prepare` after schema changes
- **Commit**: `.sqlx/` directory to git
- **Build**: Uses `SQLX_OFFLINE=true` automatically

### Error Handling

Backend uses custom error types (`apps/backend/src/errors.rs`):

```rust
pub enum AppError {
    BadRequest(String),
    NotFound(String),
    DatabaseError(String),
    InternalError(String),
}
```

Implements `IntoResponse` for automatic HTTP status codes.

## Common Tasks

### Adding a New Table

1. Create migration: `apps/backend/src/db/pg/migrations/YYYYMMDDHHMMSS_add_users.sql`
2. Create domain model: Add to `apps/backend/src/models/domain.rs` (struct with `sqlx::FromRow`)
3. Create DB operations: `apps/backend/src/db/users.rs` (impl methods on `Db`)
4. Create API models: Add to `apps/backend/src/models/api.rs` (request/response types)
5. Create handlers: `apps/backend/src/api/rest/users.rs`
6. Register routes: `apps/backend/src/api/rest/mod.rs`
7. Run: `just db-migrate && just db-prepare && just types`

### Adding shadcn/ui Components

```bash
cd apps/frontend
npx shadcn@latest add [component-name]
```

Components install to: `apps/frontend/src/components/ui/`

### Debugging Database Issues

```bash
# Check migrations
docker exec -it rust-react-starter psql -U postgres -d rust-react-starter -c "\dt"

# View migration history
docker exec -it rust-react-starter psql -U postgres -d rust-react-starter -c "SELECT * FROM _sqlx_migrations"

# Reset if corrupted
just db-reset
```

## Testing

### Integration Tests

Located in: `apps/backend/tests/`

Uses **Testcontainers** for isolated PostgreSQL instances.

Run: `cargo test --test todos_test`

## Environment Variables

Required in `.env`:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/rust-react-starter
HOST=localhost
PORT=8888
NEXT_PUBLIC_API_URL=http://localhost:8888
```

**Note**: justfile exports `DATABASE_URL` automatically.

## CI/CD

GitHub Actions workflow: `.github/workflows/ci.yml`

Runs:

- Backend: format, clippy, tests, build
- Frontend: typecheck, lint, build
- Integration: Full test suite with PostgreSQL

## Key Files to Know

| File                                    | Purpose                     |
| --------------------------------------- | --------------------------- |
| `justfile`                              | Task runner (like Makefile) |
| `Cargo.toml`                            | Rust workspace config       |
| `package.json`                          | Bun workspace config        |
| `apps/backend/src/main.rs:38`           | Server setup & routing      |
| `apps/backend/src/api/rest/mod.rs:40`   | REST API router             |
| `apps/backend/src/api/ws/handler.rs:45` | WebSocket handler           |
| `apps/backend/src/db/pg/todos.rs`       | Database operations         |
| `packages/shared/openapi.json`          | Generated OpenAPI spec      |
| `packages/sdk/typescript/src/types/`    | Generated TS types          |

## Performance Notes

- **WebSocket**: Uses broadcast channels, efficient for multiple clients
- **SQLx**: Compile-time query verification prevents runtime errors
- **Database**: Indexes on `created_at` and `completed` for todos

## Security Considerations

- **CORS**: Permissive mode (change for production in `main.rs:42`)
- **SQL Injection**: Protected by SQLx parameterized queries
- **Input Validation**: Add validation in handlers (see `todos.rs:45-47`)

## Troubleshooting

### "migration was previously applied but is missing"

```bash
just db-reset
```

### "relation does not exist"

```bash
# Ensure migration file is named correctly: YYYYMMDDHHMMSS_description.sql
just db-migrate
just db-prepare
```

### "tools not installed"

```bash
just check-tools  # Shows what's missing + installation links
```

### Build fails with SQLx errors

```bash
# Ensure .sqlx/ directory exists and is up to date
just db-prepare
```

## Best Practices

1. **Always run `just types`** after changing Rust models
2. **Commit `.sqlx/` directory** after `just db-prepare`
3. **Use RPC-style** for simple CRUD, **WebSocket** for real-time
4. **Run `just ci`** before committing
5. **Name migrations** with timestamp prefix
6. **Use `#[derive(ToSchema)]`** for OpenAPI generation
7. **Keep domain models separate** from API models

## References

- Axum docs: https://docs.rs/axum
- SQLx docs: https://docs.rs/sqlx
- utoipa docs: https://docs.rs/utoipa
- Next.js docs: https://nextjs.org/docs
- shadcn/ui: https://ui.shadcn.com
