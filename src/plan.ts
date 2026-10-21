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
  topics?: TopicInput[];
}

/** A topic inside an exam, with the hours you want to spend on it. */
export interface TopicInput {
  name: string;
  hours_needed?: number;
}

/** Study hours for one weekday, the way a caller gives them. */
export interface WeekdayHoursInput {
  /** Weekday name, like mon, tue, sat or sunday. */
  day: string;
  /** Study hours on that weekday. */
  hours: number;
}

/** Study hours per weekday, indexed like Date.getUTCDay: 0 is sunday, 6 is saturday. */
export type WeekdayHours = number[];

/** Turn the weekday hours a caller gives into a list indexed like Date.getUTCDay. */
export function weekdayHours(list?: WeekdayHoursInput[]): WeekdayHours | undefined {
  if (!list || list.length === 0) return undefined;
  const hours: WeekdayHours = [];
  for (const item of list) {
    const i = weekdayIndex(item.day);
    if (hours[i] !== undefined) throw new Error(`You gave hours for ${item.day} twice. Give each weekday once.`);
    if (!(item.hours >= 0)) throw new Error(`The hours for ${item.day} must be 0 or more, got ${item.hours}.`);
    hours[i] = item.hours;
  }
  return hours;
}

/** A topic of an exam with the hours it needs and the hours it still needs. */
export interface TopicWork {
  name: string;
  need: number;
  left: number;
}

/**
 * Work out the hours of each topic of an exam, and the hours the exam needs in total.
 * Topics that carry their own hours set the total on their own. When the exam has hours
 * and some topics do not, the exam hours are split evenly over the topics that are left.
 */
export function topicPlan(exam: ExamInput): { topics: TopicWork[]; need: number } | undefined {
  const list = exam.topics ?? [];
  if (list.length === 0) return undefined;
  const seen = new Set<string>();
  for (const t of list) {
    const key = t.name.trim().toLowerCase();
    if (seen.has(key)) throw new Error(`The exam ${exam.name} has the topic ${t.name} twice. Give each topic once.`);
    seen.add(key);
  }
  const withHours = list.filter((t) => t.hours_needed !== undefined);
  const without = list.filter((t) => t.hours_needed === undefined);
  const sum = withHours.reduce((s, t) => s + (t.hours_needed ?? 0), 0);
  let need: number;
  if (exam.hours_needed !== undefined) {
    need = exam.hours_needed;
    if (without.length === 0 && Math.abs(sum - need) > 0.001) {
      throw new Error(`The exam ${exam.name} needs ${need}h but its topics add up to ${sum}h. Make the exam hours match the topics, or leave hours_needed out of the exam.`);
    }
    if (without.length > 0 && sum > need) {
      throw new Error(`The topics of ${exam.name} add up to more than the ${need}h of the exam. Lower the hours of the topics that have them, or raise the hours of the exam.`);
    }
    if (without.length > 0 && sum === need) {
      throw new Error(`The topics of ${exam.name} already use all ${need}h of the exam. Give hours to every topic, or raise the hours of the exam.`);
    }
  } else if (without.length === 0) {
    need = sum;
  } else {
    throw new Error(`Give hours for every topic of ${exam.name}, or give hours_needed on the exam to split the hours evenly over the topics.`);
  }
  const extra = new Map<string, number>();
  if (without.length > 0) {
    const units = Math.round((need - sum) * 2);
    const each = Math.floor(units / without.length);
    let left = units - each * without.length;
    for (const t of without) {
      const u = each + (left > 0 ? 1 : 0);
      if (left > 0) left--;
      extra.set(t.name, u / 2);
    }
  }
  const topics = list.map((t) => {
    const hours = t.hours_needed !== undefined ? t.hours_needed : extra.get(t.name) ?? 0;
    return { name: t.name, need: hours, left: hours };
  });
  return { topics, need };
}

/**
 * Split the hours of one day between the topics of an exam, in proportion to the hours
 * each topic still needs. The hours come back in half hour steps and add up to the hours given.
 */
export function splitTopicHours(topics: { name: string; left: number }[], hours: number): { name: string; hours: number }[] {
  const active = topics.filter((t) => t.left > 0.001);
  if (active.length === 0 || hours <= 0) return [];
  const units = Math.round(hours * 2);
  const total = active.reduce((s, t) => s + t.left, 0);
  const parts = active.map((t) => {
    const share = (units * t.left) / total;
    const u = Math.floor(share);
    return { name: t.name, u, frac: share - u, cap: Math.ceil(t.left * 2), left: t.left };
  });
  let left = units - parts.reduce((s, p) => s + p.u, 0);
  const order = [...parts].sort((a, b) => b.frac - a.frac || b.left - a.left);
  let moved = true;
  while (left > 0 && moved) {
    moved = false;
    for (const p of order) {
      if (left <= 0) break;
      if (p.u < p.cap) {
        p.u++;
        left--;
        moved = true;
      }
    }
  }
  if (left > 0) {
    order[0].u += left;
    left = 0;
  }
  return parts.filter((p) => p.u > 0).map((p) => ({ name: p.name, hours: p.u / 2 }));
}

