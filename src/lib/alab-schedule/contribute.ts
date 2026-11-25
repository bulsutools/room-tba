/**
 * Contribution planning for POST /api/contributions/alab-schedule
 * (docs/alab-schedule-bridge.md, use case B).
 *
 * Pure logic lives here so `bun run test` covers it; the route owns DB access.
 */
import { checkRateLimit } from "@lib/api/rate-limit";
import {
  alabDedupeKey,
  meetingToScheduleSlot,
  normalizeRoomCode,
  type AlabClassEntry,
  type AlabSchedulePayload,
} from "./payload";

const SHORT_WINDOW_MS = 10 * 60 * 1000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

const IP_SHORT_MAX = 30;
const IP_DAILY_MAX = 300;
const STUDENT_SHORT_MAX = 4;
const STUDENT_DAILY_MAX = 12;

/** Max class entries accepted per submission. */
export const ALAB_MAX_CLASSES_PER_SUBMISSION = 60;

export const ALAB_PROPOSAL_SUBMITTER_NAME = "GradeSim/ALAB";
export const ALAB_PROPOSAL_SOURCE = "alab-grade-tools";

export function enforceAlabSubmitLimits(
  ip: string,
  studentHash: string,
  now = Date.now(),
): { allowed: false; resetAt: number } | null {
  const ipShort = checkRateLimit(
    `alab-schedule:ip-short:${ip}`,
    IP_SHORT_MAX,
    SHORT_WINDOW_MS,
    now,
  );
  if (!ipShort.allowed) return { allowed: false, resetAt: ipShort.resetAt };

  const studentShort = checkRateLimit(
    `alab-schedule:student-short:${studentHash}`,
    STUDENT_SHORT_MAX,
    SHORT_WINDOW_MS,
    now,
  );
  if (!studentShort.allowed) {
    return { allowed: false, resetAt: studentShort.resetAt };
  }

  const ipDaily = checkRateLimit(
    `alab-schedule:ip-daily:${ip}`,
    IP_DAILY_MAX,
    DAILY_WINDOW_MS,
    now,
  );
  if (!ipDaily.allowed) return { allowed: false, resetAt: ipDaily.resetAt };

  const studentDaily = checkRateLimit(
    `alab-schedule:student-daily:${studentHash}`,
    STUDENT_DAILY_MAX,
    DAILY_WINDOW_MS,
    now,
  );
  if (!studentDaily.allowed) {
    return { allowed: false, resetAt: studentDaily.resetAt };
  }

  return null;
}

export type AlabClassPatch = {
  courseCode: string;
  section: string;
  type: string;
  schedule: string[];
  roomCode: string | null;
  roomName: string | null;
  courseTitle: string | null;
  termId: number;
  professor: string | null;
  isOnline: boolean;
  source: typeof ALAB_PROPOSAL_SOURCE;
  studentHash: string;
  /** Issue #16 dataset key: course + section + type + room (normalized). */
  dedupeKey: string;
  /** classes-table natural key (term + course + section + type, no room). */
  naturalKey: string;
};

/**
 * One class entry → one patch. The `classes` table holds a single roomId per
 * row, so meetings spanning several rooms collapse to the room covering the
 * most meetings (ties → first seen); all meeting times still land in
 * `schedule`. Reviewers see `roomCode`/`roomName` and can request changes.
 */
export function alabClassPatch(
  entry: AlabClassEntry,
  termId: number,
  studentHash: string,
): AlabClassPatch {
  const schedule = [
    ...new Set(
      entry.meetings
        .map(meetingToScheduleSlot)
        .filter((slot): slot is string => slot !== null),
    ),
  ];

  // Room = the code with the most meetings; name from the first meeting that
  // reported one for that code.
  const roomVotes = new Map<
    string,
    { count: number; name: string | null; first: number }
  >();
  entry.meetings.forEach((meeting, index) => {
    const code = normalizeRoomCode(meeting.room?.code);
    if (!code) return;
    const vote = roomVotes.get(code) ?? { count: 0, name: null, first: index };
    vote.count += 1;
    vote.name ??= meeting.room?.name?.trim() || null;
    roomVotes.set(code, vote);
  });
  let roomCode: string | null = null;
  let roomName: string | null = null;
  let best: { count: number; first: number } | null = null;
  for (const [code, vote] of roomVotes) {
    if (
      !best ||
      vote.count > best.count ||
      (vote.count === best.count && vote.first < best.first)
    ) {
      best = vote;
      roomCode = code;
      roomName = vote.name;
    }
  }

  const dedupeKey = alabDedupeKey({
    courseCode: entry.courseCode,
    section: entry.section,
    type: entry.type,
    roomCode,
  });
  const naturalKey = [
    entry.courseCode.trim().toUpperCase(),
    entry.section.trim().toUpperCase(),
    entry.type.trim().toUpperCase(),
  ].join("|");

  return {
    courseCode: entry.courseCode,
    section: entry.section,
    type: entry.type,
    schedule,
    roomCode,
    roomName,
    courseTitle: entry.courseTitle ?? null,
    termId,
    professor: entry.professor ?? null,
    isOnline: entry.isOnline === true,
    source: ALAB_PROPOSAL_SOURCE,
    studentHash,
    dedupeKey,
    naturalKey,
  };
}

export type SkippedMapping = {
  dedupeKey: string;
  naturalKey: string;
  courseCode: string;
  section: string;
  reason: "already_published" | "pending_review" | "duplicate_in_payload";
};

export type ContributionPlan = {
  patches: AlabClassPatch[];
  skipped: SkippedMapping[];
};

/**
 * Decide which mappings become proposals.
 * - `publishedNaturalKeys`: natural keys (no room) with a live `classes` row —
 *   the dataset cannot hold a second row for the same offering.
 * - `pendingDedupeKeys`: dedupe keys (with room) already on an open
 *   `create_class` proposal. Same offering + same room dedupes; same offering
 *   + different room still reaches review so a human resolves the conflict.
 */
export function planAlabContribution(
  payload: AlabSchedulePayload,
  termId: number,
  studentHash: string,
  publishedNaturalKeys: ReadonlySet<string>,
  pendingDedupeKeys: ReadonlySet<string>,
): ContributionPlan {
  const patches: AlabClassPatch[] = [];
  const skipped: SkippedMapping[] = [];
  const seen = new Set<string>();

  for (const entry of payload.classes.slice(
    0,
    ALAB_MAX_CLASSES_PER_SUBMISSION,
  )) {
    const patch = alabClassPatch(entry, termId, studentHash);
    const base = {
      dedupeKey: patch.dedupeKey,
      naturalKey: patch.naturalKey,
      courseCode: patch.courseCode,
      section: patch.section,
    };
    if (seen.has(patch.dedupeKey)) {
      skipped.push({ ...base, reason: "duplicate_in_payload" });
      continue;
    }
    seen.add(patch.dedupeKey);
    if (publishedNaturalKeys.has(patch.naturalKey)) {
      skipped.push({ ...base, reason: "already_published" });
      continue;
    }
    if (pendingDedupeKeys.has(patch.dedupeKey)) {
      skipped.push({ ...base, reason: "pending_review" });
      continue;
    }
    patches.push(patch);
  }
  return { patches, skipped };
}
