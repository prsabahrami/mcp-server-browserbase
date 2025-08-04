/**
 * Sampling module for the TzafonWright MCP server
 * Implements sampling capability to request LLM completions from clients
 * Docs: https://modelcontextprotocol.io/docs/concepts/sampling
 */

/**
 * Sampling capability configuration
 * This indicates that the server can request LLM completions
 */
export const SAMPLING_CAPABILITY = {};

/**
 * Note: Sampling in MCP is initiated BY the server TO the client.
 * The server sends sampling/createMessage requests to ask the client
 * for LLM completions. This is useful for intelligent browser automation
 * where the server needs AI assistance to analyze pages and make decisions.
 *
 * TzafonWright has built-in GPT-4 Vision integration for AI-powered actions,
 * but sampling can provide additional client-side AI assistance for complex
 * decision making and page analysis scenarios.
 *
 * Currently, sampling support depends on the MCP client implementation.
 * Not all clients support sampling yet. (ie claude desktop)
 */

/**
 * Type definitions for sampling messages
 */
export type SamplingMessage = {
  role: "user" | "assistant";
  content: {
    type: "text" | "image";
    text?: string;
    data?: string; // base64 for images
    mimeType?: string;
  };
};

/**
 * Pre-built sampling templates for TzafonWright browser automation scenarios
 */
export const SAMPLING_TEMPLATES = {
  /**
   * Analyze a page to determine what actions are available for TzafonWright
   */
  analyzePageActions: (
    pageContent: string,
    screenshot?: string,
  ): SamplingMessage[] => [
    {
      role: "user",
      content: {
        type: "text",
        text: `Analyze this webpage for TzafonWright coordinate-based automation and identify the main interactive elements.
        
Page content:
${pageContent}

Please provide:
1. Main interactive elements with approximate coordinate ranges
2. Forms and input fields locations
3. Buttons and clickable elements positions
4. Key information displayed and extraction opportunities
5. Suggested TzafonWright actions with natural language commands
6. Potential challenges for coordinate-based automation

Format suggestions as TzafonWright commands:
- "Click the search box" (for AI-powered actions)
- "Click at coordinates X,Y" (for precise actions)
- "Type 'text'" for text input
- "Scroll down/up" for navigation`,
      },
    },
    ...(screenshot
      ? [
          {
            role: "user" as const,
            content: {
              type: "image" as const,
              data: screenshot,
              mimeType: "image/png",
            },
          },
        ]
      : []),
  ],

  /**
   * Determine next steps in a multi-step TzafonWright automation process
   */
  determineNextStep: (
    currentState: string,
    goal: string,
  ): SamplingMessage[] => [
    {
      role: "user",
      content: {
        type: "text",
        text: `Current state of the TzafonWright browser automation:
${currentState}

Goal: ${goal}

What should be the next TzafonWright action? Consider:
1. Are we on the right page for coordinate-based interaction?
2. What elements need to be clicked or interacted with?
3. Should we take a screenshot first for AI analysis?
4. Is there any data to extract using visual guidance?
5. Are there any errors or blockers visible?
6. Do we need to use multi-session tools for parallel processing?

Provide a specific TzafonWright command:
- Natural language: "Click the login button"
- Coordinate-based: "Click at coordinates 100,200"
- Screenshot: "Take a screenshot to analyze the page"
- Extract: "Extract product information from this page"
- Multi-session: Consider if parallel sessions would be beneficial`,
      },
    },
  ],

  /**
   * Extract structured data from a page using TzafonWright approach
   */
  extractStructuredData: (
    pageContent: string,
    dataSchema: string,
  ): SamplingMessage[] => [
    {
      role: "user",
      content: {
        type: "text",
        text: `Extract structured data from this webpage for TzafonWright coordinate-based automation.

Page content:
${pageContent}

Expected data schema:
${dataSchema}

Provide both:
1. The extracted data as valid JSON matching the schema (use null for missing fields)
2. TzafonWright extraction strategy with specific actions:
   - Coordinate ranges for clicking elements to reveal data
   - Screenshot recommendations for visual analysis
   - Scroll actions needed to access hidden content
   - Multiple extraction steps if data is spread across interactions

Consider TzafonWright's coordinate-based approach where data might need to be revealed through clicks, scrolls, or form interactions before it can be extracted.`,
      },
    },
  ],

  /**
   * Handle error or unexpected state
   */
  handleError: (error: string, pageState: string): SamplingMessage[] => [
    {
      role: "user",
      content: {
        type: "text",
        text: `The browser automation encountered an error:

Error: ${error}

Current page state:
${pageState}

Suggest how to recover from this error:
1. What might have caused this?
2. What alternative actions could be taken?
3. Should we retry, navigate elsewhere, or try a different approach?`,
      },
    },
  ],

  /**
   * Interpret complex UI patterns
   */
  interpretUI: (screenshot: string, instruction: string): SamplingMessage[] => [
    {
      role: "user",
      content: {
        type: "text",
        text: `Analyze this screenshot and help with: ${instruction}`,
      },
    },
    {
      role: "user",
      content: {
        type: "image",
        data: screenshot,
        mimeType: "image/png",
      },
    },
  ],
};

/**
 * Helper function to create a sampling request structure
 * This shows what a sampling request would look like when sent to the client
 */
export function createSamplingRequest(
  messages: SamplingMessage[],
  options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    includeContext?: "none" | "thisServer" | "allServers";
  },
) {
  return {
    method: "sampling/createMessage",
    params: {
      messages,
      systemPrompt:
        options?.systemPrompt ||
        "You are an expert browser automation assistant helping to analyze web pages and determine optimal automation strategies.",
      temperature: options?.temperature || 0.7,
      maxTokens: options?.maxTokens || 1000,
      includeContext: options?.includeContext || "thisServer",
      modelPreferences: {
        hints: [{ name: "claude-3" }, { name: "gpt-4" }],
        intelligencePriority: 0.8,
        speedPriority: 0.2,
      },
    },
  };
}
