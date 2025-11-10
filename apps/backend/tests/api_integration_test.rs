use backend::models::{ApiResponse, TodoRequest, TodoResponse};
use test_utils::BackendTestServer;

/// Helper to make API requests
async fn make_request(url: &str, request: TodoRequest) -> Result<TodoResponse, reqwest::Error> {
    let client = reqwest::Client::new();
    client
        .post(format!("{}/api/todos", url))
        .json(&request)
        .send()
        .await?
        .json()
        .await
}

#[tokio::test]
async fn test_health_check() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/health", server.api_url()))
        .send()
        .await
        .expect("Failed to make request");

    assert!(response.status().is_success());

    let body: ApiResponse = response.json().await.expect("Failed to parse response");
    assert_eq!(body.message, "OK");
    assert!(body.timestamp > 0);
}

#[tokio::test]
async fn test_list_todos_empty() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let response = make_request(server.api_url(), TodoRequest::List)
        .await
        .expect("Failed to make request");

    match response {
        TodoResponse::List { todos } => {
            assert_eq!(todos.len(), 0);
        }
        _ => panic!("Expected List response"),
    }
}

#[tokio::test]
async fn test_create_todo() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let response = make_request(
        server.api_url(),
        TodoRequest::Create {
            title: "Test Todo".to_string(),
            description: Some("Test Description".to_string()),
        },
    )
    .await
    .expect("Failed to make request");

    match response {
        TodoResponse::Todo { todo } => {
            assert_eq!(todo.title, "Test Todo");
            assert_eq!(todo.description, Some("Test Description".to_string()));
            assert!(!todo.completed);
        }
        _ => panic!("Expected Todo response"),
    }
}

#[tokio::test]
async fn test_create_todo_without_description() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let response = make_request(
        server.api_url(),
        TodoRequest::Create {
            title: "Todo without description".to_string(),
            description: None,
        },
    )
    .await
    .expect("Failed to make request");

    match response {
        TodoResponse::Todo { todo } => {
            assert_eq!(todo.title, "Todo without description");
            assert_eq!(todo.description, None);
            assert!(!todo.completed);
        }
        _ => panic!("Expected Todo response"),
    }
}

#[tokio::test]
async fn test_get_todo_by_id() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    // Create a todo first
    let create_response = make_request(
        server.api_url(),
        TodoRequest::Create {
            title: "Find Me".to_string(),
            description: Some("Description".to_string()),
        },
    )
    .await
    .expect("Failed to create todo");

    let created_todo = match create_response {
        TodoResponse::Todo { todo } => todo,
        _ => panic!("Expected Todo response"),
    };

    // Get it by ID
    let get_response = make_request(
        server.api_url(),
        TodoRequest::Get {
            id: created_todo.id.to_string(),
        },
    )
    .await
    .expect("Failed to get todo");

    match get_response {
        TodoResponse::Todo { todo } => {
            assert_eq!(todo.id, created_todo.id);
            assert_eq!(todo.title, "Find Me");
            assert_eq!(todo.description, Some("Description".to_string()));
        }
        _ => panic!("Expected Todo response"),
    }
}

#[tokio::test]
async fn test_list_multiple_todos() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    // Create multiple todos
    for i in 1..=3 {
        make_request(
            server.api_url(),
            TodoRequest::Create {
                title: format!("Todo {}", i),
                description: None,
            },
        )
        .await
        .expect("Failed to create todo");
    }

    // List them
    let response = make_request(server.api_url(), TodoRequest::List)
        .await
        .expect("Failed to list todos");

    match response {
        TodoResponse::List { todos } => {
            assert_eq!(todos.len(), 3);
            assert!(todos.iter().any(|t| t.title == "Todo 1"));
            assert!(todos.iter().any(|t| t.title == "Todo 2"));
            assert!(todos.iter().any(|t| t.title == "Todo 3"));
        }
        _ => panic!("Expected List response"),
    }
}

