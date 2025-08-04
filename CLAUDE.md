# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development

- `pnpm build` - Compile TypeScript and make CLI executable
- `pnpm watch` - Watch mode for TypeScript compilation
- `pnpm clean` - Remove dist directory
- `pnpm prepare` - Setup husky hooks and build project

### Quality and Linting

- `pnpm lint` - Run ESLint on TypeScript files
- `pnpm prettier:check` - Check code formatting
- `pnpm prettier:fix` - Fix code formatting issues

### Testing and Development

- `pnpm smithery` - Run development server with Smithery CLI
- `pnpm inspector` - Run MCP inspector for debugging
- `npx @browserbasehq/mcp-server-browserbase` - Run the published package locally

## Architecture Overview

This is an MCP (Model Context Protocol) server that provides browser automation capabilities using Browserbase and Stagehand. The architecture follows a layered approach:

### Core Components

1. **MCP Server Entry Point** (`src/index.ts`)
   - Exports default function for Smithery integration
   - Configures MCP server with tools, resources, and prompts
   - Handles configuration validation with Zod schemas

2. **Context Management** (`src/context.ts`)
   - Central orchestrator that manages tool execution
   - Provides access to Stagehand instances and browser sessions
   - Handles resource management (screenshots, etc.)

3. **Session Management** (`src/sessionManager.ts`)
   - Manages multiple browser sessions with unique IDs
   - Handles session lifecycle (create, retrieve, cleanup)
   - Maintains a default session and tracks active sessions
   - Integrates with Browserbase cloud browser infrastructure

4. **Tool System** (`src/tools/`)
   - Modular tool architecture with base `Tool` class
   - Each tool handles specific browser automation tasks:
     - `navigate.ts` - URL navigation
     - `act.ts` - Element interactions (click, type, etc.)
     - `extract.ts` - Data extraction from pages
     - `observe.ts` - Page observation and analysis
     - `screenshot.ts` - Screenshot capture
     - `session.ts` - Session management tools
     - `multiSession.ts` - Multi-session operations

### Key Technologies

- **Browserbase SDK** (`@browserbasehq/sdk`) - Cloud browser automation
- **Stagehand** (`@browserbasehq/stagehand`) - AI-powered browser automation
- **MCP SDK** (`@modelcontextprotocol/sdk`) - Model Context Protocol implementation
- **Playwright** - Browser automation engine (used by Stagehand)
- **Zod** - Runtime type validation and schema definition

### Configuration System

The server supports extensive configuration through CLI flags and environment variables:

- Browserbase API key and project ID (required)
- Model selection (defaults to Gemini 2.0 Flash)
- Browser viewport sizing
- Proxy and stealth mode settings
- Context persistence options
- Cookie injection

### Transport Options

- **STDIO** - Direct command-line execution
- **SHTTP** - HTTP-based transport for remote hosting via Smithery

## Development Notes

- Uses ES modules with Node16 module resolution
- TypeScript compilation targets ES2022
- Husky pre-commit hooks ensure code quality
- Supports both local development and cloud deployment via Smithery
- Session management is stateful - sessions persist until explicitly closed
- Default session is automatically created and managed
- Multi-session support allows parallel browser automation workflows
