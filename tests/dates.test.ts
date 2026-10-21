import { describe, it, expect } from "vitest";
import { fmt, parseDateInput } from "../src/dates.js";

/** A Wednesday, so the weekday of the tests is easy to follow. */
const FROM = new Date(Date.UTC(2026, 9, 21));

function read(text: string, from: Date = FROM) {
  return fmt(parseDateInput(text, from));
}

describe("dates in plain words", () => {
  it("reads a date written as YYYY-MM-DD", () => {
    expect(read("2026-12-12")).toBe("2026-12-12");
    expect(read(" 2026-12-12 ")).toBe("2026-12-12");
    expect(read("2026-12-12T09:30:00Z")).toBe("2026-12-12");
  });
  it("reads a month name and a day", () => {
    expect(read("Dec 12")).toBe("2026-12-12");
    expect(read("december 12")).toBe("2026-12-12");
    expect(read("12 Dec")).toBe("2026-12-12");
    expect(read("Dec 12th")).toBe("2026-12-12");
  });
  it("reads a month name and a day with a year", () => {
    expect(read("Dec 12 2027")).toBe("2027-12-12");
    expect(read("Dec 12, 2027")).toBe("2027-12-12");
    expect(read("12 Dec 2027")).toBe("2027-12-12");
  });
  it("takes the month and day that have not passed yet", () => {
    expect(read("Dec 12", new Date(Date.UTC(2026, 11, 20)))).toBe("2027-12-12");
    expect(read("Nov 30")).toBe("2026-11-30");
    expect(read("Dec 12")).toBe("2026-12-12");
  });
  it("reads today, tomorrow and yesterday", () => {
    expect(read("today")).toBe("2026-10-21");
    expect(read("tomorrow")).toBe("2026-10-22");
    expect(read("yesterday")).toBe("2026-10-20");
  });
  it("counts days, weeks, months and years from the day given", () => {
    expect(read("in 3 days")).toBe("2026-10-24");
    expect(read("in 3 weeks")).toBe("2026-11-11");
    expect(read("in 2 months")).toBe("2026-12-21");
    expect(read("in 1 year")).toBe("2027-10-21");
    expect(read("in a week")).toBe("2026-10-28");
    expect(read("in two weeks")).toBe("2026-11-04");
    expect(read("3 days from now")).toBe("2026-10-24");
  });
  it("counts back from the day given", () => {
    expect(read("3 days ago")).toBe("2026-10-18");
    expect(read("2 weeks ago")).toBe("2026-10-07");
  });
  it("keeps the day inside the month when a month or a year passes", () => {
    expect(read("in 1 month", new Date(Date.UTC(2026, 0, 31)))).toBe("2026-02-28");
    expect(read("in 1 year", new Date(Date.UTC(2024, 1, 29)))).toBe("2025-02-28");
  });
  it("reads a weekday", () => {
    expect(read("Friday")).toBe("2026-10-23");
    expect(read("fri")).toBe("2026-10-23");
    expect(read("next Friday")).toBe("2026-10-30");
    expect(read("last Friday")).toBe("2026-10-16");
    expect(read("Wednesday")).toBe("2026-10-21");
  });
  it("says what it cannot read", () => {
    expect(() => parseDateInput("someday")).toThrow("not a date I can read");
    expect(() => parseDateInput("")).toThrow("Give a date");
    expect(() => parseDateInput("12/12/2026")).toThrow("not a date I can read");
    expect(() => parseDateInput("Feb 30 2027")).toThrow("There is no 30 February in 2027");
    expect(() => parseDateInput("2026-02-31")).toThrow("real calendar date");
  });
  it("says when a name could be two things", () => {
    expect(() => parseDateInput("ju 12")).toThrow("June or July");
    expect(() => parseDateInput("t")).toThrow("Tuesday or Thursday");
  });
  it("tells a date it can read from one it cannot", () => {
    expect(() => parseDateInput("Dec 12")).not.toThrow();
    expect(() => parseDateInput("in 3 weeks")).not.toThrow();
    expect(() => parseDateInput("12/12/2026")).toThrow();
    expect(() => parseDateInput("someday")).toThrow();
  });
});
