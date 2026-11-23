import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, test } from "vitest";
import TimetableAssistant from "@ui/planner/TimetableAssistant.svelte";
import { plannerStore, termStore } from "@lib/store.svelte";
import type { ClassMapValue } from "@lib/types";

const row = (
  overrides: Partial<ClassMapValue> &
    Pick<ClassMapValue, "id" | "courseCode" | "section" | "type">,
): ClassMapValue => ({
  schedule: null,
  roomCode: null,
  directions: null,
  courseTitle: null,
  roomId: null,
  termId: 1252,
  ...overrides,
});

// Two courses, two sections each; CMSC "A" and MATH "X" collide on MWF.
const rows: ClassMapValue[] = [
  row({
    id: 1,
    courseCode: "CMSC 128",
    section: "A",
    type: "LEC",
    schedule: ["MWF 08:00AM-09:00AM"],
    roomCode: "ENG-301",
  }),
  row({
    id: 2,
    courseCode: "CMSC 128",
    section: "B",
    type: "LEC",
    schedule: ["TTh 10:00AM-11:30AM"],
    roomCode: "ENG-302",
  }),
  row({
    id: 3,
    courseCode: "MATH 27",
    section: "X",
    type: "LEC",
    schedule: ["MWF 08:30AM-09:30AM"],
    roomCode: "SCI-201",
  }),
  row({
    id: 4,
    courseCode: "MATH 27",
    section: "Y",
    type: "LEC",
    schedule: ["TTh 01:00PM-02:30PM"],
    roomCode: "SCI-202",
  }),
];

describe("TimetableAssistant", () => {
  beforeEach(() => {
    // localStorage is unavailable under this Node/happy-dom combo (same as
    // the other planner component tests); the store's persist() already
    // swallows storage failures, and we reset state directly below.
    termStore.activeTermId = 1252;
    termStore.terms = [];
    plannerStore.plans = [];
    plannerStore.activePlanIdByTerm = {};
  });

  test("renders ranked conflict-free proposals and applies one", async () => {
    plannerStore.addOffering([
      row({
        id: 10,
        courseCode: "CMSC 128",
        section: "A",
        type: "LEC",
        schedule: ["MWF 08:00AM-09:00AM"],
      }),
      row({
        id: 11,
        courseCode: "MATH 27",
        section: "X",
        type: "LEC",
        schedule: ["MWF 08:30AM-09:30AM"],
      }),
    ]);
    render(TimetableAssistant, { rows, onopenroom: () => {} });

    await fireEvent.click(screen.getByText("Find proposals"));
    await waitFor(() => {
      expect(screen.getByText("Option 1")).toBeTruthy();
    });
    // Proposals list renders picks with room buttons wired to the map.
    expect(screen.getAllByText(/ENG-|SCI-/).length).toBeGreaterThan(0);

    await fireEvent.click(screen.getAllByText("Use this option")[0]);
    const plan = plannerStore.activePlan;
    // Applied option must not pair the conflicting A + X sections.
    const picks = plan?.sections.map((s) => `${s.courseCode}::${s.section}`);
    expect(picks).not.toContain("CMSC 128::A");
    expect(picks).not.toContain("MATH 27::X");
  });

  test("falls back to study-block planning with no schedule data", async () => {
    plannerStore.addOffering([
      row({
        id: 20,
        courseCode: "GEED 1",
        section: "Z",
        type: "LEC",
        schedule: ["TBA"],
      }),
    ]);
    render(TimetableAssistant, { rows: [], onopenroom: () => {} });

    expect(screen.getByText(/No class schedule data/)).toBeTruthy();
    await fireEvent.click(screen.getByText("Plan study blocks"));
    await waitFor(() => {
      expect(screen.getByText("Option 1")).toBeTruthy();
    });
    // Dated sessions render in the same list pattern.
    expect(
      document.querySelectorAll(".assistant__pick").length,
    ).toBeGreaterThan(0);
  });
});
