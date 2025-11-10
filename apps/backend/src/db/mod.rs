pub mod pg;
pub mod todos;

// Re-export PostgreSQL types
pub use sqlx::postgres::{PgPool, Postgres};

/// Main database handle
#[derive(Clone)]
pub struct Db {
    pub pool: PgPool,
}

impl Db {
    /// Create a new Db instance with connection to PostgreSQL
    /// Uses environment variable DATABASE_URL
    pub async fn connect() -> anyhow::Result<Self> {
        Self::connect_with_url(None).await
    }

    /// Create a new Db instance with explicit URL
    /// Useful for testing to avoid environment variable conflicts
    pub async fn connect_with_url(url: Option<String>) -> anyhow::Result<Self> {
        let pool = pg::create_pool(url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create PostgreSQL pool: {}", e))?;

        Ok(Self { pool })
    }
}
