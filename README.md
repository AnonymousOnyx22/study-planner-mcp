# Study Planner MCP

Offline exam planning for your AI: no account, no login, no internet needed, nothing stored. Free forever, open source.

Give it your exam dates and how many hours you can study, the same on every day or different for each weekday, and get back a day by day plan with spaced repetition review dates, pomodoro blocks with breaks, and dated milestones for a big assignment. Ask for a revision timetable, an exam schedule or the spaced repetition dates for a topic, and it works them out from your dates and your hours. The date math is done by tested code, not guessed by the model.

Ask it things like:

- "I have a networking exam on Dec 12 and scripting on Dec 15. I can study 3 hours a day except Sundays. Make me a plan."
- "I have a networking exam on Dec 12. I study 2 hours on weekdays and 6 hours on weekends. Make me a plan."
- "My networking exam covers routing, switching and security. Split the study hours over those topics and tell me what to study today."
- "When should I review what I learned today so I remember it for my exam on Nov 30?"
- "What should I study today? My networking exam is on Dec 12 and I studied routing last Friday."
- "Plan 3 hours of studying as pomodoro blocks with breaks."
- "Break my 6 hour essay due Friday into milestones."
- "Give me this plan as an .ics file so I can import it into Google Calendar."

This is a free, open source [MCP](https://modelcontextprotocol.io) server. It works with Claude, ChatGPT, Cursor, VS Code Copilot and any other app that supports MCP. It runs on your computer, so your study data never leaves it. The [install steps](#install) below have the exact config for each app.

[![npm](https://img.shields.io/npm/v/study-planner-mcp.svg)](https://www.npmjs.com/package/study-planner-mcp)
[![downloads](https://img.shields.io/npm/dm/study-planner-mcp.svg)](https://www.npmjs.com/package/study-planner-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Install

The server runs on your computer through `npx`, so you need Node.js 20 or newer. There is no account, no key and nothing to sign in to.

Every app reads its MCP config from its own file, so pick yours:

- [Claude Desktop](#claude-desktop)
- [Claude Code](#claude-code)
- [ChatGPT](#chatgpt)
- [Cursor](#cursor)
- [VS Code Copilot](#vs-code-copilot)

All of them start the same server the same way. The only difference is where the JSON goes.

### Claude Desktop

Add this to `claude_desktop_config.json`:

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

Restart Claude Desktop after you save the file.

### Claude Code

Run this in a terminal:

```bash
claude mcp add study-planner -- npx -y study-planner-mcp
```

### ChatGPT

The ChatGPT desktop app can start a server that runs on your machine. Open Settings, turn on developer mode, add a connector and paste this JSON:

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

The ChatGPT website talks to servers over the web, so use the desktop app for a server that runs on your computer.

### Cursor

Cursor reads `mcp.json` from the project folder at `.cursor/mcp.json`, or from your home folder at `~/.cursor/mcp.json` if you want the server in every project. On Windows the home folder file is `%USERPROFILE%\.cursor\mcp.json`.

```json
{
  "mcpServers": {
    "study-planner": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "study-planner-mcp"]
    }
  }
}
```

Restart Cursor after you save the file. The Customize page in the sidebar lists the server once it starts, and you can turn it on or off there.

### VS Code Copilot

Put this in `.vscode/mcp.json` in your project folder, or in the `mcp.json` file in your user profile:

```json
{
  "servers": {
    "study-planner": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "study-planner-mcp"]
    }
  }
}
```

VS Code also reads a portable `.mcp.json` file in the project root. That file uses the name `mcpServers` instead of `servers`:

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

Restart VS Code after you save the file.

After any of these, try one of the questions at the top of this page.

## Tools

| Tool | What it does |
| --- | --- |
| `build_study_plan` | A day by day study plan for one or more exams, sharing the hours of each weekday by urgency, with a warning if there is not enough time, and the topic of each day when an exam has topics |
| `make_spaced_repetition_schedule` | Spaced repetition review dates for a topic at expanding intervals, with dates on or after the exam marked to skip |
| `plan_pomodoro_sessions` | A work and break schedule for a total amount of study time |
| `list_assignment_milestones` | Dated milestones that split a big assignment into research, outline, draft, revise and proofread |
| `next_review_dates` | The date of the next review for one topic, so you get a single date instead of the whole schedule |
| `export_study_plan_ics` | The same plan as an `.ics` calendar file, with one all day event per study session and one per exam, ready to open or import into Google Calendar or Apple Calendar |
| `what_to_study_today` | What to study on one day: the study sessions from your plan for that day, the topic of each session when the exams have topics, plus the spaced repetition reviews that are due that day or are late |

The original names `make_study_plan`, `spaced_repetition_dates`, `pomodoro_plan` and `assignment_milestones` do the same four jobs with the same parameters, so existing configs and saved prompts keep working.

Every date these tools take can be written in plain words, like `Dec 12` or `in 3 weeks`. See [Dates in plain words](#dates-in-plain-words).

## Study Planner MCP compared with Brightspace and Canvas

[Brightspace MCP](https://github.com/AnonymousOnyx22/brightspace-d2l-mcp) and [Canvas MCP](https://github.com/AnonymousOnyx22/canvas-lms-student-mcp) read your school site. They tell you what is due, what your grades are and what your teachers announced. They need an account and a sign in.

This server reads no site at all. You give it the exam dates and the hours you can study, and it works out the timetable, the review dates and the breaks. Run it next to an LMS server if you like: one tells you what is assigned, the other tells you how to study it.

| | Study Planner MCP | [Brightspace MCP](https://github.com/AnonymousOnyx22/brightspace-d2l-mcp) | [Canvas MCP](https://github.com/AnonymousOnyx22/canvas-lms-student-mcp) |
| --- | --- | --- | --- |
| What it reads | Nothing. You give it the exam dates and the hours | Your Brightspace courses, due dates, grades, files and announcements | Your Canvas courses, due dates, grades and announcements |
| Needs a school account | No | Yes | Yes |
| How you sign in | You never sign in | Browser sign in with your school login | An API token you create in Canvas |
| A day by day study timetable | Yes, `build_study_plan` | No, it shows the dated events your school posted | No, it shows the dated events your school posted |
| Different hours for each weekday | Yes, `hours_per_weekday` on the plan tools | No | No |
| Which topic to study on each day | Yes, give the exam topics | No | No |
| Spaced repetition review dates | Yes, `make_spaced_repetition_schedule`, and `next_review_dates` for the next one only | No | No |
| Pomodoro blocks with breaks | Yes, `plan_pomodoro_sessions` | No | No |
| Assignment milestones with dates | Yes, `list_assignment_milestones` | No | No |
| What to do today | Yes, `what_to_study_today`, and it adds the reviews that are due | Yes, a to do list of the work your school set | Yes, a to do list of the work your school set |
| A calendar file | Yes, `export_study_plan_ics` writes your study sessions and your exams | Yes, of your due dates | No |
| Works without a network | Yes | No | No |

Brightspace also writes your due dates into a calendar file, and both of them show the dated events your school posted. What they do not do is turn your exam dates and your study hours into a day by day timetable with spaced repetition dates and pomodoro breaks.

## Keywords

People search for a study planner with words like these, so here they are in one place. Revision timetable, exam schedule and spaced repetition dates are on the list, along with the other names for the same jobs.

- study planner mcp
- study planner
- study-planner-mcp
- study plan mcp
- revision timetable
- revision schedule
- revision plan
- revision planner
- exam schedule
- exam timetable
- exam planner
- exam prep
- exam study plan
- study schedule
- study timetable
- study calendar
- spaced repetition
- spaced repetition dates
- spaced repetition schedule
- pomodoro
- pomodoro planner
- assignment milestones
- assignment plan
- student planner
- student
- mcp
- mcp server
- model context protocol
- offline

The npm listing uses the same words. If you searched for one of them, install the server and ask for a plan.

## How the study plan works

Each day has the hours of that weekday, which is `hours_per_day` unless you set `hours_per_weekday`. Those hours are shared across the exams that still need work, weighted by how many hours are left divided by how many days remain, so closer and bigger exams get more time. Study stops the day before each exam. If the hours do not fit, the plan says how many are short instead of pretending. The dates the server works out are plain calendar dates, so time zones never shift a day.

When an exam has topics, the hours the exam gets on a day are split over its topics in proportion to the hours each topic still needs. That way the plan answers which topic to study, not only which exam.

## Dates in plain words

Every date the tools take can be written the way you say it. The server reads the date itself, so the day math stays in tested code.

- `2026-12-12` for a date you know exactly.
- `Dec 12`, `December 12` or `12 Dec` for a month and a day. Without a year it means the next one that has not passed yet, so asked for in October, `Dec 12` means 12 December of that year, and asked for in December it means 12 December of the next year.
- `Dec 12 2026` when you want a year of your own.
- `today`, `tomorrow` and `yesterday`.
- `in 3 days`, `in 2 weeks`, `in 3 months` and `in 1 year`, counted from today. Number words work too, like `in two weeks`.
- `3 days ago` and `2 weeks ago` for the days behind you.
- `Friday` for the coming Friday, `next Friday` for the Friday of the week after that, and `last Friday` for the one before.

This works in every date the tools take: the exam dates, `start_date`, `due_date`, `first_study_date`, `exam_date`, `from_date` and the `date` of `what_to_study_today`.

Dates with a number for the month, like `12/12/2026`, are not read, because the order of the numbers is not clear. Write the month as a name, like `Dec 12 2026`.

Tool call:

```json
{
  "exams": [{ "name": "Networking", "date": "Dec 12 2026", "hours_needed": 6 }],
  "start_date": "2026-12-07",
  "hours_per_day": 2
}
```

The answer:

```text
Exams
- Networking on 2026-12-12 sat, 6h planned

Plan from 2026-12-07
- 2026-12-07 mon  Networking 2h  (2h total)
- 2026-12-08 tue  Networking 2h  (2h total)
- 2026-12-09 wed  Networking 2h  (2h total)

Everything fits.
```

The date `2026-12-12` gives the same plan.

## Different hours each day of the week

Study days are not all the same length. `hours_per_weekday` sets the hours for each weekday, so the plan can give you 2 hours from Monday to Friday and 6 hours on Saturday and Sunday. Weekdays you leave out of the list fall back to `hours_per_day`, and a weekday with 0 hours is a day off, the same as a day in `days_off`. Days listed in `days_off` are always left out. The same list works in `export_study_plan_ics` and `what_to_study_today`, so all three tools build the same plan.

Tool call:

```json
{
  "exams": [{ "name": "Networking", "date": "2026-12-12", "hours_needed": 20 }],
  "hours_per_day": 3,
  "hours_per_weekday": [
    { "day": "mon", "hours": 2 },
    { "day": "tue", "hours": 2 },
    { "day": "wed", "hours": 2 },
    { "day": "thu", "hours": 2 },
    { "day": "fri", "hours": 2 },
    { "day": "sat", "hours": 6 },
    { "day": "sun", "hours": 6 }
  ],
  "start_date": "2026-11-30"
}
```

The answer:

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

Saturday carries the 6 hours, and Sunday gets the 4 hours that are left over.

## Hours per topic

Give an exam `topics` and the plan says which topic to study on each day, not just which exam. The hours of a day are split over the topics of the exam in proportion to the hours each topic still needs, so the topic that needs the most work gets the most time. Leave `hours_needed` off a topic and the hours of the exam are split evenly over the topics that have no hours of their own.

Tool call:

```json
{
  "exams": [
    {
      "name": "Networking",
      "date": "2026-12-10",
      "topics": [
        { "name": "Routing", "hours_needed": 6 },
        { "name": "Switching", "hours_needed": 4 },
        { "name": "Security", "hours_needed": 2 }
      ]
    }
  ],
  "hours_per_day": 4,
  "start_date": "2026-12-07"
}
```

The answer:

```text
Exams
- Networking on 2026-12-10 thu, 12h planned
  - Routing 6h planned
  - Switching 4h planned
  - Security 2h planned

Plan from 2026-12-07
- 2026-12-07 mon  Networking 4h  (4h total)
  - Networking: Routing 2h, Switching 1.5h, Security 0.5h
- 2026-12-08 tue  Networking 4h  (4h total)
  - Networking: Routing 2h, Switching 1.5h, Security 0.5h
- 2026-12-09 wed  Networking 4h  (4h total)
  - Networking: Routing 2h, Switching 1h, Security 1h

Everything fits.
```

`what_to_study_today` gives the same topics for one day, so one call tells you what to study today and which part of the exam it belongs to.

Tool call:

```json
{
  "date": "2026-12-08",
  "exams": [
    {
      "name": "Networking",
      "date": "2026-12-10",
      "topics": [
        { "name": "Routing", "hours_needed": 6 },
        { "name": "Switching", "hours_needed": 4 },
        { "name": "Security", "hours_needed": 2 }
      ]
    }
  ],
  "hours_per_day": 4,
  "start_date": "2026-12-07"
}
```

The answer:

```text
Today 2026-12-08 tue

Study sessions, 4h total
- Networking 4h
  - Routing 2h, Switching 1.5h, Security 0.5h

Next exam: Networking on 2026-12-10 thu, 2 days left.
```

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

## What to study today

`what_to_study_today` answers one day in one call. It merges the study sessions your plan gives for that day with the spaced repetition reviews that are due that day or are late. Pass the same exams and hours you use in `build_study_plan`, and the topics you are reviewing with the day you first studied each one. Leave `date` out and it uses today's date. Pass `start_date` if your plan already has a first day, so the sessions match the plan you made earlier.

Tool call:

```json
{
  "date": "2026-11-30",
  "exams": [{ "name": "Networking", "date": "2026-12-12", "hours_needed": 12 }],
  "hours_per_day": 2,
  "reviews": [{ "topic": "Routing", "first_study_date": "2026-11-27" }]
}
```

The answer:

```text
Today 2026-11-30 mon

Study sessions, 2h total
- Networking 2h

Reviews due today
- Routing, 2nd review

Reviews to catch up
- Routing, 1st review, 2 days late (due 2026-11-28)

Next reviews
- Routing on 2026-12-04 fri, 3rd review

Next exam: Networking on 2026-12-12 sat, 12 days left.
```

## Next review date

`next_review_dates` gives one date, the next review for one topic, instead of the whole schedule. It counts from the day you first studied the topic, and it skips any review that falls on or after the exam. The answer counts the reviews that have already passed. Pass `from_date` to say which day to count from, so the answer is repeatable. Use `make_spaced_repetition_schedule` when you want every review date.

Tool call:

```json
{
  "topic": "Routing",
  "first_study_date": "2026-11-27",
  "exam_date": "2026-12-12",
  "from_date": "2026-11-29"
}
```

The answer:

```text
Next review for "Routing": 2026-11-30 mon, the 2nd review, in 1 day.
1 review has passed.
```

The routing was first studied on Nov 27, so the first review fell on Nov 28 and has passed. The next one is Nov 30, and the review on Dec 27 is left out because it falls after the exam on Dec 12.

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
| [Canvas MCP](https://github.com/AnonymousOnyx22/canvas-lms-student-mcp) | Canvas LMS for AI, read only. Due dates, missing work, grades and announcements. |
| [Moodle MCP](https://github.com/AnonymousOnyx22/moodle-student-mcp) | Moodle for AI, read only. Due dates, overdue work, grades and announcements. |
| [Google Classroom MCP](https://github.com/AnonymousOnyx22/google-classroom-student-mcp) | Google Classroom for AI, read only. Todos, due dates, missing work and grades. |
| [GPA Calculator MCP](https://github.com/AnonymousOnyx22/gpa-calculator-mcp) | GPA, grade conversion and the grade you need on the final, for AI. Works offline, no account. |
| [Citations MCP](https://github.com/AnonymousOnyx22/student-citations-mcp) | APA, MLA and Chicago citations from a DOI, an ISBN or typed details. No account. |
| [Paper Finder MCP](https://github.com/AnonymousOnyx22/paper-finder-student-mcp) | Search scholarly papers, find open access copies and related work through OpenAlex. No key needed. |

## License

MIT
