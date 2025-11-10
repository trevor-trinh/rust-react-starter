use axum::{extract::State, Json};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::models::api::*;
use crate::AppState;

/// Unified handler for all todo operations
#[utoipa::path(
    post,
    path = "/api/todos",
    tag = "todos",
    request_body = TodoRequest,
    responses(
        (status = 200, description = "Operation successful", body = TodoResponse),
        (status = 400, description = "Bad request"),
        (status = 404, description = "Todo not found"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn handle_todos(
    State(state): State<AppState>,
    Json(req): Json<TodoRequest>,
) -> Result<Json<TodoResponse>> {
    match req {
        TodoRequest::List => {
            let todos = state.db.get_all_todos().await?;
            Ok(Json(TodoResponse::List {
                todos: todos.into_iter().map(Into::into).collect(),
            }))
        }

        TodoRequest::Get { id } => {
            let uuid = Uuid::parse_str(&id)
                .map_err(|_| AppError::BadRequest("Invalid UUID".to_string()))?;

            let todo = state
                .db
                .get_todo_by_id(uuid)
                .await?
                .ok_or_else(|| AppError::NotFound("Todo not found".to_string()))?;

            Ok(Json(TodoResponse::Todo { todo: todo.into() }))
        }

        TodoRequest::Create { title, description } => {
            if title.trim().is_empty() {
                return Err(AppError::BadRequest("Title cannot be empty".to_string()));
            }

            let todo = state.db.create_todo(title, description).await?;
            Ok(Json(TodoResponse::Todo { todo: todo.into() }))
        }

        TodoRequest::Update {
            id,
            title,
            description,
            completed,
        } => {
            let uuid = Uuid::parse_str(&id)
                .map_err(|_| AppError::BadRequest("Invalid UUID".to_string()))?;

            if let Some(ref t) = title {
                if t.trim().is_empty() {
                    return Err(AppError::BadRequest("Title cannot be empty".to_string()));
                }
            }

            let todo = state
                .db
                .update_todo(uuid, title, description, completed)
                .await?
                .ok_or_else(|| AppError::NotFound("Todo not found".to_string()))?;

            Ok(Json(TodoResponse::Todo { todo: todo.into() }))
        }

        TodoRequest::Delete { id } => {
            let uuid = Uuid::parse_str(&id)
                .map_err(|_| AppError::BadRequest("Invalid UUID".to_string()))?;

            let deleted = state.db.delete_todo(uuid).await?;

            if !deleted {
                return Err(AppError::NotFound("Todo not found".to_string()));
            }

            Ok(Json(TodoResponse::Deleted {
                id: uuid.to_string(),
            }))
        }
    }
}
