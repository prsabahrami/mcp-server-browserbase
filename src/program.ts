import { program } from "commander";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import createServerFunction from "./index.js";
import { ServerList } from "./server.js";
import { startHttpTransport, startStdioTransport } from "./transport.js";
import * as tzafonwrightStore from "./tzafonwrightStore.js";

import { resolveConfig } from "./config.js";

let __filename: string;
let __dirname: string;

try {
  // Try ES modules first
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch {
  // Fallback for CommonJS or when import.meta is not available
  __filename =
    (globalThis as { __filename: string }).__filename ||
    process.cwd() + "/dist/program.js";
  __dirname = path.dirname(__filename);
}

// Load package.json using fs
const packageJSONPath = path.resolve(__dirname, "../package.json");
const packageJSONBuffer = fs.readFileSync(packageJSONPath);
const packageJSON = JSON.parse(packageJSONBuffer.toString());

program
  .version("Version " + packageJSON.version)
  .name(packageJSON.name)
  .option(
    "--proxyUrl <url>",
    "The TzafonWright proxy WebSocket URL (e.g., ws://34.123.107.160:80)",
  )
  .option("--port <port>", "Port to listen on for SHTTP transport.")
  .option(
    "--host <host>",
    "Host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.",
  )
  .option("--browserWidth <width>", "Browser width to use for the browser.")
  .option("--browserHeight <height>", "Browser height to use for the browser.")
  .action(async (options) => {
    const config = await resolveConfig(options);
    const serverList = new ServerList(async () =>
      createServerFunction({
        config: config,
      }),
    );
    setupExitWatchdog(serverList);

    if (options.port)
      startHttpTransport(+options.port, options.host, serverList);
    else await startStdioTransport(serverList, config);
  });

function setupExitWatchdog(serverList: ServerList) {
  const handleExit = async () => {
    setTimeout(() => process.exit(0), 15000);
    try {
      await Promise.all([tzafonwrightStore.removeAll(), serverList.closeAll()]);
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
    process.exit(0);
  };

  process.stdin.on("close", handleExit);
  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);
}

program.parse(process.argv);
