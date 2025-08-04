import { z } from "zod";
import type { Tool, ToolSchema, ToolResult } from "./tool.js";
import type { Context } from "../context.js";
import type { ToolActionResult } from "../types/types.js";
import { ImageContent, TextContent } from "@modelcontextprotocol/sdk/types.js";

const ExtractInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      "The specific instruction for what information to extract from the current page. " +
        "Be as detailed and specific as possible about what you want to extract. For example: " +
        "'Extract all product names and prices from the listing page' or 'Get the article title, " +
        "author, and publication date from this blog post'. The more specific your instruction, " +
        "the better the extraction results will be. Avoid vague instructions like 'get everything' " +
        "or 'extract the data'. Instead, be explicit about the exact elements, text, or information you need.",
    ),
});

type ExtractInput = z.infer<typeof ExtractInputSchema>;

const extractSchema: ToolSchema<typeof ExtractInputSchema> = {
  name: "tzafonwright_extract",
  description:
    "Enhanced extraction tool for TzafonWright. Automatically captures a screenshot of the current page and " +
    "provides detailed guidance on how to extract the requested information using coordinate-based actions. " +
    "Includes visual analysis with step-by-step instructions, pro tips, and example commands tailored to your extraction needs.",
  inputSchema: ExtractInputSchema,
};

async function handleExtract(
  context: Context,
  params: ExtractInput,
): Promise<ToolResult> {
  const action = async (): Promise<ToolActionResult> => {
    try {
      const client = await context.getTzafonWrightClient();

      if (!client) {
        throw new Error("No TzafonWright client available");
      }

      // Automatically take a screenshot to help with extraction guidance
      const screenshotResult = await client.screenshot();

      if (!screenshotResult.success) {
        throw new Error(
          screenshotResult.error_message || "Failed to capture screenshot",
        );
      }

      const content: (TextContent | ImageContent)[] = [
        {
          type: "text",
          text: `Extraction instruction received: "${params.instruction}"\n\n📸 Current page screenshot captured to help with extraction.\n\n⚡ TzafonWright Extraction Guide:\n\nSince TzafonWright uses coordinate-based actions, here's how to extract "${params.instruction}":\n\n1. 🔍 **Analyze the screenshot below** to identify the elements you need\n2. 📍 **Note the coordinates** of text, buttons, or input fields\n3. 🎯 **Use specific actions** like:\n   - Click at coordinates X,Y to interact with elements\n   - Right-click for context menus\n   - Scroll to reveal more content\n4. 📝 **Extract text** by taking additional screenshots after interactions\n\n💡 **Pro Tips:**\n- For tables: Click each cell individually\n- For lists: Scroll through and capture multiple screenshots\n- For forms: Click inputs to reveal values\n- For dynamic content: Wait between actions\n\n🤖 Use the other TzafonWright tools (act, navigate, screenshot) to systematically extract the information you need.`,
        },
      ];

      // Include the screenshot if available
      if (screenshotResult.image) {
        content.push({
          type: "image",
          data: screenshotResult.image.toString("base64"),
          mimeType: "image/png",
        });
      }

      return { content };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Fallback to basic guidance if screenshot fails
      return {
        content: [
          {
            type: "text",
            text: `Extraction instruction received: "${params.instruction}"\n\n⚠️ Could not capture screenshot: ${errorMsg}\n\n📋 TzafonWright Extraction Steps:\n1. Use tzafonwright_screenshot to capture the current page\n2. Analyze the image to identify target elements\n3. Use tzafonwright_act with coordinates to interact with elements\n4. Take additional screenshots as needed\n5. Repeat until you have extracted all required information\n\nExample commands:\n- "Take a screenshot"\n- "Click at coordinates 300,150" \n- "Scroll down"\n- "Type 'search term'"\n\nTzafonWright specializes in precise coordinate-based automation.`,
          },
        ],
      };
    }
  };

  return {
    action,
    waitForNetwork: false,
  };
}

const extractTool: Tool<typeof ExtractInputSchema> = {
  capability: "core",
  schema: extractSchema,
  handle: handleExtract,
};

export default extractTool;
