import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { parseDate, fmt, studyPlan, pomodoro, milestones, spacedDates, planForDay, weekdayHours } from "../src/plan.js";
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
  it("gives the same spaced repetition dates under both names", async () => {
    const args = { topic: "Routing", first_study_date: "2026-11-01", exam_date: "2026-11-10" };
    const original = (await call("spaced_repetition_dates", args)).text;
    expect((await call("make_spaced_repetition_schedule", args)).text).toBe(original);
    expect((await call("next_review_dates", args)).text).toBe(original);
    expect(original).toContain("2026-11-02 mon");
    expect(original).toContain("(after the exam, skip)");
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
