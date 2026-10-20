#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, VERSION } from "./server.js";

function usage(): void {
  console.log(`study-planner-mcp ${VERSION}

Study planner MCP: study plans, spaced repetition, pomodoro and assignment milestones for AI apps. Works offline.

Add it to your AI app's MCP config with command "npx" and args ["-y", "study-planner-mcp"].

  --help, --version`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "--help" || cmd === "-h") return usage();
  if (cmd === "--version" || cmd === "-v") return console.log(VERSION);
  await createServer().connect(new StdioServerTransport());
  console.error(`study-planner-mcp ${VERSION} running`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
