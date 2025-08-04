import WebSocket from "ws";

export enum ActionType {
  CLICK = "click",
  TYPE = "type",
  SCROLL = "scroll",
  GOTO = "goto",
  SCREENSHOT = "screenshot",
  SET_VIEWPORT_SIZE = "set_viewport_size",
}

export interface Command {
  action_type: ActionType;
  x?: number;
  y?: number;
  text?: string;
  delta_x?: number;
  delta_y?: number;
  url?: string;
  width?: number;
  height?: number;
  timeout?: number;
}

export interface Result {
  success: boolean;
  image?: Buffer;
  error_message?: string;
}

export class TzafonWrightClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private wsUrl: string;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  // Static method for bulk session creation using TzafonWright's proxy infrastructure
  static async createBulkSessions(
    proxyUrl: string,
    count: number,
    namePrefix: string = "session",
    options: {
      batchSize?: number;
      batchDelay?: number;
      connectionTimeout?: number;
    } = {},
  ): Promise<{
    successful: Array<{
      client: TzafonWrightClient;
      sessionId: string;
      name: string;
    }>;
    failed: Array<{ error: string; name: string }>;
    batchResults: Array<{
      batchNumber: number;
      successful: number;
      failed: number;
    }>;
  }> {
    const {
      batchSize = Math.min(5, count), // Default to 5 sessions per batch, or less if count is smaller
      batchDelay = 2000, // 2 second delay between batches
      connectionTimeout = 10000, // 10 second timeout per connection
    } = options;

    const results = {
      successful: [] as Array<{
        client: TzafonWrightClient;
        sessionId: string;
        name: string;
      }>,
      failed: [] as Array<{ error: string; name: string }>,
      batchResults: [] as Array<{
        batchNumber: number;
        successful: number;
        failed: number;
      }>,
    };

    // Split sessions into batches to prevent overwhelming the server
    const totalBatches = Math.ceil(count / batchSize);
    console.error(
      `[TzafonWright] Creating ${count} sessions in ${totalBatches} batches of ${batchSize} sessions each`,
    );

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, count);
      const batchCount = endIndex - startIndex;

      console.error(
        `[TzafonWright] Processing batch ${batchIndex + 1}/${totalBatches} (${batchCount} sessions)...`,
      );

      // Create sessions for this batch
      const batchPromises = Array.from(
        { length: batchCount },
        async (_, indexInBatch) => {
          const globalIndex = startIndex + indexInBatch;
          const sessionName = `${namePrefix}-${globalIndex + 1}`;
          const sessionId = `${sessionName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

          try {
            // Add timeout to prevent hanging connections
            const client = new TzafonWrightClient(proxyUrl);

            // Create connection with timeout
            await Promise.race([
              client.connect(),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("Connection timeout")),
                  connectionTimeout,
                ),
              ),
            ]);

            return {
              success: true,
              client,
              sessionId,
              name: sessionName,
            };
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            console.error(
              `[TzafonWright] Session ${sessionName} failed: ${errorMsg}`,
            );
            return {
              success: false,
              error: errorMsg,
              name: sessionName,
            };
          }
        },
      );

      // Execute batch in parallel
      const batchResults = await Promise.allSettled(batchPromises);

      let batchSuccessful = 0;
      let batchFailed = 0;

      batchResults.forEach((result) => {
        if (result.status === "fulfilled") {
          if (
            result.value.success &&
            result.value.client &&
            result.value.sessionId &&
            result.value.name
          ) {
            results.successful.push({
              client: result.value.client,
              sessionId: result.value.sessionId,
              name: result.value.name,
            });
            batchSuccessful++;
          } else {
            results.failed.push({
              error: result.value.error || "Unknown error",
              name: result.value.name || "unknown-session",
            });
            batchFailed++;
          }
        } else {
          results.failed.push({
            error: result.reason?.message || "Unknown error",
            name: "unknown-session",
          });
          batchFailed++;
        }
      });

      results.batchResults.push({
        batchNumber: batchIndex + 1,
        successful: batchSuccessful,
        failed: batchFailed,
      });

      console.error(
        `[TzafonWright] Batch ${batchIndex + 1} complete: ${batchSuccessful} successful, ${batchFailed} failed`,
      );

      if (batchIndex < totalBatches - 1) {
        console.error(
          `[TzafonWright] Waiting ${batchDelay}ms before next batch...`,
        );
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
      }
    }

    console.error(
      `[TzafonWright] Bulk creation complete: ${results.successful.length}/${count} sessions created successfully`,
    );
    return results;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on("open", () => {
          this.isConnected = true;
          console.error(`[TzafonWright] Connected to ${this.wsUrl}`);
          resolve();
        });

        this.ws.on("error", (error: Error) => {
          console.error(`[TzafonWright] WebSocket error:`, error);
          this.isConnected = false;
          reject(error);
        });

        this.ws.on("close", () => {
          console.error(`[TzafonWright] Connection closed`);
          this.isConnected = false;
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async sendAction(command: Command): Promise<Result> {
    if (!this.ws || !this.isConnected) {
      return {
        success: false,
        error_message: "Client not connected",
      };
    }

    return new Promise((resolve, reject) => {
      try {
        const commandData = {
          action_type: command.action_type,
          ...(command.x !== undefined && { x: command.x }),
          ...(command.y !== undefined && { y: command.y }),
          ...(command.text !== undefined && { text: command.text }),
          ...(command.delta_x !== undefined && { delta_x: command.delta_x }),
          ...(command.delta_y !== undefined && { delta_y: command.delta_y }),
          ...(command.url !== undefined && { url: command.url }),
          ...(command.width !== undefined && { width: command.width }),
          ...(command.height !== undefined && { height: command.height }),
          timeout: command.timeout || 30000,
        };

        const messageHandler = (data: WebSocket.Data) => {
          try {
            const response = JSON.parse(data.toString());

            const result: Result = {
              success: response.success || false,
              error_message: response.error_message,
            };

            // Handle base64 encoded image
            if (response.image) {
              result.image = Buffer.from(response.image, "base64");
            }

            this.ws!.off("message", messageHandler);
            resolve(result);
          } catch (error) {
            this.ws!.off("message", messageHandler);
            reject(new Error(`Failed to parse response: ${error}`));
          }
        };

        this.ws!.on("message", messageHandler);
        // TzafonWright server expects messages as UTF-8 encoded bytes, not strings
        const messageBytes = Buffer.from(JSON.stringify(commandData), "utf-8");
        this.ws!.send(messageBytes);
      } catch (error) {
        reject(error);
      }
    });
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.isConnected = false;
    }
  }

  async goto(url: string, options?: { timeout?: number }): Promise<Result> {
    return this.sendAction({
      action_type: ActionType.GOTO,
      url,
      timeout: options?.timeout,
    });
  }

  async click(options: { x: number; y: number }): Promise<Result> {
    return this.sendAction({
      action_type: ActionType.CLICK,
      x: options.x,
      y: options.y,
    });
  }

  async type(text: string): Promise<Result> {
    return this.sendAction({
      action_type: ActionType.TYPE,
      text,
    });
  }

  async screenshot(): Promise<Result> {
    return this.sendAction({
      action_type: ActionType.SCREENSHOT,
    });
  }

  async scroll(options: {
    delta_x?: number;
    delta_y?: number;
  }): Promise<Result> {
    return this.sendAction({
      action_type: ActionType.SCROLL,
      delta_x: options.delta_x,
      delta_y: options.delta_y,
    });
  }

  async setViewportSize(options: {
    width: number;
    height: number;
  }): Promise<Result> {
    return this.sendAction({
      action_type: ActionType.SET_VIEWPORT_SIZE,
      width: options.width,
      height: options.height,
    });
  }
}
