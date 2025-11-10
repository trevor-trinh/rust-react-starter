pub mod api;
pub mod db;
pub mod errors;
pub mod models;

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    pub db: db::Db,
}
