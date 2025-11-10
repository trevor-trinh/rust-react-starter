use super::Db;
use crate::errors::Result;
use crate::models::domain::Todo;
use uuid::Uuid;

impl Db {
    /// Get all todos
    pub async fn get_all_todos(&self) -> Result<Vec<Todo>> {
        let todos = sqlx::query_as!(
            Todo,
            r#"
            SELECT id, title, description, completed, created_at, updated_at
            FROM todos
            ORDER BY created_at DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(todos)
    }

    /// Get a single todo by ID
    pub async fn get_todo_by_id(&self, id: Uuid) -> Result<Option<Todo>> {
        let todo = sqlx::query_as!(
            Todo,
            r#"
            SELECT id, title, description, completed, created_at, updated_at
            FROM todos
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(todo)
    }

    /// Create a new todo
    pub async fn create_todo(&self, title: String, description: Option<String>) -> Result<Todo> {
        let todo = sqlx::query_as!(
            Todo,
            r#"
            INSERT INTO todos (title, description, completed, created_at, updated_at)
            VALUES ($1, $2, false, NOW(), NOW())
            RETURNING id, title, description, completed, created_at, updated_at
            "#,
            title,
            description
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(todo)
    }

    /// Update an existing todo
    pub async fn update_todo(
        &self,
        id: Uuid,
        title: Option<String>,
        description: Option<String>,
        completed: Option<bool>,
    ) -> Result<Option<Todo>> {
        // First, get the existing todo
        let existing = self.get_todo_by_id(id).await?;

        if existing.is_none() {
            return Ok(None);
        }

        let existing = existing.unwrap();

        // Use existing values if not provided
        let new_title = title.unwrap_or(existing.title);
        let new_description = description.or(existing.description);
        let new_completed = completed.unwrap_or(existing.completed);

        let todo = sqlx::query_as!(
            Todo,
            r#"
            UPDATE todos
            SET title = $2, description = $3, completed = $4, updated_at = NOW()
            WHERE id = $1
            RETURNING id, title, description, completed, created_at, updated_at
            "#,
            id,
            new_title,
            new_description,
            new_completed
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(Some(todo))
    }

    /// Delete a todo
    pub async fn delete_todo(&self, id: Uuid) -> Result<bool> {
        let result = sqlx::query!(
            r#"
            DELETE FROM todos
            WHERE id = $1
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }
}
