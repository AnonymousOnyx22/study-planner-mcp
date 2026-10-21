import { describe, it, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

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

describe("scratch", () => {
  it("prints messages", async () => {
    const cases: [string, Record<string, unknown>][] = [
      ["make_study_plan", { exams: [{ name: "Old", date: "2026-01-01" }], start_date: "2026-12-07" }],
      ["make_study_plan", { exams: [{ name: "Today", date: "2026-12-07" }], start_date: "2026-12-07" }],
      ["make_study_plan", { exams: [{ name: "Net", date: "2026-12-12" }], start_date: "2026-12-07", hours_per_day: 0 }],
      ["make_study_plan", { exams: [{ name: "Net", date: "2026-12-12", hours_needed: 0 }], start_date: "2026-12-07" }],
      ["make_study_plan", { exams: [], start_date: "2026-12-07" }],
      ["build_study_plan", { exams: [{ name: "Old", date: "2026-01-01" }], start_date: "2026-12-07" }],
      ["export_study_plan_ics", { exams: [{ name: "Old", date: "2026-01-01" }], start_date: "2026-12-07" }],
      ["export_study_plan_ics", { exams: [{ name: "Net", date: "2026-12-12" }], start_date: "2026-12-07", hours_per_day: 0 }],
      ["make_study_plan", { exams: [{ name: "Net", date: "2026-12-12" }], start_date: "2026-12-07", days_off: ["funday"] }],
      ["make_study_plan", { exams: [{ name: "Net", date: "2026-13-12" }], start_date: "2026-12-07" }],
      ["assignment_milestones", { title: "Essay", due_date: "2026-12-01", estimated_hours: 6, start_date: "2026-12-07" }],
      ["assignment_milestones", { title: "Essay", due_date: "2026-12-07", estimated_hours: 6, start_date: "2026-12-07" }],
      ["pomodoro_plan", { total_minutes: 0 }],
      ["next_review_dates", { topic: "Routing", first_study_date: "2026-11-27", exam_date: "2026-12-12", from_date: "2026-11-29" }],
      ["next_review_dates", { topic: "Routing", first_study_date: "2026-11-01", exam_date: "2026-11-30", from_date: "2026-11-20" }],
      ["next_review_dates", { topic: "Routing", first_study_date: "2026-11-09", exam_date: "2026-11-10", from_date: "2026-11-09" }],
      ["next_review_dates", { topic: "Routing", first_study_date: "2026-11-27", intervals_days: [] }],
      ["next_review_dates", { topic: "Routing", first_study_date: "2026-11-27", exam_date: "2026-12-12", from_date: "2026-12-04" }],
    ];
    for (const [name, args] of cases) {
      const r = await call(name, args);
      console.log("== " + name + " " + JSON.stringify(args));
      console.log("isError=" + r.isError);
      console.log(JSON.stringify(r.text));
    }
  });
});
