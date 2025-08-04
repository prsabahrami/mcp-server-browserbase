import { z } from "zod";
import {
  defineTool,
  type Tool,
  type ToolResult,
  type InputType,
} from "./tool.js";
import * as tzafonwrightStore from "../tzafonwrightStore.js";
import { CreateSessionParams, TzafonWrightSession } from "../types/types.js";
import type { Context } from "../context.js";
import navigateTool from "./navigate.js";
import actTool from "./act.js";
import extractTool from "./extract.js";
import observeTool from "./observe.js";
import screenshotTool from "./screenshot.js";

/**
 * Creates a session-aware version of an existing tool
 * This wraps the original tool's handler to work with a specific session
 */
function createMultiSessionAwareTool<TInput extends InputType>(
  originalTool: Tool<TInput>,
  options: {
    namePrefix?: string;
    nameSuffix?: string;
  } = {},
): Tool<InputType> {
  const { namePrefix = "", nameSuffix = "_session" } = options;

  // Create new input schema that includes sessionId
  const originalSchema = originalTool.schema.inputSchema;
  let newInputSchema: z.ZodSchema;

  if (originalSchema instanceof z.ZodObject) {
    // If it's a ZodObject, we can spread its shape
    newInputSchema = z.object({
      sessionId: z.string().describe("The session ID to use"),
      ...originalSchema.shape,
    });
  } else {
    // For other schema types, create an intersection
    newInputSchema = z.intersection(
      z.object({ sessionId: z.string().describe("The session ID to use") }),
      originalSchema,
    );
  }

  return defineTool({
    capability: originalTool.capability,
    schema: {
      name: `${namePrefix}${originalTool.schema.name}${nameSuffix}`,
      description: `${originalTool.schema.description} (for a specific session)`,
      inputSchema: newInputSchema,
    },
    handle: async (
      context: Context,
      params: z.infer<typeof newInputSchema>,
    ): Promise<ToolResult> => {
      const { sessionId, ...originalParams } = params;

      // Get the session
      const session = tzafonwrightStore.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Create a temporary context that points to the specific session
      const sessionContext = Object.create(context);
      sessionContext.currentSessionId = sessionId;
      sessionContext.getTzafonWrightClient = async () => session.client;

      // Call the original tool's handler with the session-specific context
      return originalTool.handle(sessionContext, originalParams);
    },
  });
}

