# Changelog

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

## Unreleased

- Added a real `build_study_plan` run to the README: the tool call and its day by day answer, kept true to the code by a test.
- Tuned the npm keywords: dropped the duplicated protocol tags for the phrases people search, like exam schedule, study timetable and revision planner, and rewrote the package description in plain sentences.
- Added explicit tool names for the same jobs: `build_study_plan`, `make_spaced_repetition_schedule`, `plan_pomodoro_sessions`, `list_assignment_milestones` and `next_review_dates`.
- The original names `make_study_plan`, `spaced_repetition_dates`, `pomodoro_plan` and `assignment_milestones` stay available with unchanged parameters.
- Rewrote tool descriptions to state the job in plain sentences.
- Tool errors now say what was missing and include a valid call example. Each tool description carries a worked example prompt.
- Refreshed llms.txt, glama.json and the server.json description so listings match the current tool set.
- Updated the development dependencies to TypeScript 7, Vitest 4 and the Node type definitions for Node 26. The build and the test run pass on a clean install.
- tsconfig.json now names the Node types, so the compiler finds them without relying on automatic type discovery.

## 0.1.0

- First release. Offline study plan, spaced repetition, pomodoro and assignment milestone tools, with tests.
