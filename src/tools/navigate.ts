import { z } from "zod";
import type { Tool, ToolSchema, ToolResult } from "./tool.js";
import type { Context } from "../context.js";
import type { ToolActionResult } from "../types/types.js";

const NavigateInputSchema = z.object({
  url: z.string().describe("The URL to navigate to"),
});

type NavigateInput = z.infer<typeof NavigateInputSchema>;

const navigateSchema: ToolSchema<typeof NavigateInputSchema> = {
  name: "tzafonwright_navigate",
  description:
    "Navigate to a URL in the browser. Only use this tool with URLs you're confident will work and stay up to date. Otherwise, use https://google.com as the starting point",
  inputSchema: NavigateInputSchema,
};

async function handleNavigate(
  context: Context,
  params: NavigateInput,
): Promise<ToolResult> {
  const action = async (): Promise<ToolActionResult> => {
    try {
      const client = await context.getTzafonWrightClient();

      if (!client) {
        throw new Error("No TzafonWright client available");
      }

      // Normalize URL - add https:// if no protocol specified
      let normalizedUrl = params.url;
      if (
        !normalizedUrl.startsWith("http://") &&
        !normalizedUrl.startsWith("https://")
      ) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      const result = await client.goto(normalizedUrl);

      if (!result.success) {
        throw new Error(result.error_message || "Navigation failed");
      }

      return {
        content: [
          {
            type: "text",
            text: `Successfully navigated to: ${normalizedUrl} (original: ${params.url})`,
          },
        ],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to navigate: ${errorMsg}`);
    }
  };

  return {
    action,
    waitForNetwork: false,
  };
}

const navigateTool: Tool<typeof NavigateInputSchema> = {
  capability: "core",
  schema: navigateSchema,
  handle: handleNavigate,
};

export default navigateTool;
