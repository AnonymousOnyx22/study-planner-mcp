import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { parseDate, fmt, studyPlan, pomodoro, milestones, spacedDates, nextReview, planForDay, weekdayHours, today, addDays } from "../src/plan.js";
import { studyPlanIcs } from "../src/ics.js";

let client: Client;
beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  client = new Client({ name: "test", version: "0" });
  await client.connect(b);
});
async function call(name: string, args: Record<string, unknown> = {}) {
  const r: any = await client.callTool({ name, arguments: args });
  return { text: r.content[0].text as string, isError: !!r.isError };
}
function readmeText(): string {
  return readFileSync(new URL("../README.md", import.meta.url), "utf8");
}
/** One README section, from its heading to the next one. */
function readmeSection(title: string): string {
  return readmeText().split(`## ${title}`)[1]?.split("\n## ")[0] ?? "";
}
function dayTotals(days: { date: Date; items: { hours: number }[] }[]) {
  return days.map((d) => `${fmt(d.date)} ${d.items.reduce((s, i) => s + i.hours, 0)}h`);
}
const WEEKDAY_HOURS = [
  { day: "mon", hours: 2 },
  { day: "tue", hours: 2 },
  { day: "wed", hours: 2 },
  { day: "thu", hours: 2 },
  { day: "fri", hours: 2 },
  { day: "sat", hours: 6 },
  { day: "sun", hours: 6 },
];

describe("plan math", () => {
  it("rejects bad dates", () => {
    expect(() => parseDate("12/12/2026")).toThrow("YYYY-MM-DD");
    expect(() => parseDate("2026-02-31")).toThrow("real calendar date");
  });
  it("fills every needed hour when there is room and never studies on or after the exam", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-12", hours_needed: 12 }, { name: "Script", date: "2026-12-15", hours_needed: 9 }], parseDate("2026-12-01"), 3, [0]);
    const total = plan.days.reduce((s, d) => s + d.items.reduce((x, i) => x + i.hours, 0), 0);
    expect(total).toBe(21);
    expect(plan.short).toEqual([]);
    for (const d of plan.days) {
      expect(d.date.getUTCDay()).not.toBe(0);
      for (const i of d.items) if (i.name === "Net") expect(d.date.getTime()).toBeLessThan(parseDate("2026-12-12").getTime());
      expect(d.items.reduce((x, i) => x + i.hours, 0)).toBeLessThanOrEqual(3);
    }
  });
  it("reports hours that do not fit", () => {
    const plan = studyPlan([{ name: "Big", date: "2026-12-03", hours_needed: 20 }], parseDate("2026-12-01"), 3, []);
    expect(plan.short[0]).toEqual({ name: "Big", hours: 14 });
  });
  it("builds pomodoro steps with a long break after four sessions", () => {
    const r = pomodoro(200, 25, 5, 15, 4);
    expect(r.sessions).toBe(8);
    expect(r.steps.filter((s) => s.kind === "long break").length).toBe(1);
    expect(r.steps[7]).toEqual({ kind: "long break", minutes: 15 });
  });
  it("spaces reviews and flags ones after the exam", () => {
    const rows = spacedDates(parseDate("2026-11-01"), [1, 3, 7, 14, 30], parseDate("2026-11-10"));
    expect(rows.map((r) => fmt(r.date))).toEqual(["2026-11-02", "2026-11-04", "2026-11-08", "2026-11-15", "2026-12-01"]);
    expect(rows.map((r) => r.skipped)).toEqual([false, false, false, true, true]);
  });
  it("picks the next review and counts the ones that passed", () => {
    const r = nextReview(parseDate("2026-11-27"), [1, 3, 7, 14, 30], parseDate("2026-12-12"), parseDate("2026-11-29"));
    expect(fmt(r.date ?? parseDate("2026-01-01"))).toBe("2026-11-30");
    expect(r.number).toBe(2);
    expect(r.passed.map((d) => fmt(d))).toEqual(["2026-11-28"]);
  });
  it("leaves no next review when every review has passed", () => {
    const r = nextReview(parseDate("2026-11-01"), [1, 3, 7, 14, 30], parseDate("2026-11-30"), parseDate("2026-11-20"));
    expect(r.date).toBeUndefined();
    expect(r.number).toBeUndefined();
    expect(r.passed.map((d) => fmt(d))).toEqual(["2026-11-02", "2026-11-04", "2026-11-08", "2026-11-15"]);
  });
  it("skips the next review when it falls on the exam", () => {
    const r = nextReview(parseDate("2026-11-09"), [1, 3, 7], parseDate("2026-11-10"), parseDate("2026-11-09"));
    expect(r.date).toBeUndefined();
    expect(r.passed).toEqual([]);
  });
  it("orders milestones and finishes the day before the due date", () => {
    const rows = milestones(parseDate("2026-11-01"), parseDate("2026-11-11"), 10, [{ name: "a", share: 1 }, { name: "b", share: 1 }]);
    expect(rows[0].date.getTime()).toBeLessThan(rows[1].date.getTime());
    expect(fmt(rows[1].date)).toBe("2026-11-10");
    expect(rows.reduce((s, r) => s + r.hours, 0)).toBe(10);
  });
  it("picks one day out of a plan and the study day after it", () => {
    const exams = [{ name: "Net", date: "2026-12-12", hours_needed: 6 }];
    const picked = planForDay(exams, parseDate("2026-12-07"), parseDate("2026-12-08"), 2, [0]);
    expect(picked.day?.items).toEqual([{ name: "Net", hours: 2 }]);
    expect(fmt(picked.next?.date ?? parseDate("2026-12-01"))).toBe("2026-12-09");
    const off = planForDay(exams, parseDate("2026-12-06"), parseDate("2026-12-06"), 2, [0]);
    expect(off.day).toBeUndefined();
    expect(fmt(off.next?.date ?? parseDate("2026-12-01"))).toBe("2026-12-07");
  });
  it("gives every weekday its own hours", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-12", hours_needed: 20 }], parseDate("2026-11-30"), 3, [], weekdayHours(WEEKDAY_HOURS));
    expect(dayTotals(plan.days)).toEqual([
      "2026-11-30 2h",
      "2026-12-01 2h",
      "2026-12-02 2h",
      "2026-12-03 2h",
      "2026-12-04 2h",
      "2026-12-05 6h",
      "2026-12-06 4h",
    ]);
    expect(plan.short).toEqual([]);
  });
  it("keeps hours_per_day for the weekdays the list leaves out", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-12", hours_needed: 9 }], parseDate("2026-11-30"), 3, [], weekdayHours([{ day: "sat", hours: 6 }]));
    expect(dayTotals(plan.days)).toEqual(["2026-11-30 3h", "2026-12-01 3h", "2026-12-02 3h"]);
  });
  it("treats a weekday with 0 hours as a day off", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-19", hours_needed: 30 }], parseDate("2026-11-30"), 3, [], weekdayHours([{ day: "sun", hours: 0 }, { day: "sat", hours: 6 }]));
    const days = plan.days.map((d) => fmt(d.date));
    expect(days).not.toContain("2026-12-06");
    expect(days).toContain("2026-12-05");
    expect(plan.days.reduce((s, d) => s + d.items.reduce((x, i) => x + i.hours, 0), 0)).toBe(30);
  });
  it("picks the day out of a plan with the hours of that weekday", () => {
    const picked = planForDay([{ name: "Net", date: "2026-12-12", hours_needed: 40 }], parseDate("2026-11-30"), parseDate("2026-12-05"), 3, [], weekdayHours(WEEKDAY_HOURS));
    expect(picked.day?.items).toEqual([{ name: "Net", hours: 6 }]);
  });
  it("leaves out a day that is in days_off even when that day has hours", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-19", hours_needed: 30 }], parseDate("2026-11-30"), 3, [6], weekdayHours([{ day: "sat", hours: 6 }]));
    expect(plan.days.map((d) => fmt(d.date))).not.toContain("2026-12-05");
    expect(plan.days.reduce((s, d) => s + d.items.reduce((x, i) => x + i.hours, 0), 0)).toBe(30);
  });
  it("takes half hours on a weekday", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-12", hours_needed: 6 }], parseDate("2026-11-30"), 3, [], weekdayHours([{ day: "mon", hours: 1.5 }]));
    expect(dayTotals(plan.days)).toEqual(["2026-11-30 1.5h", "2026-12-01 3h", "2026-12-02 1.5h"]);
  });
  it("says which weekday was given twice and when a name is wrong", () => {
    expect(() => weekdayHours([{ day: "mon", hours: 2 }, { day: "Monday", hours: 3 }])).toThrow("twice");
    expect(() => weekdayHours([{ day: "funday", hours: 2 }])).toThrow("not a weekday");
  });
});

