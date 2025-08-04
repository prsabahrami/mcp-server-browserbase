import { TzafonWrightClient } from "../tzafonwright/client.js";
import { ImageContent, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { Tool } from "../tools/tool.js";
import { InputType } from "../tools/tool.js";

export type TzafonWrightSession = {
  id: string; // MCP-side ID
  client: TzafonWrightClient; // WebSocket client to TzafonWright server
  created: number;
  metadata?: Record<string, any>; // optional extras (proxy settings, etc.)
};

export type CreateSessionParams = {
  proxyUrl?: string;
  meta?: Record<string, any>;
};

export type BrowserSession = {
  client: TzafonWrightClient;
  sessionId: string;
};

export type ToolActionResult =
  | { content?: (ImageContent | TextContent)[] }
  | undefined
  | void;

// Type for the tools array used in MCP server registration
export type MCPTool = Tool<InputType>;
export type MCPToolsArray = MCPTool[];
