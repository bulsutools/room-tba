import { parseDays, parseScheduleTime } from "../schedule-renderer.js";
import {
  groupClassesByOffering,
  offeringGroupKey,
} from "../class-offering-groups.js";
import type { ClassMapValue } from "@lib/types";
import type { OfferingCandidate, WeekBlock } from "./types.js";

/**
 * ClassMapValue rows -> schedulable offering candidates (#5). One candidate
 * per class-offering group (course + section, LEC/LAB/… rows merged), reusing
 * the planner's grouping so solver picks match what the planner would apply.
 *
 * `roomBuilding` optionally maps roomCode -> building name so building
 * preferences have data to score against; absent, `buildings` stays empty.
 */
export function offeringsFromClasses(
  rows: ClassMapValue[],
  roomBuilding?: ReadonlyMap<string, string>,
): OfferingCandidate[] {
  const candidates: OfferingCandidate[] = [];

  for (const group of groupClassesByOffering(rows)) {
    if (group.key.startsWith("__solo__")) continue;
    const key = offeringGroupKey(group.courseCode, group.section);
    if (!key) continue;

    const blocks: WeekBlock[] = [];
    const roomCodes = new Set<string>();
    const buildings = new Set<string>();
    let unscheduled = true;

    for (const row of group.sections) {
      if (row.roomCode) roomCodes.add(row.roomCode);
      const building = row.roomCode
        ? roomBuilding?.get(row.roomCode)
        : undefined;
      for (const str of row.schedule ?? []) {
        const parsed = parseScheduleTime(str);
        if (!parsed) continue;
        unscheduled = false;
        for (const dayIndex of parseDays(parsed.days)) {
          blocks.push({
            dayIndex,
            startMin: parsed.startMinutes,
            endMin: parsed.endMinutes,
          });
          if (building) buildings.add(building);
        }
      }
    }

    candidates.push({
      key,
      courseCode: group.courseCode,
      section: group.section,
      courseTitle: group.courseTitle,
      blocks,
      unscheduled,
      internalConflicts: countInternalConflicts(group.sections),
      roomCodes: [...roomCodes].sort(),
      buildings: [...buildings].sort(),
      rows: group.sections,
    });
  }

  return candidates.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Overlaps between blocks that belong to different component rows (LEC vs
 * LAB vs RCT). Same-row multi-day expansion never self-conflicts because each
 * block is a distinct day or a distinct schedule string; identical duplicate
 * rows are deduped first.
 */
function countInternalConflicts(rows: ClassMapValue[]): number {
  // Rebuild blocks per row so we only compare across different components.
  const perRow: WeekBlock[][] = [];
  for (const row of rows) {
    const rowBlocks: WeekBlock[] = [];
    for (const str of row.schedule ?? []) {
      const parsed = parseScheduleTime(str);
      if (!parsed) continue;
      for (const dayIndex of parseDays(parsed.days)) {
        rowBlocks.push({
          dayIndex,
          startMin: parsed.startMinutes,
          endMin: parsed.endMinutes,
        });
      }
    }
    if (rowBlocks.length > 0) perRow.push(rowBlocks);
  }
  if (perRow.length < 2) return 0;

  let conflicts = 0;
  for (let i = 0; i < perRow.length; i++) {
    for (let j = i + 1; j < perRow.length; j++) {
      for (const a of perRow[i]) {
        for (const b of perRow[j]) {
          if (blocksOverlap(a, b)) conflicts++;
        }
      }
    }
  }
  return conflicts;
}

export function blocksOverlap(
  a: { dayIndex: number; startMin: number; endMin: number },
  b: { dayIndex: number; startMin: number; endMin: number },
): boolean {
  return (
    a.dayIndex === b.dayIndex && a.startMin < b.endMin && b.startMin < a.endMin
  );
}
