use axum::{
    routing::{get, post},
    Router,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::models::ApiResponse;

pub mod health;
pub mod todos;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Rust React Starter API",
        version = "0.1.0",
        description = "A simple RPC-style API with Rust and React"
    ),
    paths(
        health::health_check,
        todos::handle_todos,
    ),
    components(
        schemas(
            ApiResponse,
            crate::errors::ErrorResponse,
            crate::models::api::ApiTodo,
            crate::models::api::TodoRequest,
            crate::models::api::TodoResponse,
        )
    ),
    tags(
        (name = "health", description = "Health check endpoints"),
        (name = "todos", description = "Todo operations")
    )
)]
pub struct ApiDoc;

pub fn create_rest() -> Router<crate::AppState> {
    Router::new()
        .route("/api/health", get(health::health_check))
        .route("/api/todos", post(todos::handle_todos))
        .merge(SwaggerUi::new("/api/docs").url("/api/openapi.json", ApiDoc::openapi()))
}
