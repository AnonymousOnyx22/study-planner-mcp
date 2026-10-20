import { z } from "zod";
import { type ToolDef, bullets } from "./core/tools.js";
import { addDays, fmt, label, milestones, parseDate, pomodoro, spacedDates, studyPlan, today, weekdayIndex } from "./plan.js";

type Api = null;
const date = z.string().describe("A date as YYYY-MM-DD.");

const core: ToolDef<Api>[] = [
  {
    name: "make_study_plan",
    title: "Make a study plan",
    description:
      "Build a day by day study plan for one or more exams. Daily hours are shared across exams by urgency, study stops the day before each exam, and the answer warns when there is not enough time.",
    inputSchema: {
      exams: z.array(z.object({ name: z.string(), date, hours_needed: z.number().gt(0).optional().describe("Study hours you want to put in. Defaults to 10.") })).min(1),
      hours_per_day: z.number().gt(0).max(16).default(3).describe("Study hours available on a study day."),
      days_off: z.array(z.string()).default([]).describe('Weekdays with no studying, like ["sun"].'),
      start_date: date.optional().describe("First day to study. Defaults to today."),
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
    description: "List spaced repetition review dates for a topic at expanding intervals, so you revisit it just before you would forget it. Dates on or after the exam are marked to skip.",
    inputSchema: {
      topic: z.string(),
      first_study_date: date.optional().describe("The day you first studied it. Defaults to today."),
      intervals_days: z.array(z.number().int().gt(0)).default([1, 3, 7, 14, 30]).describe("Days after the first study to review."),
      exam_date: date.optional(),
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
    description: "Plan pomodoro sessions: a work and break schedule for a total amount of study time, with a long break after a set number of sessions.",
    inputSchema: {
      total_minutes: z.number().int().gt(0).max(1440),
      work_minutes: z.number().int().gt(0).default(25),
      short_break_minutes: z.number().int().gt(0).default(5),
      long_break_minutes: z.number().int().gt(0).default(15),
      sessions_before_long_break: z.number().int().gt(0).default(4),
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
    description: "List dated milestones that split a big assignment into steps between a start date and the due date.",
    inputSchema: {
      title: z.string(),
      due_date: date,
      estimated_hours: z.number().gt(0),
      start_date: date.optional().describe("Defaults to today."),
      steps: z.array(z.object({ name: z.string(), share: z.number().gt(0) })).optional().describe("Custom steps with relative sizes. Defaults to research, outline, draft, revise, proofread."),
    },
    run: async (a) => {
      const start = a.start_date ? parseDate(a.start_date) : today();
      const steps = a.steps ?? [{ name: "Research", share: 25 }, { name: "Outline", share: 10 }, { name: "First draft", share: 35 }, { name: "Revise", share: 20 }, { name: "Proofread and submit", share: 10 }];
      const rows = milestones(start, parseDate(a.due_date), a.estimated_hours, steps);
      return `${a.title}, due ${label(parseDate(a.due_date))}, about ${a.estimated_hours}h of work\n${bullets(rows.map((r) => `Finish by ${label(r.date)}, ${r.name} (${r.hours}h)`))}`;
    },
  },
];

/** Expose a core tool under a name that states the job in the caller's words. */
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
    "Build a day by day study plan for one or more exams. Give each exam date and the hours you have per day, and get dated study sessions split by urgency, with a warning when the hours do not fit.",
  ),
  alias(
    "spaced_repetition_dates",
    "make_spaced_repetition_schedule",
    "Make a spaced repetition schedule",
    "Make a spaced repetition schedule for a topic: review dates at expanding intervals from the day you first studied it, with any date on or after the exam marked to skip.",
  ),
  alias(
    "pomodoro_plan",
    "plan_pomodoro_sessions",
    "Plan pomodoro sessions",
    "Plan pomodoro sessions for a total amount of study time: work blocks separated by short breaks, with a long break after a set number of sessions.",
  ),
  alias(
    "assignment_milestones",
    "list_assignment_milestones",
    "List assignment milestones",
    "List dated milestones that split a big assignment from a start date to the due date, with default steps for research, outline, draft, revise and proofread.",
  ),
  alias(
    "spaced_repetition_dates",
    "next_review_dates",
    "Next review dates",
    "List the next review dates for a topic, computed from the day you first studied it with expanding spaced repetition intervals. Dates on or after the exam are marked to skip.",
  ),
];