// Bulk create sessions tool
export const createBulkSessionsTool = defineTool({
  capability: "create_bulk_sessions",
  schema: {
    name: "multi_tzafonwright_sessions_create_bulk",
    description:
      "🚀 **Optimized Bulk Session Creator**: Create multiple parallel browser sessions using TzafonWright's proxy infrastructure! " +
      "Leverages the Ephemeral Browser Proxy to efficiently route connections to available browser instances. " +
      "Perfect for: concurrent data scraping, parallel testing, batch processing, multi-account workflows, " +
      "A/B testing with multiple variants, or any task requiring many browser instances. " +
      "Much more efficient than creating sessions individually - uses TzafonWright's native infrastructure scaling.",
    inputSchema: z.object({
      count: z
        .number()
        .min(1)
        .max(50)
        .describe(
          "Number of parallel sessions to create (1-50). Sessions are created in batches to prevent overwhelming the server. For large counts, expect longer creation times.",
        ),
      namePrefix: z
        .string()
        .optional()
        .describe(
          "Optional prefix for session names. Sessions will be named like 'prefix-1', 'prefix-2', etc. Example: 'scraper' creates 'scraper-1', 'scraper-2'. Defaults to 'session'.",
        ),
      batchSize: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe(
          "Sessions per batch (1-10). Smaller batches are more reliable but slower. Default: 5. Use 2-3 for unstable connections, 5-8 for stable setups.",
        ),
      batchDelay: z
        .number()
        .min(0)
        .max(10000)
        .optional()
        .describe(
          "Delay between batches in milliseconds (0-10000). Longer delays reduce server load but increase total time. Default: 2000ms (2 seconds).",
        ),
    }),
  },
  handle: async (
    context: Context,
    { count, namePrefix = "session", batchSize, batchDelay },
  ): Promise<ToolResult> => {
    try {
      const bulkResults = await import("../tzafonwright/client.js").then(
        (module) =>
          module.TzafonWrightClient.createBulkSessions(
            context.config.proxyUrl,
            count,
            namePrefix,
            {
              batchSize,
              batchDelay,
              connectionTimeout: 10000,
            },
          ),
      );

      const sessions: TzafonWrightSession[] = [];
      const errors: string[] = [];

      for (const result of bulkResults.successful) {
        try {
          const sessionData = {
            id: result.sessionId,
            client: result.client,
            created: Date.now(),
            metadata: { name: result.name },
          };
          tzafonwrightStore.storeSession(sessionData);
          sessions.push(sessionData);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push(
            `${result.name}: Failed to store session - ${errorMessage}`,
          );
          await result.client.close().catch(() => {});
        }
      }

      bulkResults.failed.forEach((failure) => {
        errors.push(`${failure.name}: ${failure.error}`);
      });

      const successCount = sessions.length;
      const failureCount = errors.length;

      let statusText = `🎉 **Batched Session Creation Complete!**\n\n`;
      statusText += `✅ **Successfully Created**: ${successCount}/${count} sessions\n`;

      if (bulkResults.batchResults.length > 1) {
        statusText += `\n📊 **Batch Results**:\n`;
        bulkResults.batchResults.forEach((batch) => {
          statusText += `   Batch ${batch.batchNumber}: ${batch.successful} successful, ${batch.failed} failed\n`;
        });
      }

      if (successCount > 0) {
        statusText += `\n📋 **Active Sessions**:\n`;
        sessions.forEach((session, index) => {
          const sessionName =
            session.metadata?.name || `${namePrefix}-${index + 1}`;
          statusText += `   ${index + 1}. ${session.id} (${sessionName})\n`;
        });
      }

      if (failureCount > 0) {
        statusText += `\n❌ **Failed Sessions** (${failureCount}):\n`;
        errors.slice(0, 10).forEach((error, index) => {
          statusText += `   ${index + 1}. ${error}\n`;
        });
        if (errors.length > 10) {
          statusText += `   ... and ${errors.length - 10} more failures\n`;
        }
      }

      statusText += `\n🔧 **Next Steps**:\n`;
      statusText += `   • Use 'multi_tzafonwright_session_list' to view all sessions\n`;
      statusText += `   • Use session-specific tools with the session IDs above\n`;
      statusText += `   • Remember to close sessions when done to free resources\n`;

      if (failureCount > successCount) {
        statusText += `\n💡 **Optimization Tips**: High failure rate detected.\n`;
        statusText += `   • Try smaller batch sizes (2-3 sessions per batch)\n`;
        statusText += `   • Increase batch delay (3000-5000ms)\n`;
        statusText += `   • Check your TzafonWright server capacity\n`;
      }

      if (successCount > 10) {
        statusText += `\n⚠️  **Resource Warning**: ${successCount} sessions created. Monitor system performance!`;
      }

      return {
        action: async () => ({
          content: [
            {
              type: "text",
              text: statusText,
            },
          ],
        }),
        waitForNetwork: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create bulk sessions: ${errorMessage}. Check your TzafonWright proxy connection and system resources.`,
      );
    }
  },
});

export const createSessionTool = defineTool({
  capability: "create_session",
  schema: {
    name: "multi_tzafonwright_session_create",
    description:
      "Create parallel browser session for multi-session workflows. Use this when you need multiple browser instances running simultaneously: parallel data scraping, concurrent automation, A/B testing, multiple user accounts, cross-site operations, batch processing, or any task requiring more than one browser. Creates an isolated browser session with independent state. Always pair with session-specific tools (those ending with '_session'). Perfect for scaling automation tasks that require multiple browsers working in parallel.",
    inputSchema: z.object({
      name: z
        .string()
        .optional()
        .describe(
          "Highly recommended: Descriptive name for tracking multiple sessions (e.g. 'amazon-scraper', 'user-login-flow', 'checkout-test-1'). Makes debugging and session management much easier!",
        ),
    }),
  },
  handle: async (context: Context, { name }): Promise<ToolResult> => {
    try {
      const params: CreateSessionParams = {
        meta: name ? { name } : undefined,
      };

      const session = await tzafonwrightStore.create(context.config, params);

      return {
        action: async () => ({
          content: [
            {
              type: "text",
              text: `Created TzafonWright session ${session.id}${name ? ` (${name})` : ""}`,
            },
          ],
        }),
        waitForNetwork: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create browser session: ${errorMessage}. Please check your TzafonWright proxy connection and try again.`,
      );
    }
  },
});

