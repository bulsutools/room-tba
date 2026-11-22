import { describe, expect, test } from "bun:test";
import {
  routeScheduleSummary,
  SCHEDULE_NOT_PUBLISHED,
  summarizeSchedule,
} from "./transit-schedule";

describe("summarizeSchedule", () => {
  test("says the schedule is not published instead of inventing one", () => {
    const summary = routeScheduleSummary("kaliwa-kanan");
    expect(summary.published).toBe(false);
    expect(summary.hours).toBe(SCHEDULE_NOT_PUBLISHED);
    expect(summary.frequency).toBe("Frequency not published");
  });

  test("every route reads not-published while ROUTE_SCHEDULES is empty", () => {
    for (const id of ["north-loop", "south-loop", "any-route"]) {
      const summary = routeScheduleSummary(id);
      expect(summary.published).toBe(false);
      expect(summary.hours).toBe(SCHEDULE_NOT_PUBLISHED);
    }
  });

  test("uses a stated headway", () => {
    expect(
      summarizeSchedule({ days: "Weekdays", headwayMinutes: 10 }).frequency,
    ).toBe("Every 10 min");
  });
});
