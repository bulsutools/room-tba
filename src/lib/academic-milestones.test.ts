import { describe, expect, it } from "bun:test";
import { holidaysWithin, milestonesForTerms } from "./academic-milestones";

/**
 * The BulSU fork has no parsed registrar calendar yet, so every lookup
 * returns empty. These tests pin that behavior: once a BulSU academic
 * calendar is imported, extend the fixtures here.
 */
describe("milestonesForTerms", () => {
  it("returns nothing for any term while CALENDARS is empty", () => {
    expect(milestonesForTerms([1261])).toEqual([]);
    expect(milestonesForTerms([1251, 1252, 1253])).toEqual([]);
    expect(milestonesForTerms([])).toEqual([]);
  });
});

describe("holidaysWithin", () => {
  it("returns nothing for any span while CALENDARS is empty", () => {
    expect(holidaysWithin("2026-08-01", "2026-12-31")).toEqual([]);
    expect(holidaysWithin("2030-01-01", "2030-12-31")).toEqual([]);
  });
});
