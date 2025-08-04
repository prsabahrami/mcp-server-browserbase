import { z } from "zod";
import type { Tool, ToolSchema, ToolResult } from "./tool.js";
import type { Context } from "../context.js";
import type { ToolActionResult } from "../types/types.js";

const ObserveInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      "Detailed instruction for what specific elements or components to observe on the web page. " +
        "This instruction must be extremely specific and descriptive. For example: 'Find the red login button " +
        "in the top right corner', 'Locate the search input field with placeholder text', or 'Identify all " +
        "clickable product cards on the page'. The more specific and detailed your instruction, the better " +
        "the observation results will be. Avoid generic instructions like 'find buttons' or 'see elements'. " +
        "Instead, describe the visual characteristics, location, text content, or functionality of the elements " +
        "you want to observe. This tool is designed to help you identify interactive elements that you can " +
        "later use with the act tool for performing actions like clicking, typing, or form submission.",
    ),
  returnAction: z
    .boolean()
    .optional()
    .describe(
      "Whether to return the action to perform on the element. If true, the action will be returned as a string. " +
        "If false, the action will not be returned.",
    ),
});

type ObserveInput = z.infer<typeof ObserveInputSchema>;

const observeSchema: ToolSchema<typeof ObserveInputSchema> = {
  name: "tzafonwright_observe",
  description:
    "Observes the current web page state. Since TzafonWright doesn't have AI-powered element detection, " +
    "this tool will suggest taking a screenshot to manually identify elements and their coordinates. " +
    "Use this in combination with the screenshot tool to identify clickable elements and their positions.",
  inputSchema: ObserveInputSchema,
};

async function handleObserve(
  context: Context,
  params: ObserveInput,
): Promise<ToolResult> {
  const action = async (): Promise<ToolActionResult> => {
    try {
      // TzafonWright doesn't have AI-powered observation capabilities
      // Suggest taking a screenshot to manually identify elements
      return {
        content: [
          {
            type: "text",
            text: `Observation instruction: "${params.instruction}"\n\nSince TzafonWright doesn't have AI-powered element detection, please:\n1. Take a screenshot to see the current page\n2. Manually identify the elements you described\n3. Note their approximate coordinates\n4. Use the act tool with specific coordinates\n\nFor example, if you see a button at position (300, 150), use: "Click at coordinates 300,150"`,
          },
        ],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to observe: ${errorMsg}`);
    }
  };

  return {
    action,
    waitForNetwork: false,
  };
}

const observeTool: Tool<typeof ObserveInputSchema> = {
  capability: "core",
  schema: observeSchema,
  handle: handleObserve,
};

export default observeTool;
