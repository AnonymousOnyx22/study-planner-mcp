import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./core/tools.js";
import { tools } from "./tools.js";

export const VERSION = "0.1.0";

export function createServer(): McpServer {
  const server = new McpServer({ name: "study-planner-mcp", version: VERSION });
  // Validate inputs inside runTool so errors come back as tool results with a valid call example.
  (server as any).validateToolInput = async (_tool: unknown, args: unknown) => args ?? {};
  registerTools(server, tools, null);
  return server;
}
