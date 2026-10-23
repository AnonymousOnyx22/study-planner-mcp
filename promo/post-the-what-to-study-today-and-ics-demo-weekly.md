Where it goes: r/GetStudying, posted in the weekly thread once a week.

Title: The two tools I use every morning from my free study planner

I built a free MCP server for exam planning, and the two newest tools are the ones I open first. Both take the same exam dates and study hours you already have.

`what_to_study_today` answers one day in one call. It gives you the sessions from your plan for that day, the topic of each session when you gave the exam topics, and the spaced repetition reviews that are due that day or are late.

This is a real answer for Nov 30: a networking exam on Dec 12 that needs 12 hours, 2 hours a day, and routing first studied on Nov 27.

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

So one question gets you the study block, the review you missed, and the next review date. No opening four tabs before you start.

`export_study_plan_ics` takes the same arguments as `build_study_plan` and gives back a calendar file. Each study session becomes an all day event marked free, each exam becomes an all day event marked busy, and every event has a UID built from its date and exam name. Save the answer as `plan.ics` and import it into Google Calendar or Apple Calendar. If you only want the sessions, set `include_exams` to false.

Install is one line:

```bash
claude mcp add study-planner -- npx -y study-planner-mcp
```

The README has the config for Claude Desktop, Claude Code, Cursor and VS Code Copilot as well.

It is free, open source, runs on your computer, needs no account, and stores nothing. If a plan comes out wrong for your dates, tell me and I will look at it.