describe("topics inside an exam", () => {
  it("takes the hours of the exam from its topics", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-12", topics: [{ name: "Routing", hours_needed: 6 }, { name: "Security", hours_needed: 4 }] }], parseDate("2026-12-07"), 2, [0]);
    expect(plan.exams[0].need).toBe(10);
    expect(plan.exams[0].topics).toEqual([{ name: "Routing", need: 6 }, { name: "Security", need: 4 }]);
  });
  it("splits the hours of a day over the topics", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-12", topics: [{ name: "Routing", hours_needed: 6 }, { name: "Security", hours_needed: 4 }] }], parseDate("2026-12-07"), 2, [0]);
    expect(plan.days[0].items[0]).toEqual({ name: "Net", hours: 2, topics: [{ name: "Routing", hours: 1 }, { name: "Security", hours: 1 }] });
    const total = plan.days.reduce((s, d) => s + d.items.reduce((x, i) => x + i.hours, 0), 0);
    expect(total).toBe(10);
    expect(plan.short).toEqual([]);
  });
  it("gives the same topic hours as the plan adds up to", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-12", topics: [{ name: "Routing", hours_needed: 6 }, { name: "Security", hours_needed: 4 }] }], parseDate("2026-12-07"), 3, []);
    const planned = plan.days.flatMap((d) => d.items.flatMap((i) => i.topics ?? []).map((t) => `${t.name} ${t.hours}h`));
    expect(planned.reduce((s, p) => s + Number(p.split(" ")[1].replace("h", "")), 0)).toBe(10);
    const perTopic = (name: string) => plan.days.flatMap((d) => d.items.flatMap((i) => i.topics ?? []).filter((t) => t.name === name).map((t) => t.hours)).reduce((s, h) => s + h, 0);
    expect(perTopic("Routing")).toBe(6);
    expect(perTopic("Security")).toBe(4);
  });
  it("splits the exam hours evenly over the topics that have no hours", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-12", hours_needed: 9, topics: [{ name: "Routing" }, { name: "Switching" }, { name: "Security" }] }], parseDate("2026-12-07"), 2, [0]);
    expect(plan.exams[0].topics).toEqual([{ name: "Routing", need: 3 }, { name: "Switching", need: 3 }, { name: "Security", need: 3 }]);
    expect(plan.short).toEqual([]);
  });
  it("says when the exam hours and the topic hours do not match", () => {
    expect(() => studyPlan([{ name: "Net", date: "2026-12-12", hours_needed: 20, topics: [{ name: "Routing", hours_needed: 6 }] }], parseDate("2026-12-07"), 2, [])).toThrow("add up to 6h");
  });
  it("says when a topic has no hours and the exam has none either", () => {
    expect(() => studyPlan([{ name: "Net", date: "2026-12-12", topics: [{ name: "Routing" }] }], parseDate("2026-12-07"), 2, [])).toThrow("Give hours for every topic");
  });
  it("says when a topic is given twice", () => {
    expect(() => studyPlan([{ name: "Net", date: "2026-12-12", topics: [{ name: "Routing", hours_needed: 2 }, { name: "Routing", hours_needed: 2 }] }], parseDate("2026-12-07"), 2, [])).toThrow("twice");
  });
  it("reports the topics that are short", () => {
    const plan = studyPlan([{ name: "Net", date: "2026-12-10", topics: [{ name: "Routing", hours_needed: 6 }, { name: "Security", hours_needed: 4 }] }], parseDate("2026-12-07"), 2, []);
    expect(plan.short[0].name).toBe("Net");
    expect(plan.short[0].topics?.map((t) => t.name)).toEqual(["Routing", "Security"]);
  });
});

