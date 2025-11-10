use anyhow::Context;
use axum::{routing::get, Router};
use backend::api::{rest, ws};
use backend::db::Db;
use backend::AppState;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables
    let _ = dotenvy::from_path(".env");

    env_logger::init();

    // ===============================
    // Configuration
    // ===============================
    let host = std::env::var("HOST").unwrap_or_else(|_| "localhost".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "8888".to_string());
    let addr = format!("{}:{}", host, port);

    log::info!("Starting server...");

    // ===============================
    // Connect to database
    // ===============================
    let db = Db::connect()
        .await
        .context("Failed to connect to database")?;
    log::info!("Connected to PostgreSQL");

    // ===============================
    // Create axum app
    // ===============================
    let rest = rest::create_rest();
    let state = AppState { db };

    let app = Router::new()
        .route("/ws", get(ws::ws_handler))
        .merge(rest)
        .with_state(state)
        .layer(CorsLayer::permissive());

    // ===============================
    // Start server
    // ===============================
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .context(format!("Failed to bind to {}", addr))?;

    println!("\n🚀 Backend server running on http://{}", addr);
    println!("📖 OpenAPI docs: http://{}/api/docs", addr);
    println!("📋 OpenAPI spec: http://{}/api/openapi.json", addr);
    println!("🔌 WebSocket endpoint: ws://{}/ws\n", addr);

    axum::serve(listener, app).await.context("Server error")?;

    Ok(())
}
