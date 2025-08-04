import { z } from "zod";
import type { Tool, ToolSchema, ToolResult } from "./tool.js";
import type { Context } from "../context.js";
import type { ToolActionResult } from "../types/types.js";
import { screenshots } from "../mcp/resources.js";

const ScreenshotInputSchema = z.object({
  name: z.string().optional().describe("The name of the screenshot"),
});

type ScreenshotInput = z.infer<typeof ScreenshotInputSchema>;

const screenshotSchema: ToolSchema<typeof ScreenshotInputSchema> = {
  name: "tzafonwright_screenshot",
  description:
    "Takes a screenshot of the current page. Use this tool to learn where you are on the page when controlling the browser with TzafonWright. Only use this tool when the other tools are not sufficient to get the information you need.",
  inputSchema: ScreenshotInputSchema,
};

async function handleScreenshot(
  context: Context,
  params: ScreenshotInput,
): Promise<ToolResult> {
  const action = async (): Promise<ToolActionResult> => {
    try {
      const client = await context.getTzafonWrightClient();
      if (!client) {
        throw new Error("No TzafonWright client available");
      }

      const result = await client.screenshot();

      if (!result.success || !result.image) {
        throw new Error(result.error_message || "Screenshot failed");
      }

      // Convert buffer to base64 string and store in memory
      const screenshotBase64 = result.image.toString("base64");
      const name = params.name
        ? `screenshot-${params.name}-${new Date()
            .toISOString()
            .replace(/:/g, "-")}`
        : `screenshot-${new Date().toISOString().replace(/:/g, "-")}-tzafonwright`;
      screenshots.set(name, screenshotBase64);

      // Notify the client that the resources changed
      const serverInstance = context.getServer();

      if (serverInstance) {
        serverInstance.notification({
          method: "notifications/resources/list_changed",
        });
      }

      return {
        content: [
          {
            type: "text",
            text: `Screenshot taken with name: ${name}`,
          },
          {
            type: "image",
            data: screenshotBase64,
            mimeType: "image/png",
          },
        ],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to take screenshot: ${errorMsg}`);
    }
  };

  return {
    action,
    waitForNetwork: false,
  };
}

const screenshotTool: Tool<typeof ScreenshotInputSchema> = {
  capability: "core",
  schema: screenshotSchema,
  handle: handleScreenshot,
};

export default screenshotTool;
