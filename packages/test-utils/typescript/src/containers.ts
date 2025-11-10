import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Test database container manager
 *
 * Manages the lifecycle of a PostgreSQL testcontainer including:
 * - Starting the container
 * - Running migrations
 * - Providing database connection
 * - Cleaning up resources
 */
export class TestDb {
  private container: StartedPostgreSqlContainer;
  private client: Client;
  private migrationsPath: string;

  private constructor(container: StartedPostgreSqlContainer, client: Client, migrationsPath: string) {
    this.container = container;
    this.client = client;
    this.migrationsPath = migrationsPath;
  }

  /**
   * Set up test database with PostgreSQL container
   *
   * Starts a PostgreSQL container, runs migrations automatically,
   * and returns a TestDb instance. Call cleanup() when done to stop the container.
   *
   * @example
   * ```typescript
   * const testDb = await TestDb.setup();
   * const client = testDb.getClient();
   *
   * // Use client for testing...
   *
   * await testDb.cleanup();
   * ```
   */
  static async setup(): Promise<TestDb> {
    // Start PostgreSQL container
    const container = await new PostgreSqlContainer("postgres:16")
      .withDatabase("postgres")
      .withUsername("postgres")
      .withPassword("postgres")
      .start();

    // Create database client
    const client = new Client({
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getPassword(),
    });

    await client.connect();

    // Determine migrations path (relative to the test-utils package)
    const migrationsPath = join(process.cwd(), "../../../apps/backend/src/db/pg/migrations");

    const testDb = new TestDb(container, client, migrationsPath);

    // Run migrations
    await testDb.runMigrations();

    return testDb;
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    try {
      // Read migration files
      const fs = await import("fs/promises");
      const files = await fs.readdir(this.migrationsPath);
      const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

      // Run each migration in order
      for (const file of sqlFiles) {
        const filePath = join(this.migrationsPath, file);
        const sql = await readFile(filePath, "utf-8");
        await this.client.query(sql);
      }
    } catch (error) {
      throw new Error(`Failed to run migrations: ${error}`);
    }
  }

  /**
   * Get the database client for testing
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Get the connection string for the test database
   */
  getConnectionString(): string {
    return `postgresql://${this.container.getUsername()}:${this.container.getPassword()}@${this.container.getHost()}:${this.container.getPort()}/${this.container.getDatabase()}`;
  }

  /**
   * Clean up the database connection and container
   *
   * Always call this method when done with testing to ensure
   * proper cleanup of resources.
   */
  async cleanup(): Promise<void> {
    try {
      await this.client.end();
    } catch (error) {
      console.error("Error closing database client:", error);
    }

    try {
      await this.container.stop();
    } catch (error) {
      console.error("Error stopping container:", error);
    }
  }
}