#[tokio::test]
async fn test_update_todo_title() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    // Create a todo
    let create_response = make_request(
        server.api_url(),
        TodoRequest::Create {
            title: "Original Title".to_string(),
            description: None,
        },
    )
    .await
    .expect("Failed to create todo");

    let created_todo = match create_response {
        TodoResponse::Todo { todo } => todo,
        _ => panic!("Expected Todo response"),
    };

    // Update it
    let update_response = make_request(
        server.api_url(),
        TodoRequest::Update {
            id: created_todo.id.to_string(),
            title: Some("Updated Title".to_string()),
            description: None,
            completed: None,
        },
    )
    .await
    .expect("Failed to update todo");

    match update_response {
        TodoResponse::Todo { todo } => {
            assert_eq!(todo.id, created_todo.id);
            assert_eq!(todo.title, "Updated Title");
            assert!(!todo.completed);
        }
        _ => panic!("Expected Todo response"),
    }
}

#[tokio::test]
async fn test_update_todo_completion() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    // Create a todo
    let create_response = make_request(
        server.api_url(),
        TodoRequest::Create {
            title: "Complete Me".to_string(),
            description: None,
        },
    )
    .await
    .expect("Failed to create todo");

    let created_todo = match create_response {
        TodoResponse::Todo { todo } => todo,
        _ => panic!("Expected Todo response"),
    };

    // Mark as completed
    let update_response = make_request(
        server.api_url(),
        TodoRequest::Update {
            id: created_todo.id.to_string(),
            title: None,
            description: None,
            completed: Some(true),
        },
    )
    .await
    .expect("Failed to update todo");

    match update_response {
        TodoResponse::Todo { todo } => {
            assert_eq!(todo.id, created_todo.id);
            assert!(todo.completed);
        }
        _ => panic!("Expected Todo response"),
    }
}

#[tokio::test]
async fn test_delete_todo() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    // Create a todo
    let create_response = make_request(
        server.api_url(),
        TodoRequest::Create {
            title: "To Be Deleted".to_string(),
            description: None,
        },
    )
    .await
    .expect("Failed to create todo");

    let created_todo = match create_response {
        TodoResponse::Todo { todo } => todo,
        _ => panic!("Expected Todo response"),
    };

    // Delete it
    let delete_response = make_request(
        server.api_url(),
        TodoRequest::Delete {
            id: created_todo.id.to_string(),
        },
    )
    .await
    .expect("Failed to delete todo");

    match delete_response {
        TodoResponse::Deleted { id } => {
            assert_eq!(id, created_todo.id.to_string());
        }
        _ => panic!("Expected Deleted response"),
    }

    // Verify it's gone
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/todos", server.api_url()))
        .json(&TodoRequest::Get {
            id: created_todo.id.to_string(),
        })
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 404);
}

#[tokio::test]
async fn test_get_nonexistent_todo_returns_404() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let fake_id = "00000000-0000-0000-0000-000000000000";

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/todos", server.api_url()))
        .json(&TodoRequest::Get {
            id: fake_id.to_string(),
        })
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 404);
}

#[tokio::test]
async fn test_delete_nonexistent_todo_returns_404() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let fake_id = "00000000-0000-0000-0000-000000000000";

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/todos", server.api_url()))
        .json(&TodoRequest::Delete {
            id: fake_id.to_string(),
        })
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 404);
}

#[tokio::test]
async fn test_special_characters_in_title() {
    let server = BackendTestServer::setup()
        .await
        .expect("Failed to start backend server");

    let special_title = r#"Todo with "quotes" and 'apostrophes'"#;
    let special_desc = "Description with <html> & special chars: 你好";

    let response = make_request(
        server.api_url(),
        TodoRequest::Create {
            title: special_title.to_string(),
            description: Some(special_desc.to_string()),
        },
    )
    .await
    .expect("Failed to create todo");

    match response {
        TodoResponse::Todo { todo } => {
            assert_eq!(todo.title, special_title);
            assert_eq!(todo.description, Some(special_desc.to_string()));
        }
        _ => panic!("Expected Todo response"),
    }
}
