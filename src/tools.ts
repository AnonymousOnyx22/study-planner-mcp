import { z } from "zod";
import { type ToolDef, bullets } from "./core/tools.js";
import { addDays, fmt, label, milestones, parseDate, pomodoro, spacedDates, studyPlan, today, weekdayIndex } from "./plan.js";

type Api = null;

function textField(name: string, example = "Math") {
  return z.string({
    error: (iss) =>
      iss.input === undefined
        ? `${name} is required; try ${name}: "${example}"`
        : `${name} must be text, got "${iss.input}"; try ${name}: "${example}"`,
  });
}

function dateField(name: string, example = "2026-11-14") {
  return z.string({
    error: (iss) =>
      iss.input === undefined
        ? `${name} is required; try ${name}: "${example}"`
        : `${name} must be YYYY-MM-DD, got "${iss.input}"; try ${example}`,
  }).regex(/^\d{4}-\d{2}-\d{2}$/, {
    error: (iss) => `${name} must be YYYY-MM-DD, got "${iss.input}"; try ${example}`,
  });
}

function numberField(name: string, example = 3, min = 0, max?: number, integer = false) {
  let s = z.number({
    error: (iss) =>
      iss.input === undefined
        ? `${name} is required; try ${name}: ${example}`
        : `${name} must be a number, got "${iss.input}"; try ${name}: ${example}`,
  });
  if (integer) {
    s = s.int({
      error: (iss) => `${name} must be a whole number, got "${iss.input}"; try ${name}: ${example}`,
    });
  }
  s = s.gt(min, {
    error: `${name} must be greater than ${min}; try ${name}: ${example}`,
  });
  if (max !== undefined) {
    s = s.max(max, {
      error: `${name} must be at most ${max}; try ${name}: ${example}`,
    });
  }
  return s;
}

const core: ToolDef<Api>[] = [
  {
    name: "make_study_plan",
    title: "Make a study plan",
    description:
      "Build a day by day study plan for one or more exams. Daily hours are shared across exams by urgency, study stops the day before each exam, and the answer warns when there is not enough time. Example prompt: \"Plan 3 weeks of study for my 4 exams, 90 minutes a day.\"",
    inputSchema: {
      exams: z
        .array(
          z.object({
            name: textField("name", "Networking"),
            date: dateField("exam_date"),
            hours_needed: numberField("hours_needed", 10, 0).optional().describe("Study hours you want to put in. Defaults to 10."),
          }),
          {
            error: (iss) =>
              iss.input === undefined
                ? "exams is required; try exams: [{name: \"Networking\", date: \"2026-12-12\", hours_needed: 6}]"
                : "exams must be a list of exams; try exams: [{name: \"Networking\", date: \"2026-12-12\", hours_needed: 6}]",
          },
        )
        .min(1, {
          error: "exams must have at least 1 exam; try exams: [{name: \"Networking\", date: \"2026-12-12\", hours_needed: 6}]",
        })
        .describe("Exams with name, date and optional hours needed."),
      hours_per_day: numberField("hours_per_day", 3, 0, 16).default(3).describe("Study hours available on a study day."),
      days_off: z
        .array(textField("days_off", "sun"), {
          error: (iss) =>
            iss.input === undefined
              ? "days_off is required; try days_off: [\"sun\"]"
              : "days_off must be a list of weekday names; try days_off: [\"sun\"]",
        })
        .default([])
        .describe('Weekdays with no studying, like ["sun"].'),
      start_date: dateField("start_date").optional().describe("First day to study. Defaults to today."),
    },
    run: async (a) => {
      const start = a.start_date ? parseDate(a.start_date) : today();
      const plan = studyPlan(a.exams, start, a.hours_per_day, a.days_off.map(weekdayIndex));
      const lines = plan.days.map((d) => `${label(d.date)}  ${d.items.map((i) => `${i.name} ${i.hours}h`).join(", ")}  (${d.items.reduce((s, i) => s + i.hours, 0)}h total)`);
      const exams = plan.exams.map((e) => `${e.name} on ${label(e.date)}, ${e.need}h planned`);
      let out = `Exams\n${bullets(exams)}\n\nPlan from ${fmt(start)}\n${bullets(lines)}`;
      if (plan.short.length) {
        out += `\n\nNot enough time. ${plan.short.map((s) => `${s.name} is ${s.hours}h short`).join(", ")}. Add study days, raise hours per day or lower the hours needed.`;
      } else {
        out += "\n\nEverything fits.";
      }
      return out;
    },
  },
  {
    name: "spaced_repetition_dates",
    title: "Spaced repetition dates",
    description:
      "List spaced repetition review dates for a topic at expanding intervals, so you revisit it just before you would forget it. Dates on or after the exam are marked to skip. Example prompt: \"When should I review what I learned today for my exam on 2026-11-30?\"",
    inputSchema: {
      topic: textField("topic", "Routing").describe("Topic you studied."),
      first_study_date: dateField("first_study_date").optional().describe("The day you first studied it. Defaults to today."),
      intervals_days: z
        .array(numberField("intervals_days", 7, 0, undefined, true), {
          error: (iss) =>
            iss.input === undefined
              ? "intervals_days is required; try intervals_days: [1, 3, 7, 14, 30]"
              : "intervals_days must be a list of whole days; try intervals_days: [1, 3, 7, 14, 30]",
        })
        .default([1, 3, 7, 14, 30])
        .describe("Days after the first study to review."),
      exam_date: dateField("exam_date").optional().describe("Exam date, if any."),
    },
    run: async (a) => {
      const first = a.first_study_date ? parseDate(a.first_study_date) : today();
      const exam = a.exam_date ? parseDate(a.exam_date) : undefined;
      const rows = spacedDates(first, a.intervals_days, exam);
      const lines = rows.map((r) => `Day ${r.day}, ${label(r.date)}${r.skipped ? " (after the exam, skip)" : ""}`);
      return `Review "${a.topic}" starting from ${label(first)}\n${bullets(lines)}`;
    },
  },
  {
    name: "pomodoro_plan",
    title: "Pomodoro plan",
    description:
      "Plan pomodoro sessions: a work and break schedule for a total amount of study time, with a long break after a set number of sessions. Example prompt: \"Plan 3 hours of studying as pomodoro blocks with breaks.\"",
    inputSchema: {
      total_minutes: numberField("total_minutes", 75, 0, 1440, true).describe("Total study time in minutes."),
      work_minutes: numberField("work_minutes", 25, 0, undefined, true).default(25).describe("Work block length in minutes."),
      short_break_minutes: numberField("short_break_minutes", 5, 0, undefined, true).default(5).describe("Short break length in minutes."),
      long_break_minutes: numberField("long_break_minutes", 15, 0, undefined, true).default(15).describe("Long break length in minutes."),
      sessions_before_long_break: numberField("sessions_before_long_break", 4, 0, undefined, true).default(4).describe("Work sessions before a long break."),
    },
    run: async (a) => {
      const r = pomodoro(a.total_minutes, a.work_minutes, a.short_break_minutes, a.long_break_minutes, a.sessions_before_long_break);
      let t = 0;
      const lines = r.steps.map((s) => {
        const from = t;
        t += s.minutes;
        return `${from}-${t} min, ${s.kind} (${s.minutes} min)`;
      });
      return `${r.sessions} work sessions\n${bullets(lines)}\n\nTotal time with breaks is ${t} minutes.`;
    },
  },
  {
    name: "assignment_milestones",
    title: "Assignment milestones",
    description:
      "List dated milestones that split a big assignment into steps between a start date and the due date. Example prompt: \"Break my 6 hour essay due 2026-11-20 into milestones.\"",
    inputSchema: {
      title: textField("title", "Essay").describe("Assignment name."),
      due_date: dateField("due_date").describe("Due date."),
      estimated_hours: numberField("estimated_hours", 6, 0).describe("Estimated total hours."),
      start_date: dateField("start_date").optional().describe("Defaults to today."),
      steps: z
        .array(
          z.object({
            name: textField("name", "Research"),
            share: numberField("share", 25, 0).describe("Relative size of the step."),
          }),
          {
            error: (iss) =>
              iss.input === undefined
                ? "steps is required; try steps: [{name: \"Research\", share: 25}]"
                : "steps must be a list of steps; try steps: [{name: \"Research\", share: 25}]",
          },
        )
        .optional()
        .describe("Custom steps with relative sizes. Defaults to research, outline, draft, revise, proofread."),
    },
    run: async (a) => {
      const start = a.start_date ? parseDate(a.start_date) : today();
      const steps = a.steps ?? [{ name: "Research", share: 25 }, { name: "Outline", share: 10 }, { name: "First draft", share: 35 }, { name: "Revise", share: 20 }, { name: "Proofread and submit", share: 10 }];
      const rows = milestones(start, parseDate(a.due_date), a.estimated_hours, steps);
      return `${a.title}, due ${label(parseDate(a.due_date))}, about ${a.estimated_hours}h of work\n${bullets(rows.map((r) => `Finish by ${label(r.date)}, ${r.name} (${r.hours}h)`))}`;
    },
  },
];

