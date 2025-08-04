export type Config = {
  /**
   * TzafonWright proxy WebSocket URL
   * @example "ws://34.123.107.160:80"
   */
  proxyUrl: string;
  /**
   * The viewport of the browser
   * @default { browserWidth: 1024, browserHeight: 768 }
   */
  viewPort?: {
    /**
     * The width of the browser
     */
    browserWidth?: number;
    /**
     * The height of the browser
     */
    browserHeight?: number;
  };
  /**
   * Server configuration for MCP transport layer
   *
   * Controls how the MCP server binds and listens for connections.
   * When port is specified, the server will start an SHTTP transport.
   * When both port and host are undefined, the server uses stdio transport.
   *
   * Security considerations:
   * - Use localhost (default) for local development
   * - Use 0.0.0.0 only when you need external access and have proper security measures
   * - Consider firewall rules and network security when exposing the server
   */
  server?: {
    /**
     * The port to listen on for SHTTP or MCP transport.
     * If undefined, uses stdio transport instead of HTTP.
     *
     * @example 3000
     */
    port?: number;
    /**
     * The host to bind the server to.
     *
     * @default "localhost" - Only accepts local connections
     * @example "0.0.0.0" - Accepts connections from any interface (use with caution)
     */
    host?: string;
  };
};
