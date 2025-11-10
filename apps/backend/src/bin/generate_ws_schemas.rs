use schemars::schema_for;
use std::fs;

use backend::models::api::{ClientMessage, ServerMessage};

fn main() {
    println!("Generating WebSocket JSON schemas...");

    // Generate schemas for both message types
    let client_schema = schema_for!(ClientMessage);
    let server_schema = schema_for!(ServerMessage);

    // Combine into a single file with both schemas
    let combined = serde_json::json!({
        "ClientMessage": client_schema,
        "ServerMessage": server_schema,
    });

    let schemas_json =
        serde_json::to_string_pretty(&combined).expect("Failed to serialize schemas");

    // Ensure the output directory exists
    let output_dir = "../../packages/shared";
    fs::create_dir_all(output_dir).expect("Failed to create output directory");

    // Write to the shared package
    let output_path = "../../packages/shared/ws-schemas.json";
    if let Err(e) = fs::write(output_path, &schemas_json) {
        eprintln!("Error: Could not write {}: {}", output_path, e);
        std::process::exit(1);
    }

    println!("✅ Generated {}", output_path);
    println!("📄 {} bytes written", schemas_json.len());
}
