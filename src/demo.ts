import { runTool } from "./core/tools.js";
import { tools } from "./tools.js";

/** Fixed dates, so the demo prints the same plan on every run. */
const exams = [
  {
    name: "Networking",
    date: "2026-12-12",
    hours_needed: 6,
    topics: [
      { name: "Routing", hours_needed: 4 },
      { name: "Subnetting", hours_needed: 2 },
    ],
  },
  { name: "Databases", date: "2026-12-15", hours_needed: 5 },
];
const plan = { exams, start_date: "2026-12-07", hours_per_day: 2, days_off: ["sun"] };

async function call(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`The demo needs the ${name} tool.`);
  const result = await runTool(tool, args, null);
  const text = result.content[0].text;
  if (result.isError) throw new Error(text);
  return text;
}

async function main(): Promise<void> {
  console.log("== make_study_plan: two exams ==\n");
  console.log(await call("make_study_plan", plan));

  console.log("\n== what_to_study_today: 2026-12-09 ==\n");
  console.log(
    await call("what_to_study_today", {
      ...plan,
      date: "2026-12-09",
      reviews: [{ topic: "Routing", first_study_date: "2026-12-07", exam_date: "2026-12-12" }],
    }),
  );

  console.log("\n== export_study_plan_ics: first lines ==\n");
  const ics = await call("export_study_plan_ics", plan);
  console.log(ics.split(/\r?\n/).slice(0, 16).join("\n"));
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
