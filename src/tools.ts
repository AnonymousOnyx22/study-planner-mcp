import { z } from "zod";
import { type ToolDef, bullets } from "./core/tools.js";
import { studyPlanIcs } from "./ics.js";
import { DAY_MS, fmt, label, milestones, parseDate, planForDay, pomodoro, spacedDates, studyPlan, today, weekdayHours, weekdayIndex } from "./plan.js";

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

const EXAM_HINT = 'try exams: [{name: "Networking", date: "2026-12-12", hours_needed: 6}]';

const examItem = z.object({
  name: textField("name", "Networking"),
  date: dateField("exam_date"),
  hours_needed: numberField("hours_needed", 10, 0).optional().describe("Study hours you want to put in. Defaults to 10."),
});

/** The list of exams, shared by the tools that plan study time. */
function examList(required: boolean) {
  return z.array(examItem, {
    error: (iss) =>
      iss.input === undefined && required
        ? `exams is required; ${EXAM_HINT}`
        : `exams must be a list of exams; ${EXAM_HINT}`,
  });
}

function hoursPerDay() {
  return numberField("hours_per_day", 3, 0, 16).default(3).describe("Study hours available on a study day.");
}

function daysOff() {
  return z
    .array(textField("days_off", "sun"), {
      error: (iss) =>
        iss.input === undefined
          ? 'days_off is required; try days_off: ["sun"]'
          : 'days_off must be a list of weekday names; try days_off: ["sun"]',
    })
    .default([])
    .describe('Weekdays with no studying, like ["sun"].');
}

/** The study hours on one weekday of the hours_per_weekday list. */
function weekdayHoursField() {
  return z
    .number({
      error: (iss) =>
        iss.input === undefined
          ? "hours is required; try hours: 2"
          : `hours must be a number, got "${iss.input}"; try hours: 2`,
    })
    .min(0, { error: "hours must be 0 or more; try hours: 2" })
    .max(16, { error: "hours must be at most 16; try hours: 2" })
    .describe("Study hours on that weekday. Use 0 for a day with no studying.");
}

function hoursPerWeekday() {
  return z
    .array(
      z.object({
        day: textField("day", "mon").describe("Weekday name, like mon, tue, sat or sunday."),
        hours: weekdayHoursField(),
      }),
      {
        error: (iss) =>
          iss.input === undefined
            ? 'hours_per_weekday is required; try hours_per_weekday: [{day: "mon", hours: 2}]'
            : 'hours_per_weekday must be a list of weekdays with hours; try hours_per_weekday: [{day: "mon", hours: 2}]',
      },
    )
    .optional()
    .describe(
      'Study hours for each weekday, like [{day: "mon", hours: 2}, {day: "sat", hours: 6}]. Weekdays you leave out use hours_per_day, a weekday with 0 hours is a day off, and days in days_off are always left out.',
    );
}

/** The arguments every plan building tool takes, kept in one place so they never drift apart. */
function planFields() {
  return {
    exams: examList(true)
      .min(1, { error: `exams must have at least 1 exam; ${EXAM_HINT}` })
      .describe("Exams with name, date and optional hours needed."),
    hours_per_day: hoursPerDay(),
    hours_per_weekday: hoursPerWeekday(),
    days_off: daysOff(),
    start_date: dateField("start_date").optional().describe("First day to study. Defaults to today."),
  };
}

/** "1st", "2nd", "3rd" and so on, for naming reviews in order. */
function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const last = n % 10;
  if (teen) return `${n}th`;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

