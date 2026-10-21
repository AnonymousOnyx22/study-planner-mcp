import { addDays, fmt, label, studyPlan } from "./plan.js";

type Plan = ReturnType<typeof studyPlan>;

const CRLF = "\r\n";

/** Escape a text value the way RFC 5545 asks, so commas and semicolons in names survive. */
export function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line to 75 octets, continuing on the next line with a space. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let cur = "";
  let limit = 75;
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, "utf8") > limit) {
      parts.push(cur);
      cur = ch;
      limit = 74; // a continuation line starts with a space, which counts toward the 75
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts.join(CRLF + " ");
}

function compact(date: Date): string {
  return fmt(date).replace(/-/g, "");
}

function stamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`;
}

function slug(text: string): string {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "event";
}

export interface IcsOptions {
  /** Add an all day event on each exam day. Defaults to true. */
  includeExams?: boolean;
  /** Export time, used for DTSTAMP. Defaults to now. */
  now?: Date;
}

interface IcsEvent {
  date: Date;
  base: string;
  summary: string;
  description: string;
  busy: boolean;
}

/** Write a study plan as an .ics calendar file: one all day event per study session and one per exam. */
export function studyPlanIcs(plan: Plan, opts: IcsOptions = {}): string {
  const exams = new Map(plan.exams.map((e) => [e.name, e]));
  const events: IcsEvent[] = [];
  for (const day of plan.days) {
    const total = day.items.reduce((s, i) => s + i.hours, 0);
    for (const item of day.items) {
      const bits = [`${item.name}, ${item.hours}h of study.`];
      if (item.topics && item.topics.length > 0) {
        bits.push(`Topics: ${item.topics.map((t) => `${t.name} ${t.hours}h`).join(", ")}.`);
      }
      bits.push(`Day total ${total}h.`);
      const exam = exams.get(item.name);
      if (exam) bits.push(`Exam on ${label(exam.date)}.`);
      events.push({
        date: day.date,
        base: `${fmt(day.date)}-${slug(item.name)}-study`,
        summary: `Study: ${item.name} ${item.hours}h`,
        description: bits.join(" "),
        busy: false,
      });
    }
  }
  if (opts.includeExams !== false) {
    for (const e of plan.exams) {
      events.push({
        date: e.date,
        base: `${fmt(e.date)}-${slug(e.name)}-exam`,
        summary: `Exam: ${e.name}`,
        description: `Exam day. ${e.name}, ${e.need}h planned in the study plan.`,
        busy: true,
      });
    }
  }
  if (events.length === 0) {
    throw new Error("Nothing to export: the plan has no study sessions. Add a study day or leave include_exams on.");
  }
  const dtstamp = stamp(opts.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AnonymousOnyx22//Study Planner MCP//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Study plan",
  ];
  const used = new Set<string>();
  for (const e of events) {
    let uid = `${e.base}@study-planner-mcp`;
    for (let n = 2; used.has(uid); n++) uid = `${e.base}-${n}@study-planner-mcp`;
    used.add(uid);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`,
      `SUMMARY:${icsEscape(e.summary)}`,
      `DESCRIPTION:${icsEscape(e.description)}`,
      `TRANSP:${e.busy ? "OPAQUE" : "TRANSPARENT"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
