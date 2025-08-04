import OpenAI from "openai";

export interface ElementLocation {
  x: number;
  y: number;
  confidence: number;
  description: string;
}

export interface AIVisionResult {
  success: boolean;
  coordinates?: ElementLocation;
  error?: string;
  reasoning?: string;
}

export class AIVisionService {
  private openai: OpenAI | null = null;

  constructor() {
    // Initialize OpenAI client if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private isConfigured(): boolean {
    return this.openai !== null;
  }

  async findElementCoordinates(
    screenshotBase64: string,
    naturalLanguageQuery: string,
    viewportWidth: number = 1280,
    viewportHeight: number = 720,
  ): Promise<AIVisionResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error:
          "AI Vision not configured. Please set OPENAI_API_KEY environment variable.",
      };
    }

    try {
      const prompt = `You are an expert web automation assistant that analyzes screenshots to find UI elements and provide precise click coordinates.

TASK: Find the element described by this user query: "${naturalLanguageQuery}"

VIEWPORT INFO:
- Width: ${viewportWidth}px
- Height: ${viewportHeight}px

INSTRUCTIONS:
1. Carefully analyze the screenshot to locate the element matching the user's description
2. Identify the center point of the target element for clicking
3. Provide coordinates as pixel values from the top-left corner (0,0)
4. Consider clickable areas, not just visual boundaries
5. For text inputs, target the center of the input field
6. For buttons, target the center of the button
7. For links, target the center of the clickable text

RESPONSE FORMAT (JSON only):
{
  "found": true/false,
  "x": number (pixel coordinate from left),
  "y": number (pixel coordinate from top),
  "confidence": number (0.0 to 1.0),
  "reasoning": "Brief explanation of what you found and why you chose these coordinates",
  "element_description": "What type of element this is (button, input, link, etc.)"
}

If you cannot find the element, respond with:
{
  "found": false,
  "confidence": 0.0,
  "reasoning": "Explanation of why the element wasn't found",
  "suggestions": ["Alternative descriptions the user could try"]
}

EXAMPLES:
- "Click the search box" → Find the main search input field
- "Click the login button" → Find the login/sign in button
- "Click the menu" → Find the hamburger menu or navigation menu
- "Click on Apple" → Find text or link containing "Apple"

Respond with ONLY the JSON object, no other text.`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${screenshotBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          success: false,
          error: "No response from AI vision service",
        };
      }

      try {
        // Try to parse the JSON response
        let result;
        try {
          result = JSON.parse(content);
        } catch {
          // If JSON parsing fails, try to extract values from partial JSON
          console.error(
            "JSON parsing failed, attempting to extract values:",
            content,
          );

          // Extract values using regex as fallback
          const foundMatch = content.match(/"found":\s*(true|false)/);
          const xMatch = content.match(/"x":\s*(\d+)/);
          const yMatch = content.match(/"y":\s*(\d+)/);
          const confMatch = content.match(/"confidence":\s*([0-9.]+)/);
          const reasoningMatch = content.match(/"reasoning":\s*"([^"]+)"/);

          if (foundMatch && foundMatch[1] === "true" && xMatch && yMatch) {
            // We have enough info to proceed
            result = {
              found: true,
              x: parseInt(xMatch[1]),
              y: parseInt(yMatch[1]),
              confidence: confMatch ? parseFloat(confMatch[1]) : 0.8,
              reasoning: reasoningMatch
                ? reasoningMatch[1]
                : "AI found element but response was truncated",
              element_description: "Element (from partial response)",
            };
          } else {
            throw new Error(
              "Could not extract coordinates from partial response",
            );
          }
        }

        if (result.found) {
          return {
            success: true,
            coordinates: {
              x: Math.round(result.x),
              y: Math.round(result.y),
              confidence: result.confidence || 0.8,
              description: result.element_description || "Element",
            },
            reasoning: result.reasoning,
          };
        } else {
          return {
            success: false,
            error: result.reasoning,
            reasoning: result.suggestions
              ? `Suggestions: ${result.suggestions.join(", ")}`
              : undefined,
          };
        }
      } catch {
        console.error("Failed to parse AI vision response:", content);
        return {
          success: false,
          error: "Failed to parse AI vision response",
          reasoning: content.substring(0, 300),
        };
      }
    } catch (error) {
      console.error("AI Vision API error:", error);
      return {
        success: false,
        error: `AI Vision API error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async getElementSuggestions(screenshotBase64: string): Promise<string[]> {
    if (!this.isConfigured()) {
      return ["AI Vision not configured"];
    }

    try {
      const prompt = `Analyze this screenshot and list the main interactive elements that a user might want to click on. 

Provide a JSON array of descriptive strings that could be used in natural language commands.

Examples:
- "search box" or "search input"
- "login button" or "sign in"  
- "menu button" or "hamburger menu"
- "submit button"
- "close button"
- specific text like "Apple" if it's a clickable link

Response format: ["element1", "element2", "element3"]

Focus on the most obvious and commonly targeted elements. Limit to 8 suggestions max.`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${screenshotBase64}`,
                  detail: "low",
                },
              },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          return JSON.parse(content);
        } catch {
          // Fallback parsing for non-JSON responses
          const matches = content.match(/"([^"]+)"/g);
          return matches ? matches.map((m) => m.slice(1, -1)) : [];
        }
      }
    } catch (error) {
      console.error("Failed to get element suggestions:", error);
    }

    return [];
  }
}

// Singleton instance
export const aiVisionService = new AIVisionService();
