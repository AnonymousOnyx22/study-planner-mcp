# Study Planner MCP

Offline exam planning for your AI: no account, no login, no internet needed, nothing stored. Free forever, open source.

Give it your exam dates and how many hours you can study, and get back a day by day plan with spaced repetition review dates, pomodoro blocks with breaks, and dated milestones for a big assignment. The date math is done by tested code, not guessed by the model.

Ask it things like:

- "I have a networking exam on Dec 12 and scripting on Dec 15. I can study 3 hours a day except Sundays. Make me a plan."
- "When should I review what I learned today so I remember it for my exam on Nov 30?"
- "Plan 3 hours of studying as pomodoro blocks with breaks."
- "Break my 6 hour essay due Friday into milestones."
- "Give me this plan as an .ics file so I can import it into Google Calendar."

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
| `build_study_plan` | A day by day study plan for one or more exams, sharing your daily hours by urgency, with a warning if there is not enough time |
| `make_spaced_repetition_schedule` | Spaced repetition review dates for a topic at expanding intervals, with dates on or after the exam marked to skip |
| `plan_pomodoro_sessions` | A work and break schedule for a total amount of study time |
| `list_assignment_milestones` | Dated milestones that split a big assignment into research, outline, draft, revise and proofread |
| `next_review_dates` | The next review dates for a topic, computed from the day you first studied it |
| `export_study_plan_ics` | The same plan as an `.ics` calendar file, with one all day event per study session and one per exam, ready to open or import into Google Calendar or Apple Calendar |

The original names `make_study_plan`, `spaced_repetition_dates`, `pomodoro_plan` and `assignment_milestones` do the same four jobs with the same parameters, so existing configs and saved prompts keep working.

## How the study plan works

Each day your hours are shared across the exams that still need work, weighted by how many hours are left divided by how many days remain, so closer and bigger exams get more time. Study stops the day before each exam. If the hours do not fit, the plan says how many are short instead of pretending. Dates are plain calendar dates, so time zones never shift a day.

## Example plan

This is a real answer from `build_study_plan`, copied from a run of the code in this folder. Networking needs 20 hours by Dec 12 and Scripting needs 16 hours by Dec 15, with 3 hours a day and no study on Sundays. Passing `start_date` is what makes the dates repeatable.

Tool call:

```json
{
  "exams": [
    { "name": "Networking", "date": "2026-12-12", "hours_needed": 20 },
    { "name": "Scripting", "date": "2026-12-15", "hours_needed": 16 }
  ],
  "hours_per_day": 3,
  "days_off": ["sun"],
  "start_date": "2026-11-30"
}
```

The answer:

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

Sundays are skipped, and Networking stops on Dec 11 because studying stops the day before each exam, so Dec 12 is Scripting only.

## Calendar file

`export_study_plan_ics` takes the same arguments as `build_study_plan` and answers with a complete `.ics` file instead of plain text. Save the answer as `plan.ics` and open it, or import it in Google Calendar or Apple Calendar. Every study session becomes an all day event marked free, every exam becomes an all day event marked busy, and `include_exams: false` gives you the study sessions only. Each event carries a UID built from its date and exam name, and the dates are written as plain calendar dates, so no time zone moves an event to another day.

Tool call:

```json
{
  "exams": [{ "name": "Networking", "date": "2026-12-12", "hours_needed": 6 }],
  "start_date": "2026-12-07",
  "hours_per_day": 2,
  "days_off": ["sun"]
}
```

These are the first lines of the file, copied from a run. Two more study events and one exam event follow in the same shape, and `DTSTAMP` is the moment of the export, so yours will differ.

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AnonymousOnyx22//Study Planner MCP//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Study plan
BEGIN:VEVENT
UID:2026-12-07-networking-study@study-planner-mcp
DTSTAMP:20261021T022919Z
DTSTART;VALUE=DATE:20261207
DTEND;VALUE=DATE:20261208
SUMMARY:Study: Networking 2h
DESCRIPTION:Networking\, 2h of study. Day total 2h. Exam on 2026-12-12 sat.
TRANSP:TRANSPARENT
END:VEVENT
```

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
