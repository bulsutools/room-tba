import type { ClassMapValue } from "@lib/types";

/**
 * Timetable assistant constraint model (#5). Two modes share it:
 *
 * - Class mode: `solveTimetable` picks one section offering per course and
 *   checks the merged weekly pattern against the constraints below.
 * - Study-block mode: `planStudyBlocks` places dated study sessions with zero
 *   schedule data, honoring `blackoutDates` (calendar blackouts like finals
 *   week) plus the same day/time rules.
 */

/** One meeting on the weekly pattern. dayIndex 0-5 = M-S (parseDays). */
export type WeekBlock = {
  dayIndex: number;
  startMin: number; // minutes since midnight
  endMin: number;
};

/** Inclusive ISO date range (YYYY-MM-DD) with no classes/study blocks. */
export type BlackoutWindow = {
  startDate: string;
  endDate: string;
};

export type DayWindow = {
  /** Inclusive earliest start, minutes since midnight. */
  startMin?: number;
  /** Exclusive latest end, minutes since midnight. */
  endMin?: number;
};

export type TimetableConstraints = {
  /** Days a block may land on; default all six (M-S). */
  allowedDays?: number[];
  /** Global earliest start / latest end applied to every block. */
  window?: DayWindow;
  /** Per-day overrides merged over `window` (dayIndex 0-5). */
  dayWindows?: Partial<Record<number, DayWindow>>;
  /** Recurring weekly blackouts (e.g. "MW 11:00-12:00 org assembly"). */
  blockedWindows?: WeekBlock[];
  /** Dated calendar blackouts; consulted by study-block mode. */
  blackoutDates?: BlackoutWindow[];
  /** Soft preference: offerings whose rooms sit in these buildings score up. */
  preferredBuildings?: string[];
  /** Hard cap on distinct days with any block. */
  maxDaysOnCampus?: number;
  /** Soft preference: courseCode -> section the user already favors. */
  preferredSections?: Record<string, string>;
};

/** One schedulable class offering: all type rows sharing course + section. */
export type OfferingCandidate = {
  /** courseCode::section natural key. */
  key: string;
  courseCode: string;
  section: string;
  courseTitle: string | null;
  /** Every parsed block across the offering's rows. */
  blocks: WeekBlock[];
  /** Rows with no parseable schedule ("TBA") — solver never picks these. */
  unscheduled: boolean;
  /** Blocks from different component rows that overlap each other. */
  internalConflicts: number;
  roomCodes: string[];
  buildings: string[];
  /** Source rows, kept so a proposal can be applied back to the planner. */
  rows: ClassMapValue[];
};

export type TimetableProposal = {
  /** Deterministic rank order, 0-based. */
  rank: number;
  score: number;
  /** Chosen candidate per required course, sorted by courseCode. */
  picks: OfferingCandidate[];
  daysOnCampus: number;
  /** Human-readable scoring notes ("3 days on campus", "prefers HS"). */
  notes: string[];
};

export type SolveResult = {
  proposals: TimetableProposal[];
  /** Required courses with no placeable candidate at all. */
  uncoveredCourses: string[];
};

export type StudySession = {
  /** ISO date YYYY-MM-DD. */
  date: string;
  startMin: number;
  endMin: number;
};

export type StudyBlockProposal = {
  rank: number;
  score: number;
  /** Weekly pattern this proposal expands into sessions. */
  days: number[];
  startMin: number;
  endMin: number;
  sessions: StudySession[];
  notes: string[];
};
