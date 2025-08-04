/**
 * Prompts module for the TzafonWright MCP server
 * Contains prompts definitions and handlers for prompt-related requests
 * Docs: https://modelcontextprotocol.io/docs/concepts/prompts
 */

// Define the prompts
export const PROMPTS = [
  {
    name: "tzafonwright_system",
    description:
      "System prompt defining the scope and capabilities of TzafonWright MCP server",
    arguments: [],
  },
  {
    name: "multi_session_guidance",
    description:
      "Guidance on when and how to use multi-session browser automation with TzafonWright",
    arguments: [],
  },
  {
    name: "ai_powered_automation",
    description:
      "Guidelines on using AI-powered browser automation with TzafonWright's coordinate-based actions",
    arguments: [],
  },
];

/**
 * Get a prompt by name
 * @param name The name of the prompt to retrieve
 * @returns The prompt definition or throws an error if not found
 */
export function getPrompt(name: string) {
  if (name === "tzafonwright_system") {
    return {
      description: "System prompt for TzafonWright MCP server capabilities",
      messages: [
        {
          role: "system",
          content: {
            type: "text",
            text: `You have access to a powerful browser automation server via TzafonWright MCP. This server provides:

CAPABILITIES:
- Enterprise browser automation using TzafonWright infrastructure
- AI-powered web interactions with GPT-4 Vision integration
- Parallel browser sessions for concurrent tasks (with intelligent batching)
- Coordinate-based precision actions for reliable automation
- Screenshot capture and visual analysis with AI guidance
- Enhanced extraction tools with visual assistance
- Bulk session management with resource optimization

TOOL SELECTION GUIDE:
For SINGLE browser tasks: Use "tzafonwright_session_create" then regular tools
For MULTIPLE browser tasks: Use "multi_tzafonwright_session_create" then session-specific tools
For BULK operations: Use "multi_tzafonwright_sessions_create_bulk" for efficient parallel creation

MULTI-SESSION INDICATORS - Use multi-session tools when you see:
- "parallel", "multiple", "simultaneously", "concurrent"
- "different accounts", "A/B test", "compare"
- "multiple sites", "batch processing", "scraping multiple pages"
- Any task requiring more than one browser instance

MULTI-SESSION WORKFLOW:
1. Create sessions: "multi_tzafonwright_session_create" (give descriptive names)
2. Bulk create: "multi_tzafonwright_sessions_create_bulk" (for 5+ sessions)
3. Track sessions: "multi_tzafonwright_session_list"
4. Use session tools: "multi_tzafonwright_navigate_session", "multi_tzafonwright_act_session", etc.
5. Cleanup: "multi_tzafonwright_session_close" or "multi_tzafonwright_sessions_close_bulk"

AI-POWERED ACTIONS:
- Use natural language: "Click the search box", "Click the login button"
- AI Vision automatically finds coordinates for you
- Fallback guidance provided when elements can't be found
- Requires OPENAI_API_KEY environment variable

BEST PRACTICES:
- Use descriptive session names for easier tracking
- For bulk operations, use smaller batch sizes (2-5) for reliability
- Always close sessions when done to free resources
- Take screenshots for visual confirmation or debugging
- Each session maintains independent state and authentication
- AI actions work best with clear, specific instructions

When using this server, think of it as controlling real browsers with AI assistance. You can navigate, click, type, and extract data using natural language, while the system handles coordinate precision and visual analysis automatically.`,
          },
        },
      ],
    };
  }

  if (name === "multi_session_guidance") {
    return {
      description:
        "Comprehensive guidance on multi-session browser automation with TzafonWright",
      messages: [
        {
          role: "system",
          content: {
            type: "text",
            text: `Multi-Session TzafonWright Browser Automation Guidance

WHEN TO USE MULTI-SESSION TOOLS:
- Parallel data collection from multiple websites
- A/B testing with different user flows
- Authentication with multiple user accounts simultaneously  
- Cross-site operations requiring coordination
- Bulk web scraping across multiple domains
- Concurrent testing scenarios
- Any task requiring more than one browser instance

TOOL NAMING PATTERNS:
- Session Management: "multi_tzafonwright_session_*"
- Bulk Operations: "multi_tzafonwright_sessions_*_bulk"
- Browser Actions: "multi_tzafonwright_*_session" 

RECOMMENDED WORKFLOWS:

INDIVIDUAL SESSIONS:
1. Create sessions: "multi_tzafonwright_session_create" (give each a descriptive name)
2. List sessions: "multi_tzafonwright_session_list" (to track active sessions)
3. Use session-specific tools: "multi_tzafonwright_navigate_session", "multi_tzafonwright_act_session", etc.
4. Clean up: "multi_tzafonwright_session_close" when done

BULK SESSIONS (5+ sessions):
1. Bulk create: "multi_tzafonwright_sessions_create_bulk" (specify count, batch size, delays)
2. List sessions: "multi_tzafonwright_session_list" (track all sessions)
3. Use session-specific tools with the returned session IDs
4. Bulk cleanup: "multi_tzafonwright_sessions_close_bulk" (close by prefix or all)

IMPORTANT RULES:
- Always use session-specific tools (with "_session" suffix) when working with multiple sessions
- Each session maintains independent browser state and authentication
- For bulk operations, use smaller batch sizes (2-5) to prevent resource exhaustion
- Always close sessions when finished to free resources
- Use descriptive session names for easier tracking
- Monitor system resources when running many concurrent sessions

BULK SESSION BEST PRACTICES:
- Start with small counts (5-10) to test your setup
- Use batch sizes of 2-3 for unstable connections, 5-8 for stable setups
- Increase batch delays (3000-5000ms) if you experience failures
- Clean up failed sessions manually if needed

SINGLE VS MULTI-SESSION:
- Single: "tzafonwright_session_create" → "tzafonwright_navigate" 
- Multi: "multi_tzafonwright_session_create" → "multi_tzafonwright_navigate_session"
- Bulk: "multi_tzafonwright_sessions_create_bulk" → "multi_tzafonwright_navigate_session"`,
          },
        },
      ],
    };
  }

  if (name === "ai_powered_automation") {
    return {
      description:
        "Guidelines on using AI-powered browser automation with TzafonWright's coordinate-based actions",
      messages: [
        {
          role: "system",
          content: {
            type: "text",
            text: `AI-Powered TzafonWright Automation Guidelines

OVERVIEW:
TzafonWright combines coordinate-based browser automation with GPT-4 Vision AI to provide natural language interaction capabilities while maintaining precision and reliability.

AI-POWERED ACT TOOL:
- Use natural language: tzafonwright_act("Click the search box")
- AI Vision automatically analyzes screenshots to find elements
- Provides coordinates and executes clicks automatically
- Fallback guidance when elements cannot be found

NATURAL LANGUAGE EXAMPLES:
✅ Good commands:
- "Click the search box"
- "Click the login button" 
- "Click on Apple" (finds Apple links/text)
- "Click the submit button"
- "Type 'hello world'"
- "Scroll down"

❌ Avoid vague commands:
- "Click the thing"
- "Do something"
- "Find stuff"

COORDINATE FALLBACK:
When AI can't find elements, you can still use precise coordinates:
- "Click at coordinates 100,200"
- "Scroll 0,300" (x,y delta)

ENHANCED EXTRACTION:
- tzafonwright_extract automatically takes screenshots
- Provides visual guidance for coordinate-based extraction
- Shows exactly what elements are available on the page
- Gives step-by-step instructions for complex extractions

WORKFLOW BEST PRACTICES:
1. Start with natural language commands
2. Let AI Vision find and click elements automatically
3. Use screenshots for verification and debugging
4. Fall back to coordinates for precision when needed
5. Use extraction tool for guidance on complex data gathering

AI REQUIREMENTS:
- Set OPENAI_API_KEY environment variable for AI features
- AI Vision uses GPT-4 with high-detail image analysis
- Fallback guidance provided when API is unavailable

MULTI-SESSION AI AUTOMATION:
- All AI features work with session-specific tools
- Use "multi_tzafonwright_act_session" for AI actions in specific sessions
- Each session maintains independent AI analysis context
- Bulk operations can use AI for each individual session

DEBUGGING AI ACTIONS:
- AI provides confidence scores and reasoning
- Screenshots included with failed attempts
- Element suggestions provided for alternative approaches
- Clear error messages for troubleshooting

PERFORMANCE TIPS:
- AI actions take 2-5 seconds due to screenshot analysis
- Use coordinate mode for repetitive actions after initial AI discovery
- AI Vision is most effective with clear, well-structured web pages
- Modern web applications work better than legacy interfaces`,
          },
        },
      ],
    };
  }

  throw new Error(`Invalid prompt name: ${name}`);
}
