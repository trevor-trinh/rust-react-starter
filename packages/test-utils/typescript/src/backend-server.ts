import { GenericContainer, Network, StartedNetwork, StartedTestContainer, Wait } from "testcontainers";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { join } from "path";

/**
 * Backend test server manager
 *
 * Manages the lifecycle of both PostgreSQL and Backend containers including:
 * - Starting PostgreSQL container
 * - Running migrations
 * - Building and starting backend server
 * - Providing API and WebSocket URLs
 * - Cleaning up all resources
 */
export class BackendTestServer {
  private network?: StartedNetwork;
  private postgresContainer?: StartedPostgreSqlContainer;
  private backendContainer?: StartedTestContainer;
  private apiUrl?: string;
  private wsUrl?: string;

  /**
   * Set up backend test server with PostgreSQL and backend containers
   *
   * Starts a PostgreSQL container, backend container, connects them via network,
   * and returns a BackendTestServer instance. Call cleanup() when done.
   *
   * **Prerequisites**: The Docker image `rust-react-starter-backend:test` must exist.
   * Build it first with: `just build-test-image` or `docker build -t rust-react-starter-backend:test -f apps/backend/Dockerfile .`
   *
   * @example
   * ```typescript
   * const server = await BackendTestServer.start();
   * const apiUrl = server.getApiUrl();
   *
   * // Use apiUrl for testing...
   *
   * await server.cleanup();
   * ```
   */
  static async start(): Promise<BackendTestServer> {
    const server = new BackendTestServer();

    // Create a network for containers to communicate
    server.network = await new Network().start();

    // Start PostgreSQL container on the network
    server.postgresContainer = await new PostgreSqlContainer("postgres:16")
      .withDatabase("postgres")
      .withUsername("postgres")
      .withPassword("postgres")
      .withNetwork(server.network)
      .withNetworkAliases("postgres") // DNS name inside network
      .start();

    // Build DATABASE_URL that backend can use (using network alias)
    const databaseUrl = `postgresql://postgres:postgres@postgres:5432/postgres`;

    // Start the container with the pre-built image
    server.backendContainer = await new GenericContainer("rust-react-starter-backend:test")
      .withEnvironment({
        DATABASE_URL: databaseUrl,
        HOST: "0.0.0.0",
        PORT: "8888",
      })
      .withExposedPorts(8888)
      .withWaitStrategy(Wait.forHttp("/api/health", 8888)) // Wait for health check
      .withStartupTimeout(60000) // 60 seconds for starting
      .withNetworkMode(server.network.getName())
      .start();

    const mappedPort = server.backendContainer.getMappedPort(8888);
    const host = server.backendContainer.getHost();

    server.apiUrl = `http://${host}:${mappedPort}`;
    server.wsUrl = `ws://${host}:${mappedPort}`;

    return server;
  }

  /**
   * Get the base URL for REST API requests
   */
  getApiUrl(): string {
    if (!this.apiUrl) {
      throw new Error("Backend server not started");
    }
    return this.apiUrl;
  }

  /**
   * Get the base URL for WebSocket connections
   */
  getWsUrl(): string {
    if (!this.wsUrl) {
      throw new Error("Backend server not started");
    }
    return this.wsUrl;
  }

  /**
   * Get the full WebSocket URL (includes /ws path)
   */
  getFullWsUrl(): string {
    return `${this.getWsUrl()}/ws`;
  }

  /**
   * Get the PostgreSQL connection string
   *
   * Useful if you want to query the database directly in tests
   */
  getDatabaseUrl(): string {
    if (!this.postgresContainer) {
      throw new Error("Backend server not started");
    }
    return `postgresql://${this.postgresContainer.getUsername()}:${this.postgresContainer.getPassword()}@${this.postgresContainer.getHost()}:${this.postgresContainer.getPort()}/${this.postgresContainer.getDatabase()}`;
  }

  /**
   * Clean up all containers and network
   *
   * Always call this method when done with testing to ensure
   * proper cleanup of resources.
   */
  async cleanup(): Promise<void> {
    const errors: Error[] = [];

    if (this.backendContainer) {
      try {
        await this.backendContainer.stop();
      } catch (error) {
        console.error("Error stopping backend container:", error);
        errors.push(error as Error);
      }
    }

    if (this.postgresContainer) {
      try {
        await this.postgresContainer.stop();
      } catch (error) {
        console.error("Error stopping PostgreSQL container:", error);
        errors.push(error as Error);
      }
    }

    if (this.network) {
      try {
        await this.network.stop();
      } catch (error) {
        console.error("Error stopping network:", error);
        errors.push(error as Error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to cleanup some resources: ${errors.map((e) => e.message).join(", ")}`);
    }
  }
}