const core: ToolDef<Api>[] = [
  {
    name: "make_study_plan",
    title: "Make a study plan",
    description:
      "Build a day by day study plan for one or more exams. Daily hours are shared across exams by urgency, study stops the day before each exam, and the answer warns when there is not enough time. Set hours_per_weekday when your weekdays and your weekend differ. Example prompt: \"Plan 3 weeks of study for my 4 exams, 90 minutes a day.\"",
    inputSchema: planFields(),
    run: async (a) => {
      const start = a.start_date ? parseDate(a.start_date) : today();
      const plan = studyPlan(a.exams, start, a.hours_per_day, a.days_off.map(weekdayIndex), weekdayHours(a.hours_per_weekday));
      const lines = plan.days.map((d) => `${label(d.date)}  ${d.items.map((i) => `${i.name} ${i.hours}h`).join(", ")}  (${d.items.reduce((s, i) => s + i.hours, 0)}h total)`);
      const exams = plan.exams.map((e) => `${e.name} on ${label(e.date)}, ${e.need}h planned`);
      let out = `Exams\n${bullets(exams)}\n\nPlan from ${fmt(start)}\n${bullets(lines)}`;
      if (plan.short.length) {
        out += `\n\nNot enough time. ${plan.short.map((s) => `${s.name} is ${s.hours}h short`).join(", ")}. Add study days, raise hours per day or hours per weekday, or lower the hours needed.`;
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
  {
    name: "export_study_plan_ics",
    title: "Export study plan as ICS",
    description:
      "Turn a study plan into an .ics calendar file to import into Google Calendar or Apple Calendar. It builds the same plan as build_study_plan, with the same hours_per_weekday if you set one, and answers with the whole file, so save the answer as plan.ics and open it. Every study session becomes an all day event that shows as free, and every exam becomes an all day event that shows as busy unless include_exams is false. Example prompt: \"Export my plan for a networking exam on 2026-12-12, 6 hours, starting 2026-12-07, as an ICS file.\"",
    inputSchema: {
      ...planFields(),
      include_exams: z
        .boolean()
        .default(true)
        .describe("Also add an all day event on each exam day. Set false for study sessions only."),
    },
    run: async (a) => {
      const start = a.start_date ? parseDate(a.start_date) : today();
      const plan = studyPlan(a.exams, start, a.hours_per_day, a.days_off.map(weekdayIndex), weekdayHours(a.hours_per_weekday));
      return studyPlanIcs(plan, { includeExams: a.include_exams });
    },
  },
  {
    name: "what_to_study_today",
    title: "What to study today",
    description:
      "Answer what to study on one day in a single call: the study sessions your plan gives for that day, plus the spaced repetition reviews that are due that day or are late. Give the same exams and hours you use in build_study_plan, including hours_per_weekday, and the topics you are reviewing with the day you first studied each one. Example prompt: \"What should I study today? I have a networking exam on 2026-12-12 and I studied routing on 2026-11-27.\"",
    inputSchema: {
      date: dateField("date").optional().describe("The day to show. Defaults to today."),
      exams: examList(false).optional().describe("Exams with name, date and optional hours needed. Leave it out to show reviews only."),
      hours_per_day: hoursPerDay(),
      hours_per_weekday: hoursPerWeekday(),
      days_off: daysOff(),
      start_date: dateField("start_date").optional().describe("First day of the plan. Defaults to the day you are asking about."),
      reviews: z
        .array(
          z.object({
            topic: textField("topic", "Routing"),
            first_study_date: dateField("first_study_date").optional().describe("The day you first studied it. Defaults to the day you are asking about."),
            exam_date: dateField("exam_date").optional().describe("Exam date, if any. Reviews on or after it are skipped."),
          }),
          {
            error: () => 'reviews must be a list of topics; try reviews: [{topic: "Routing", first_study_date: "2026-11-27"}]',
          },
        )
        .optional()
        .describe("Topics you are reviewing, with the day you first studied each one."),
      intervals_days: z
        .array(numberField("intervals_days", 7, 0, undefined, true), {
          error: (iss) =>
            iss.input === undefined
              ? "intervals_days is required; try intervals_days: [1, 3, 7, 14, 30]"
              : "intervals_days must be a list of whole days; try intervals_days: [1, 3, 7, 14, 30]",
        })
        .default([1, 3, 7, 14, 30])
        .describe("Days after the first study to review."),
    },
    run: async (a) => {
      const day = a.date ? parseDate(a.date) : today();
      const start = a.start_date ? parseDate(a.start_date) : day;
      const exams = a.exams ?? [];
      const reviews = a.reviews ?? [];
      const out: string[] = [`Today ${label(day)}`];

      let nextExam: { name: string; date: Date; left: number } | undefined;
      if (exams.length) {
        const plan = planForDay(exams, start, day, a.hours_per_day, a.days_off.map(weekdayIndex), weekdayHours(a.hours_per_weekday));
        if (plan.day) {
          const total = plan.day.items.reduce((s, i) => s + i.hours, 0);
          out.push("", `Study sessions, ${total}h total`, bullets(plan.day.items.map((i) => `${i.name} ${i.hours}h`)));
        } else if (plan.next) {
          const total = plan.next.items.reduce((s, i) => s + i.hours, 0);
          const when = start.getTime() > day.getTime() ? `The plan starts on ${label(plan.next.date)}` : `Next study day ${label(plan.next.date)}`;
          out.push("", `No study session today. ${when}, ${total}h total`, bullets(plan.next.items.map((i) => `${i.name} ${i.hours}h`)));
        } else {
          out.push("", "No study session today.");
        }
        if (plan.short.length) {
          out.push("", `Not enough time. ${plan.short.map((s) => `${s.name} is ${s.hours}h short`).join(", ")}. Add study days, raise hours per day or hours per weekday, or lower the hours needed.`);
        }
        const upcoming = plan.exams
          .filter((e) => e.date.getTime() >= day.getTime())
          .sort((x, y) => x.date.getTime() - y.date.getTime());
        if (upcoming.length) {
          const e = upcoming[0];
          nextExam = { name: e.name, date: e.date, left: Math.round((e.date.getTime() - day.getTime()) / DAY_MS) };
        }
      }

      const due: { topic: string; date: Date; n: number; late: number }[] = [];
      const next: { topic: string; date: Date; n: number }[] = [];
      for (const r of reviews) {
        const first = r.first_study_date ? parseDate(r.first_study_date) : day;
        const exam = r.exam_date ? parseDate(r.exam_date) : undefined;
        const rows = spacedDates(first, a.intervals_days, exam).filter((row) => !row.skipped);
        let added = false;
        rows.forEach((row, i) => {
          if (row.date.getTime() <= day.getTime()) {
            due.push({ topic: r.topic, date: row.date, n: i + 1, late: Math.round((day.getTime() - row.date.getTime()) / DAY_MS) });
          } else if (!added) {
            next.push({ topic: r.topic, date: row.date, n: i + 1 });
            added = true;
          }
        });
      }
      const onTime = due.filter((d) => d.late === 0);
      const late = due.filter((d) => d.late > 0);
      if (onTime.length) out.push("", "Reviews due today", bullets(onTime.map((d) => `${d.topic}, ${ordinal(d.n)} review`)));
      if (late.length) out.push("", "Reviews to catch up", bullets(late.map((d) => `${d.topic}, ${ordinal(d.n)} review, ${d.late} ${d.late === 1 ? "day" : "days"} late (due ${fmt(d.date)})`)));
      if (next.length) out.push("", "Next reviews", bullets(next.map((n) => `${n.topic} on ${label(n.date)}, ${ordinal(n.n)} review`)));

      if (!exams.length && !reviews.length) {
        out.push("", "Nothing to show. Pass exams with their dates, or reviews with the day you first studied each topic.");
      }
      if (nextExam) {
        const left = nextExam.left > 0 ? `, ${nextExam.left} days left` : ", today";
        out.push("", `Next exam: ${nextExam.name} on ${label(nextExam.date)}${left}.`);
      }
      return out.join("\n");
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
    "Build a day by day study plan for one or more exams. Give each exam date and the hours you have per day, or set different hours for each weekday with hours_per_weekday, and get dated study sessions split by urgency, with a warning when the hours do not fit. Example prompt: \"Plan 3 weeks of study for my 4 exams, 90 minutes a day.\"",
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
