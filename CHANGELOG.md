# Changelog

## Unreleased

- Added explicit tool names for the same jobs: `build_study_plan`, `make_spaced_repetition_schedule`, `plan_pomodoro_sessions`, `list_assignment_milestones` and `next_review_dates`.
- The original names `make_study_plan`, `spaced_repetition_dates`, `pomodoro_plan` and `assignment_milestones` stay available with unchanged parameters.
- Rewrote tool descriptions to state the job in plain sentences.
- Tool errors now say what was missing and include a valid call example. Each tool description carries a worked example prompt.
- Refreshed llms.txt, glama.json and the server.json description so listings match the current tool set.

## 0.1.0

- First release. Offline study plan, spaced repetition, pomodoro and assignment milestone tools, with tests.
