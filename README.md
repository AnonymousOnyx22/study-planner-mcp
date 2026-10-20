# Study Planner MCP

Offline exam planning for your AI: no account, no login, no internet needed, nothing stored. Free forever, open source.

Give it your exam dates and how many hours you can study, and get back a day by day plan with spaced repetition review dates, pomodoro blocks with breaks, and dated milestones for a big assignment. The date math is done by tested code, not guessed by the model.

Ask it things like:

- "I have a networking exam on Dec 12 and scripting on Dec 15. I can study 3 hours a day except Sundays. Make me a plan."
- "When should I review what I learned today so I remember it for my exam on Nov 30?"
- "Plan 3 hours of studying as pomodoro blocks with breaks."
- "Break my 6 hour essay due Friday into milestones."

This is a free, open source [MCP](https://modelcontextprotocol.io) server. It works with Claude, ChatGPT, Cursor, VS Code Copilot and any other app that supports MCP. It runs on your computer, so your study data never leaves it.

[![npm](https://img.shields.io/npm/v/study-planner-mcp.svg)](https://www.npmjs.com/package/study-planner-mcp)
[![downloads](https://img.shields.io/npm/dm/study-planner-mcp.svg)](https://www.npmjs.com/package/study-planner-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Quick start

Add this to your AI app's MCP config. For Claude Desktop that is `claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "study-planner": {
      "command": "npx",
      "args": ["-y", "study-planner-mcp"]
    }
  }
}
```

Restart your AI app, then try one of the questions at the top of this page. You need Node.js 20 or newer.

For Claude Code, run `claude mcp add study-planner -- npx -y study-planner-mcp`.

## Tools

| Tool | What it does |
| --- | --- |
| `make_study_plan` | A day by day study plan for one or more exams, sharing your daily hours by urgency, with a warning if there is not enough time |
| `spaced_repetition_dates` | Review dates for a topic using expanding intervals, kept before your exam date |
| `pomodoro_plan` | A work and break schedule for a total amount of study time |
| `assignment_milestones` | Dated milestones that split a big assignment into research, outline, draft, revise and proofread |

## How the study plan works

Each day your hours are shared across the exams that still need work, weighted by how many hours are left divided by how many days remain, so closer and bigger exams get more time. Study stops the day before each exam. If the hours do not fit, the plan says how many are short instead of pretending. Dates are plain calendar dates, so time zones never shift a day.


## Development

```bash
npm install
npm run build
npm test
```

Pass `start_date` in tools to get repeatable results. The tests call every tool through a real MCP client, so they need no account or network.

## More free student MCP servers

All free, open source and read only where they touch your accounts. Browse the full list at [brightspacemcp.com/more-mcps](https://brightspacemcp.com/more-mcps/).

| Server | What it does |
| --- | --- |
| [Brightspace MCP](https://github.com/AnonymousOnyx22/brightspace-d2l-mcp) | D2L Brightspace for AI. Due dates with real submission status, grades, a target grade calculator and course files. |
| [Canvas MCP](https://github.com/AnonymousOnyx22/canvas-lms-student-mcp) | Read-only Canvas LMS for AI. Due dates, missing work, grades and announcements. |
| [Moodle MCP](https://github.com/AnonymousOnyx22/moodle-student-mcp) | Read-only Moodle for AI. Due dates, overdue work, grades and announcements. |
| [Google Classroom MCP](https://github.com/AnonymousOnyx22/google-classroom-student-mcp) | Read-only Google Classroom for AI. To-do, due dates, missing work and grades. |
| [GPA Calculator MCP](https://github.com/AnonymousOnyx22/gpa-calculator-mcp) | GPA, grade conversion and what-do-I-need-on-the-final math for AI. Works offline, no account. |
| [Citations MCP](https://github.com/AnonymousOnyx22/student-citations-mcp) | APA, MLA and Chicago citations from a DOI, an ISBN or typed details. No account. |
| [Paper Finder MCP](https://github.com/AnonymousOnyx22/paper-finder-student-mcp) | Search scholarly papers, find open access copies and related work through OpenAlex. No key needed. |

## License

MIT
