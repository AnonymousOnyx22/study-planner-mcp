export const DAY_MS = 86400000;
const NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`"${s}" is not a date. Use YYYY-MM-DD, try 2026-12-12.`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1) throw new Error(`"${s}" is not a real calendar date; try 2026-11-14.`);
  return d;
}

export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function label(d: Date): string {
  return `${fmt(d)} ${NAMES[d.getUTCDay()]}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function today(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

export function weekdayIndex(name: string): number {
  const i = NAMES.indexOf(name.slice(0, 3).toLowerCase());
  if (i < 0) throw new Error(`"${name}" is not a weekday. Use names like mon, tue or sunday.`);
  return i;
}

const HALF = (n: number) => Math.round(n * 2) / 2;

export interface ExamInput {
  name: string;
  date: string;
  hours_needed?: number;
}

export interface DayPlan {
  date: Date;
  items: { name: string; hours: number }[];
}

export function studyPlan(exams: ExamInput[], startDate: Date, hoursPerDay: number, daysOff: number[]) {
  if (exams.length === 0) throw new Error("Add at least one exam.");
  const work = exams.map((e) => ({
    name: e.name,
    exam: parseDate(e.date),
    need: e.hours_needed ?? 10,
    left: e.hours_needed ?? 10,
  }));
  for (const w of work) {
    if (w.exam.getTime() <= startDate.getTime()) throw new Error(`${w.name} is on ${fmt(w.exam)}, which is not after the start date ${fmt(startDate)}.`);
  }
  const last = new Date(Math.max(...work.map((w) => w.exam.getTime())));
  const days: DayPlan[] = [];
  for (let d = startDate; d.getTime() < last.getTime(); d = addDays(d, 1)) {
    if (daysOff.includes(d.getUTCDay())) continue;
    const active = work.filter((w) => w.left > 0 && w.exam.getTime() > d.getTime());
    if (active.length === 0) continue;
    const urgency = active.map((w) => {
      const daysLeft = Math.max(1, Math.round((w.exam.getTime() - d.getTime()) / DAY_MS));
      return { w, u: w.left / daysLeft };
    });
    const total = urgency.reduce((s, x) => s + x.u, 0);
    let capacity = hoursPerDay;
    const alloc = new Map<string, number>();
    for (const x of urgency.sort((a, b) => b.u - a.u)) {
      const share = Math.min(x.w.left, HALF((x.u / total) * hoursPerDay));
      const give = Math.min(share, capacity);
      alloc.set(x.w.name, give);
      capacity -= give;
    }
    // hand any leftover half hours to the most urgent exams that still need time
    for (const x of urgency) {
      if (capacity <= 0) break;
      const have = alloc.get(x.w.name) ?? 0;
      const more = Math.min(x.w.left - have, capacity);
      if (more > 0) {
        alloc.set(x.w.name, have + more);
        capacity -= more;
      }
    }
    const items: DayPlan["items"] = [];
    for (const w of active) {
      const h = alloc.get(w.name) ?? 0;
      if (h > 0) {
        w.left -= h;
        items.push({ name: w.name, hours: h });
      }
    }
    if (items.length) days.push({ date: d, items });
  }
  const short = work.filter((w) => w.left > 0.001).map((w) => ({ name: w.name, hours: HALF(w.left) }));
  return { days, short, exams: work.map((w) => ({ name: w.name, date: w.exam, need: w.need })) };
}

export interface PlanDay {
  /** The plan day that falls on the date you asked about, if there is one. */
  day?: DayPlan;
  /** The first study day after that date, if there is one. */
  next?: DayPlan;
  /** Exams whose hours did not fit in the plan. */
  short: { name: string; hours: number }[];
  /** Every exam in the plan with its date and its planned hours. */
  exams: { name: string; date: Date; need: number }[];
}

/** Pick one day out of a study plan, plus the next study day after it. */
export function planForDay(exams: ExamInput[], startDate: Date, target: Date, hoursPerDay: number, daysOff: number[]): PlanDay {
  const plan = studyPlan(exams, startDate, hoursPerDay, daysOff);
  const key = fmt(target);
  return {
    day: plan.days.find((d) => fmt(d.date) === key),
    next: plan.days.find((d) => d.date.getTime() > target.getTime()),
    short: plan.short,
    exams: plan.exams,
  };
}

export function spacedDates(first: Date, intervals: number[], examDate?: Date): { date: Date; day: number; skipped: boolean }[] {
  return intervals.map((n) => {
    const date = addDays(first, n);
    return { date, day: n, skipped: examDate ? date.getTime() >= examDate.getTime() : false };
  });
}

export function pomodoro(total: number, work: number, shortBreak: number, longBreak: number, before: number) {
  if (total < 1) throw new Error("Give at least 1 minute of study time.");
  const steps: { kind: "work" | "short break" | "long break"; minutes: number }[] = [];
  let left = total;
  let n = 0;
  while (left > 0) {
    const m = Math.min(work, left);
    steps.push({ kind: "work", minutes: m });
    left -= m;
    n++;
    if (left > 0) steps.push(n % before === 0 ? { kind: "long break", minutes: longBreak } : { kind: "short break", minutes: shortBreak });
  }
  return { steps, sessions: n };
}

export function milestones(start: Date, due: Date, hours: number, steps: { name: string; share: number }[]) {
  if (due.getTime() <= start.getTime()) throw new Error(`The due date ${fmt(due)} must be after the start date ${fmt(start)}.`);
  const totalShare = steps.reduce((s, x) => s + x.share, 0);
  const span = due.getTime() - start.getTime();
  let acc = 0;
  return steps.map((s, i) => {
    acc += s.share;
    const raw = start.getTime() + (acc / totalShare) * span;
    const date = i === steps.length - 1 ? addDays(due, -1) : new Date(Math.floor(raw / DAY_MS) * DAY_MS);
    return { name: s.name, hours: HALF((s.share / totalShare) * hours), date: date.getTime() < start.getTime() ? start : date };
  });
}
