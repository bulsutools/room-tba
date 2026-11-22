/**
 * Class (`classes` table) writes for the ALAB schedule bridge (#16).
 *
 * Classes have no admin CRUD surface — the only writer today is the AMIS
 * import script. `create_class` proposals publish through here so they get
 * the same room resolution (rooms + aliases, tiered like the importer),
 * editor history row, and `classes` sync-key bump.
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  aliasesTable,
  classesTable,
  editProposalsTable,
  roomsTable,
} from "@drizzle/schema";
import { db } from "@lib/db";
import {
  buildRoomLookup,
  matchRoomId,
} from "@lib/amis/import-classes";
import { recordEditorHistory, refreshSyncKey } from "./admin-service";

export type ClassScheduleCreateInput = {
  courseCode: string;
  section: string;
  type: string;
  /** AMIS-style slots, e.g. ["M 07:00AM-08:30AM"]; [] = no usable times. */
  schedule: string[];
  roomCode?: string | null;
  roomName?: string | null;
  courseTitle?: string | null;
  termId: number;
};

/**
 * Resolve a room code/name to rooms.id using the same tiered lookup as the
 * class importers (exact → alias → abbreviation/squash fuzzy). Null when the
 * venue is unknown — the class still publishes, just without a room link.
 */
export async function resolveClassRoomId(
  roomCode: string | null | undefined,
  roomName: string | null | undefined,
): Promise<number | null> {
  const candidates = [roomCode, roomName]
    .map((value) => value?.trim())
    .filter((value): value is string => !!value);
  if (candidates.length === 0) return null;

  const [rooms, roomAliases] = await Promise.all([
    db.select({ id: roomsTable.id, code: roomsTable.roomCode }).from(roomsTable),
    db
      .select({ alias: aliasesTable.alias, targetId: aliasesTable.targetId })
      .from(aliasesTable)
      .where(eq(aliasesTable.targetType, "room")),
  ]);
  const lookup = buildRoomLookup(rooms, roomAliases);
  for (const candidate of candidates) {
    const match = matchRoomId(lookup, candidate);
    if (match) return match.roomId;
  }
  return null;
}

/** Insert one `classes` row. Returns the inserted row, or null on failure. */
export async function createClassSchedule(
  input: ClassScheduleCreateInput,
  editedBy = "admin",
): Promise<typeof classesTable.$inferSelect | null> {
  const roomId = await resolveClassRoomId(input.roomCode, input.roomName);

  const [inserted] = await db
    .insert(classesTable)
    .values({
      courseCode: input.courseCode.trim(),
      section: input.section.trim(),
      type: input.type.trim().toUpperCase(),
      schedule: input.schedule,
      roomId,
      courseTitle: input.courseTitle?.trim() || null,
      termId: input.termId,
    })
    .returning({ id: classesTable.id });
  if (!inserted) return null;

  const [after] = await db
    .select()
    .from(classesTable)
    .where(eq(classesTable.id, inserted.id))
    .limit(1);
  if (!after) return null;

  await recordEditorHistory({
    entityType: "class",
    entityId: after.id,
    action: "create",
    before: null,
    after,
    editedBy,
    summary: input.roomCode
      ? `${input.courseCode} ${input.section} → room ${input.roomCode}`
      : `${input.courseCode} ${input.section} (no room)`,
  });
  await refreshSyncKey("classes");
  return after;
}

/**
 * Natural keys (course|section|type, no room, no term — caller scopes by
 * term) with a live `classes` row. Matches {@link alabClassPatch}'s
 * `naturalKey`: the classes table cannot hold a second row for the same
 * offering, so published dedupe ignores room on purpose.
 */
export async function publishedClassNaturalKeys(
  termId: number,
): Promise<Set<string>> {
  const rows = await db
    .select({
      courseCode: classesTable.courseCode,
      section: classesTable.section,
      type: classesTable.type,
    })
    .from(classesTable)
    .where(eq(classesTable.termId, termId));

  const keys = new Set<string>();
  for (const row of rows) {
    if (!row.courseCode || !row.section || !row.type) continue;
    keys.add(
      [
        row.courseCode.trim().toUpperCase(),
        row.section.trim().toUpperCase(),
        row.type.trim().toUpperCase(),
      ].join("|"),
    );
  }
  return keys;
}

/** Dedupe keys already on open `create_class` proposals. */
export async function pendingClassProposalKeys(): Promise<Set<string>> {
  const rows = await db
    .select({ patch: editProposalsTable.proposedPatch })
    .from(editProposalsTable)
    .where(
      and(
        eq(editProposalsTable.entityType, "create_class"),
        inArray(editProposalsTable.status, ["pending", "needs_changes"]),
      ),
    );
  const keys = new Set<string>();
  for (const row of rows) {
    const patch = row.patch as Record<string, unknown> | null;
    const key = patch?.["dedupeKey"];
    if (typeof key === "string" && key) keys.add(key);
  }
  return keys;
}
