import type { Config } from "../config.d.ts";
import { createTzafonWrightClient } from "./tzafonwrightStore.js";
import type { BrowserSession } from "./types/types.js";

// Global state for managing browser sessions
const browsers = new Map<string, BrowserSession>();

// Keep track of the default session explicitly
let defaultBrowserSession: BrowserSession | null = null;

// Define a specific ID for the default session
export const defaultSessionId = `tzafonwright_session_main_${Date.now()}`;

// Keep track of the active session ID. Defaults to the main session.
let activeSessionId: string = defaultSessionId;

/**
 * Sets the active session ID.
 * @param id The ID of the session to set as active.
 */
export function setActiveSessionId(id: string): void {
  if (browsers.has(id) || id === defaultSessionId) {
    activeSessionId = id;
  } else {
    process.stderr.write(
      `[SessionManager] WARN - Set active session failed for non-existent ID: ${id}\n`,
    );
  }
}

/**
 * Gets the active session ID.
 * @returns The active session ID.
 */
export function getActiveSessionId(): string {
  return activeSessionId;
}

// Function to create a new TzafonWright session
export async function createNewBrowserSession(
  newSessionId: string,
  config: Config,
): Promise<BrowserSession> {
  if (!config.proxyUrl) {
    throw new Error("TzafonWright proxy URL is missing in the configuration.");
  }

  try {
    process.stderr.write(
      `[SessionManager] Creating TzafonWright session ${newSessionId}...\n`,
    );

    // Create and initialize TzafonWright client instance
    const client = await createTzafonWrightClient(
      config,
      { proxyUrl: config.proxyUrl },
      newSessionId,
    );

    process.stderr.write(
      `[SessionManager] TzafonWright client initialized for session: ${newSessionId}\n`,
    );

    const sessionObj: BrowserSession = {
      client,
      sessionId: newSessionId,
    };

    browsers.set(newSessionId, sessionObj);

    if (newSessionId === defaultSessionId) {
      defaultBrowserSession = sessionObj;
    }

    setActiveSessionId(newSessionId);
    process.stderr.write(
      `[SessionManager] Session created and active: ${newSessionId}\n`,
    );

    return sessionObj;
  } catch (creationError) {
    const errorMessage =
      creationError instanceof Error
        ? creationError.message
        : String(creationError);
    process.stderr.write(
      `[SessionManager] Creating session ${newSessionId} failed: ${errorMessage}\n`,
    );
    throw new Error(
      `Failed to create/connect session ${newSessionId}: ${errorMessage}`,
    );
  }
}

async function closeBrowserGracefully(
  session: BrowserSession | undefined | null,
  sessionIdToLog: string,
): Promise<void> {
  // Close TzafonWright client which handles browser cleanup
  if (session?.client) {
    try {
      process.stderr.write(
        `[SessionManager] Closing TzafonWright client for session: ${sessionIdToLog}\n`,
      );
      await session.client.close();
      process.stderr.write(
        `[SessionManager] Successfully closed TzafonWright client for session: ${sessionIdToLog}\n`,
      );
    } catch (closeError) {
      process.stderr.write(
        `[SessionManager] WARN - Error closing TzafonWright client for session ${sessionIdToLog}: ${
          closeError instanceof Error ? closeError.message : String(closeError)
        }\n`,
      );
    }
  }
}

// Internal function to ensure default session
export async function ensureDefaultSessionInternal(
  config: Config,
): Promise<BrowserSession> {
  const sessionId = defaultSessionId;
  let needsReCreation = false;

  if (!defaultBrowserSession) {
    needsReCreation = true;
    process.stderr.write(
      `[SessionManager] Default session ${sessionId} not found, creating.\n`,
    );
  } else if (!defaultBrowserSession.client) {
    needsReCreation = true;
    process.stderr.write(
      `[SessionManager] Default session ${sessionId} is stale, recreating.\n`,
    );
    await closeBrowserGracefully(defaultBrowserSession, sessionId);
    defaultBrowserSession = null;
    browsers.delete(sessionId);
  }

  if (needsReCreation) {
    try {
      defaultBrowserSession = await createNewBrowserSession(sessionId, config);
      return defaultBrowserSession;
    } catch (creationError) {
      // Error during initial creation or recreation
      process.stderr.write(
        `[SessionManager] Initial/Recreation attempt for default session ${sessionId} failed. Error: ${
          creationError instanceof Error
            ? creationError.message
            : String(creationError)
        }\n`,
      );
      // Attempt one more time after a failure
      process.stderr.write(
        `[SessionManager] Retrying creation of default session ${sessionId} after error...\n`,
      );
      try {
        defaultBrowserSession = await createNewBrowserSession(
          sessionId,
          config,
        );
        return defaultBrowserSession;
      } catch (retryError) {
        const finalErrorMessage =
          retryError instanceof Error ? retryError.message : String(retryError);
        process.stderr.write(
          `[SessionManager] Failed to recreate default session ${sessionId} after retry: ${finalErrorMessage}\n`,
        );
        throw new Error(
          `Failed to ensure default session ${sessionId} after initial error and retry: ${finalErrorMessage}`,
        );
      }
    }
  }

  // If we reached here, the existing default session is considered okay.
  setActiveSessionId(sessionId); // Ensure default is marked active
  return defaultBrowserSession!; // Non-null assertion: logic ensures it's not null here
}

