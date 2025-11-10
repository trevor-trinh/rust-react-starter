use axum::Json;

use crate::models::ApiResponse;

/// Health check endpoint
#[utoipa::path(
    get,
    path = "/api/health",
    tag = "health",
    responses(
        (status = 200, description = "Server is healthy", body = ApiResponse)
    )
)]
pub async fn health_check() -> Json<ApiResponse> {
    Json(ApiResponse {
        message: "OK".to_string(),
        timestamp: chrono::Utc::now().timestamp() as u64,
    })
}
