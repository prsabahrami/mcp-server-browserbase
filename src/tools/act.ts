import { z } from "zod";
import type { Tool, ToolSchema, ToolResult } from "./tool.js";
import type { Context } from "../context.js";
import type { ToolActionResult } from "../types/types.js";
import { ImageContent, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { aiVisionService } from "../services/aiVision.js";

const ActInputSchema = z.object({
  action: z
    .string()
    .describe(
      "The action to perform. Should be as atomic and specific as possible, " +
        "i.e. 'Click the sign in button' or 'Type 'hello' into the search input'. AVOID actions that are more than one " +
        "step, i.e. 'Order me pizza' or 'Send an email to Paul asking him to call me'. The instruction should be just as specific as possible, " +
        "and have a strong correlation to the text on the page. If unsure, use observe before using act.",
    ),
  variables: z
    .object({})
    .optional()
    .describe(
      "Variables used in the action template. ONLY use variables if you're dealing " +
        "with sensitive data or dynamic content. For example, if you're logging in to a website, " +
        "you can use a variable for the password. When using variables, you MUST have the variable " +
        'key in the action template. For example: {"action": "Fill in the password", "variables": {"password": "123456"}}',
    ),
});

type ActInput = z.infer<typeof ActInputSchema>;

const actSchema: ToolSchema<typeof ActInputSchema> = {
  name: "tzafonwright_act",
  description:
    "🤖 **AI-Powered Web Actions!** Performs actions on web page elements using advanced AI vision. " +
    "**Natural Language Support**: Use commands like 'Click the search box', 'Click the login button', 'Click on Apple'. " +
    "**AI Vision**: Automatically analyzes screenshots to find elements and determine coordinates. " +
    "**Fallback**: If AI can't find elements, provides intelligent suggestions and manual coordinate options. " +
    "**Coordinate Mode**: Still supports direct coordinates like 'Click at coordinates 100,200'. " +
    "**Text Input**: Use 'Type \"text\"' for entering text. **Scrolling**: 'Scroll down', 'Scroll up'. " +
    "Requires OPENAI_API_KEY environment variable for AI features.",
  inputSchema: ActInputSchema,
};

// Helper function to parse natural language actions into TzafonWright commands
function parseAction(action: string, variables?: Record<string, unknown>) {
  // Apply variables if provided
  let processedAction = action;
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      processedAction = processedAction.replace(
        new RegExp(`\\{${key}\\}`, "g"),
        String(value),
      );
    }
  }

  const lowerAction = processedAction.toLowerCase().trim();

  // Parse click actions with coordinates
  const clickCoordMatch = lowerAction.match(
    /click\s+(?:at\s+)?(?:coordinates?\s+)?(\d+)[,\s]+(\d+)/,
  );
  if (clickCoordMatch) {
    return {
      type: "click",
      x: parseInt(clickCoordMatch[1]),
      y: parseInt(clickCoordMatch[2]),
    };
  }

  // Parse typing actions
  const typeMatch =
    lowerAction.match(/type\s+['""](.+?)['""]/) ||
    lowerAction.match(/enter\s+['""](.+?)['""]/) ||
    lowerAction.match(/input\s+['""](.+?)['""]/) ||
    processedAction.match(/type\s+(.+?)(?:\s+into|$)/);
  if (typeMatch) {
    return {
      type: "type",
      text: typeMatch[1],
    };
  }

  // Parse scroll actions
  if (lowerAction.includes("scroll down")) {
    return {
      type: "scroll",
      delta_y: 300,
    };
  }
  if (lowerAction.includes("scroll up")) {
    return {
      type: "scroll",
      delta_y: -300,
    };
  }
  if (lowerAction.includes("scroll left")) {
    return {
      type: "scroll",
      delta_x: -300,
    };
  }
  if (lowerAction.includes("scroll right")) {
    return {
      type: "scroll",
      delta_x: 300,
    };
  }

  // Generic scroll parsing
  const scrollMatch = lowerAction.match(/scroll\s+([-\d]+)[,\s]+([-\d]+)/);
  if (scrollMatch) {
    return {
      type: "scroll",
      delta_x: parseInt(scrollMatch[1]),
      delta_y: parseInt(scrollMatch[2]),
    };
  }

  return null;
}

