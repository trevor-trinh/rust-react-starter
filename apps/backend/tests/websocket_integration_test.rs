use backend::models::{ClientMessage, ServerMessage};
use futures_util::{SinkExt, StreamExt};
use test_utils::BackendTestServer;
use tokio_tungstenite::{connect_async, tungstenite::Message};

/// Helper to connect to WebSocket and return the connection
async fn connect_ws(
    url: &str,
) -> (
    futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        Message,
    >,
    futures_util::stream::SplitStream<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    >,
) {
    let (ws_stream, _) = connect_async(url)
        .await
        .expect("Failed to connect to WebSocket");
    ws_stream.split()
}

/// Helper to send a client message
async fn send_message(
    write: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        Message,
    >,
    message: ClientMessage,
) {
    let json = serde_json::to_string(&message).expect("Failed to serialize message");
    write
        .send(Message::Text(json.into()))
        .await
        .expect("Failed to send message");
}

/// Helper to receive the next server message
async fn receive_message(
    read: &mut futures_util::stream::SplitStream<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    >,
) -> ServerMessage {
    let msg = read.next().await.expect("No message received").unwrap();
    match msg {
        Message::Text(text) => serde_json::from_str(&text).expect("Failed to deserialize message"),
        _ => panic!("Expected text message"),
    }
}

#[tokio::test]
async fn test_websocket_connection() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let (mut _write, mut read) = connect_ws(&server.full_ws_url()).await;

    // Should receive connected message
    let message = receive_message(&mut read).await;

    match message {
        ServerMessage::Connected { client_id, todos } => {
            assert!(!client_id.is_empty());
            assert_eq!(todos.len(), 0);
        }
        _ => panic!("Expected Connected message"),
    }
}

#[tokio::test]
async fn test_websocket_create_todo() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let (mut write, mut read) = connect_ws(&server.full_ws_url()).await;

    // Skip connected message
    receive_message(&mut read).await;

    // Create a todo
    send_message(
        &mut write,
        ClientMessage::Create {
            title: "WebSocket Todo".to_string(),
            description: Some("Created via WS".to_string()),
        },
    )
    .await;

    // Should receive created message
    let message = receive_message(&mut read).await;

    match message {
        ServerMessage::Created { todo } => {
            assert_eq!(todo.title, "WebSocket Todo");
            assert_eq!(todo.description, Some("Created via WS".to_string()));
            assert!(!todo.completed);
        }
        _ => panic!("Expected Created message, got: {:?}", message),
    }
}

#[tokio::test]
async fn test_websocket_update_todo() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let (mut write, mut read) = connect_ws(&server.full_ws_url()).await;

    // Skip connected message
    receive_message(&mut read).await;

    // Create a todo
    send_message(
        &mut write,
        ClientMessage::Create {
            title: "Original Title".to_string(),
            description: None,
        },
    )
    .await;

    let created_message = receive_message(&mut read).await;
    let todo_id = match created_message {
        ServerMessage::Created { todo } => todo.id,
        _ => panic!("Expected Created message"),
    };

    // Update the todo
    send_message(
        &mut write,
        ClientMessage::Update {
            id: todo_id.to_string(),
            title: Some("Updated Title".to_string()),
            description: None,
            completed: None,
        },
    )
    .await;

    // Should receive updated message
    let message = receive_message(&mut read).await;

    match message {
        ServerMessage::Updated { todo } => {
            assert_eq!(todo.id, todo_id);
            assert_eq!(todo.title, "Updated Title");
        }
        _ => panic!("Expected Updated message"),
    }
}

#[tokio::test]
async fn test_websocket_toggle_todo() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let (mut write, mut read) = connect_ws(&server.full_ws_url()).await;

    // Skip connected message
    receive_message(&mut read).await;

    // Create a todo
    send_message(
        &mut write,
        ClientMessage::Create {
            title: "Toggle Me".to_string(),
            description: None,
        },
    )
    .await;

    let created_message = receive_message(&mut read).await;
    let (todo_id, initial_completed) = match created_message {
        ServerMessage::Created { todo } => (todo.id, todo.completed),
        _ => panic!("Expected Created message"),
    };

    // Toggle the todo
    send_message(
        &mut write,
        ClientMessage::Toggle {
            id: todo_id.to_string(),
        },
    )
    .await;

    // Should receive updated message
    let message = receive_message(&mut read).await;

    match message {
        ServerMessage::Updated { todo } => {
            assert_eq!(todo.id, todo_id);
            assert_eq!(todo.completed, !initial_completed);
        }
        _ => panic!("Expected Updated message"),
    }
}

