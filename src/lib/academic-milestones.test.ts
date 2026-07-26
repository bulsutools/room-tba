import { describe, expect, it } from "bun:test";
import { holidaysWithin, milestonesForTerms } from "./academic-milestones";

/**
 * These assert against the committed extraction of the real AY 2026-2027
 * registrar PDF, so a parser change that moves a student-facing date fails
 * here instead of shipping.
 */
describe("milestonesForTerms", () => {
  const firstSem = milestonesForTerms([1261]);
  const find = (label: string) =>
    firstSem.find((milestone) => milestone.label === label);

  it("surfaces the student-planning rows for AY 2026-2027 1st sem", () => {
    expect(find("Start of classes")).toEqual({
      termId: 1261,
      label: "Start of classes",
      kind: "milestone",
      startsOn: "2026-08-03",
      endsOn: "2026-08-03",
    });
    expect(find("Dropping deadline")?.startsOn).toBe("2026-10-28");
    expect(find("Leave of absence deadline")?.startsOn).toBe("2026-11-12");
    expect(find("Final examinations")).toMatchObject({
      startsOn: "2026-12-01",
      endsOn: "2026-12-07",
    });
    expect(find("Reading break")).toMatchObject({
      startsOn: "2026-10-29",
      endsOn: "2026-10-31",
    });
  });

  it("repairs the label the OCR split mid-sentence", () => {
    // The dated line of the GENERAL REGISTRATION block reads
    // "registrants, non-degree/special/foreign/ exchange students".
    expect(find("General registration")).toMatchObject({
      startsOn: "2026-07-28",
      endsOn: "2026-07-30",
    });
  });

  it("keeps staff-only rows out of the UI but in the data", () => {
    const labels = firstSem.map((milestone) => milestone.label);
    expect(labels).not.toContain(
      "University Council Executive Committee Meeting",
    );
    expect(labels.some((label) => label.includes("College Faculty"))).toBe(
      false,
    );
  });

  it("returns terms in chronological order", () => {
    const dates = firstSem.map((milestone) => milestone.startsOn);
    expect([...dates].sort()).toEqual(dates);
  });

  it("has nothing for AY 2025-2026, whose PDF has no text layer", () => {
    expect(milestonesForTerms([1251, 1252, 1253])).toEqual([]);
  });
});

describe("holidaysWithin", () => {
  it("returns the official holidays inside the strip's span", () => {
    const holidays = holidaysWithin("2026-08-01", "2026-12-31");
    expect(holidays.map((holiday) => holiday.label)).toContain(
      "Ninoy Aquino Day",
    );
    expect(holidays[0]?.startsOn).toBe("2026-08-21");
    expect(holidays.every((holiday) => holiday.kind === "holiday")).toBe(true);
    // Outside the range.
    expect(holidays.map((holiday) => holiday.label)).not.toContain("Labor Day");
  });

  it("is empty for a span the registrar published no holidays in", () => {
    expect(holidaysWithin("2030-01-01", "2030-12-31")).toEqual([]);
  });
});
