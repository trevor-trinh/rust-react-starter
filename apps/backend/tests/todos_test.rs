use test_utils::TestDb;

#[tokio::test]
async fn test_create_todo() {
    let test_db = TestDb::setup()
        .await
        .expect("Failed to setup test database");
    let db = test_db.db();

    // Create a todo
    let todo = db
        .create_todo(
            "Test Todo".to_string(),
            Some("Test Description".to_string()),
        )
        .await
        .expect("Failed to create todo");

    assert_eq!(todo.title, "Test Todo");
    assert_eq!(todo.description, Some("Test Description".to_string()));
    assert!(!todo.completed);
}

#[tokio::test]
async fn test_get_all_todos() {
    let test_db = TestDb::setup()
        .await
        .expect("Failed to setup test database");
    let db = test_db.db();

    // Create some todos
    db.create_todo("Todo 1".to_string(), None)
        .await
        .expect("Failed to create todo 1");
    db.create_todo("Todo 2".to_string(), None)
        .await
        .expect("Failed to create todo 2");

    // Get all todos
    let todos = db.get_all_todos().await.expect("Failed to get todos");

    assert_eq!(todos.len(), 2);
}

#[tokio::test]
async fn test_get_todo_by_id() {
    let test_db = TestDb::setup()
        .await
        .expect("Failed to setup test database");
    let db = test_db.db();

    // Create a todo
    let created = db
        .create_todo("Find Me".to_string(), None)
        .await
        .expect("Failed to create todo");

    // Get it by ID
    let found = db
        .get_todo_by_id(created.id)
        .await
        .expect("Failed to get todo")
        .expect("Todo not found");

    assert_eq!(found.id, created.id);
    assert_eq!(found.title, "Find Me");
}

#[tokio::test]
async fn test_update_todo() {
    let test_db = TestDb::setup()
        .await
        .expect("Failed to setup test database");
    let db = test_db.db();

    // Create a todo
    let todo = db
        .create_todo("Original Title".to_string(), None)
        .await
        .expect("Failed to create todo");

    // Update the todo
    let updated = db
        .update_todo(todo.id, Some("Updated Title".to_string()), None, Some(true))
        .await
        .expect("Failed to update todo")
        .expect("Todo not found");

    assert_eq!(updated.title, "Updated Title");
    assert!(updated.completed);
}

#[tokio::test]
async fn test_update_partial() {
    let test_db = TestDb::setup()
        .await
        .expect("Failed to setup test database");
    let db = test_db.db();

    // Create a todo
    let todo = db
        .create_todo("Original".to_string(), Some("Description".to_string()))
        .await
        .expect("Failed to create todo");

    // Update only completion status
    let updated = db
        .update_todo(todo.id, None, None, Some(true))
        .await
        .expect("Failed to update todo")
        .expect("Todo not found");

    assert_eq!(updated.title, "Original");
    assert_eq!(updated.description, Some("Description".to_string()));
    assert!(updated.completed);
}

#[tokio::test]
async fn test_delete_todo() {
    let test_db = TestDb::setup()
        .await
        .expect("Failed to setup test database");
    let db = test_db.db();

    // Create a todo
    let todo = db
        .create_todo("To Be Deleted".to_string(), None)
        .await
        .expect("Failed to create todo");

    // Delete the todo
    let deleted = db
        .delete_todo(todo.id)
        .await
        .expect("Failed to delete todo");

    assert!(deleted);

    // Verify it's gone
    let found = db
        .get_todo_by_id(todo.id)
        .await
        .expect("Failed to get todo");

    assert!(found.is_none());
}

#[tokio::test]
async fn test_delete_nonexistent() {
    let test_db = TestDb::setup()
        .await
        .expect("Failed to setup test database");
    let db = test_db.db();

    // Try to delete a non-existent todo
    let deleted = db
        .delete_todo(uuid::Uuid::new_v4())
        .await
        .expect("Failed to delete todo");

    assert!(!deleted);
}

#[tokio::test]
async fn test_update_nonexistent() {
    let test_db = TestDb::setup()
        .await
        .expect("Failed to setup test database");
    let db = test_db.db();

    // Try to update a non-existent todo
    let result = db
        .update_todo(
            uuid::Uuid::new_v4(),
            Some("New Title".to_string()),
            None,
            None,
        )
        .await
        .expect("Failed to update todo");

    assert!(result.is_none());
}
