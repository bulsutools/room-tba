import type {
  OfferingCandidate,
  TimetableConstraints,
  WeekBlock,
} from "./types.js";
import { blocksOverlap } from "./candidates.js";

const ALL_DAYS = [0, 1, 2, 3, 4, 5];

/** Effective day set: constraint override or the full M-S week. */
export function allowedDays(constraints?: TimetableConstraints): Set<number> {
  return new Set(constraints?.allowedDays ?? ALL_DAYS);
}

/** Effective window for one day: per-day override merged over the global one. */
export function dayWindow(
  constraints: TimetableConstraints | undefined,
  dayIndex: number,
): { startMin?: number; endMin?: number } {
  return {
    startMin:
      constraints?.dayWindows?.[dayIndex]?.startMin ??
      constraints?.window?.startMin,
    endMin:
      constraints?.dayWindows?.[dayIndex]?.endMin ??
      constraints?.window?.endMin,
  };
}

/** Hard check: every block lands on an allowed day inside its day window. */
export function blocksFitWindows(
  blocks: WeekBlock[],
  constraints?: TimetableConstraints,
): boolean {
  const days = allowedDays(constraints);
  for (const block of blocks) {
    if (!days.has(block.dayIndex)) return false;
    const win = dayWindow(constraints, block.dayIndex);
    if (win.startMin != null && block.startMin < win.startMin) return false;
    if (win.endMin != null && block.endMin > win.endMin) return false;
  }
  return true;
}

/** Hard check: no block overlaps a recurring weekly blackout window. */
export function blocksAvoidBlackouts(
  blocks: WeekBlock[],
  constraints?: TimetableConstraints,
): boolean {
  for (const block of blocks) {
    for (const blackout of constraints?.blockedWindows ?? []) {
      if (blocksOverlap(block, blackout)) return false;
    }
  }
  return true;
}

/**
 * Hard feasibility for one offering: scheduled, internally consistent, and
 * inside every hard constraint. TBA offerings and offerings whose own
 * components overlap can never be proposed.
 */
export function candidateIsPlaceable(
  candidate: OfferingCandidate,
  constraints?: TimetableConstraints,
): boolean {
  return (
    !candidate.unscheduled &&
    candidate.internalConflicts === 0 &&
    blocksFitWindows(candidate.blocks, constraints) &&
    blocksAvoidBlackouts(candidate.blocks, constraints)
  );
}

/** Distinct days with at least one block. */
export function daysOnCampus(blocks: WeekBlock[]): number {
  return new Set(blocks.map((b) => b.dayIndex)).size;
}

/**
 * Soft score for a complete proposal. Higher is better; deterministic.
 * - preferred building hits: +3 each (capped per pick)
 * - preferred section matches: +5 each
 * - fewer days on campus: +1 per day under the max (or just -1/day baseline)
 */
export function scoreProposal(
  picks: OfferingCandidate[],
  constraints?: TimetableConstraints,
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 0;

  const preferredBuildings = new Set(
    (constraints?.preferredBuildings ?? []).map((b) => b.toUpperCase()),
  );
  if (preferredBuildings.size > 0) {
    let hits = 0;
    for (const pick of picks) {
      if (pick.buildings.some((b) => preferredBuildings.has(b.toUpperCase()))) {
        hits++;
      }
    }
    if (hits > 0) {
      score += hits * 3;
      notes.push(
        `${hits} course${hits === 1 ? "" : "s"} in preferred buildings`,
      );
    }
  }

  const preferredSections = constraints?.preferredSections ?? {};
  let matches = 0;
  for (const pick of picks) {
    if (preferredSections[pick.courseCode] === pick.section) matches++;
  }
  if (matches > 0) {
    score += matches * 5;
    notes.push(
      `${matches} section${matches === 1 ? "" : "s"} match your current picks`,
    );
  }

  const days = daysOnCampus(picks.flatMap((p) => p.blocks));
  score -= days;
  notes.push(`${days} day${days === 1 ? "" : "s"} on campus`);

  if (
    constraints?.maxDaysOnCampus != null &&
    days > constraints.maxDaysOnCampus
  ) {
    // Should be unreachable — the solver hard-filters these — but keep the
    // penalty so a hand-built proposal list still ranks sanely.
    score -= (days - constraints.maxDaysOnCampus) * 10;
    notes.push(`exceeds ${constraints.maxDaysOnCampus}-day limit`);
  }

  return { score, notes };
}

/** Pairwise overlap across picks; used to prune partial assignments. */
export function picksConflict(
  a: OfferingCandidate,
  b: OfferingCandidate,
): boolean {
  for (const ba of a.blocks) {
    for (const bb of b.blocks) {
      if (blocksOverlap(ba, bb)) return true;
    }
  }
  return false;
}

/** Proposal-level hard check: day cap plus pairwise conflicts. */
export function proposalIsFeasible(
  picks: OfferingCandidate[],
  constraints?: TimetableConstraints,
): boolean {
  if (constraints?.maxDaysOnCampus != null) {
    const days = daysOnCampus(picks.flatMap((p) => p.blocks));
    if (days > constraints.maxDaysOnCampus) return false;
  }
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      if (picksConflict(picks[i], picks[j])) return false;
    }
  }
  return true;
}