// Get a specific session by ID
export async function getSession(
  sessionId: string,
  config: Config,
  createIfMissing: boolean = true,
): Promise<BrowserSession | null> {
  if (sessionId === defaultSessionId && createIfMissing) {
    try {
      return await ensureDefaultSessionInternal(config);
    } catch {
      process.stderr.write(
        `[SessionManager] Failed to get default session due to error in ensureDefaultSessionInternal for ${sessionId}. See previous messages for details.\n`,
      );
      return null; // Or rethrow if getSession failing for default is critical
    }
  }

  // For non-default sessions
  process.stderr.write(`[SessionManager] Getting session: ${sessionId}\n`);
  const sessionObj = browsers.get(sessionId);

  if (!sessionObj) {
    process.stderr.write(
      `[SessionManager] WARN - Session not found in map: ${sessionId}\n`,
    );
    return null;
  }

  // Validate the found session
  if (!sessionObj.client) {
    process.stderr.write(
      `[SessionManager] WARN - Found session ${sessionId} is stale, removing.\n`,
    );
    await closeBrowserGracefully(sessionObj, sessionId);
    browsers.delete(sessionId);
    if (activeSessionId === sessionId) {
      process.stderr.write(
        `[SessionManager] WARN - Invalidated active session ${sessionId}, resetting to default.\n`,
      );
      setActiveSessionId(defaultSessionId);
    }
    return null;
  }

  // Session appears valid, make it active
  setActiveSessionId(sessionId);
  process.stderr.write(`[SessionManager] Using valid session: ${sessionId}\n`);
  return sessionObj;
}

/**
 * Clean up a session by removing it from tracking.
 * This is called after a browser is closed to ensure proper cleanup.
 * @param sessionId The session ID to clean up
 */
export async function cleanupSession(sessionId: string): Promise<void> {
  process.stderr.write(`[SessionManager] Cleaning up session: ${sessionId}\n`);

  // Get the session to close it gracefully
  const session = browsers.get(sessionId);
  if (session) {
    await closeBrowserGracefully(session, sessionId);
  }

  // Remove from browsers map
  browsers.delete(sessionId);

  // Clear default session reference if this was the default
  if (sessionId === defaultSessionId && defaultBrowserSession) {
    defaultBrowserSession = null;
  }

  // Reset active session to default if this was the active one
  if (activeSessionId === sessionId) {
    process.stderr.write(
      `[SessionManager] Cleaned up active session ${sessionId}, resetting to default.\n`,
    );
    setActiveSessionId(defaultSessionId);
  }
}

// Function to close all managed browser sessions gracefully
export async function closeAllSessions(): Promise<void> {
  process.stderr.write(`[SessionManager] Closing all sessions...\n`);
  const closePromises: Promise<void>[] = [];
  for (const [id, session] of browsers.entries()) {
    process.stderr.write(`[SessionManager] Closing session: ${id}\n`);
    closePromises.push(
      // Use the helper for consistent logging/error handling
      closeBrowserGracefully(session, id),
    );
  }
  try {
    await Promise.all(closePromises);
  } catch {
    // Individual errors are caught and logged by closeBrowserGracefully
    process.stderr.write(
      `[SessionManager] WARN - Some errors occurred during batch session closing. See individual messages.\n`,
    );
  }

  browsers.clear();
  defaultBrowserSession = null;
  setActiveSessionId(defaultSessionId); // Reset active session to default
  process.stderr.write(`[SessionManager] All sessions closed and cleared.\n`);
}
