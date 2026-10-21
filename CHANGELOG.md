# Changelog

## Unreleased

- This file now starts with the Unreleased block, so the newest work comes first and every released version follows in order.
- The scratch test that only printed messages to the console is no longer in the test folder, so every test file there checks something.
- Every date the tools take can now be written in plain words: `Dec 12`, `12 Dec`, `Dec 12 2026`, `today`, `tomorrow`, `yesterday`, `in 3 weeks`, `3 days ago`, and `Friday`, `next Friday` or `last Friday`. The server reads the date itself, so the day math stays in tested code. A month name without a year means the next one that has not passed yet, and a date with a number for the month, like `12/12/2026`, is not read because the order of the numbers is not clear.
- llms.txt now has a worked example for every tool: the prompt, the tool call with its arguments, and the answer that comes back. A test runs each of those calls and checks that the answer in the file is the answer the tool gives, so the examples cannot drift from the code.
- The server.json description now says the server runs offline and needs no account, so the registry listing says what sets it apart from the school site servers that need a sign in.
- `next_review_dates` now gives one date, the next review for a topic, instead of the whole schedule. It keeps the same arguments, takes an optional `from_date` to say which day to count from, and counts the reviews that have already passed. `make_spaced_repetition_schedule` and `spaced_repetition_dates` still give every review date.
- Added a keyword list to the README, so the phrases people search for, like revision timetable, exam schedule and spaced repetition dates, sit in one place. The npm keywords now use the same list, with revision schedule, revision plan, exam planner, exam prep, study calendar, study plan mcp, spaced repetition schedule, pomodoro planner and assignment plan added.
- Added a comparison table to the README that puts this server next to Brightspace MCP and Canvas MCP, so you can see which one reads your school site and which one plans the study time. Each row says what the other two really do, so their to do lists, their calendar events and the calendar file Brightspace can write are named too.
- Added `topics` to the exams of the plan tools, so an exam can carry its own topics with hours. The plan then names the topic of every study day, `what_to_study_today` names the topic of one day, and the calendar file puts the topics in the description of each session. Leave `hours_needed` off a topic and the hours of the exam are split evenly over the topics.
- Added `hours_per_weekday` to the plan tools, so each weekday can have its own study hours. Weekdays you leave out of the list fall back to `hours_per_day`, a weekday with 0 hours is a day off, and days in `days_off` are always left out. `build_study_plan`, `make_study_plan`, `export_study_plan_ics` and `what_to_study_today` all take it and build the same plan from it.
- Added `what_to_study_today`, which merges the study sessions from your plan for that day with the spaced repetition reviews that are due that day or are late, so one call answers what to do today. Pass the day you want, the exams and hours you use in `build_study_plan`, and the topics you are reviewing with the day you first studied each one.
- The README now has one install section per client, with the exact JSON for Claude Desktop, ChatGPT, Cursor and VS Code Copilot, and the file each app reads it from.
- llms.txt now leads with the current tool names and puts the older names on a single Aliases line, so a client model picks the current names first.
- Added `export_study_plan_ics`, which answers with the plan as an `.ics` calendar file: one all day event per study session plus one per exam, ready to open or import in Google Calendar or Apple Calendar. `include_exams: false` leaves the exams out.
- Added a real `build_study_plan` run to the README: the tool call and its day by day answer, kept true to the code by a test.
- Tuned the npm keywords: dropped the duplicated protocol tags for the phrases people search, like exam schedule, study timetable and revision planner, and rewrote the package description in plain sentences.
- Added explicit tool names for the same jobs: `build_study_plan`, `make_spaced_repetition_schedule`, `plan_pomodoro_sessions`, `list_assignment_milestones` and `next_review_dates`.
- The original names `make_study_plan`, `spaced_repetition_dates`, `pomodoro_plan` and `assignment_milestones` stay available with unchanged parameters.
- Rewrote tool descriptions to state the job in plain sentences.
- Tool errors now say what was missing and include a valid call example. Each tool description carries a worked example prompt.
- Refreshed llms.txt, glama.json and the server.json description so listings match the current tool set.
- Updated the development dependencies to TypeScript 7, Vitest 4 and the Node type definitions for Node 26. The build and the test run pass on a clean install.
- tsconfig.json now names the Node types, so the compiler finds them without relying on automatic type discovery.

## 0.1.3

- Retune npm keywords and rewrite the package description
- Add a tested real build_study_plan sample to the README

## 0.1.2

- Small fixes and clearer docs

## 0.1.1

- Add self correcting errors and worked example prompts to every tool
- Align registry metadata, glama.json and llms.txt with npm listing
- Rewrite descriptions and keywords around study planner mcp phrase
- Refresh dependencies and re run the tests before the 0.1.1 bump
- write the em dash check as an escape
- Rename and rewrite its tools into explicit study-plan verbs
- Rewrite README first screen around offline exam planning

## 0.1.0

- First release. Offline study plan, spaced repetition, pomodoro and assignment milestone tools, with tests.
