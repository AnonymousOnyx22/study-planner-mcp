Where it goes: X, LinkedIn and student AI channels, posted once a week.

Title: My exam week plan, built with my free study planner

I built a free, open source MCP server that turns your exam dates and study hours into a day by day plan. No account, nothing stored, runs on your computer. This is real output from it.

My networking exam needs 20 hours by Dec 12, and scripting needs 16 hours by Dec 15. I study 3 hours a day with no study on Sundays, starting Nov 30.

```text
Exams
- Networking on 2026-12-12 sat, 20h planned
- Scripting on 2026-12-15 tue, 16h planned

Plan from 2026-11-30
- 2026-11-30 mon  Networking 2h, Scripting 1h  (3h total)
- 2026-12-01 tue  Networking 2h, Scripting 1h  (3h total)
- 2026-12-02 wed  Networking 2h, Scripting 1h  (3h total)
- 2026-12-03 thu  Networking 2h, Scripting 1h  (3h total)
- 2026-12-04 fri  Networking 1.5h, Scripting 1.5h  (3h total)
- 2026-12-05 sat  Networking 2h, Scripting 1h  (3h total)
- 2026-12-07 mon  Networking 2h, Scripting 1h  (3h total)
- 2026-12-08 tue  Networking 1.5h, Scripting 1.5h  (3h total)
- 2026-12-09 wed  Networking 2h, Scripting 1h  (3h total)
- 2026-12-10 thu  Networking 1.5h, Scripting 1.5h  (3h total)
- 2026-12-11 fri  Networking 1.5h, Scripting 1.5h  (3h total)
- 2026-12-12 sat  Scripting 3h  (3h total)

Everything fits.
```

Sundays are skipped and networking stops on Dec 11 because studying stops the day before each exam, so Dec 12 is scripting only. The hours are shared by how much work each exam has left and how many days remain, so closer and bigger exams get more time.

There are also tools for spaced repetition review dates, pomodoro blocks with breaks, assignment milestones, what to study today and an .ics calendar file you can import into Google Calendar or Apple Calendar.

Install with one line:

```bash
npx -y study-planner-mcp
```

The README has the config for Claude Desktop, Claude Code, Cursor and VS Code Copilot. It is free, open source, runs on your computer, needs no account and stores nothing. If a plan comes out wrong for your dates, tell me and I will look at it.
