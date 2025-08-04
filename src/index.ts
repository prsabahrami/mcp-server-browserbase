import dotenv from "dotenv";
dotenv.config();

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MCPToolsArray } from "./types/types.js";

import { Context } from "./context.js";
import type { Config } from "../config.d.ts";
import { TOOLS } from "./tools/index.js";
import { PROMPTS, getPrompt } from "./mcp/prompts.js";
import { RESOURCE_TEMPLATES } from "./mcp/resources.js";

import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Configuration schema for Smithery - matches existing Config interface
export const configSchema = z.object({
  proxyUrl: z.string().describe("The TzafonWright proxy WebSocket URL"),
  viewPort: z
    .object({
      browserWidth: z.number().optional().describe("The width of the browser"),
      browserHeight: z
        .number()
        .optional()
        .describe("The height of the browser"),
    })
    .optional(),
  server: z
    .object({
      port: z
        .number()
        .optional()
        .describe("The port to listen on for SHTTP or MCP transport"),
      host: z
        .string()
        .optional()
        .describe(
          "The host to bind the server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces",
        ),
    })
    .optional(),
});

// Default function for Smithery
export default function ({ config }: { config: z.infer<typeof configSchema> }) {
  if (!config.proxyUrl) {
    throw new Error("proxyUrl is required");
  }

  const server = new McpServer({
    name: "TzafonWright MCP Server",
    version: "2.0.0",
    description:
      "Browser automation server powered by TzafonWright. Enables LLMs to navigate websites, interact with elements, extract data, and capture screenshots using natural language commands.",
    capabilities: {
      resources: {
        subscribe: true,
        listChanged: true,
      },
      prompts: {
        listChanged: true,
      },
      sampling: {},
    },
  });

  const internalConfig: Config = config as Config;

  // Create the context, passing server instance and config
  const context = new Context(server.server, internalConfig);

  server.server.registerCapabilities({
    resources: {
      subscribe: true,
      listChanged: true,
    },
    prompts: {
      listChanged: true,
    },
    sampling: {},
  });

  // Add resource handlers
  server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return context.listResources();
  });

  server.server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
      return context.readResource(request.params.uri);
    },
  );

  server.server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async () => {
      return { resourceTemplates: RESOURCE_TEMPLATES };
    },
  );

  // Add prompt handlers
  server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: PROMPTS };
  });

  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const prompt = getPrompt(request.params.name);
    return prompt;
  });

  const tools: MCPToolsArray = [...TOOLS];

  // Register each tool with the Smithery server
  tools.forEach((tool) => {
    if (tool.schema.inputSchema instanceof z.ZodObject) {
      server.tool(
        tool.schema.name,
        tool.schema.description,
        tool.schema.inputSchema.shape,
        async (params: z.infer<typeof tool.schema.inputSchema>) => {
          try {
            const result = await context.run(tool, params);
            return result;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            process.stderr.write(
              `[Smithery Error] ${new Date().toISOString()} Error running tool ${tool.schema.name}: ${errorMessage}\n`,
            );
            throw new Error(
              `Failed to run tool '${tool.schema.name}': ${errorMessage}`,
            );
          }
        },
      );
    } else {
      console.warn(
        `Tool "${tool.schema.name}" has an input schema that is not a ZodObject. Schema type: ${tool.schema.inputSchema.constructor.name}`,
      );
    }
  });

  return server.server;
}
