import { z } from "zod";
import { type ToolDef, bullets } from "./core/tools.js";
import { studyPlanIcs } from "./ics.js";
import { DAY_MS, fmt, label, parseDateInput, today } from "./dates.js";

function parseTime(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`"${s}" is not a time. Use HH:MM, like 09:00.`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`"${s}" is not a real time of day.`);
  return h * 60 + min;
}
function clock(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
import { examCountdown, milestones, nextReview, planForDay, plannedReviews, pomodoro, spacedDates, studyPlan, weekdayHours, weekdayIndex } from "./plan.js";

type Api = null;

function textField(name: string, example = "Math") {
  return z.string({
    error: (iss) =>
      iss.input === undefined
        ? `${name} is required; try ${name}: "${example}"`
        : `${name} must be text, got "${iss.input}"; try ${name}: "${example}"`,
  });
}

/** The forms of a date the tools take, named in every description of a date. */
const DATE_HINT = "Use 2026-12-12, or plain text like Dec 12, next Friday or in 3 weeks.";

function dateField(name: string, example = "2026-11-14") {
  return z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? `${name} is required; try ${name}: "${example}"`
          : `${name} must be YYYY-MM-DD or plain text, got "${iss.input}"; try ${example}`,
    })
    .superRefine((value, ctx) => {
      try {
        parseDateInput(value);
      } catch (err) {
        ctx.addIssue({
          code: "custom",
          message: `${name} must be a date, got "${value}". ${(err as Error).message}`,
        });
      }
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

const topicItem = z.object({
  name: textField("name", "Routing").describe("Name of the topic inside the exam."),
  hours_needed: numberField("hours_needed", 4, 0).optional().describe("Study hours for this topic. Leave it out to split the exam hours evenly over the topics."),
});

const examItem = z.object({
  name: textField("name", "Networking"),
  date: dateField("exam_date").describe(`Date of the exam. ${DATE_HINT}`),
  hours_needed: numberField("hours_needed", 10, 0).optional().describe("Study hours you want to put in. Defaults to 10."),
  topics: z
    .array(topicItem, {
      error: (iss) =>
        iss.input === undefined
          ? 'topics is required; try topics: [{name: "Routing", hours_needed: 4}]'
          : 'topics must be a list of topics; try topics: [{name: "Routing", hours_needed: 4}]',
    })
    .optional()
    .describe("Topics of the exam with their own hours, so the plan can say which topic to study on each day."),
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
      .describe("Exams with name, date, optional hours needed and optional topics with their own hours."),
    hours_per_day: hoursPerDay(),
    hours_per_weekday: hoursPerWeekday(),
    days_off: daysOff(),
    start_date: dateField("start_date").optional().describe(`First day to study. Defaults to today. ${DATE_HINT}`),
  };
}

/** The arguments the review tools take, kept in one place so they never drift apart. */
function reviewFields() {
  return {
    topic: textField("topic", "Routing").describe("Topic you studied."),
    first_study_date: dateField("first_study_date").optional().describe(`The day you first studied it. Defaults to today. ${DATE_HINT}`),
    intervals_days: z
      .array(numberField("intervals_days", 7, 0, undefined, true), {
        error: (iss) =>
          iss.input === undefined
            ? "intervals_days is required; try intervals_days: [1, 3, 7, 14, 30]"
            : "intervals_days must be a list of whole days; try intervals_days: [1, 3, 7, 14, 30]",
      })
      .default([1, 3, 7, 14, 30])
      .describe("Days after the first study to review."),
    exam_date: dateField("exam_date").optional().describe(`Exam date, if any. Reviews on or after it are skipped. ${DATE_HINT}`),
  };
}

function planReviewFields() {
  return {
    reviews: z
      .array(
        z.object({
          topic: textField("topic", "Routing"),
          first_study_date: dateField("first_study_date").optional().describe(`The day you first studied it. Defaults to the plan start date. ${DATE_HINT}`),
          exam_date: dateField("exam_date").optional().describe(`Exam date, if any. Reviews on or after it are skipped. ${DATE_HINT}`),
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

/** "today", "in 3 days" or "5 days ago", for a date compared with the day you ask about. */
function relative(from: Date, date: Date): string {
  const days = Math.round((date.getTime() - from.getTime()) / DAY_MS);
  if (days === 0) return "today";
  if (days > 0) return `in ${days} ${days === 1 ? "day" : "days"}`;
  const past = -days;
  return `${past} ${past === 1 ? "day" : "days"} ago`;
}

/** The topic lines under a study day, one line for each exam that has topics. */
function dayTopicLines(items: { name: string; topics?: { name: string; hours: number }[] }[]): string[] {
  const lines: string[] = [];
  for (const item of items) {
    if (!item.topics || item.topics.length === 0) continue;
    lines.push(`  - ${item.name}: ${item.topics.map((t) => `${t.name} ${t.hours}h`).join(", ")}`);
  }
  return lines;
}

/** The topic lines under one exam of a day. */
function itemTopicLines(item: { name: string; hours: number; topics?: { name: string; hours: number }[] }): string[] {
  if (!item.topics || item.topics.length === 0) return [];
  return [`  - ${item.topics.map((t) => `${t.name} ${t.hours}h`).join(", ")}`];
}

const core: ToolDef<Api>[] = [
  {
    name: "make_study_plan",
    title: "Make a study plan",
    description:
      "Build a day by day study plan for one or more exams. Daily hours are shared across exams by urgency, study stops the day before each exam, and the answer warns when there is not enough time. Set hours_per_weekday when your weekdays and your weekend differ, and give an exam topics with their own hours to get the topic of each day as well. Add reviews with the day you first studied each one to show Review: entries in the plan and in the calendar. Dates can be plain text, like Dec 12 or in 3 weeks. Example prompt: \"Plan 3 weeks of study for my 4 exams, 90 minutes a day.\"",
    inputSchema: { ...planFields(), ...planReviewFields() },
    run: async (a) => {
      const start = a.start_date ? parseDateInput(a.start_date) : today();
      const plan = studyPlan(a.exams, start, a.hours_per_day, a.days_off.map(weekdayIndex), weekdayHours(a.hours_per_weekday));
      const reviews = a.reviews?.length ? plannedReviews(a.reviews, a.intervals_days, start) : [];
      if (reviews.length) (plan as any).reviews = reviews;
      const lines = plan.days.map((d) => {
        const head = `${label(d.date)}  ${d.items.map((i) => `${i.name} ${i.hours}h`).join(", ")}  (${d.items.reduce((s, i) => s + i.hours, 0)}h total)`;
        return [head, ...dayTopicLines(d.items)].join("\n");
      });
      const reviewLines = reviews
        .filter((r) => plan.days.some((d) => d.date.getTime() === r.date.getTime()))
        .map((r) => {
          const examForReview = r.exam ? plan.exams.find((e) => e.date.getTime() === r.exam?.getTime()) : undefined;
          const examLine = examForReview ? ` for ${examForReview.name}, exam ${label(examForReview.date)}` : "";
          return `- ${label(r.date)}  Review: ${r.topic}, ${ordinal(r.number)} review${examLine}`;
        });
      const exams = plan.exams.map((e) => {
        const head = `${e.name} on ${label(e.date)}, ${e.need}h planned`;
        if (!e.topics || e.topics.length === 0) return head;
        return [head, ...e.topics.map((t) => `  - ${t.name} ${t.need}h planned`)].join("\n");
      });
      let out = `Exams\n${bullets(exams)}\n\nPlan from ${fmt(start)}\n${bullets(lines)}`;
      if (reviewLines.length) {
        out += `\n\nReviews\n${bullets(reviewLines)}`;
      }
      if (plan.short.length) {
        const short = plan.short.map((s) => {
          const head = `${s.name} is ${s.hours}h short`;
          if (!s.topics || s.topics.length === 0) return head;
          return `${head}: ${s.topics.map((t) => `${t.name} ${t.hours}h short`).join(", ")}`;
        });
        out += `\n\nNot enough time. ${short.join(", ")}. Add study days, raise hours per day or hours per weekday, or lower the hours needed.`;
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
      "List spaced repetition review dates for a topic at expanding intervals, so you revisit it just before you would forget it. Dates on or after the exam are marked to skip. Dates can be plain text, like Dec 12 or in 3 weeks. Example prompt: \"When should I review what I learned today for my exam on 2026-11-30?\"",
    inputSchema: reviewFields(),
    run: async (a) => {
      const first = a.first_study_date ? parseDateInput(a.first_study_date) : today();
      const exam = a.exam_date ? parseDateInput(a.exam_date) : undefined;
      const rows = spacedDates(first, a.intervals_days, exam);
      const lines = rows.map((r) => `Day ${r.day}, ${label(r.date)}${r.skipped ? " (after the exam, skip)" : ""}`);
      return `Review "${a.topic}" starting from ${label(first)}\n${bullets(lines)}`;
    },
  },
  {
    name: "next_review_dates",
    title: "Next review date",
    description:
      "Give the date of the next review for one topic, so you get a single date instead of the whole schedule. It is the first review that is not on or after the exam and has not passed yet, counting from the day you first studied it. The answer counts the reviews that already passed. Use make_spaced_repetition_schedule when you want every review date. Dates can be plain text, like Dec 12 or in 3 weeks. Example prompt: \"When should I review the routing I studied on 2026-11-01 for my exam on 2026-11-30?\"",
    inputSchema: {
      ...reviewFields(),
      from_date: dateField("from_date").optional().describe(`The day to count from. Defaults to today. Reviews before it have passed. ${DATE_HINT}`),
    },
    run: async (a) => {
      if (a.intervals_days.length === 0) throw new Error("Give intervals_days at least one number of days.");
      const first = a.first_study_date ? parseDateInput(a.first_study_date) : today();
      const exam = a.exam_date ? parseDateInput(a.exam_date) : undefined;
      const from = a.from_date ? parseDateInput(a.from_date) : today();
      const r = nextReview(first, a.intervals_days, exam, from);
      const out: string[] = [];
      if (r.date) {
        out.push(`Next review for "${a.topic}": ${label(r.date)}, the ${ordinal(r.number ?? 1)} review, ${relative(from, r.date)}.`);
      } else if (r.passed.length) {
        const last = r.passed[r.passed.length - 1];
        out.push(`No review left for "${a.topic}". The last one was on ${label(last)}, ${relative(from, last)}.`);
      } else if (exam) {
        out.push(`No review left for "${a.topic}" before the exam on ${label(exam)}.`);
      } else {
        out.push(`No review left for "${a.topic}".`);
      }
      if (r.passed.length) out.push(`${r.passed.length} ${r.passed.length === 1 ? "review has" : "reviews have"} passed.`);
      return out.join("\n");
    },
  },
  {
    name: "pomodoro_plan",
    title: "Pomodoro plan",
    description:
      "Plan pomodoro sessions: a work and break schedule for a total amount of study time, with a long break after a set number of sessions. Give start_time, like 09:00, to get clock times for each block. Example prompt: \"Plan 3 hours of studying as pomodoro blocks with breaks.\"",
    inputSchema: {
      total_minutes: numberField("total_minutes", 75, 0, 1440, true).describe("Total study time in minutes."),
      work_minutes: numberField("work_minutes", 25, 0, undefined, true).default(25).describe("Work block length in minutes."),
      short_break_minutes: numberField("short_break_minutes", 5, 0, undefined, true).default(5).describe("Short break length in minutes."),
      long_break_minutes: numberField("long_break_minutes", 15, 0, undefined, true).default(15).describe("Long break length in minutes."),
       sessions_before_long_break: numberField("sessions_before_long_break", 4, 0, undefined, true).default(4).describe("Work sessions before a long break."),
       start_time: textField("start_time", "09:00").optional().describe("Clock time the first block starts, like 09:00. Leave it out to list the blocks as minutes from the start."),
     },
     run: async (a) => {
       const r = pomodoro(a.total_minutes, a.work_minutes, a.short_break_minutes, a.long_break_minutes, a.sessions_before_long_break);
       // with no start_time the blocks keep their old wording, minutes from the start; a start_time turns them into clock times
       const startMinutes = a.start_time ? parseTime(a.start_time) : null;
       let t = 0;
       const lines = r.steps.map((s) => {
         const from = t;
         t += s.minutes;
         const to = t;
         return startMinutes === null ? `${from}-${to} min, ${s.kind} (${s.minutes} min)` : `${clock(startMinutes + from)}-${clock(startMinutes + to)} ${s.kind} (${s.minutes} min)`;
       });
       return `${r.sessions} work sessions\n${bullets(lines)}\n\nTotal time with breaks is ${t} minutes.`;
     },
  },
  {
    name: "assignment_milestones",
    title: "Assignment milestones",
    description:
      "List dated milestones that split a big assignment into steps between a start date and the due date. Dates can be plain text, like Dec 12 or in 3 weeks. Example prompt: \"Break my 6 hour essay due 2026-11-20 into milestones.\"",
    inputSchema: {
      title: textField("title", "Essay").describe("Assignment name."),
      due_date: dateField("due_date").describe(`Due date. ${DATE_HINT}`),
      estimated_hours: numberField("estimated_hours", 6, 0).describe("Estimated total hours."),
      start_date: dateField("start_date").optional().describe(`Defaults to today. ${DATE_HINT}`),
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
      const start = a.start_date ? parseDateInput(a.start_date) : today();
      const steps = a.steps ?? [{ name: "Research", share: 25 }, { name: "Outline", share: 10 }, { name: "First draft", share: 35 }, { name: "Revise", share: 20 }, { name: "Proofread and submit", share: 10 }];
      const rows = milestones(start, parseDateInput(a.due_date), a.estimated_hours, steps);
      return `${a.title}, due ${label(parseDateInput(a.due_date))}, about ${a.estimated_hours}h of work\n${bullets(rows.map((r) => `Finish by ${label(r.date)}, ${r.name} (${r.hours}h)`))}`;
    },
  },
  {
    name: "export_study_plan_ics",
    title: "Export study plan as ICS",
    description:
      "Turn a study plan into an .ics calendar file to import into Google Calendar or Apple Calendar. It builds the same plan as build_study_plan, with the same hours_per_weekday if you set one, and answers with the whole file, so save the answer as plan.ics and open it. Every study session becomes an all day event that shows as free, with the topics of the session in its description when the exam has topics, and every exam becomes an all day event that shows as busy unless include_exams is false. Add reviews with the day you first studied each one to add Review: all day events to the calendar. Dates can be plain text, like Dec 12 or in 3 weeks. Example prompt: \"Export my plan for a networking exam on 2026-12-12, 6 hours, starting 2026-12-07, as an ICS file.\"",
    inputSchema: {
      ...planFields(),
      ...planReviewFields(),
      include_exams: z
        .boolean()
        .default(true)
        .describe("Also add an all day event on each exam day. Set false for study sessions only."),
    },
    run: async (a) => {
      const start = a.start_date ? parseDateInput(a.start_date) : today();
      const plan = studyPlan(a.exams, start, a.hours_per_day, a.days_off.map(weekdayIndex), weekdayHours(a.hours_per_weekday));
      if (a.reviews?.length) {
        (plan as any).reviews = plannedReviews(a.reviews, a.intervals_days, start);
      }
      return studyPlanIcs(plan, { includeExams: a.include_exams });
    },
  },
  {
    name: "what_to_study_today",
    title: "What to study today",
    description:
      "Answer what to study on one day in a single call: the study sessions your plan gives for that day, with the topic of each session when the exams have topics, plus the spaced repetition reviews that are due that day or are late. Give the same exams and hours you use in build_study_plan, including hours_per_weekday, and the topics you are reviewing with the day you first studied each one. Leave date out and it uses today's date. Dates can be plain text, like Dec 12 or in 3 weeks. Example prompt: \"What should I study today? I have a networking exam on 2026-12-12 and I studied routing on 2026-11-27.\"",
    inputSchema: {
      date: dateField("date").optional().describe(`The day to show. Defaults to today. ${DATE_HINT}`),
      exams: examList(false).optional().describe("Exams with name, date and optional hours needed. Leave it out to show reviews only."),
      hours_per_day: hoursPerDay(),
      hours_per_weekday: hoursPerWeekday(),
      days_off: daysOff(),
      start_date: dateField("start_date").optional().describe(`First day of the plan. Defaults to the day you are asking about. ${DATE_HINT}`),
      reviews: z
        .array(
          z.object({
            topic: textField("topic", "Routing"),
            first_study_date: dateField("first_study_date").optional().describe(`The day you first studied it. Defaults to the day you are asking about. ${DATE_HINT}`),
            exam_date: dateField("exam_date").optional().describe(`Exam date, if any. Reviews on or after it are skipped. ${DATE_HINT}`),
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
      const day = a.date ? parseDateInput(a.date) : today();
      const start = a.start_date ? parseDateInput(a.start_date) : day;
      const exams = a.exams ?? [];
      const reviews = a.reviews ?? [];
      const out: string[] = [`Today ${label(day)}`];

      let nextExam: { name: string; date: Date; left: number } | undefined;
      if (exams.length) {
        const plan = planForDay(exams, start, day, a.hours_per_day, a.days_off.map(weekdayIndex), weekdayHours(a.hours_per_weekday));
        if (plan.day) {
          const total = plan.day.items.reduce((s, i) => s + i.hours, 0);
          out.push("", `Study sessions, ${total}h total`, bullets(plan.day.items.map((i) => [i.name + " " + i.hours + "h", ...itemTopicLines(i)].join("\n"))));
        } else if (plan.next) {
          const total = plan.next.items.reduce((s, i) => s + i.hours, 0);
          const when = start.getTime() > day.getTime() ? `The plan starts on ${label(plan.next.date)}` : `Next study day ${label(plan.next.date)}`;
          out.push("", `No study session today. ${when}, ${total}h total`, bullets(plan.next.items.map((i) => [i.name + " " + i.hours + "h", ...itemTopicLines(i)].join("\n"))));
        } else {
          out.push("", "No study session today.");
        }
        if (plan.short.length) {
          const short = plan.short.map((s) => {
            const head = `${s.name} is ${s.hours}h short`;
            if (!s.topics || s.topics.length === 0) return head;
            return `${head}: ${s.topics.map((t) => `${t.name} ${t.hours}h short`).join(", ")}`;
          });
          out.push("", `Not enough time. ${short.join(", ")}. Add study days, raise hours per day or hours per weekday, or lower the hours needed.`);
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
        const first = r.first_study_date ? parseDateInput(r.first_study_date) : day;
        const exam = r.exam_date ? parseDateInput(r.exam_date) : undefined;
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
  {
    name: "exam_countdown",
    title: "Exam countdown",
    description:
      "Check whether you are on track for each exam. For every exam it gives the days left, the study days left, the hours still to study, the hours to put in on each study day and a plain On track or Behind verdict, using the same hours per day, hours per weekday and days off as the plan tools. Give from_date to count from a fixed day. Dates can be plain text, like Dec 12 or in 3 weeks. Example prompt: \"Am I on track for my exam on 2026-12-12 if I can study 2 hours a day?\"",
    inputSchema: {
      exams: examList(true)
        .min(1, { error: `exams must have at least 1 exam; ${EXAM_HINT}` })
        .describe("Exams with name, date, optional hours needed and optional topics with their own hours."),
      hours_per_day: hoursPerDay(),
      hours_per_weekday: hoursPerWeekday(),
      days_off: daysOff(),
      from_date: dateField("from_date").optional().describe(`The day to count from. Defaults to today. ${DATE_HINT}`),
    },
    run: async (a) => {
      const from = a.from_date ? parseDateInput(a.from_date) : today();
      const rows = examCountdown(a.exams, from, a.hours_per_day, a.days_off.map(weekdayIndex), weekdayHours(a.hours_per_weekday));
      const blocks = rows.map((r) => {
        const lines = [`${r.days_left} ${r.days_left === 1 ? "day" : "days"} left, ${r.study_days_left} ${r.study_days_left === 1 ? "study day" : "study days"} left`];
        if (r.study_days_left > 0) lines.push(`${r.hours_needed}h still needed, ${r.hours_per_study_day}h per study day`);
        else lines.push(`${r.hours_needed}h still needed, and no study days left`);
        const verdict = r.passed
          ? "Behind: the exam date has passed."
          : r.on_track
            ? `On track: ${r.hours_needed}h fits in ${r.study_days_left} study days at your hours.`
            : `Behind by ${r.hours_short}h: your study days give ${Math.round((r.hours_needed - r.hours_short) * 10) / 10}h before the exam.`;
        lines.push(verdict);
        const topics = r.topics?.map((t) => `${t.name} ${t.need}h needed${t.hours_short > 0 ? `, ${t.hours_short}h short` : ""}`).join(", ");
        return `${r.name}, exam ${label(r.date)}\n${bullets(lines)}${topics ? `\n  - ${topics}` : ""}`;
      });
      return `Exam countdown from ${label(from)}\n\n${blocks.join("\n\n")}`;
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
    "Build a day by day study plan for one or more exams. Give each exam date and the hours you have per day, or set different hours for each weekday with hours_per_weekday, and get dated study sessions split by urgency, with a warning when the hours do not fit. Give an exam topics with their own hours and the plan names the topic of each day. Add reviews with the day you first studied each one to show Review: entries in the plan and in the calendar. Dates can be plain text, like Dec 12 or in 3 weeks. Example prompt: \"Plan 3 weeks of study for my 4 exams, 90 minutes a day.\"",
  ),
  alias(
    "spaced_repetition_dates",
    "make_spaced_repetition_schedule",
    "Make a spaced repetition schedule",
    "Make a spaced repetition schedule for a topic: every review date at expanding intervals from the day you first studied it, with any date on or after the exam marked to skip. Use next_review_dates when you want the next review date only. Dates can be plain text, like Dec 12 or in 3 weeks. Example prompt: \"When should I review what I learned today for my exam on 2026-11-30?\"",
  ),
  alias(
    "pomodoro_plan",
    "plan_pomodoro_sessions",
    "Plan pomodoro sessions",
    "Plan pomodoro sessions for a total amount of study time: work blocks separated by short breaks, with a long break after a set number of sessions. Give start_time, like 09:00, to get clock times for each block. Example prompt: \"Plan 3 hours of studying as pomodoro blocks with breaks.\"",
  ),
  alias(
    "assignment_milestones",
    "list_assignment_milestones",
    "List assignment milestones",
    "List dated milestones that split a big assignment from a start date to the due date, with default steps for research, outline, draft, revise and proofread. Dates can be plain text, like Dec 12 or in 3 weeks. Example prompt: \"Break my 6 hour essay due 2026-11-20 into milestones.\"",
  ),
];
