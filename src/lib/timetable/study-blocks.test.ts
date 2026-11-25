import { describe, expect, it } from "bun:test";
import { formatMinutes, planStudyBlocks } from "./study-blocks.js";
import type { TimetableConstraints } from "./types.js";

// Monday 2026-03-02, Asia/Manila.
const TODAY = new Date("2026-03-02T10:00:00+08:00");

// Term 1252 window (from TERM_CALENDAR_WINDOWS): Jan 19 – May 31 2026,
// finals May 15–22.
const TERM = {
  id: 1252,
  startsOn: "2026-01-19",
  endsOn: "2026-05-31",
} as const;

function sessionDates(proposal: { sessions: { date: string }[] }) {
  return proposal.sessions.map((s) => s.date);
}

describe("planStudyBlocks", () => {
  it("works with zero schedule data and returns dated sessions", () => {
    const proposals = planStudyBlocks({ term: TERM, today: TODAY });
    expect(proposals.length).toBeGreaterThan(0);
    for (const proposal of proposals) {
      expect(proposal.sessions.length).toBeGreaterThan(0);
      for (const session of proposal.sessions) {
        expect(session.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(session.startMin).toBeLessThan(session.endMin);
      }
    }
  });

  it("honors allowedDays and day windows", () => {
    const constraints: TimetableConstraints = {
      allowedDays: [0, 2], // Mon + Wed only
      window: { startMin: 9 * 60, endMin: 17 * 60 },
    };
    const proposals = planStudyBlocks({
      term: TERM,
      today: TODAY,
      constraints,
    });
    expect(proposals.length).toBeGreaterThan(0);
    for (const proposal of proposals) {
      for (const session of proposal.sessions) {
        const weekday = new Date(`${session.date}T00:00:00Z`).getUTCDay();
        const index = (weekday + 6) % 7; // Mon=0
        expect([0, 2]).toContain(index);
        expect(session.startMin).toBeGreaterThanOrEqual(9 * 60);
        expect(session.endMin).toBeLessThanOrEqual(17 * 60);
      }
    }
  });

  it("skips dated calendar blackouts", () => {
    const constraints: TimetableConstraints = {
      blackoutDates: [{ startDate: "2026-03-02", endDate: "2026-03-08" }],
    };
    const proposals = planStudyBlocks({
      term: TERM,
      today: TODAY,
      constraints,
      sessionMinutes: 120,
    });
    for (const proposal of proposals) {
      for (const date of sessionDates(proposal)) {
        expect(date < "2026-03-02" || date > "2026-03-08").toBe(true);
      }
    }
  });

  it("skips finals week from the term calendar", () => {
    // Week of Mon 2026-05-11 contains finals Fri 2026-05-15 → Sat 2026-05-22.
    const today = new Date("2026-05-11T10:00:00+08:00");
    const proposals = planStudyBlocks({
      term: TERM,
      today,
      constraints: { allowedDays: [4, 5] }, // Fri + Sat only
      sessionMinutes: 120,
    });
    for (const proposal of proposals) {
      for (const date of sessionDates(proposal)) {
        expect(date >= "2026-05-15" && date <= "2026-05-22").toBe(false);
      }
    }
  });

  it("avoids recurring weekly blocked windows", () => {
    const constraints: TimetableConstraints = {
      allowedDays: [0], // Mondays only
      // Monday 18:00-20:00 org assembly; default window ends 18:00 anyway,
      // so block the whole default day instead.
      blockedWindows: [{ dayIndex: 0, startMin: 8 * 60, endMin: 18 * 60 }],
    };
    const proposals = planStudyBlocks({
      term: TERM,
      today: TODAY,
      constraints,
    });
    // Every Monday slot collides with the blackout → no proposals.
    expect(proposals).toEqual([]);
  });

  it("clamps sessions to the term window", () => {
    // Today is the last week of term; sessions must not run past endsOn.
    const today = new Date("2026-05-25T10:00:00+08:00"); // Mon, term ends Sun May 31
    const proposals = planStudyBlocks({ term: TERM, today });
    for (const proposal of proposals) {
      for (const date of sessionDates(proposal)) {
        expect(date <= "2026-05-31").toBe(true);
      }
    }
  });
});

describe("formatMinutes", () => {
  it("formats 24h minutes as 12h time", () => {
    expect(formatMinutes(8 * 60)).toBe("8:00 AM");
    expect(formatMinutes(13 * 60 + 30)).toBe("1:30 PM");
    expect(formatMinutes(0)).toBe("12:00 AM");
    expect(formatMinutes(12 * 60)).toBe("12:00 PM");
  });
});
