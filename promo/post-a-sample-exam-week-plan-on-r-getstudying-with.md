Where it goes: r/GetStudying, as a text post.

Title: The exam week plan I got from my free study planner

I built a free, open source MCP server that turns your exam dates and study hours into a day by day plan. This is real output from it.

My networking exam is on Dec 12 and needs 20 hours. I study 2 hours on weekdays and 6 hours on Saturday and Sunday, starting Nov 30.

```text
Exams
- Networking on 2026-12-12 sat, 20h planned

Plan from 2026-11-30
- 2026-11-30 mon  Networking 2h  (2h total)
- 2026-12-01 tue  Networking 2h  (2h total)
- 2026-12-02 wed  Networking 2h  (2h total)
- 2026-12-03 thu  Networking 2h  (2h total)
- 2026-12-04 fri  Networking 2h  (2h total)
- 2026-12-05 sat  Networking 6h  (6h total)
- 2026-12-06 sun  Networking 4h  (4h total)

Everything fits.
```

Saturday takes the 6 hours and Sunday gets the 4 hours that are left. The hours are shared by how much work each exam has left and how many days remain, so closer and bigger exams get more time. Study stops the day before an exam. If the hours do not fit, it tells you how many you are short instead of pretending.

The tool is build_study_plan. There are also tools for spaced repetition review dates, pomodoro blocks with breaks, assignment milestones and an .ics calendar file.

To install, add this to your config file:

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "study-planner": {
      "command": "npx",
      "args": ["-y", "study-planner-mcp"]
    }
  }
}
```

Or run this in Claude Code:

```bash
claude mcp add study-planner -- npx -y study-planner-mcp
```

It runs on your computer, needs no account and stores nothing. The README has the config for Cursor and VS Code as well.

If a plan comes out wrong for your dates, tell me and I will look at it.
