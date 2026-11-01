import { describe, it, expect } from "vitest";
import { z } from "zod";
import { runTool, type ToolDef } from "../src/core/tools.js";
import { ApiError } from "../src/core/http.js";
import { tools } from "../src/tools.js";

const EXAM_HINT = 'try exams: [{name: "Networking", date: "2026-12-12", hours_needed: 6}]';
const TOPICS_HINT = 'try topics: [{name: "Routing", hours_needed: 4}]';

function tool(name: string) {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`no tool ${name}`);
  return t;
}
async function run(name: string, args: unknown) {
  const r = await runTool(tool(name), args, null);
  return { text: r.content[0].text, isError: r.isError };
}

describe("runTool argument errors", () => {
  it("names the tool and the exams hint when exams is missing", async () => {
    const r = await run("build_study_plan", {});
    expect(r.isError).toBe(true);
    expect(r.text).toContain("Invalid arguments for tool build_study_plan");
    expect(r.text).toContain(`exams is required; ${EXAM_HINT}`);
  });
  it("treats undefined arguments like an empty object", async () => {
    const r = await run("build_study_plan", undefined);
    expect(r.isError).toBe(true);
    expect(r.text).toContain(`exams is required; ${EXAM_HINT}`);
  });
  it("gives the exams hint when exams is not a list", async () => {
    const r = await run("build_study_plan", { exams: "Networking" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain(`exams must be a list of exams; ${EXAM_HINT}`);
  });
  it("gives the exams hint when the list is empty", async () => {
    const r = await run("build_study_plan", { exams: [] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain(`exams must have at least 1 exam; ${EXAM_HINT}`);
  });
  it("gives the topics hint when topics is not a list", async () => {
    const r = await run("build_study_plan", { exams: [{ name: "Net", date: "2026-12-12", topics: "Routing" }] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain(`topics must be a list of topics; ${TOPICS_HINT}`);
  });
  it("adds the path of a bad field after the message", async () => {
    const r = await run("build_study_plan", { exams: [{ name: "Net", date: "2026-12-12", hours_needed: -1 }] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("hours_needed must be greater than 0");
    expect(r.text).toContain("at exams.0.hours_needed");
  });
  it("puts each problem on its own line", async () => {
    const r = await run("build_study_plan", { exams: [{ date: "2026-12-12" }], hours_per_day: "lots" });
    expect(r.isError).toBe(true);
    expect(r.text.split("\n").length).toBeGreaterThanOrEqual(2);
    expect(r.text).toContain("name is required");
    expect(r.text).toContain("hours_per_day must be a number");
    expect(r.text).not.toContain("\\n");
  });
});

describe("runTool run errors", () => {
  const schema = { n: z.number() };
  function failing(err: unknown): ToolDef<null> {
    return {
      name: "boom",
      title: "Boom",
      description: "Always fails.",
      inputSchema: schema,
      run: async () => {
        throw err;
      },
    };
  }
  it("returns an ApiError message as it is", async () => {
    const r = await runTool(failing(new ApiError("Not allowed", 403)), { n: 1 }, null);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("Not allowed");
  });
  it("wraps other errors", async () => {
    const r = await runTool(failing(new Error("disk full")), { n: 1 }, null);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("Something went wrong: disk full");
  });
  it("does not set isError on success", async () => {
    const ok: ToolDef<null> = { ...failing(null), run: async () => "fine" };
    const r = await runTool(ok, { n: 1 }, null);
    expect(r.isError).toBeUndefined();
    expect(r.content[0].text).toBe("fine");
  });
  it("does not call run when the arguments are invalid", async () => {
    let called = false;
    const t: ToolDef<null> = { ...failing(null), run: async () => ((called = true), "x") };
    const r = await runTool(t, { n: "one" }, null);
    expect(r.isError).toBe(true);
    expect(called).toBe(false);
  });
});

describe("structured output", () => {
  const exams = [{ name: "Networking", date: "2026-12-12", hours_needed: 6 }];

  it("make_study_plan returns structuredContent that matches its outputSchema", async () => {
    const t = tool("make_study_plan");
    const r = await runTool(t, { exams, hours_per_day: 2, start_date: "2026-12-07" }, null);
    expect(r.isError).toBeUndefined();
    expect(r.content[0].text).toContain("Everything fits");
    const s = z.object(t.outputSchema!).parse(r.structuredContent) as any;
    expect(s.fits).toBe(true);
    expect(s.total_hours).toBe(6);
    expect(s.days[0].date).toBe("2026-12-07");
  });

  it("exam_countdown returns days left and the verdict as fields", async () => {
    const t = tool("exam_countdown");
    const r = await runTool(t, { exams, hours_per_day: 2, from_date: "2026-12-07" }, null);
    const s = z.object(t.outputSchema!).parse(r.structuredContent) as any;
    expect(s.exams[0].days_left).toBe(5);
    expect(s.exams[0].on_track).toBe(true);
  });

  it("reschedule_missed_days returns hours done, hours left and the repaired days", async () => {
    const t = tool("reschedule_missed_days");
    const r = await runTool(t, { exams: [{ ...exams[0], hours_done: 2 }], hours_per_day: 2, start_date: "2026-12-07" }, null);
    expect(r.isError).toBeUndefined();
    const s = z.object(t.outputSchema!).parse(r.structuredContent) as any;
    expect(s.hours_done).toBe(2);
    expect(s.hours_left).toBe(4);
    expect(s.fits).toBe(true);
    expect(s.days[0].date).toBe("2026-12-07");
  });

  it("build_study_plan shares the schema and tools without one return text only", async () => {
    expect(tool("build_study_plan").outputSchema).toBe(tool("make_study_plan").outputSchema);
    const r = await runTool(tool("pomodoro_plan"), { total_minutes: 50 }, null);
    expect(r.structuredContent).toBeUndefined();
  });
});
