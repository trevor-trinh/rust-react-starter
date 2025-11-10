import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { compile } from "json-schema-to-typescript";
import { resolve, dirname } from "path";

async function generateTypes() {
  console.log("Generating WebSocket TypeScript types...");

  // Read the JSON schema file
  const schemaPath = resolve(__dirname, "../../../shared/ws-schemas.json");
  const schemaContent = readFileSync(schemaPath, "utf8");
  const schemas = JSON.parse(schemaContent);

  // Ensure output directory exists
  const outputDir = resolve(__dirname, "../src/types/generated");
  mkdirSync(outputDir, { recursive: true });

  // Generate types for ClientMessage
  const clientMessageTs = await compile(schemas.ClientMessage, "ClientMessage", {
    bannerComment: "",
    style: {
      semi: true,
    },
  });

  // Generate types for ServerMessage
  const serverMessageTs = await compile(schemas.ServerMessage, "ServerMessage", {
    bannerComment: "",
    style: {
      semi: true,
    },
  });

  // Combine into a single file with header
  const output = `/**
 * WebSocket Message Types
 * Generated from Rust types via JSON Schema
 * DO NOT EDIT MANUALLY
 */

${clientMessageTs}

${serverMessageTs}

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";
`;

  // Write to output file
  const outputPath = resolve(outputDir, "websocket.ts");
  writeFileSync(outputPath, output);

  console.log(`✅ Generated ${outputPath}`);
  console.log(`📄 ${output.length} bytes written`);
}

generateTypes().catch((error) => {
  console.error("Error generating types:", error);
  process.exit(1);
});
