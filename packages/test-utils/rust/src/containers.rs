use backend::db::Db;
use testcontainers::{
    core::{ContainerPort, WaitFor},
    runners::AsyncRunner,
    ContainerAsync, GenericImage, ImageExt,
};
use testcontainers_modules::postgres::Postgres;

/// Container handles for cleanup
pub struct TestDb {
    pub(crate) db: Db,
    pub(crate) _postgres_container: testcontainers::ContainerAsync<Postgres>,
}

impl TestDb {
    /// Set up test database with PostgreSQL container
    ///
    /// This starts a PostgreSQL container, runs migrations automatically,
    /// and returns a TestDb instance. The container will be cleaned up when dropped.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use test_utils::TestDb;
    ///
    /// #[tokio::test]
    /// async fn test_something() {
    ///     let test_db = TestDb::setup().await.unwrap();
    ///     let db = test_db.db();
    ///
    ///     // Use db for testing...
    /// }
    /// ```
    pub async fn setup() -> anyhow::Result<Self> {
        // Start PostgreSQL container
        let postgres_container = Postgres::default()
            .with_tag("16")
            .start()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to start PostgreSQL container: {}", e))?;

        // Get connection details
        let host = postgres_container
            .get_host()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get PostgreSQL host: {}", e))?;

        let port = postgres_container
            .get_host_port_ipv4(5432)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get PostgreSQL port: {}", e))?;

        // Build connection URL
        let database_url = format!("postgresql://postgres:postgres@{}:{}/postgres", host, port);

        // Connect to database
        let db = Db::connect_with_url(Some(database_url.clone()))
            .await
            .map_err(|e| anyhow::anyhow!("Failed to connect to database: {}", e))?;

        Ok(TestDb {
            db,
            _postgres_container: postgres_container,
        })
    }

    /// Get a reference to the database connection
    pub fn db(&self) -> &Db {
        &self.db
    }

    /// Get a clone of the database connection
    ///
    /// Useful when you need to move the Db into another struct or pass it to functions.
    pub fn db_clone(&self) -> Db {
        self.db.clone()
    }
}

/// Backend test server
///
/// Manages the lifecycle of both PostgreSQL and Backend containers for integration testing.
/// The backend container is built from the Dockerfile and connected to PostgreSQL.
pub struct BackendTestServer {
    _postgres_container: ContainerAsync<Postgres>,
    _backend_container: ContainerAsync<GenericImage>,
    api_url: String,
    ws_url: String,
}

impl BackendTestServer {
    /// Set up backend test server with PostgreSQL and backend containers
    ///
    /// This starts a PostgreSQL container and the backend container.
    /// The containers will be cleaned up when dropped.
    ///
    /// **Prerequisites**: The Docker image `rust-react-starter-backend:test` must exist.
    /// Build it with: `just build-test-image` or `docker build -t rust-react-starter-backend:test -f apps/backend/Dockerfile .`
    ///
    /// # Example
    ///
    /// ```no_run
    /// use test_utils::BackendTestServer;
    ///
    /// #[tokio::test]
    /// async fn test_api() {
    ///     let server = BackendTestServer::setup().await.unwrap();
    ///     let api_url = server.api_url();
    ///
    ///     // Make HTTP requests to api_url...
    /// }
    /// ```
    pub async fn setup() -> anyhow::Result<Self> {
        // Start PostgreSQL container
        let postgres_container = Postgres::default()
            .with_tag("16")
            .start()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to start PostgreSQL container: {}", e))?;

        // Get PostgreSQL connection details
        let pg_port = postgres_container
            .get_host_port_ipv4(5432)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get PostgreSQL port: {}", e))?;

        // Build database URL based on platform
        // On Linux (including CI), use 172.17.0.1 (Docker bridge gateway)
        // On Mac/Windows, use host.docker.internal
        let database_url = if cfg!(target_os = "linux") {
            // On Linux, containers can reach the host's localhost via the Docker bridge gateway
            format!(
                "postgresql://postgres:postgres@172.17.0.1:{}/postgres",
                pg_port
            )
        } else {
            // On Mac/Windows (Docker Desktop), use host.docker.internal
            format!(
                "postgresql://postgres:postgres@host.docker.internal:{}/postgres",
                pg_port
            )
        };

        // Create backend image (already built in setup())
        let backend_image = GenericImage::new("rust-react-starter-backend", "test")
            .with_wait_for(WaitFor::message_on_stdout("Backend server running"))
            .with_exposed_port(ContainerPort::Tcp(8888));

        // Start backend container with environment variables
        let backend_container = backend_image
            .with_env_var("DATABASE_URL", database_url)
            .with_env_var("HOST", "0.0.0.0")
            .with_env_var("PORT", "8888")
            .start()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to start backend container: {}", e))?;

        // Get backend connection details
        let backend_host = backend_container
            .get_host()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get backend host: {}", e))?;

        let backend_port = backend_container
            .get_host_port_ipv4(8888)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get backend port: {}", e))?;

        let api_url = format!("http://{}:{}", backend_host, backend_port);
        let ws_url = format!("ws://{}:{}", backend_host, backend_port);

        Ok(BackendTestServer {
            _postgres_container: postgres_container,
            _backend_container: backend_container,
            api_url,
            ws_url,
        })
    }

    /// Get the base URL for REST API requests
    pub fn api_url(&self) -> &str {
        &self.api_url
    }

    /// Get the base URL for WebSocket connections (without /ws path)
    pub fn ws_url(&self) -> &str {
        &self.ws_url
    }

    /// Get the full WebSocket URL (includes /ws path)
    pub fn full_ws_url(&self) -> String {
        format!("{}/ws", self.ws_url)
    }
}
