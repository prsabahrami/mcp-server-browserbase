import { z } from "zod";
import type { Tool, ToolSchema, ToolResult } from "./tool.js";
import type { Context } from "../context.js";
import type { ToolActionResult } from "../types/types.js";

// Import SessionManager functions
import {
  createNewBrowserSession,
  defaultSessionId,
  ensureDefaultSessionInternal,
  cleanupSession,
  getSession,
} from "../sessionManager.js";
import type { BrowserSession } from "../types/types.js";

// --- Tool: Create Session ---
const CreateSessionInputSchema = z.object({
  // Keep sessionId optional, but clarify its role
  sessionId: z
    .string()
    .optional()
    .describe(
      "Optional session ID to use/reuse. If not provided or invalid, a new session is created.",
    ),
});
type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

const createSessionSchema: ToolSchema<typeof CreateSessionInputSchema> = {
  name: "tzafonwright_session_create",
  description:
    "Create or reuse a single browser session using TzafonWright. WARNING: This tool is for SINGLE browser workflows only. If you need multiple browser sessions running simultaneously (parallel scraping, A/B testing, multiple accounts), use 'multi_tzafonwright_session_create' instead. This creates one browser session and initializes TzafonWright client to work with that session. Updates the active session.",
  inputSchema: CreateSessionInputSchema,
};

// Handle function for CreateSession using SessionManager
async function handleCreateSession(
  context: Context,
  params: CreateSessionInput,
): Promise<ToolResult> {
  const action = async (): Promise<ToolActionResult> => {
    try {
      const config = context.config; // Get config from context
      let targetSessionId: string;

      if (params.sessionId) {
        targetSessionId = `${params.sessionId}_tzafonwright`;
        process.stderr.write(
          `[tool.createSession] Attempting to create/assign session with specified ID: ${targetSessionId}`,
        );
      } else {
        targetSessionId = defaultSessionId;
      }

      let session: BrowserSession;
      if (targetSessionId === defaultSessionId) {
        session = await ensureDefaultSessionInternal(config);
      } else {
        // Create a new TzafonWright session
        session = await createNewBrowserSession(targetSessionId, config);
      }

      if (!session || !session.client || !session.sessionId) {
        throw new Error(
          `SessionManager failed to return a valid session object for ID: ${targetSessionId}`,
        );
      }

      context.currentSessionId = targetSessionId;
      process.stderr.write(
        `[tool.connected] Successfully connected to TzafonWright session. Internal ID: ${targetSessionId}`,
      );

      return {
        content: [
          {
            type: "text",
            text: `TzafonWright session created successfully: ${session.sessionId}`,
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `[tool.createSession] Action failed: ${errorMessage}`,
      );
      // Re-throw to be caught by Context.run's error handling for actions
      throw new Error(`Failed to create Browserbase session: ${errorMessage}`);
    }
  };

  // Return the ToolResult structure expected by Context.run
  return {
    action: action,
    waitForNetwork: false,
  };
}

// Define tool using handle
const createSessionTool: Tool<typeof CreateSessionInputSchema> = {
  capability: "core", // Add capability
  schema: createSessionSchema,
  handle: handleCreateSession,
};

// --- Tool: Close Session ---
const CloseSessionInputSchema = z.object({});

const closeSessionSchema: ToolSchema<typeof CloseSessionInputSchema> = {
  name: "browserbase_session_close",
  description:
    "Closes the current Browserbase session by properly shutting down the Stagehand instance, which handles browser cleanup and terminates the session recording.",
  inputSchema: CloseSessionInputSchema,
};

async function handleCloseSession(context: Context): Promise<ToolResult> {
  const action = async (): Promise<ToolActionResult> => {
    // Store the current session ID before it's potentially changed.
    const previousSessionId = context.currentSessionId;
    let clientClosedSuccessfully = false;
    let clientCloseErrorMessage = "";

    // Step 1: Attempt to get the session and close TzafonWright client
    try {
      const session = await getSession(
        previousSessionId,
        context.config,
        false,
      );

      if (session && session.client) {
        process.stderr.write(
          `[tool.closeSession] Attempting to close TzafonWright client for session: ${previousSessionId || "default"}`,
        );

        // Use TzafonWright client's close method which handles cleanup properly
        await session.client.close();
        clientClosedSuccessfully = true;

        process.stderr.write(
          `[tool.closeSession] TzafonWright client for session (${previousSessionId}) closed successfully.`,
        );

        // Clean up the session from tracking
        await cleanupSession(previousSessionId);
      } else {
        process.stderr.write(
          `[tool.closeSession] No TzafonWright client found for session: ${previousSessionId || "default/unknown"}`,
        );
      }
    } catch (error: unknown) {
      clientCloseErrorMessage =
        error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `[tool.closeSession] Error retrieving or closing TzafonWright client (session ID was ${previousSessionId || "default/unknown"}): ${clientCloseErrorMessage}`,
      );
    }

    // Step 2: Always reset the context's current session ID to default
    const oldContextSessionId = context.currentSessionId;
    context.currentSessionId = defaultSessionId;
    process.stderr.write(
      `[tool.closeSession] Session context reset to default. Previous context session ID was ${oldContextSessionId || "default/unknown"}.`,
    );

    // Step 3: Determine the result message
    if (clientCloseErrorMessage && !clientClosedSuccessfully) {
      throw new Error(
        `Failed to close the TzafonWright session (session ID in context was ${previousSessionId || "default/unknown"}). Error: ${clientCloseErrorMessage}. Session context has been reset to default.`,
      );
    }

    if (clientClosedSuccessfully) {
      const successMessage = `TzafonWright session (${previousSessionId || "default"}) closed successfully. Context reset to default.`;
      return { content: [{ type: "text", text: successMessage }] };
    }

    // No TzafonWright client was found
    let infoMessage =
      "No active TzafonWright session found to close. Session context has been reset to default.";
    if (previousSessionId && previousSessionId !== defaultSessionId) {
      infoMessage = `No active TzafonWright session found for session ID '${previousSessionId}'. The context has been reset to default.`;
    }
    return { content: [{ type: "text", text: infoMessage }] };
  };

  return {
    action: action,
    waitForNetwork: false,
  };
}

const closeSessionTool: Tool<typeof CloseSessionInputSchema> = {
  capability: "core",
  schema: closeSessionSchema,
  handle: handleCloseSession,
};

export default [createSessionTool, closeSessionTool];