function alias(of: string, name: string, title: string, description: string): ToolDef<Api> {
  const base = core.find((t) => t.name === of);
  if (!base) throw new Error(`No tool named ${of} to alias.`);
  return { name, title, description, inputSchema: base.inputSchema, run: base.run };
}

export const tools: ToolDef<Api>[] = [
  ...core,
  alias(
    "make_study_plan",
    "build_study_plan",
    "Build a study plan",
    "Build a day by day study plan for one or more exams. Give each exam date and the hours you have per day, and get dated study sessions split by urgency, with a warning when the hours do not fit. Example prompt: \"Plan 3 weeks of study for my 4 exams, 90 minutes a day.\"",
  ),
  alias(
    "spaced_repetition_dates",
    "make_spaced_repetition_schedule",
    "Make a spaced repetition schedule",
    "Make a spaced repetition schedule for a topic: review dates at expanding intervals from the day you first studied it, with any date on or after the exam marked to skip. Example prompt: \"When should I review what I learned today for my exam on 2026-11-30?\"",
  ),
  alias(
    "pomodoro_plan",
    "plan_pomodoro_sessions",
    "Plan pomodoro sessions",
    "Plan pomodoro sessions for a total amount of study time: work blocks separated by short breaks, with a long break after a set number of sessions. Example prompt: \"Plan 3 hours of studying as pomodoro blocks with breaks.\"",
  ),
  alias(
    "assignment_milestones",
    "list_assignment_milestones",
    "List assignment milestones",
    "List dated milestones that split a big assignment from a start date to the due date, with default steps for research, outline, draft, revise and proofread. Example prompt: \"Break my 6 hour essay due 2026-11-20 into milestones.\"",
  ),
  alias(
    "spaced_repetition_dates",
    "next_review_dates",
    "Next review dates",
    "List the next review dates for a topic, computed from the day you first studied it with expanding spaced repetition intervals. Dates on or after the exam are marked to skip. Example prompt: \"When should I review what I learned today for my exam on 2026-11-30?\"",
  ),
];