async function handleAct(
  context: Context,
  params: ActInput,
): Promise<ToolResult> {
  const action = async (): Promise<ToolActionResult> => {
    try {
      const client = await context.getTzafonWrightClient();

      if (!client) {
        throw new Error("No TzafonWright client available");
      }

      // Parse the natural language action
      const parsedAction = parseAction(params.action, params.variables);

      if (!parsedAction) {
        // Try AI vision to understand natural language and find coordinates
        const screenshotResult = await client.screenshot();

        if (!screenshotResult.success || !screenshotResult.image) {
          throw new Error("Failed to capture screenshot for AI analysis");
        }

        const screenshotBase64 = screenshotResult.image.toString("base64");

        // Use AI to find the element coordinates
        const aiResult = await aiVisionService.findElementCoordinates(
          screenshotBase64,
          params.action,
          context.config.viewPort?.browserWidth || 1280,
          context.config.viewPort?.browserHeight || 720,
        );

        if (aiResult.success && aiResult.coordinates) {
          // AI found the element! Execute the click automatically
          const result = await client.click({
            x: aiResult.coordinates.x,
            y: aiResult.coordinates.y,
          });

          if (!result.success) {
            throw new Error(result.error_message || "Click action failed");
          }

          return {
            content: [
              {
                type: "text",
                text: `🤖 **AI Vision Success!**\n\n✅ **Action**: ${params.action}\n🎯 **Found**: ${aiResult.coordinates.description}\n📍 **Coordinates**: (${aiResult.coordinates.x}, ${aiResult.coordinates.y})\n🎯 **Confidence**: ${Math.round(aiResult.coordinates.confidence * 100)}%\n💭 **AI Reasoning**: ${aiResult.reasoning}\n\n**Result**: Successfully clicked on the target element!`,
              },
            ],
          };
        } else {
          // AI couldn't find it, provide enhanced guidance with suggestions
          const suggestions =
            await aiVisionService.getElementSuggestions(screenshotBase64);

          const guidanceText = `🤖 **AI Vision Analysis**\n\n❌ Could not find element for: "${params.action}"\n${aiResult.error ? `\n🔍 **AI Feedback**: ${aiResult.error}` : ""}\n${aiResult.reasoning ? `\n💭 **Analysis**: ${aiResult.reasoning}` : ""}\n\n🎯 **Available Elements Detected:**\n${suggestions.length > 0 ? suggestions.map((s) => `- "${s}"`).join("\n") : "No clear interactive elements detected"}\n\n🔧 **Alternative Actions You Can Try:**\n- Use one of the detected elements above\n- "Click at coordinates X,Y" (manual coordinates)\n- "Type 'text'" (for typing)\n- "Scroll down" or "Scroll up"\n\n📸 **Current Screenshot Below** - Use it to identify coordinates manually if needed:`;

          const content: (TextContent | ImageContent)[] = [
            { type: "text", text: guidanceText },
          ];

          content.push({
            type: "image",
            data: screenshotBase64,
            mimeType: "image/png",
          });

          return { content };
        }
      }

      let result;
      switch (parsedAction.type) {
        case "click":
          result = await client.click({
            x: parsedAction.x!,
            y: parsedAction.y!,
          });
          break;
        case "type":
          result = await client.type(parsedAction.text!);
          break;
        case "scroll":
          result = await client.scroll({
            delta_x: parsedAction.delta_x || 0,
            delta_y: parsedAction.delta_y || 0,
          });
          break;
        default:
          throw new Error(`Unsupported action type: ${parsedAction.type}`);
      }

      if (!result.success) {
        throw new Error(
          result.error_message || `Action failed: ${params.action}`,
        );
      }

      return {
        content: [
          {
            type: "text",
            text: `Action performed: ${params.action}`,
          },
        ],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to perform action: ${errorMsg}`);
    }
  };

  return {
    action,
    waitForNetwork: false,
  };
}

const actTool: Tool<typeof ActInputSchema> = {
  capability: "core",
  schema: actSchema,
  handle: handleAct,
};

export default actTool;
