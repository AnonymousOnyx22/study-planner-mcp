/**
 * The date helpers of the server and the reading of a date the way a person writes it.
 */

export const DAY_MS = 86400000;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SHORT_WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/** The forms of a date the server reads, named in every message about a date. */
export const DATE_FORMS = "Use 2026-12-12, or plain text like Dec 12, next Friday or in 3 weeks. Write the month as a name, like Dec 12 2026, when the day comes first.";

export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function label(d: Date): string {
  return `${fmt(d)} ${SHORT_WEEKDAYS[d.getUTCDay()]}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function today(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

/** A date written as YYYY-MM-DD. */
export function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`"${s}" is not a date. Use YYYY-MM-DD, try 2026-12-12.`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1) throw new Error(`"${s}" is not a real calendar date; try 2026-11-14.`);
  return d;
}

/** A date at midnight UTC, built from its parts. */
function makeDate(year: number, month: number, day: number): Date {
  const d = new Date(Date.UTC(2000, month, day));
  d.setUTCFullYear(year);
  return d;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** The number of days in a month of a year. */
function daysInMonth(year: number, month: number): number {
  if (month === 1) return isLeapYear(year) ? 29 : 28;
  return new Date(Date.UTC(2000, month + 1, 0)).getUTCDate();
}

/** True when the year, month and day are a date on the calendar. */
function isRealDate(year: number, month: number, day: number): boolean {
  const d = makeDate(year, month, day);
  return d.getUTCMonth() === month && d.getUTCDate() === day;
}

/** A name with its first letter in capitals, for the messages about names. */
function cap(name: string): string {
  return name.slice(0, 1).toUpperCase() + name.slice(1);
}

/** The month a name stands for, or -1 when the name is not a month. */
function monthOf(token: string): number {
  const hits = MONTHS.map((name, i) => ({ name, i })).filter((m) => m.name.startsWith(token));
  if (hits.length === 1) return hits[0].i;
  if (hits.length > 1) throw new Error(`"${token}" could be ${hits.map((h) => cap(h.name)).join(" or ")}. Write the month out, like ${cap(hits[0].name)}.`);
  return -1;
}

/** The weekday a name stands for, or -1 when the name is not a weekday. */
function weekdayOf(token: string): number {
  const hits = WEEKDAYS.map((name, i) => ({ name, i })).filter((w) => w.name.startsWith(token));
  if (hits.length === 1) return hits[0].i;
  if (hits.length > 1) throw new Error(`"${token}" could be ${hits.map((h) => cap(h.name)).join(" or ")}. Write the weekday out, like ${cap(hits[0].name)}.`);
  return -1;
}

/** The number a word or a set of digits stands for. */
function numberOf(token: string): number | undefined {
  if (/^\d+$/.test(token)) return Number(token);
  return NUMBER_WORDS[token];
}

/** A date the given number of months later, with the day kept inside the month. */
function addMonths(d: Date, n: number): Date {
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + n;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return makeDate(year, month, Math.min(d.getUTCDate(), daysInMonth(year, month)));
}

/** A date the given number of years later, with the day kept inside the month. */
function addYears(d: Date, n: number): Date {
  const year = d.getUTCFullYear() + n;
  const month = d.getUTCMonth();
  return makeDate(year, month, Math.min(d.getUTCDate(), daysInMonth(year, month)));
}

/** A date the given number of days, weeks, months or years away from the day given. */
function shift(from: Date, countText: string, unit: string, sign: number): Date {
  const n = numberOf(countText);
  if (n === undefined) throw new Error(`"${countText}" is not a number of ${unit}s. ${DATE_FORMS}`);
  if (unit === "day") return addDays(from, sign * n);
  if (unit === "week") return addDays(from, sign * 7 * n);
  if (unit === "month") return addMonths(from, sign * n);
  return addYears(from, sign * n);
}

/**
 * Read a date the way a person writes it: 2026-12-12, Dec 12, next Friday, in 3 weeks.
 * A month name without a year means the next one that has not passed yet.
 * The offsets count from the day given, which is today unless another day is passed in.
 */
export function parseDateInput(text: string, from: Date = today()): Date {
  const s = String(text ?? "").trim();
  if (!s) throw new Error(`Give a date. ${DATE_FORMS}`);
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/.exec(s);
  if (iso) return parseDate(iso[1]);
  const low = s.toLowerCase().replace(/[,\s]+/g, " ").trim();

  if (low === "today" || low === "now") return new Date(from.getTime());
  if (low === "tomorrow") return addDays(from, 1);
  if (low === "yesterday") return addDays(from, -1);

  const ahead = /^(?:in\s+)?(\S+)\s+(day|week|month|year)s?(?:\s+from\s+(?:now|today))?$/.exec(low);
  if (ahead) return shift(from, ahead[1], ahead[2], 1);
  const past = /^(\S+)\s+(day|week|month|year)s?\s+ago$/.exec(low);
  if (past) return shift(from, past[1], past[2], -1);

  const monthFirst = /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/.exec(low);
  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/.exec(low);
  if (monthFirst || dayFirst) {
    const m = monthFirst ?? dayFirst!;
    const monthText = monthFirst ? m[1] : m[2];
    const dayText = monthFirst ? m[2] : m[1];
    const month = monthOf(monthText);
    if (month < 0) throw new Error(`"${monthText}" is not a month. ${DATE_FORMS}`);
    const day = Number(dayText);
    if (day < 1 || day > 31) throw new Error(`"${dayText}" is not a day of the month. ${DATE_FORMS}`);
    if (m[3]) {
      const year = Number(m[3]);
      if (!isRealDate(year, month, day)) throw new Error(`There is no ${day} ${cap(MONTHS[month])} in ${year}.`);
      return makeDate(year, month, day);
    }
    const year = from.getUTCFullYear();
    const next = year + 1;
    const here = isRealDate(year, month, day);
    const there = isRealDate(next, month, day);
    if (!here && !there) {
      throw new Error(`There is no ${day} ${cap(MONTHS[month])} in ${year} or ${next}. Write the year, like ${day} ${cap(MONTHS[month])} ${year + 4}.`);
    }
    if (!here) return makeDate(next, month, day);
    const d = makeDate(year, month, day);
    return d.getTime() < from.getTime() ? makeDate(next, month, day) : d;
  }

  const week = /^(?:(this|next|coming|last)\s+)?([a-z]+)$/.exec(low);
  if (week) {
    const day = weekdayOf(week[2]);
    if (day >= 0) {
      const steps = (day - from.getUTCDay() + 7) % 7;
      if (week[1] === "last") return addDays(from, steps === 0 ? -7 : steps - 7);
      if (week[1] === "next") return addDays(from, steps + 7);
      return addDays(from, steps);
    }
  }

  throw new Error(`"${s}" is not a date I can read. ${DATE_FORMS}`);
}
