use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ============================================================================
// REST API TYPES
// ============================================================================

#[derive(Serialize, Deserialize, ToSchema)]
pub struct ApiResponse {
    pub message: String,
    pub timestamp: u64,
}

// ============================================================================
// TODO API TYPES
// ============================================================================

/// API representation of a Todo item
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, JsonSchema)]
pub struct ApiTodo {
    pub id: String, // UUID as string for JSON compatibility
    pub title: String,
    pub description: Option<String>,
    pub completed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Unified request for all todo operations
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TodoRequest {
    /// List all todos
    List,
    /// Get a single todo by ID
    Get { id: String },
    /// Create a new todo
    Create {
        title: String,
        description: Option<String>,
    },
    /// Update an existing todo
    Update {
        id: String,
        title: Option<String>,
        description: Option<String>,
        completed: Option<bool>,
    },
    /// Delete a todo
    Delete { id: String },
}

/// Unified response for all todo operations
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TodoResponse {
    /// List of todos
    List { todos: Vec<ApiTodo> },
    /// Single todo
    Todo { todo: ApiTodo },
    /// Deleted todo ID
    Deleted { id: String },
}

// ============================================================================
// REST API SPECIFIC TYPES
// ============================================================================

/// Request to create a new todo
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateTodoRequest {
    pub title: String,
    pub description: Option<String>,
}

/// Request to update an existing todo
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateTodoRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub completed: Option<bool>,
}

/// Response for listing todos
#[derive(Debug, Serialize, ToSchema)]
pub struct ListTodosResponse {
    pub todos: Vec<ApiTodo>,
}

/// Response for getting a single todo
#[derive(Debug, Serialize, ToSchema)]
pub struct GetTodoResponse {
    pub todo: ApiTodo,
}

/// Response for creating a todo
#[derive(Debug, Serialize, ToSchema)]
pub struct CreateTodoResponse {
    pub todo: ApiTodo,
}

/// Response for updating a todo
#[derive(Debug, Serialize, ToSchema)]
pub struct UpdateTodoResponse {
    pub todo: ApiTodo,
}

/// Response for deleting a todo
#[derive(Debug, Serialize, ToSchema)]
pub struct DeleteTodoResponse {
    pub id: String,
}

// ============================================================================
// CONVERSION IMPLEMENTATIONS
// ============================================================================

impl From<super::domain::Todo> for ApiTodo {
    fn from(todo: super::domain::Todo) -> Self {
        Self {
            id: todo.id.to_string(),
            title: todo.title,
            description: todo.description,
            completed: todo.completed,
            created_at: todo.created_at,
            updated_at: todo.updated_at,
        }
    }
}

// ============================================================================
// WEBSOCKET MESSAGES
// ============================================================================

/// Messages sent from client to server
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Create a new todo
    Create {
        title: String,
        description: Option<String>,
    },
    /// Update an existing todo
    Update {
        id: String,
        title: Option<String>,
        description: Option<String>,
        completed: Option<bool>,
    },
    /// Delete a todo
    Delete { id: String },
    /// Toggle todo completion status
    Toggle { id: String },
    /// Ping message to keep connection alive
    Ping,
}

/// Messages sent from server to client
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Sent when client first connects (includes all todos)
    Connected {
        client_id: String,
        todos: Vec<ApiTodo>,
    },
    /// Broadcast when a todo is created
    Created { todo: ApiTodo },
    /// Broadcast when a todo is updated
    Updated { todo: ApiTodo },
    /// Broadcast when a todo is deleted
    Deleted { id: String },
    /// Sent when an error occurs
    Error { message: String },
    /// Pong response to keep connection alive
    Pong,
}