#[tokio::test]
async fn test_websocket_delete_todo() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let (mut write, mut read) = connect_ws(&server.full_ws_url()).await;

    // Skip connected message
    receive_message(&mut read).await;

    // Create a todo
    send_message(
        &mut write,
        ClientMessage::Create {
            title: "To Be Deleted".to_string(),
            description: None,
        },
    )
    .await;

    let created_message = receive_message(&mut read).await;
    let todo_id = match created_message {
        ServerMessage::Created { todo } => todo.id,
        _ => panic!("Expected Created message"),
    };

    // Delete the todo
    send_message(
        &mut write,
        ClientMessage::Delete {
            id: todo_id.to_string(),
        },
    )
    .await;

    // Should receive deleted message
    let message = receive_message(&mut read).await;

    match message {
        ServerMessage::Deleted { id } => {
            assert_eq!(id, todo_id.to_string());
        }
        _ => panic!("Expected Deleted message"),
    }
}

#[tokio::test]
async fn test_websocket_broadcast_to_multiple_clients() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    // Connect two clients
    let (mut write1, mut read1) = connect_ws(&server.full_ws_url()).await;
    let (mut _write2, mut read2) = connect_ws(&server.full_ws_url()).await;

    // Skip connected messages
    receive_message(&mut read1).await;
    receive_message(&mut read2).await;

    // Client 1 creates a todo
    send_message(
        &mut write1,
        ClientMessage::Create {
            title: "Broadcast Test".to_string(),
            description: None,
        },
    )
    .await;

    // Both clients should receive the created message
    let msg1 = receive_message(&mut read1).await;
    let msg2 = receive_message(&mut read2).await;

    match (msg1, msg2) {
        (ServerMessage::Created { todo: todo1 }, ServerMessage::Created { todo: todo2 }) => {
            assert_eq!(todo1.title, "Broadcast Test");
            assert_eq!(todo2.title, "Broadcast Test");
            assert_eq!(todo1.id, todo2.id);
        }
        _ => panic!("Expected Created messages on both clients"),
    }
}

#[tokio::test]
async fn test_websocket_error_on_invalid_id() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let (mut write, mut read) = connect_ws(&server.full_ws_url()).await;

    // Skip connected message
    receive_message(&mut read).await;

    let fake_id = "00000000-0000-0000-0000-000000000000";

    // Try to update non-existent todo
    send_message(
        &mut write,
        ClientMessage::Update {
            id: fake_id.to_string(),
            title: Some("This will fail".to_string()),
            description: None,
            completed: None,
        },
    )
    .await;

    // Should receive error message
    let message = receive_message(&mut read).await;

    match message {
        ServerMessage::Error { message } => {
            assert!(!message.is_empty());
        }
        _ => panic!("Expected Error message"),
    }
}

#[tokio::test]
async fn test_websocket_multiple_operations() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let (mut write, mut read) = connect_ws(&server.full_ws_url()).await;

    // Skip connected message
    receive_message(&mut read).await;

    // Create multiple todos
    for i in 1..=3 {
        send_message(
            &mut write,
            ClientMessage::Create {
                title: format!("Todo {}", i),
                description: None,
            },
        )
        .await;

        let message = receive_message(&mut read).await;
        match message {
            ServerMessage::Created { todo } => {
                assert_eq!(todo.title, format!("Todo {}", i));
            }
            _ => panic!("Expected Created message"),
        }
    }

    // Update the first todo - note we need to track IDs properly in a real test
    // For now, just verify we can do multiple operations without errors
}

#[tokio::test]
async fn test_websocket_special_characters() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let (mut write, mut read) = connect_ws(&server.full_ws_url()).await;

    // Skip connected message
    receive_message(&mut read).await;

    let special_title = r#"Todo with "quotes" and 'apostrophes'"#;
    let special_desc = "Description with <html> & special chars: 你好";

    // Create a todo with special characters
    send_message(
        &mut write,
        ClientMessage::Create {
            title: special_title.to_string(),
            description: Some(special_desc.to_string()),
        },
    )
    .await;

    // Should receive created message with preserved special characters
    let message = receive_message(&mut read).await;

    match message {
        ServerMessage::Created { todo } => {
            assert_eq!(todo.title, special_title);
            assert_eq!(todo.description, Some(special_desc.to_string()));
        }
        _ => panic!("Expected Created message"),
    }
}
