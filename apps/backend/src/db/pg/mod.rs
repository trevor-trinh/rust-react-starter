use anyhow::Context;
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::env;

/// Create a PostgreSQL connection pool and run migrations
/// If url is provided, it will be used instead of reading from environment
pub async fn create_pool(url: Option<String>) -> anyhow::Result<PgPool> {
    let database_url = url
        .or_else(|| env::var("DATABASE_URL").ok())
        .context("DATABASE_URL must be provided or set in environment")?;

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;

    // Run migrations automatically
    log::info!("Running PostgreSQL migrations...");
    sqlx::migrate!("./src/db/pg/migrations")
        .run(&pool)
        .await
        .context("Failed to run PostgreSQL migrations")?;
    log::info!("✅ PostgreSQL migrations complete");

    Ok(pool)
}