export interface DayPlan {
  date: Date;
  items: { name: string; hours: number; topics?: { name: string; hours: number }[] }[];
}

/**
 * Build a study plan. Each day gets the hours of its weekday when the caller set them,
 * and hoursPerDay on every other weekday. A weekday with 0 hours is a day off.
 * An exam with topics gives part of every study day to each topic.
 */
export function studyPlan(exams: ExamInput[], startDate: Date, hoursPerDay: number, daysOff: number[], weekday?: WeekdayHours): Plan {
  if (exams.length === 0) throw new Error("Add at least one exam.");
  const work = exams.map((e) => {
    const t = topicPlan(e);
    const need = t ? t.need : e.hours_needed ?? 10;
    return { name: e.name, exam: parseDate(e.date), need, left: need, topics: t?.topics };
  });
  for (const w of work) {
    if (w.exam.getTime() <= startDate.getTime()) throw new Error(`${w.name} is on ${fmt(w.exam)}, which is not after the start date ${fmt(startDate)}.`);
  }
  const last = new Date(Math.max(...work.map((w) => w.exam.getTime())));
  const days: DayPlan[] = [];
  for (let d = startDate; d.getTime() < last.getTime(); d = addDays(d, 1)) {
    if (daysOff.includes(d.getUTCDay())) continue;
    const dayHours = weekday?.[d.getUTCDay()] ?? hoursPerDay;
    if (dayHours <= 0) continue;
    const active = work.filter((w) => w.left > 0 && w.exam.getTime() > d.getTime());
    if (active.length === 0) continue;
    const urgency = active.map((w) => {
      const daysLeft = Math.max(1, Math.round((w.exam.getTime() - d.getTime()) / DAY_MS));
      return { w, u: w.left / daysLeft };
    });
    const total = urgency.reduce((s, x) => s + x.u, 0);
    let capacity = dayHours;
    const alloc = new Map<string, number>();
    for (const x of urgency.sort((a, b) => b.u - a.u)) {
      const share = Math.min(x.w.left, HALF((x.u / total) * dayHours));
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
      if (h <= 0) continue;
      if (w.topics) {
        const parts = splitTopicHours(w.topics, h);
        const used = parts.reduce((s, p) => s + p.hours, 0);
        for (const p of parts) {
          const t = w.topics.find((x) => x.name === p.name);
          if (t) t.left -= p.hours;
        }
        w.left -= used;
        if (parts.length) items.push({ name: w.name, hours: used, topics: parts });
      } else {
        w.left -= h;
        items.push({ name: w.name, hours: h });
      }
    }
    if (items.length) days.push({ date: d, items });
  }
  const short: PlanShort[] = [];
  for (const w of work) {
    if (w.left <= 0.001) continue;
    const topics = w.topics?.filter((t) => t.left > 0.001).map((t) => ({ name: t.name, hours: HALF(t.left) }));
    short.push(topics?.length ? { name: w.name, hours: HALF(w.left), topics } : { name: w.name, hours: HALF(w.left) });
  }
  const examsOut: PlanExam[] = work.map((w) => {
    const topics = w.topics?.map((t) => ({ name: t.name, need: t.need }));
    return topics?.length ? { name: w.name, date: w.exam, need: w.need, topics } : { name: w.name, date: w.exam, need: w.need };
  });
  return { days, short, exams: examsOut };
}

/** An exam of a plan with its date and the hours it needs. */
export interface PlanExam {
  name: string;
  date: Date;
  need: number;
  /** The topics of the exam, when the exam has any. */
  topics?: { name: string; need: number }[];
}

/** An exam that did not fit in the plan, with the hours it is short. */
export interface PlanShort {
  name: string;
  hours: number;
  /** The topics of the exam that are still short. */
  topics?: { name: string; hours: number }[];
}

/** A whole study plan. */
export interface Plan {
  days: DayPlan[];
  short: PlanShort[];
  exams: PlanExam[];
}

export interface PlanDay {
  /** The plan day that falls on the date you asked about, if there is one. */
  day?: DayPlan;
  /** The first study day after that date, if there is one. */
  next?: DayPlan;
  /** Exams whose hours did not fit in the plan. */
  short: PlanShort[];
  /** Every exam in the plan with its date and its planned hours. */
  exams: PlanExam[];
}

/** Pick one day out of a study plan, plus the next study day after it. */
export function planForDay(exams: ExamInput[], startDate: Date, target: Date, hoursPerDay: number, daysOff: number[], weekday?: WeekdayHours): PlanDay {
  const plan = studyPlan(exams, startDate, hoursPerDay, daysOff, weekday);
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
