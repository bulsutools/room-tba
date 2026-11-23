import { isFinalsWeek, termDateKey } from "../term-calendar.js";
import type { Term } from "@lib/types";
import {
  blocksFitWindows,
  blocksAvoidBlackouts,
  dayWindow,
} from "./constraints.js";
import type {
  BlackoutWindow,
  StudyBlockProposal,
  StudySession,
  TimetableConstraints,
  WeekBlock,
} from "./types.js";

const DAY_MS = 86_400_000;

function isoFromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** Manila day key for `date`, matching the app's "today". */
function manilaDayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function inBlackout(isoDate: string, windows: BlackoutWindow[]): boolean {
  return windows.some((w) => isoDate >= w.startDate && isoDate <= w.endDate);
}

export type StudyBlockInput = {
  constraints?: TimetableConstraints;
  /** Term window bounds study sessions; without it only `weekOf` is used. */
  term?: Pick<Term, "id" | "startsOn" | "endsOn"> | null;
  /** Anchor date; sessions expand for its Mon-Sun week (Asia/Manila). */
  today?: Date;
  /** Study session length in minutes. Default 120. */
  sessionMinutes?: number;
  /** Gap between sessions on the same day. Default 0. */
  gapMinutes?: number;
  /** Sessions per week cap. Default 5. */
  maxSessionsPerWeek?: number;
  /** Max ranked proposals. Default 3. */
  maxProposals?: number;
};

/**
 * "Study block planner" mode (#5): proposes dated study sessions with zero
 * schedule data. Works off the weekly constraint model plus dated calendar
 * blackouts (finals week, org-wide closures) and the term window.
 */
export function planStudyBlocks(input: StudyBlockInput): StudyBlockProposal[] {
  const today = input.today ?? new Date();
  const sessionMinutes = input.sessionMinutes ?? 120;
  const gapMinutes = input.gapMinutes ?? 0;
  const maxSessions = input.maxSessionsPerWeek ?? 5;
  const maxProposals = input.maxProposals ?? 3;
  const constraints = input.constraints;

  // Week containing `today` in Asia/Manila, Monday-first.
  const todayKey = manilaDayKey(today);
  const todayNum = dayNumber(todayKey);
  const weekdayIndex = (new Date(`${todayKey}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon=0
  const weekStart = todayNum - weekdayIndex;

  const termStart = termDateKey(input.term?.startsOn);
  const termEnd = termDateKey(input.term?.endsOn);
  const blackoutDates = constraints?.blackoutDates ?? [];

  const isBlockedDate = (iso: string) =>
    inBlackout(iso, blackoutDates) ||
    (input.term != null &&
      isFinalsWeek(new Date(`${iso}T12:00:00+08:00`), input.term));
  const inTerm = (iso: string) =>
    (!termStart || iso >= termStart) && (!termEnd || iso <= termEnd);

  // Candidate start slots per allowed day, honoring day windows.
  const days = [...(constraints?.allowedDays ?? [0, 1, 2, 3, 4, 5])].sort(
    (a, b) => a - b,
  );
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const proposals: StudyBlockProposal[] = [];
  const seen = new Set<string>();

  for (const dayIndex of days) {
    const win = dayWindow(constraints, dayIndex);
    const dayStart = win.startMin ?? 8 * 60; // sensible campus default: 8 AM
    const dayEnd = win.endMin ?? 18 * 60; // …to 6 PM
    if (dayEnd - dayStart < sessionMinutes) continue;

    // Recurring weekly blackouts shrink the usable span on this weekday.
    const busy = (constraints?.blockedWindows ?? [])
      .filter((b) => b.dayIndex === dayIndex)
      .sort((a, b) => a.startMin - b.startMin);

    const freeSpans: { startMin: number; endMin: number }[] = [];
    let cursor = dayStart;
    for (const b of busy) {
      const bs = Math.max(b.startMin, dayStart);
      const be = Math.min(b.endMin, dayEnd);
      if (bs > cursor) freeSpans.push({ startMin: cursor, endMin: bs });
      cursor = Math.max(cursor, be);
    }
    if (cursor < dayEnd) freeSpans.push({ startMin: cursor, endMin: dayEnd });

    for (const span of freeSpans) {
      // Pack sessions back-to-back inside the free span.
      const sessions: StudySession[] = [];
      let start = span.startMin;
      while (
        start + sessionMinutes <= span.endMin &&
        sessions.length < maxSessions
      ) {
        // Find the first week day this slot lands on that isn't blocked.
        for (let weekOffset = 0; weekOffset < 2; weekOffset++) {
          const iso = isoFromDayNumber(weekStart + weekOffset * 7 + dayIndex);
          if (!inTerm(iso) || isBlockedDate(iso)) continue;
          sessions.push({
            date: iso,
            startMin: start,
            endMin: start + sessionMinutes,
          });
          break;
        }
        start += sessionMinutes + gapMinutes;
      }
      if (sessions.length === 0) continue;

      const signature = `${dayIndex}:${startMinOf(sessions)}:${sessions.length}`;
      if (seen.has(signature)) continue;
      seen.add(signature);

      const weekly: WeekBlock[] = [
        {
          dayIndex,
          startMin: sessions[0].startMin,
          endMin: sessions[0].endMin,
        },
      ];
      const fits =
        blocksFitWindows(weekly, constraints) &&
        blocksAvoidBlackouts(weekly, constraints);
      if (!fits) continue;

      const notes = [
        `${dayNames[dayIndex]} ${formatMinutes(sessions[0].startMin)}–${formatMinutes(sessions[0].endMin)}`,
        `${sessions.length} session${sessions.length === 1 ? "" : "s"} this week`,
      ];
      proposals.push({
        rank: proposals.length,
        score: scoreStudyProposal(
          dayIndex,
          sessions[0].startMin,
          sessions.length,
        ),
        days: [dayIndex],
        startMin: sessions[0].startMin,
        endMin: sessions[0].endMin,
        sessions,
        notes,
      });
    }
  }

  return proposals
    .sort(
      (a, b) =>
        b.score - a.score || a.startMin - b.startMin || a.days[0] - b.days[0],
    )
    .slice(0, maxProposals)
    .map((p, i) => ({ ...p, rank: i }));
}

function startMinOf(sessions: StudySession[]): number {
  return sessions[0]?.startMin ?? 0;
}

/**
 * Prefer mid-morning/afternoon slots over dawn/dusk, and more sessions per
 * week over fewer (a packed week finishes the syllabus sooner).
 */
function scoreStudyProposal(
  dayIndex: number,
  startMin: number,
  sessionCount: number,
): number {
  let score = sessionCount * 2;
  // Penalize starts before 9 AM and after 5 PM.
  if (startMin < 9 * 60) score -= (9 * 60 - startMin) / 60;
  if (startMin >= 17 * 60) score -= (startMin - 17 * 60) / 30;
  // Slight Friday/Saturday discount — most students want weekends free.
  if (dayIndex === 4) score -= 1;
  if (dayIndex === 5) score -= 2;
  return score;
}

export function formatMinutes(min: number): string {
  const hour24 = Math.floor(min / 60);
  const minute = min % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${period}`;
}
