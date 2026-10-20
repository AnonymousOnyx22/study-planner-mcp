import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { parseDate, fmt, studyPlan, pomodoro, milestones, spacedDates } from "../src/plan.js";

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
});

describe("MCP tools", () => {
  it("lists nine read only tools", async () => {
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual([
      "assignment_milestones",
      "build_study_plan",
      "list_assignment_milestones",
      "make_spaced_repetition_schedule",
      "make_study_plan",
      "next_review_dates",
      "plan_pomodoro_sessions",
      "pomodoro_plan",
      "spaced_repetition_dates",
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });
  it("describes every tool as a study plan job", async () => {
    const tools = (await client.listTools()).tools;
    for (const t of tools) {
      expect(t.description ?? "").toMatch(/\S/);
      expect(t.description).not.toContain("—");
    }
  });
  it("makes a plan through the server", async () => {
    const r = await call("make_study_plan", { exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 6 }], start_date: "2026-12-07", hours_per_day: 2, days_off: ["sun"] });
    expect(r.text).toContain("Everything fits.");
    expect(r.text).toContain("2026-12-07 mon");
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
  it("answers the explicit verb names like the originals", async () => {
    const built = await call("build_study_plan", { exams: [{ name: "Networking", date: "2026-12-12", hours_needed: 6 }], start_date: "2026-12-07", hours_per_day: 2, days_off: ["sun"] });
    expect(built.text).toContain("Everything fits.");
    expect((await call("plan_pomodoro_sessions", { total_minutes: 75 })).text).toContain("3 work sessions");
    expect((await call("list_assignment_milestones", { title: "Essay", due_date: "2026-11-20", estimated_hours: 6, start_date: "2026-11-10" })).text).toContain("Proofread and submit");
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
