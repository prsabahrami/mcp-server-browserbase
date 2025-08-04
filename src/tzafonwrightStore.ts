import { randomUUID } from "crypto";
import { TzafonWrightClient } from "./tzafonwright/client.js";
import { TzafonWrightSession, CreateSessionParams } from "./types/types.js";
import type { Config } from "../config.d.ts";

// Store for all active sessions
const store = new Map<string, TzafonWrightSession>();

/**
 * Create a configured TzafonWright client instance
 */
export const createTzafonWrightClient = async (
  config: Config,
  params: CreateSessionParams = {},
  sessionId: string,
): Promise<TzafonWrightClient> => {
  const proxyUrl = params.proxyUrl || config.proxyUrl;

  if (!proxyUrl) {
    throw new Error("TzafonWright proxy URL is required");
  }

  const client = new TzafonWrightClient(proxyUrl);

  try {
    await client.connect();
    process.stderr.write(
      `[TzafonWrightStore] Client connected for session: ${sessionId}\n`,
    );

    // Set viewport size if configured
    if (config.viewPort?.browserWidth && config.viewPort?.browserHeight) {
      await client.setViewportSize({
        width: config.viewPort.browserWidth,
        height: config.viewPort.browserHeight,
      });
    }

    return client;
  } catch (error) {
    await client.close();
    throw error;
  }
};

/**
 * Create a new TzafonWright session
 */
export const create = async (
  config: Config,
  params: CreateSessionParams = {},
): Promise<TzafonWrightSession> => {
  const id = randomUUID() + "_tzafonwright";

  process.stderr.write(`[TzafonWrightStore] Creating new session ${id}...\n`);

  const client = await createTzafonWrightClient(config, params, id);

  const session: TzafonWrightSession = {
    id,
    client,
    created: Date.now(),
    metadata: {
      ...params.meta,
      proxyUrl: params.proxyUrl || config.proxyUrl,
    },
  };

  store.set(id, session);

  process.stderr.write(`[TzafonWrightStore] Session created: ${id}\n`);

  return session;
};

/**
 * Get a session by ID
 */
export const get = (id: string): TzafonWrightSession | null => {
  return store.get(id) ?? null;
};

/**
 * List all active sessions
 */
export const list = (): TzafonWrightSession[] => {
  return Array.from(store.values());
};

/**
 * Remove and close a session
 */
export const remove = async (id: string): Promise<void> => {
  const session = store.get(id);
  if (!session) {
    process.stderr.write(
      `[TzafonWrightStore] Session not found for removal: ${id}\n`,
    );
    return;
  }

  process.stderr.write(`[TzafonWrightStore] Removing session: ${id}\n`);

  try {
    await session.client.close();
    process.stderr.write(`[TzafonWrightStore] Session closed: ${id}\n`);
  } catch (error) {
    process.stderr.write(
      `[TzafonWrightStore] Error closing session ${id}: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
  } finally {
    store.delete(id);
  }
};

/**
 * Remove all sessions
 */
export const removeAll = async (): Promise<void> => {
  process.stderr.write(
    `[TzafonWrightStore] Removing all ${store.size} sessions...\n`,
  );
  await Promise.all(list().map((s) => remove(s.id)));
  process.stderr.write(`[TzafonWrightStore] All sessions removed\n`);
};

/**
 * Store a pre-created session (for bulk operations)
 */
export const storeSession = (session: TzafonWrightSession): void => {
  store.set(session.id, session);
  process.stderr.write(`[TzafonWrightStore] Session stored: ${session.id}\n`);
};

/**
 * Get store size
 */
export const size = (): number => {
  return store.size;
};