describe("calendar file", () => {
  const plan = studyPlan([{ name: "Net; Security, part 1", date: "2026-12-12", hours_needed: 6 }], parseDate("2026-12-07"), 2, [0]);
  const file = studyPlanIcs(plan, { includeExams: true, now: new Date(Date.UTC(2026, 10, 14, 9, 30)) });
  it("writes a calendar of all day events", () => {
    expect(file.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(file).toContain("VERSION:2.0");
    expect(file).toContain("PRODID:-//AnonymousOnyx22//Study Planner MCP//EN");
    expect(file).toContain("DTSTAMP:20261114T093000Z");
    expect(file).toContain("DTSTART;VALUE=DATE:20261207");
    expect(file).toContain("DTEND;VALUE=DATE:20261208");
    expect(file).toContain("SUMMARY:Study: Net\\; Security\\, part 1 2h");
    const flat = file.replace(/\r\n /g, "");
    expect(flat).toContain("DESCRIPTION:Net\\; Security\\, part 1\\, 2h of study. Day total 2h. Exam on 2026-12-12 sat.");
    expect(flat).toContain("SUMMARY:Exam: Net\\; Security\\, part 1");
    expect(file).toContain("TRANSP:TRANSPARENT");
    expect(file).toContain("TRANSP:OPAQUE");
    const uids = [...file.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
    expect(uids.length).toBe(4);
    expect(new Set(uids).size).toBe(4);
    expect(uids[0]).toBe("2026-12-07-net-security-part-1-study@study-planner-mcp");
    expect(uids[3]).toBe("2026-12-12-net-security-part-1-exam@study-planner-mcp");
  });
  it("leaves the exams out when asked", () => {
    const studyOnly = studyPlanIcs(plan, { includeExams: false, now: new Date(Date.UTC(2026, 10, 14, 9, 30)) });
    expect(studyOnly).not.toContain("SUMMARY:Exam:");
    expect(studyOnly.match(/BEGIN:VEVENT/g)?.length).toBe(3);
  });
  it("folds long lines to 75 octets and survives the unfolding", () => {
    const name = "Networking, security, routing, switching, cryptography and wireless";
    const long = studyPlanIcs(
      studyPlan([{ name, date: "2026-12-12", hours_needed: 6 }], parseDate("2026-12-07"), 2, [0]),
      { now: new Date(Date.UTC(2026, 10, 14, 9, 30)) },
    );
    expect(long).toContain("\r\n ");
    for (const line of long.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    const flat = long.replace(/\r\n /g, "");
    expect(flat).toContain(`SUMMARY:Study: ${name.replace(/,/g, "\\,")} 2h`);
    const uni = studyPlanIcs(
      studyPlan([{ name: "日本語と中文の試験", date: "2026-12-12", hours_needed: 6 }], parseDate("2026-12-07"), 2, [0]),
      { now: new Date(Date.UTC(2026, 10, 14, 9, 30)) },
    );
    for (const line of uni.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    expect(uni.replace(/\r\n /g, "")).toContain("SUMMARY:Study: 日本語と中文の試験 2h");
  });
});

describe("MCP tools", () => {
  it("lists eleven read only tools", async () => {
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual([
      "assignment_milestones",
      "build_study_plan",
      "export_study_plan_ics",
      "list_assignment_milestones",
      "make_spaced_repetition_schedule",
      "make_study_plan",
      "next_review_dates",
      "plan_pomodoro_sessions",
      "pomodoro_plan",
      "spaced_repetition_dates",
      "what_to_study_today",
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });
  it("describes every tool as a study plan job", async () => {
    const tools = (await client.listTools()).tools;
    for (const t of tools) {
      expect(t.description ?? "").toMatch(/\S/);
      expect(t.description).not.toContain("\u2014");
    }
  });
  it("makes a plan through the server", async () => {
    const r = await call("make_study_plan", { exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 6 }], start_date: "2026-12-07", hours_per_day: 2, days_off: ["sun"] });
    expect(r.text).toContain("Everything fits.");
    expect(r.text).toContain("2026-12-07 mon");
  });
  it("makes a plan with different hours for each weekday", async () => {
    const r = await call("build_study_plan", {
      exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 20 }],
      hours_per_day: 3,
      hours_per_weekday: WEEKDAY_HOURS,
      start_date: "2026-11-30",
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("2026-11-30 mon  Networking 2h  (2h total)");
    expect(r.text).toContain("2026-12-05 sat  Networking 6h  (6h total)");
    expect(r.text).toContain("2026-12-06 sun  Networking 4h  (4h total)");
    expect(r.text).toContain("Everything fits.");
  });
  it("says what is short when the weekday hours are not enough", async () => {
    const r = await call("build_study_plan", {
      exams: [{ name: "Networking", date: "2026-12-05", hours_needed: 20 }],
      hours_per_day: 3,
      hours_per_weekday: [{ day: "mon", hours: 2 }, { day: "tue", hours: 2 }],
      start_date: "2026-12-01",
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Networking is 9h short");
    expect(r.text).toContain("raise hours per day or hours per weekday");
  });
  it("explains a weekday that is wrong or given twice", async () => {
    const wrong = await call("build_study_plan", { exams: [{ name: "Net", date: "2026-12-12" }], hours_per_weekday: [{ day: "funday", hours: 2 }] });
    expect(wrong.isError).toBe(true);
    expect(wrong.text).toContain("not a weekday");
    const twice = await call("build_study_plan", { exams: [{ name: "Net", date: "2026-12-12" }], hours_per_weekday: [{ day: "mon", hours: 2 }, { day: "Monday", hours: 3 }] });
    expect(twice.isError).toBe(true);
    expect(twice.text).toContain("twice");
  });
  it("exports a plan with different hours for each weekday", async () => {
    const r = await call("export_study_plan_ics", {
      exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 20 }],
      hours_per_day: 3,
      hours_per_weekday: WEEKDAY_HOURS,
      start_date: "2026-11-30",
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("DTSTART;VALUE=DATE:20261205");
    expect(r.text).toContain("SUMMARY:Study: Networking 6h");
    expect(r.text).toContain("SUMMARY:Study: Networking 4h");
  });
  it("explains a past exam date", async () => {
    const r = await call("make_study_plan", { exams: [{ name: "Old", date: "2026-01-01" }], start_date: "2026-12-07" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("not after the start date");
  });
  it("answers pomodoro and milestone calls", async () => {
    expect((await call("pomodoro_plan", { total_minutes: 75 })).text).toContain("3 work sessions");
    expect((await call("assignment_milestones", { title: "Essay", due_date: "2026-11-20", estimated_hours: 6, start_date: "2026-11-10" })).text).toContain("Proofread and submit");
  });
  it("gives the topic of every day of a plan", async () => {
    const r = await call("build_study_plan", {
      exams: [{ name: "Networking", date: "2026-12-10", topics: [{ name: "Routing", hours_needed: 6 }, { name: "Switching", hours_needed: 4 }, { name: "Security", hours_needed: 2 }] }],
      hours_per_day: 4,
      start_date: "2026-12-07",
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("- Routing 6h planned");
    expect(r.text).toContain("- 2026-12-08 tue  Networking 4h  (4h total)");
    expect(r.text).toContain("  - Networking: Routing 2h, Switching 1.5h, Security 0.5h");
    expect(r.text).toContain("Everything fits.");
  });
  it("gives the topics of the day in what_to_study_today", async () => {
    const r = await call("what_to_study_today", {
      date: "2026-12-08",
      exams: [{ name: "Networking", date: "2026-12-10", topics: [{ name: "Routing", hours_needed: 6 }, { name: "Switching", hours_needed: 4 }, { name: "Security", hours_needed: 2 }] }],
      hours_per_day: 4,
      start_date: "2026-12-07",
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Study sessions, 4h total");
    expect(r.text).toContain("- Networking 4h");
    expect(r.text).toContain("  - Routing 2h, Switching 1.5h, Security 0.5h");
  });
  it("explains topics that do not fit the exam", async () => {
    const r = await call("build_study_plan", {
      exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 20, topics: [{ name: "Routing", hours_needed: 6 }] }],
      start_date: "2026-12-07",
    });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("add up to 6h");
  });
  it("puts the topics of a session in the calendar file", async () => {
    const r = await call("export_study_plan_ics", {
      exams: [{ name: "Networking", date: "2026-12-12", topics: [{ name: "Routing", hours_needed: 6 }, { name: "Security", hours_needed: 4 }] }],
      hours_per_day: 2,
      start_date: "2026-12-07",
    });
    expect(r.isError).toBe(false);
    expect(r.text.replace(/\r\n /g, "")).toContain("Topics: Routing 1h\\, Security 1h.");
  });
  it("exports a plan as an .ics file", async () => {
    const args = { exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 6 }], start_date: "2026-12-07", hours_per_day: 2, days_off: ["sun"] };
    const r = await call("export_study_plan_ics", args);
    expect(r.isError).toBe(false);
    expect(r.text.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(r.text).toContain("DTSTART;VALUE=DATE:20261207");
    expect(r.text).toContain("SUMMARY:Study: Networking 2h");
    expect(r.text).toContain("SUMMARY:Exam: Networking");
    expect(r.text).toContain("END:VCALENDAR");
    const studyOnly = await call("export_study_plan_ics", { ...args, include_exams: false });
    expect(studyOnly.isError).toBe(false);
    expect(studyOnly.text).not.toContain("SUMMARY:Exam:");
    expect(studyOnly.text.match(/BEGIN:VEVENT/g)?.length).toBe(3);
  });
  it("explains an export with nothing in it", async () => {
    const r = await call("export_study_plan_ics", {
      exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 6 }],
      start_date: "2026-12-07",
      days_off: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      include_exams: false,
    });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("Nothing to export");
  });
  it("shows a real study plan in the README", async () => {
    const section = readmeSection("Example plan");
    const json = /Tool call:\n\n```json\n([\s\S]*?)```/.exec(section);
    const answer = /The answer:\n\n```text\n([\s\S]*?)```/.exec(section);
    expect(json?.[1]).toBeTruthy();
    expect(answer?.[1]).toBeTruthy();
    const r = await call("build_study_plan", JSON.parse(json![1]));
    expect(r.isError).toBe(false);
    expect(r.text).toBe(answer![1].trimEnd());
  });
  it("shows a real plan with hours per weekday in the README", async () => {
    const section = readmeSection("Different hours each day of the week");
    const json = /Tool call:\n\n```json\n([\s\S]*?)```/.exec(section);
    const answer = /The answer:\n\n```text\n([\s\S]*?)```/.exec(section);
    expect(json?.[1]).toBeTruthy();
    expect(answer?.[1]).toBeTruthy();
    const r = await call("build_study_plan", JSON.parse(json![1]));
    expect(r.isError).toBe(false);
    expect(r.text).toBe(answer![1].trimEnd());
  });
  it("shows a real plan made from a plain date in the README", async () => {
    const section = readmeSection("Dates in plain words");
    const json = /Tool call:\n\n```json\n([\s\S]*?)```/.exec(section);
    const answer = /The answer:\n\n```text\n([\s\S]*?)```/.exec(section);
    expect(json?.[1]).toBeTruthy();
    expect(answer?.[1]).toBeTruthy();
    const r = await call("build_study_plan", JSON.parse(json![1]));
    expect(r.isError).toBe(false);
    expect(r.text).toBe(answer![1].trimEnd());
  });
  it("shows a real plan with topics in the README", async () => {
    const section = readmeSection("Hours per topic");
    const calls = [...section.matchAll(/Tool call:\n\n```json\n([\s\S]*?)```/g)].map((m) => m[1]);
    const answers = [...section.matchAll(/The answer:\n\n```text\n([\s\S]*?)```/g)].map((m) => m[1]);
    expect(calls.length).toBe(2);
    expect(answers.length).toBe(2);
    const plan = await call("build_study_plan", JSON.parse(calls[0]));
    expect(plan.isError).toBe(false);
    expect(plan.text).toBe(answers[0].trimEnd());
    const day = await call("what_to_study_today", JSON.parse(calls[1]));
    expect(day.isError).toBe(false);
    expect(day.text).toBe(answers[1].trimEnd());
  });
  it("shows a real ICS file in the README", async () => {
    const section = readmeSection("Calendar file");
    const block = /```text\n(BEGIN:VCALENDAR[\s\S]*?)```/.exec(section);
    expect(block?.[1]).toBeTruthy();
    const calls = [...section.matchAll(/Tool call:\n\n```json\n([\s\S]*?)```/g)];
    const json = calls.find((m) => m[1].includes("2026-12-07"));
    expect(json).toBeTruthy();
    const r = await call("export_study_plan_ics", JSON.parse(json![1]));
    expect(r.isError).toBe(false);
    expect(r.text.match(/BEGIN:VEVENT/g)?.length).toBe(4);
    for (const line of block![1].split("\n")) {
      if (line && !line.startsWith("DTSTAMP:")) expect(r.text).toContain(line);
    }
  });
  it("shows a real next review in the README", async () => {
    const section = readmeSection("Next review date");
    const json = /Tool call:\n\n```json\n([\s\S]*?)```/.exec(section);
    const answer = /The answer:\n\n```text\n([\s\S]*?)```/.exec(section);
    expect(json?.[1]).toBeTruthy();
    expect(answer?.[1]).toBeTruthy();
    const r = await call("next_review_dates", JSON.parse(json![1]));
    expect(r.isError).toBe(false);
    expect(r.text).toBe(answer![1].trimEnd());
  });
  it("keeps the tool descriptions in llms.txt and glama.json the same as the tools", async () => {
    const tools = (await client.listTools()).tools;
    const llms = readFileSync(new URL("../llms.txt", import.meta.url), "utf8");
    const glama = JSON.parse(readFileSync(new URL("../glama.json", import.meta.url), "utf8"));
    for (const t of tools) {
      const line = llms.split("\n").find((l) => l.startsWith(`- ${t.name}: `));
      if (line) expect(line.slice(2)).toBe(`${t.name}: ${t.description}`);
      const listed = glama.tools.find((x: { name: string }) => x.name === t.name);
      expect(listed?.description).toBe(t.description);
    }
  });
  it("keeps the server.json description short enough for the registry", () => {
    const server = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
    expect(server.description.length).toBeLessThanOrEqual(100);
  });
  it("says in the server.json description that the server runs offline and needs no account", () => {
    const server = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
    expect(server.description).toContain("offline");
    expect(server.description).toContain("no account");
  });
  it("answers the explicit verb names like the originals", async () => {
    const built = await call("build_study_plan", { exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 6 }], start_date: "2026-12-07", hours_per_day: 2, days_off: ["sun"] });
    expect(built.text).toContain("Everything fits.");
    expect((await call("plan_pomodoro_sessions", { total_minutes: 75 })).text).toContain("3 work sessions");
    expect((await call("list_assignment_milestones", { title: "Essay", due_date: "2026-11-20", estimated_hours: 6, start_date: "2026-11-10" })).text).toContain("Proofread and submit");
  });
  it("leads llms.txt with the current names and folds the older ones into one alias line", async () => {
    const llms = readFileSync(new URL("../llms.txt", import.meta.url), "utf8");
    const tools = (await client.listTools()).tools;
    const current = [
      "build_study_plan",
      "make_spaced_repetition_schedule",
      "next_review_dates",
      "plan_pomodoro_sessions",
      "list_assignment_milestones",
      "export_study_plan_ics",
      "what_to_study_today",
    ];
    const older = ["make_study_plan", "spaced_repetition_dates", "pomodoro_plan", "assignment_milestones"];
    const lines = llms.split("\n");
    const aliasLine = lines.find((l) => l.startsWith("- Aliases:")) ?? "";
    expect(aliasLine).not.toBe("");
    const aliasIndex = lines.indexOf(aliasLine);
    for (const name of current) {
      const line = lines.find((l) => l.startsWith(`- ${name}:`)) ?? "";
      expect(line).not.toBe("");
      expect(lines.indexOf(line)).toBeLessThan(aliasIndex);
    }
    for (const name of older) {
      expect(aliasLine).toContain(name);
      expect(lines.some((l) => l.startsWith(`- ${name}:`))).toBe(false);
    }
    for (const t of tools) expect(llms).toContain(t.name);
  });
  it("gives the same spaced repetition dates under both schedule names", async () => {
    const args = { topic: "Routing", first_study_date: "2026-11-01", exam_date: "2026-11-10" };
    const original = (await call("spaced_repetition_dates", args)).text;
    expect((await call("make_spaced_repetition_schedule", args)).text).toBe(original);
    expect(original).toContain("2026-11-02 mon");
    expect(original).toContain("(after the exam, skip)");
  });
  it("gives only the next review from next_review_dates", async () => {
    const r = await call("next_review_dates", { topic: "Routing", first_study_date: "2026-11-27", exam_date: "2026-12-12", from_date: "2026-11-29" });
    expect(r.isError).toBe(false);
    expect(r.text).toBe('Next review for "Routing": 2026-11-30 mon, the 2nd review, in 1 day.\n1 review has passed.');
    expect(r.text).not.toContain("2026-12-04");
  });
  it("does not give the whole schedule from next_review_dates", async () => {
    const full = (await call("spaced_repetition_dates", { topic: "Routing", first_study_date: "2026-11-01" })).text;
    const one = (await call("next_review_dates", { topic: "Routing", first_study_date: "2026-11-01", from_date: "2026-11-01" })).text;
    expect(full).toContain("2026-11-02");
    expect(full).toContain("2026-12-01");
    expect(one).toContain("2026-11-02");
    expect(one).not.toContain("2026-12-01");
  });
  it("says when no review is left before the exam", async () => {
    const r = await call("next_review_dates", { topic: "Routing", first_study_date: "2026-11-09", exam_date: "2026-11-10", from_date: "2026-11-09" });
    expect(r.isError).toBe(false);
    expect(r.text).toBe('No review left for "Routing" before the exam on 2026-11-10 tue.');
  });
  it("says when every review has passed", async () => {
    const r = await call("next_review_dates", { topic: "Routing", first_study_date: "2026-11-01", exam_date: "2026-11-30", from_date: "2026-11-20" });
    expect(r.isError).toBe(false);
    expect(r.text).toBe('No review left for "Routing". The last one was on 2026-11-15 sun, 5 days ago.\n4 reviews have passed.');
  });
  it("counts a review from today when no first study date is given", async () => {
    const r = await call("next_review_dates", { topic: "Routing" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("the 1st review, in 1 day.");
  });
  it("explains an empty list of intervals", async () => {
    const r = await call("next_review_dates", { topic: "Routing", intervals_days: [] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("at least one number of days");
  });
});

describe("dates in plain words", () => {
  const plan = { exams: [{ name: "Networking", date: "Dec 12 2026", hours_needed: 6 }], start_date: "2026-12-07", hours_per_day: 2 };

  it("takes a month name and a day for the exam date", async () => {
    const r = await call("build_study_plan", plan);
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Networking on 2026-12-12 sat, 6h planned");
    expect(r.text).toContain("Everything fits.");
  });
  it("takes a month name without a year for the exam date", async () => {
    const r = await call("build_study_plan", { ...plan, exams: [{ name: "Networking", date: "Dec 12", hours_needed: 6 }] });
    expect(r.isError).toBe(false);
    expect(r.text).toMatch(/- Networking on 20\d\d-12-12 sat, 6h planned/);
  });
  it("gives the same plan for a plain date and for the date it stands for", async () => {
    const plain = await call("build_study_plan", plan);
    const iso = await call("build_study_plan", { ...plan, exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 6 }] });
    expect(plain.text).toBe(iso.text);
  });
  it("counts a relative date from today", async () => {
    const plain = await call("build_study_plan", { exams: [{ name: "Networking", date: "in 3 weeks", hours_needed: 6 }], hours_per_day: 2 });
    const iso = await call("build_study_plan", { exams: [{ name: "Networking", date: fmt(addDays(today(), 21)), hours_needed: 6 }], hours_per_day: 2 });
    expect(plain.text).toBe(iso.text);
    expect(plain.text).toContain(`Plan from ${fmt(today())}`);
  });
  it("takes a plain date for the day, the exam and the reviews", async () => {
    const r = await call("what_to_study_today", {
      date: "today",
      exams: [{ name: "Networking", date: "in 3 weeks" }],
      reviews: [{ topic: "Routing", first_study_date: "3 days ago" }],
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain(`Today ${fmt(today())}`);
    expect(r.text).toContain("Reviews to catch up");
  });
  it("takes a plain date for the due date of an assignment", async () => {
    const r = await call("list_assignment_milestones", { title: "Essay", due_date: "in 2 weeks", estimated_hours: 6 });
    expect(r.isError).toBe(false);
    expect(r.text).toContain(`due ${fmt(addDays(today(), 14))}`);
  });
  it("says which forms of a date it reads", async () => {
    const r = await call("build_study_plan", { exams: [{ name: "Networking", date: "someday" }] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("plain text like Dec 12, next Friday or in 3 weeks");
  });
  it("says why a date it read is not a date", async () => {
    const r = await call("build_study_plan", { exams: [{ name: "Networking", date: "Feb 30" }] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("There is no 30 February");
  });
});

describe("what to study today", () => {
  const plan = { exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 12 }], hours_per_day: 2 };

  it("merges the plan sessions for the day with the reviews that are due", async () => {
    const r = await call("what_to_study_today", {
      ...plan,
      date: "2026-11-30",
      reviews: [{ topic: "Routing", first_study_date: "2026-11-27" }],
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Today 2026-11-30 mon");
    expect(r.text).toContain("Study sessions, 2h total");
    expect(r.text).toContain("- Networking 2h");
    expect(r.text).toContain("Reviews due today");
    expect(r.text).toContain("- Routing, 2nd review");
    expect(r.text).toContain("Reviews to catch up");
    expect(r.text).toContain("- Routing, 1st review, 2 days late (due 2026-11-28)");
    expect(r.text).toContain("- Routing on 2026-12-04 fri, 3rd review");
    expect(r.text).toContain("Next exam: Networking on 2026-12-12 sat, 12 days left.");
  });

  it("shows the next study day when the day asked about is a day off", async () => {
    const r = await call("what_to_study_today", { ...plan, date: "2026-11-30", days_off: ["mon"] });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("No study session today. Next study day 2026-12-01 tue, 2h total");
  });

  it("uses the hours of the weekday it is asked about", async () => {
    const r = await call("what_to_study_today", {
      date: "2026-12-05",
      exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 20 }],
      hours_per_day: 3,
      hours_per_weekday: WEEKDAY_HOURS,
      start_date: "2026-11-30",
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Today 2026-12-05 sat");
    expect(r.text).toContain("Study sessions, 6h total");
    expect(r.text).toContain("- Networking 6h");
  });

  it("shows reviews on their own when there are no exams", async () => {
    const r = await call("what_to_study_today", { date: "2026-11-30", reviews: [{ topic: "Routing", first_study_date: "2026-11-27" }] });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Reviews due today");
    expect(r.text).not.toContain("Study sessions");
    expect(r.text).not.toContain("Next exam");
  });

  it("skips reviews that fall on or after the exam", async () => {
    const r = await call("what_to_study_today", {
      date: "2026-11-30",
      reviews: [{ topic: "Routing", first_study_date: "2026-11-27", exam_date: "2026-11-29" }],
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("- Routing, 1st review, 2 days late (due 2026-11-28)");
    expect(r.text).not.toContain("2nd review");
  });

  it("says what to pass when there is nothing to show", async () => {
    const r = await call("what_to_study_today", { date: "2026-11-30" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Nothing to show.");
    expect(r.text).toContain("reviews with the day you first studied each topic");
  });

  it("shows a real run in the README", async () => {
    const section = readmeSection("What to study today");
    const json = /Tool call:\n\n```json\n([\s\S]*?)```/.exec(section);
    const answer = /The answer:\n\n```text\n([\s\S]*?)```/.exec(section);
    expect(json?.[1]).toBeTruthy();
    expect(answer?.[1]).toBeTruthy();
    const r = await call("what_to_study_today", JSON.parse(json![1]));
    expect(r.isError).toBe(false);
    expect(r.text).toBe(answer![1].trimEnd());
  });
});

describe("llms.txt worked examples", () => {
  const llms = readFileSync(new URL("../llms.txt", import.meta.url), "utf8");
  const section = llms.split("## Worked examples")[1]?.split("\n## ")[0] ?? "";
  const blocks = section.split("\n### ").slice(1);
  const toolOf = (block: string): string => /^Tool call: (\S+)$/m.exec(block)?.[1] ?? "";
  const argsOf = (block: string): string => /```json\n([\s\S]*?)```/.exec(block)?.[1] ?? "";
  const answerOf = (block: string): string => /```text\n([\s\S]*?)```/.exec(block)?.[1] ?? "";

  it("has a worked example for every tool the file lists", () => {
    expect(blocks.length).toBeGreaterThanOrEqual(10);
    const named = new Set(blocks.map(toolOf));
    for (const name of [
      "build_study_plan",
      "make_spaced_repetition_schedule",
      "next_review_dates",
      "plan_pomodoro_sessions",
      "list_assignment_milestones",
      "export_study_plan_ics",
      "what_to_study_today",
    ]) {
      expect(named.has(name)).toBe(true);
    }
  });

  it("shows answers that match what the tools give", async () => {
    for (const block of blocks) {
      const name = toolOf(block);
      const args = argsOf(block);
      const answer = answerOf(block);
      expect(name).not.toBe("");
      expect(args).not.toBe("");
      expect(answer).not.toBe("");
      const r = await call(name, JSON.parse(args));
      expect(r.isError).toBe(false);
      if (answer.startsWith("BEGIN:VCALENDAR")) {
        for (const line of answer.split("\n")) {
          if (line && !line.startsWith("DTSTAMP:")) expect(r.text).toContain(line);
        }
      } else {
        expect(r.text).toBe(answer.trimEnd());
      }
    }
  });

  it("keeps every example on a date of its own, so the answers do not change", () => {
    for (const block of blocks) {
      const name = toolOf(block);
      const args = JSON.parse(argsOf(block));
      if (name === "build_study_plan" || name === "export_study_plan_ics") expect(args.start_date).toBeTruthy();
      if (name === "what_to_study_today") expect(args.date).toBeTruthy();
      if (name === "next_review_dates") expect(args.from_date).toBeTruthy();
    }
  });
});

describe("README install snippets", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const install = readme.split("## Install")[1]?.split("\n## ")[0] ?? "";

  it("covers every client the README says it works with", () => {
    expect(install).not.toBe("");
    for (const client of ["Claude Desktop", "Claude Code", "ChatGPT", "Cursor", "Copilot"]) {
      expect(install).toContain(client);
    }
  });

  it("starts the same server in every snippet", () => {
    const blocks = [...install.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    let vsCodeStyle = 0;
    for (const block of blocks) {
      const config = JSON.parse(block);
      const servers = config.mcpServers ?? config.servers;
      expect(servers).toBeTruthy();
      if (config.servers) vsCodeStyle++;
      for (const entry of Object.values(servers) as { command: string; args: string[] }[]) {
        expect(entry.command).toBe("npx");
        expect(entry.args).toContain("-y");
        expect(entry.args).toContain(pkg.name);
      }
    }
    expect(vsCodeStyle).toBe(1);
  });

  it("keeps the package name in every snippet the same as package.json", () => {
    const names = [...readme.matchAll(/"args":\s*\[[^\]]*\]/g)].map((m) => m[0]);
    expect(names.length).toBeGreaterThan(0);
    for (const line of names) expect(line).toContain(`"${pkg.name}"`);
  });
});

describe("README keywords and LMS comparison", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const keywordLines = (): string[] =>
    readmeSection("Keywords")
      .split("\n")
      .filter((l) => l.startsWith("- "))
      .map((l) => l.slice(2).trim());

  it("lists the phrases people search for", () => {
    const listed = keywordLines();
    expect(listed.length).toBeGreaterThan(0);
    for (const phrase of [
      "revision timetable",
      "revision schedule",
      "exam schedule",
      "exam planner",
      "spaced repetition dates",
      "spaced repetition schedule",
      "study timetable",
      "study calendar",
      "pomodoro",
      "pomodoro planner",
      "assignment milestones",
      "study planner mcp",
    ]) {
      expect(listed).toContain(phrase);
    }
  });

  it("keeps every keyword phrase short enough for npm", () => {
    for (const phrase of keywordLines()) {
      expect(phrase.length).toBeLessThanOrEqual(30);
      expect(phrase).toBe(phrase.toLowerCase());
    }
  });

  it("keeps the README keyword list the same as the npm keywords", () => {
    const listed = keywordLines();
    expect([...listed].sort()).toEqual([...(pkg.keywords as string[])].sort());
  });

  it("compares the server with Brightspace and Canvas", () => {
    const section = readmeSection("Study Planner MCP compared with Brightspace and Canvas");
    expect(section).not.toBe("");
    expect(section).toContain("brightspace-d2l-mcp");
    expect(section).toContain("canvas-lms-student-mcp");
    expect(section).toContain("Spaced repetition review dates");
    expect(section).toContain("Needs a school account");
  });

  it("gives every row of the comparison table a cell for each server", () => {
    const section = readmeSection("Study Planner MCP compared with Brightspace and Canvas");
    const rows = section
      .split("\n")
      .filter((l) => l.trim().startsWith("|"))
      .filter((l) => !/^\|\s*---/.test(l.trim()));
    expect(rows.length).toBeGreaterThan(5);
    const cellsOf = (row: string) =>
      row
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim());
    // the head row may leave the top left corner empty
    for (const cell of cellsOf(rows[0]).slice(1)) expect(cell).not.toBe("");
    for (const row of rows.slice(1)) {
      const cells = cellsOf(row);
      expect(cells.length).toBe(4);
      for (const cell of cells) expect(cell).not.toBe("");
    }
  });

  it("names only tools and parameters the server really has", async () => {
    const tools = await client.listTools();
    const names = new Set(tools.tools.map((t) => t.name));
    const params = new Set<string>();
    for (const t of tools.tools) {
      for (const key of Object.keys((t.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {})) params.add(key);
    }
    const section = readmeSection("Study Planner MCP compared with Brightspace and Canvas");
    const named = [...section.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) expect(names.has(name) || params.has(name)).toBe(true);
  });
});