// List sessions tool
export const listSessionsTool = defineTool({
  capability: "list_sessions",
  schema: {
    name: "multi_tzafonwright_session_list",
    description:
      "ONLY WORKS WITH MULTI-SESSION TOOLS! Track all parallel sessions: Critical tool for multi-session management! Shows all active browser sessions with their IDs, names, and ages. Use this frequently to monitor your parallel automation workflows, verify sessions are running, and get session IDs for session-specific tools. Essential for debugging and resource management in complex multi-browser scenarios.",
    inputSchema: z.object({}),
  },
  handle: async (): Promise<ToolResult> => {
    const sessions = tzafonwrightStore.list();

    if (sessions.length === 0) {
      return {
        action: async () => ({
          content: [
            {
              type: "text",
              text: "No active sessions",
            },
          ],
        }),
        waitForNetwork: false,
      };
    }

    const sessionInfo = sessions.map((s) => ({
      id: s.id,
      name: s.metadata?.name,
      created: new Date(s.created).toISOString(),
      age: Math.floor((Date.now() - s.created) / 1000),
    }));

    return {
      action: async () => ({
        content: [
          {
            type: "text",
            text: `Active sessions (${sessions.length}):\n${sessionInfo
              .map(
                (s) =>
                  `- ${s.id}${s.name ? ` (${s.name})` : ""} - Age: ${s.age}s`,
              )
              .join("\n")}`,
          },
        ],
      }),
      waitForNetwork: false,
    };
  },
});

