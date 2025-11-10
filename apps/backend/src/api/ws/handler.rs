use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use crate::{
    models::{ApiTodo, ClientMessage, ServerMessage},
    AppState,
};

/// Shared state for WebSocket connections
#[derive(Clone)]
pub struct WsState {
    /// Broadcast channel for sending messages to all connected clients
    tx: broadcast::Sender<ServerMessage>,
}

impl WsState {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self { tx }
    }

    /// Broadcast a message to all connected clients
    pub fn broadcast(&self, msg: ServerMessage) {
        // Ignore error if no receivers are active
        let _ = self.tx.send(msg);
    }
}

// Global WebSocket state (shared across all connections)
lazy_static::lazy_static! {
    static ref WS_STATE: Arc<RwLock<WsState>> = Arc::new(RwLock::new(WsState::new()));
}

/// WebSocket handler - upgrades HTTP connection to WebSocket
pub async fn ws_handler(ws: WebSocketUpgrade, State(app_state): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, app_state))
}

/// Handle an individual WebSocket connection
async fn handle_socket(socket: WebSocket, app_state: AppState) {
    let client_id = Uuid::new_v4().to_string();

    // Split socket into sender and receiver
    let (mut sender, mut receiver) = socket.split();

    // Subscribe to broadcast channel
    let ws_state = WS_STATE.read().await;
    let mut rx = ws_state.tx.subscribe();
    drop(ws_state); // Release read lock

    // Send initial connection message with all todos
    match app_state.db.get_all_todos().await {
        Ok(todos) => {
            let api_todos: Vec<ApiTodo> = todos.into_iter().map(|t| t.into()).collect();
            let msg = ServerMessage::Connected {
                client_id: client_id.clone(),
                todos: api_todos,
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = sender.send(Message::Text(json.into())).await;
            }
        }
        Err(e) => {
            log::error!("Failed to fetch todos: {}", e);
            let msg = ServerMessage::Error {
                message: "Failed to fetch todos".to_string(),
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = sender.send(Message::Text(json.into())).await;
            }
            return;
        }
    }

    log::info!("WebSocket client connected: {}", client_id);

    // Spawn task to receive broadcast messages and send to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    // Spawn task to receive messages from this client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                handle_client_message(text.to_string(), &app_state).await;
            }
        }
    });

    // Wait for either task to finish (connection closed or error)
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    log::info!("WebSocket client disconnected: {}", client_id);
}

/// Process messages from client and broadcast updates
async fn handle_client_message(text: String, app_state: &AppState) {
    // Parse client message
    let client_msg: ClientMessage = match serde_json::from_str(&text) {
        Ok(msg) => msg,
        Err(e) => {
            log::error!("Failed to parse client message: {}", e);
            broadcast_error("Invalid message format".to_string()).await;
            return;
        }
    };

    // Process message and broadcast result
    match client_msg {
        ClientMessage::Create { title, description } => {
            handle_create_todo(title, description, app_state).await;
        }
        ClientMessage::Update {
            id,
            title,
            description,
            completed,
        } => {
            handle_update_todo(id, title, description, completed, app_state).await;
        }
        ClientMessage::Delete { id } => {
            handle_delete_todo(id, app_state).await;
        }
        ClientMessage::Toggle { id } => {
            handle_toggle_todo(id, app_state).await;
        }
        ClientMessage::Ping => {
            // Respond with Pong to the sender only
            handle_ping().await;
        }
    }
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

async fn handle_create_todo(title: String, description: Option<String>, app_state: &AppState) {
    match app_state.db.create_todo(title, description).await {
        Ok(todo) => {
            let msg = ServerMessage::Created { todo: todo.into() };
            let ws_state = WS_STATE.read().await;
            ws_state.broadcast(msg);
        }
        Err(e) => {
            log::error!("Failed to create todo: {}", e);
            broadcast_error("Failed to create todo".to_string()).await;
        }
    }
}

async fn handle_update_todo(
    id: String,
    title: Option<String>,
    description: Option<String>,
    completed: Option<bool>,
    app_state: &AppState,
) {
    let uuid = match Uuid::parse_str(&id) {
        Ok(uuid) => uuid,
        Err(_) => {
            broadcast_error("Invalid todo ID".to_string()).await;
            return;
        }
    };

    match app_state
        .db
        .update_todo(uuid, title, description, completed)
        .await
    {
        Ok(Some(todo)) => {
            let msg = ServerMessage::Updated { todo: todo.into() };
            let ws_state = WS_STATE.read().await;
            ws_state.broadcast(msg);
        }
        Ok(None) => {
            broadcast_error("Todo not found".to_string()).await;
        }
        Err(e) => {
            log::error!("Failed to update todo: {}", e);
            broadcast_error("Failed to update todo".to_string()).await;
        }
    }
}

async fn handle_delete_todo(id: String, app_state: &AppState) {
    let uuid = match Uuid::parse_str(&id) {
        Ok(uuid) => uuid,
        Err(_) => {
            broadcast_error("Invalid todo ID".to_string()).await;
            return;
        }
    };

    match app_state.db.delete_todo(uuid).await {
        Ok(true) => {
            let msg = ServerMessage::Deleted { id };
            let ws_state = WS_STATE.read().await;
            ws_state.broadcast(msg);
        }
        Ok(false) => {
            broadcast_error("Todo not found".to_string()).await;
        }
        Err(e) => {
            log::error!("Failed to delete todo: {}", e);
            broadcast_error("Failed to delete todo".to_string()).await;
        }
    }
}

async fn handle_toggle_todo(id: String, app_state: &AppState) {
    let uuid = match Uuid::parse_str(&id) {
        Ok(uuid) => uuid,
        Err(_) => {
            broadcast_error("Invalid todo ID".to_string()).await;
            return;
        }
    };

    // Get current todo to toggle its completed status
    match app_state.db.get_todo_by_id(uuid).await {
        Ok(Some(todo)) => {
            let new_completed = !todo.completed;
            match app_state
                .db
                .update_todo(uuid, None, None, Some(new_completed))
                .await
            {
                Ok(Some(updated_todo)) => {
                    let msg = ServerMessage::Updated {
                        todo: updated_todo.into(),
                    };
                    let ws_state = WS_STATE.read().await;
                    ws_state.broadcast(msg);
                }
                Ok(None) => {
                    broadcast_error("Todo not found".to_string()).await;
                }
                Err(e) => {
                    log::error!("Failed to toggle todo: {}", e);
                    broadcast_error("Failed to toggle todo".to_string()).await;
                }
            }
        }
        Ok(None) => {
            broadcast_error("Todo not found".to_string()).await;
        }
        Err(e) => {
            log::error!("Failed to get todo: {}", e);
            broadcast_error("Failed to toggle todo".to_string()).await;
        }
    }
}

async fn handle_ping() {
    let msg = ServerMessage::Pong;
    let ws_state = WS_STATE.read().await;
    ws_state.broadcast(msg);
}

async fn broadcast_error(message: String) {
    let msg = ServerMessage::Error { message };
    let ws_state = WS_STATE.read().await;
    ws_state.broadcast(msg);
}
