import type { Config } from "../config.d.ts";

export type ToolCapability = "core" | string;

// Define Command Line Options Structure
export type CLIOptions = {
  proxyUrl?: string;
  port?: number;
  host?: string;
  browserWidth?: number;
  browserHeight?: number;
};

// Default Configuration Values
const defaultConfig: Config = {
  proxyUrl: process.env.TZAFONWRIGHT_PROXY_URL ?? "ws://34.123.107.160:80",
  server: {
    port: undefined,
    host: undefined,
  },
  viewPort: {
    browserWidth: 1024,
    browserHeight: 768,
  },
};

// Resolve final configuration by merging defaults, file config, and CLI options
export async function resolveConfig(cliOptions: CLIOptions): Promise<Config> {
  const cliConfig = await configFromCLIOptions(cliOptions);
  // Order: Defaults < File Config < CLI Overrides
  const mergedConfig = mergeConfig(defaultConfig, cliConfig);

  // Basic validation for proxy URL
  if (!mergedConfig.proxyUrl) {
    console.warn(
      "Warning: TZAFONWRIGHT_PROXY_URL environment variable not set. Using default proxy URL: ws://34.123.107.160:80",
    );
    mergedConfig.proxyUrl = "ws://34.123.107.160:80";
  }

  return mergedConfig;
}

// Create Config structure based on CLI options
export async function configFromCLIOptions(
  cliOptions: CLIOptions,
): Promise<Config> {
  return {
    proxyUrl: cliOptions.proxyUrl || process.env.TZAFONWRIGHT_PROXY_URL || "",
    server: {
      port: cliOptions.port,
      host: cliOptions.host,
    },
    viewPort: {
      browserWidth: cliOptions.browserWidth,
      browserHeight: cliOptions.browserHeight,
    },
  };
}

// Helper function to merge config objects, excluding undefined values
function pickDefined<T extends object>(obj: T | undefined): Partial<T> {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

// Merge two configuration objects (overrides takes precedence)
function mergeConfig(base: Config, overrides: Config): Config {
  const baseFiltered = pickDefined(base);
  const overridesFiltered = pickDefined(overrides);

  // Create the result object
  const result = { ...baseFiltered } as Config;

  // For each property in overrides
  for (const [key, value] of Object.entries(overridesFiltered)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key as keyof Config] &&
      typeof result[key as keyof Config] === "object"
    ) {
      // Deep merge for nested objects
      (result as Record<string, unknown>)[key] = {
        ...(result[key as keyof Config] as object),
        ...value,
      };
    } else {
      // Simple override for primitives, arrays, etc.
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}