// Bulk close sessions tool
export const closeBulkSessionsTool = defineTool({
  capability: "close_bulk_sessions",
  schema: {
    name: "multi_tzafonwright_sessions_close_bulk",
    description:
      "🧹 **Bulk Session Cleanup**: Close multiple parallel sessions at once for efficient resource management! " +
      "Perfect for cleaning up after batch automation, parallel testing, or multi-session workflows. " +
      "Can close all sessions, sessions by name prefix, or a specific list. Essential for preventing resource waste " +
      "and system performance issues. Much faster than closing sessions individually.",
    inputSchema: z.object({
      mode: z
        .enum(["all", "prefix", "list"])
        .describe(
          "Cleanup mode: 'all' = close all sessions, 'prefix' = close sessions with specific name prefix, 'list' = close specific session IDs",
        ),
      namePrefix: z
        .string()
        .optional()
        .describe(
          "Required when mode='prefix'. Close all sessions whose names start with this prefix. Example: 'scraper' closes 'scraper-1', 'scraper-2', etc.",
        ),
      sessionIds: z
        .array(z.string())
        .optional()
        .describe(
          "Required when mode='list'. Array of specific session IDs to close. Get IDs from 'multi_tzafonwright_session_list'.",
        ),
    }),
  },
  handle: async (
    context: Context,
    { mode, namePrefix, sessionIds },
  ): Promise<ToolResult> => {
    try {
      const allSessions = tzafonwrightStore.list();

      if (allSessions.length === 0) {
        return {
          action: async () => ({
            content: [
              {
                type: "text",
                text: "📋 No active sessions to close.",
              },
            ],
          }),
          waitForNetwork: false,
        };
      }

      let sessionsToClose: typeof allSessions = [];

      // Determine which sessions to close based on mode
      switch (mode) {
        case "all":
          sessionsToClose = allSessions;
          break;

        case "prefix":
          if (!namePrefix) {
            throw new Error("namePrefix is required when mode='prefix'");
          }
          sessionsToClose = allSessions.filter((session) =>
            session.metadata?.name?.startsWith(namePrefix),
          );
          break;

        case "list":
          if (!sessionIds || sessionIds.length === 0) {
            throw new Error("sessionIds array is required when mode='list'");
          }
          sessionsToClose = allSessions.filter((session) =>
            sessionIds.includes(session.id),
          );
          break;
      }

      if (sessionsToClose.length === 0) {
        const modeText =
          mode === "prefix"
            ? `with prefix '${namePrefix}'`
            : mode === "list"
              ? "matching the provided IDs"
              : "";
        return {
          action: async () => ({
            content: [
              {
                type: "text",
                text: `📋 No sessions found ${modeText} to close.`,
              },
            ],
          }),
          waitForNetwork: false,
        };
      }

      // Close sessions in parallel for speed
      const closePromises = sessionsToClose.map(async (session) => {
        try {
          await tzafonwrightStore.remove(session.id);
          return { success: true, session };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return { success: false, session, error: errorMessage };
        }
      });

      const results = await Promise.all(closePromises);

      // Separate successful closes from errors
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      let statusText = `🧹 **Bulk Session Cleanup Complete!**\n\n`;
      statusText += `✅ **Successfully Closed**: ${successful.length}/${sessionsToClose.length} sessions\n`;

      if (successful.length > 0) {
        statusText += `\n🗑️ **Closed Sessions**:\n`;
        successful.forEach((result, index) => {
          const sessionName = result.session.metadata?.name || "unnamed";
          statusText += `   ${index + 1}. ${result.session.id} (${sessionName})\n`;
        });
      }

      if (failed.length > 0) {
        statusText += `\n❌ **Failed to Close** (${failed.length}):\n`;
        failed.forEach((result, index) => {
          const sessionName = result.session.metadata?.name || "unnamed";
          statusText += `   ${index + 1}. ${result.session.id} (${sessionName}): ${result.error}\n`;
        });
      }

      const remainingSessions = tzafonwrightStore.list();
      statusText += `\n📊 **Resource Status**: ${remainingSessions.length} sessions still active`;

      if (successful.length > 0) {
        statusText += `\n✨ **Resources freed!** System performance should improve.`;
      }

      return {
        action: async () => ({
          content: [
            {
              type: "text",
              text: statusText,
            },
          ],
        }),
        waitForNetwork: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to close bulk sessions: ${errorMessage}`);
    }
  },
});

// Close session tool
export const closeSessionTool = defineTool({
  capability: "close_session",
  schema: {
    name: "multi_tzafonwright_session_close",
    description:
      "Cleanup parallel session for multi-session workflows. Properly terminates a browser session and frees resources. Always use this when finished with a session to avoid resource waste. Critical for responsible multi-session automation - each unclosed session continues consuming resources!",
    inputSchema: z.object({
      sessionId: z
        .string()
        .describe(
          "Exact session ID to close (get from 'multi_tzafonwright_session_list'). Double-check this ID - once closed, the session cannot be recovered!",
        ),
    }),
  },
  handle: async (_context: Context, { sessionId }): Promise<ToolResult> => {
    const session = tzafonwrightStore.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await tzafonwrightStore.remove(sessionId);

    return {
      action: async () => ({
        content: [
          {
            type: "text",
            text: `Closed session ${sessionId}`,
          },
        ],
      }),
      waitForNetwork: false,
    };
  },
});

// Create multi-session-aware versions of the core tools
export const navigateWithSessionTool = createMultiSessionAwareTool(
  navigateTool,
  {
    namePrefix: "multi_",
    nameSuffix: "_session",
  },
);

export const actWithSessionTool = createMultiSessionAwareTool(actTool, {
  namePrefix: "multi_",
  nameSuffix: "_session",
});

export const extractWithSessionTool = createMultiSessionAwareTool(extractTool, {
  namePrefix: "multi_",
  nameSuffix: "_session",
});

export const observeWithSessionTool = createMultiSessionAwareTool(observeTool, {
  namePrefix: "multi_",
  nameSuffix: "_session",
});

export const screenshotWithSessionTool = createMultiSessionAwareTool(
  screenshotTool,
  {
    namePrefix: "multi_",
    nameSuffix: "_session",
  },
);
