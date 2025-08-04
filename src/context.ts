import type { TzafonWrightClient } from "./tzafonwright/client.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Config } from "../config.d.ts";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { listResources, readResource } from "./mcp/resources.js";
import { getSession, defaultSessionId } from "./sessionManager.js";
import type { MCPTool } from "./types/types.js";

export class Context {
  public readonly config: Config;
  private server: Server;
  public currentSessionId: string = defaultSessionId;

  constructor(server: Server, config: Config) {
    this.server = server;
    this.config = config;
  }

  public getServer(): Server {
    return this.server;
  }

  /**
   * Gets the TzafonWright client instance for the current session from SessionManager
   */
  public async getTzafonWrightClient(
    sessionId: string = this.currentSessionId,
  ): Promise<TzafonWrightClient> {
    const session = await getSession(sessionId, this.config);
    if (!session) {
      throw new Error(`No session found for ID: ${sessionId}`);
    }
    return session.client;
  }

  public async getActiveClient(
    createIfMissing: boolean = true,
  ): Promise<TzafonWrightClient | null> {
    const session = await getSession(
      this.currentSessionId,
      this.config,
      createIfMissing,
    );
    if (!session || !session.client) {
      return null;
    }
    return session.client;
  }

  async run(tool: MCPTool, args: unknown): Promise<CallToolResult> {
    try {
      console.error(
        `Executing tool: ${tool.schema.name} with args: ${JSON.stringify(args)}`,
      );

      // Check if this tool has a handle method (new tool system)
      if ("handle" in tool && typeof tool.handle === "function") {
        const toolResult = await tool.handle(this, args);

        if (toolResult?.action) {
          const actionResult = await toolResult.action();
          const content = actionResult?.content || [];

          return {
            content: Array.isArray(content)
              ? content
              : [{ type: "text", text: "Action completed successfully." }],
            isError: false,
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `${tool.schema.name} completed successfully.`,
              },
            ],
            isError: false,
          };
        }
      } else {
        // Fallback for any legacy tools without handle method
        throw new Error(
          `Tool ${tool.schema.name} does not have a handle method`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Tool ${tool.schema?.name || "unknown"} failed: ${errorMessage}`,
      );
      return {
        content: [{ type: "text", text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  /**
   * List resources
   * Documentation: https://modelcontextprotocol.io/docs/concepts/resources
   */
  listResources() {
    return listResources();
  }

  /**
   * Read a resource by URI
   * Documentation: https://modelcontextprotocol.io/docs/concepts/resources
   */
  readResource(uri: string) {
    return readResource(uri);
  }
}
