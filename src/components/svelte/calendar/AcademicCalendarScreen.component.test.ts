import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import AcademicCalendarScreen from "@ui/calendar/AcademicCalendarScreen.svelte";
import {
  expectNoHorizontalOverflow,
  mountAtWidth,
} from "@test/layout-assertions";
import { EVENT_MARKER_STEP_PCT } from "@lib/academic-calendar";
import { termStore } from "@lib/store.svelte";
import {
  setAcademicCalendarsForTests,
  type AcademicCalendarData,
} from "@lib/academic-milestones";
import type { TermWithCount } from "@lib/types";

// Windows are placed around the real clock so the screen's "today" snapshot
// lands inside term B without mocking Date.
const DAY_MS = 86_400_000;
const manilaKey = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY_MS).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });

const term = (
  id: number,
  overrides: Partial<TermWithCount> = {},
): TermWithCount => ({
  id,
  label: `Term ${id}`,
  schoolYear: "2098-2099",
  semester: null,
  startsOn: null,
  endsOn: null,
  isDefault: false,
  isActive: true,
  sortOrder: id,
  classesImportedAt: null,
  version: 1,
  updatedAt: "2026-01-01",
  classCount: 0,
  ...overrides,
});

describe("AcademicCalendarScreen", () => {
  beforeEach(() => {
    termStore.terms = [
      term(9001, {
        startsOn: manilaKey(-120),
        endsOn: manilaKey(-60),
        semester: "1",
        classCount: 1200,
      }),
      term(9002, {
        startsOn: manilaKey(-10),
        endsOn: manilaKey(50),
        semester: "2",
        classCount: 3400,
      }),
      term(9003, { semester: "midyear" }),
    ];
    termStore.loaded = true;
  });

  test("renders a dialog with the year strip, today marker, and in-session highlight", () => {
    render(AcademicCalendarScreen);
    expect(
      screen.getByRole("dialog", { name: "Academic calendar" }),
    ).toBeTruthy();

    const segments = document.querySelectorAll(".acal-seg");
    expect(segments).toHaveLength(2); // 9003 has no dates anywhere
    expect(document.querySelector(".acal-seg--past")?.textContent).toContain(
      "1st sem",
    );
    expect(
      document.querySelector(".acal-seg--in-session")?.textContent,
    ).toContain("2nd sem");
    expect(document.querySelector(".acal-today")).toBeTruthy();
  });

  test("explains the strip's dots and keeps the caveat collapsed", () => {
    render(AcademicCalendarScreen);
    const legend = screen.getByRole("list", { name: "Timeline legend" });
    for (const label of ["Deadline", "Period", "Holiday", "same spot"]) {
      expect(legend.textContent).toContain(label);
    }
    expect(
      screen
        .getByText("May differ from the official BulSU academic calendar")
        .closest("details"),
    ).not.toHaveAttribute("open");
  });

  test("lists every active term with term id, date range, class count, and status", () => {
    render(AcademicCalendarScreen);
    const cards = [...document.querySelectorAll(".acal-card")];
    expect(cards).toHaveLength(3);

    const inSession = cards.find((card) =>
      card.textContent?.includes("Term 9002"),
    );
    expect(inSession?.textContent).toContain("In session");
    expect(inSession?.textContent).toContain("3400 classes campus-wide");
    expect(inSession?.classList.contains("acal-card--current")).toBe(true);

    const undated = cards.find((card) =>
      card.textContent?.includes("Term 9003"),
    );
    expect(undated?.textContent).toContain("Dates TBA");
  });

  test("shows the community-data disclaimer", () => {
    render(AcademicCalendarScreen);
    expect(
      screen.getByText("May differ from the official BulSU academic calendar"),
    ).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("Registrar");
  });

  test("says so plainly for an AY with no published registrar calendar", () => {
    // AY 2030-2031 has no registrar PDF and no holidays on file, which is also
    // the AY 2025-2026 situation (image-only scan, nothing extractable).
    termStore.terms = [
      term(1301, {
        schoolYear: "2030-2031",
        semester: "1",
        startsOn: "2030-08-05",
        endsOn: "2030-12-10",
      }),
    ];
    render(AcademicCalendarScreen);
    expect(document.querySelectorAll(".acal-dot")).toHaveLength(0);
    expect(document.querySelector(".acal-milestones")?.textContent).toContain(
      "There's no registrar calendar published",
    );
  });

  // Fixture registrar calendar standing in for the (not yet imported) BulSU
  // AY 2026-2027 calendar: two terms, staff-only rows, pre-term dates that
  // fall off the Aug-Dec strip, and one official holiday.
  const AY_2026_2027: AcademicCalendarData = {
    milestones: [
      {
        termId: 1261,
        label: "University Council Executive Committee Meeting",
        kind: "milestone",
        startsOn: "2026-07-15",
        endsOn: "2026-07-15",
      },
      {
        termId: 1261,
        label: "Application for graduation",
        kind: "deadline",
        startsOn: "2026-06-15",
        endsOn: "2026-06-19",
      },
      {
        termId: 1261,
        label: "General registration",
        kind: "deadline",
        startsOn: "2026-07-06",
        endsOn: "2026-07-10",
      },
      {
        termId: 1261,
        label: "Completion/removal examinations",
        kind: "period",
        startsOn: "2026-07-13",
        endsOn: "2026-07-17",
      },
      {
        termId: 1261,
        label: "Start of classes",
        kind: "milestone",
        startsOn: "2026-08-03",
        endsOn: "2026-08-07",
      },
      {
        termId: 1261,
        label: "Dropping of subjects",
        kind: "deadline",
        startsOn: "2026-10-28",
        endsOn: "2026-10-28",
      },
      {
        termId: 1261,
        label: "End of classes",
        kind: "milestone",
        startsOn: "2026-11-27",
        endsOn: "2026-11-27",
      },
      {
        termId: 1261,
        label: "Final examinations",
        kind: "period",
        startsOn: "2026-12-01",
        endsOn: "2026-12-07",
      },
      {
        termId: 1262,
        label: "Start of classes",
        kind: "milestone",
        startsOn: "2027-01-11",
        endsOn: "2027-01-15",
      },
      {
        termId: 1262,
        label: "Final examinations",
        kind: "period",
        startsOn: "2027-04-26",
        endsOn: "2027-05-01",
      },
    ],
    holidays: [{ label: "Ninoy Aquino Day", startsOn: "2026-08-21" }],
  };

  describe("with a fixture AY 2026-2027 registrar calendar", () => {
    beforeEach(() => {
      setAcademicCalendarsForTests([AY_2026_2027]);
      termStore.terms = [
        term(1261, {
          schoolYear: "2026-2027",
          semester: "1",
          startsOn: "2026-08-03",
          endsOn: "2026-12-07",
          classCount: 12876,
        }),
      ];
      termStore.loaded = true;
    });

    test("lists the student-planning milestones, not the staff rows", () => {
      render(AcademicCalendarScreen);
      const labels = [
        ...document.querySelectorAll(".acal-milestone__label"),
      ].map((node) => node.textContent);

      expect(labels).toContain("Start of classes");
      expect(labels).toContain("Dropping deadline");
      expect(labels).toContain("Final examinations");
      expect(labels).toContain("Ninoy Aquino Day");
      expect(labels).not.toContain(
        "University Council Executive Committee Meeting",
      );
    });

    test("marks each milestone on the strip without overlap", () => {
      render(AcademicCalendarScreen);
      const dots = [...document.querySelectorAll<HTMLElement>(".acal-dot")];
      expect(dots.length).toBeGreaterThan(3);

      const lefts = dots
        .map((dot) => Number.parseFloat(dot.style.left))
        .sort((a, b) => a - b);
      for (const [index, left] of lefts.entries()) {
        expect(left).toBeGreaterThanOrEqual(EVENT_MARKER_STEP_PCT / 2);
        expect(left).toBeLessThanOrEqual(100 - EVENT_MARKER_STEP_PCT / 2);
        const previous = lefts[index - 1];
        if (previous !== undefined) {
          expect(left - previous).toBeGreaterThanOrEqual(EVENT_MARKER_STEP_PCT);
        }
      }
    });

    test("shows the date range for a period and a single date for a deadline", () => {
      render(AcademicCalendarScreen);
      const rowFor = (label: string) =>
        [...document.querySelectorAll(".acal-milestone")].find((row) =>
          row
            .querySelector(".acal-milestone__label")
            ?.textContent?.includes(label),
        );

      expect(rowFor("Final examinations")?.textContent).toContain(
        "Dec 1 – Dec 7",
      );
      expect(rowFor("Dropping deadline")?.textContent).toContain("Oct 28");
      expect(
        rowFor("Dropping deadline")?.classList.contains(
          "acal-milestone--deadline",
        ),
      ).toBe(true);
    });

    test("a term card opens to its own registrar dates", () => {
      render(AcademicCalendarScreen);
      const card = document.querySelector<HTMLDetailsElement>(".acal-card");

      expect(card?.tagName).toBe("DETAILS");
      // The in-session term starts open so the dates are not a click away.
      expect(card?.querySelector(".acal-card__head")?.tagName).toBe("SUMMARY");

      const labels = [
        ...(card?.querySelectorAll(
          ".acal-card__dates .acal-milestone__label",
        ) ?? []),
      ].map((node) => node.textContent);
      expect(labels).toContain("Start of classes");
      expect(labels).toContain("Final examinations");
    });

    test("a term card only lists its own term's dates", () => {
      termStore.terms = [
        term(1261, { schoolYear: "2026-2027", semester: "1" }),
        term(1262, { schoolYear: "2026-2027", semester: "2" }),
      ];
      render(AcademicCalendarScreen);
      const cards = document.querySelectorAll(".acal-card");
      expect(cards.length).toBe(2);

      // Both terms have a "Start of classes", on different dates: the second
      // card must not repeat the first card's.
      const datesIn = (card: Element) =>
        [...card.querySelectorAll(".acal-card__dates .acal-milestone")]
          .filter((row) =>
            row
              .querySelector(".acal-milestone__label")
              ?.textContent?.includes("Start of classes"),
          )
          .map(
            (row) => row.querySelector(".acal-milestone__date")?.textContent,
          );

      expect(datesIn(cards[0])).toHaveLength(1);
      expect(datesIn(cards[1])).toHaveLength(1);
      expect(datesIn(cards[0])).not.toEqual(datesIn(cards[1]));
    });

    test("owns up to the registrar dates that fall off the strip", () => {
      // The strip is padded to the term's own months (Aug - Dec), but
      // registration and completion exams run in July. Those rows must not
      // vanish silently from a list headed "Registrar calendar for AY ...".
      render(AcademicCalendarScreen);
      const labelsIn = (selector: string) =>
        [
          ...document.querySelectorAll(`${selector} .acal-milestone__label`),
        ].map((node) => node.textContent);

      expect(labelsIn(".acal-milestones__list")).not.toContain(
        "General registration",
      );
      expect(labelsIn(".acal-card__dates")).toContain("General registration");

      const note = document
        .querySelector(".acal-milestones")
        ?.textContent?.replace(/\s+/g, " ");
      expect(note).toContain("3 registrar dates fall outside the months shown");
      expect(note).toContain("in its card below");
    });
    afterEach(() => {
      setAcademicCalendarsForTests(null);
    });

    test("@320px: no horizontal overflow with the full milestone list", () => {
      mountAtWidth(320);
      const { container } = render(AcademicCalendarScreen);
      expectNoHorizontalOverflow(container);
      const screenEl = container.querySelector<HTMLElement>(".acal-screen");
      if (screenEl) expectNoHorizontalOverflow(screenEl);
    });
  });
});
