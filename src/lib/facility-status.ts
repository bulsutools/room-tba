/**
 * Facility status index (#9, #11, #14): per-location reports for restrooms
 * (the "CR index"), computer labs, the clinic, and canteens.
 *
 * Records live in `data/facility-status.json` — content-in-git, same
 * convention as `data/acad-orgs.json`. Field collection is tracked in #10/#15
 * and reporting goes through the `facility_status` issue form, so the dataset
 * ships empty until verified rows land; every consumer must render an empty
 * state.
 *
 * This module is pure: record types, validation, freshness windows, and
 * display helpers. Search matching lives in `search-suggestions.ts`.
 */
import rawRecords from "../../data/facility-status.json";

export const FACILITY_TYPES = [
  "restroom",
  "computer_lab",
  "clinic",
  "canteen",
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  restroom: "Restroom",
  computer_lab: "Computer lab",
  clinic: "Clinic",
  canteen: "Canteen",
};

/** GitHub issue form collectors file verified reports against (#9). */
export const FACILITY_REPORT_ISSUE_URL =
  "https://github.com/bulsutools/room-tba/issues/new?template=facility_status.yml";

type FacilityRecordBase = {
  /** Stable slug, e.g. "coe-b2-f3-cr". Unique across the file. */
  id: string;
  /** `buildings.building_name` — building names are the campus-wide key. */
  building: string;
  /** Floor number; null/omitted = building-wide or unspecified. */
  floor?: number | null;
  /** Room code or short label, e.g. "CR FB", "IC LAB 2". */
  room?: string | null;
  /** ISO 8601 date or datetime of the last field check. Required. */
  verifiedAt: string;
  /** Who checked it (name or initials). Optional but encouraged. */
  verifiedBy?: string | null;
  /** One factual line, e.g. "third stall sink clogged". No review essays. */
  note?: string | null;
};

export type RestroomAudience = "male" | "female" | "all-gender";

export type RestroomAttributes = {
  audience?: RestroomAudience;
  /** PWD/accessible CR available at this location. */
  pwdAccessible?: boolean;
  bidet?: boolean;
  flushWorking?: boolean;
  pailDipper?: boolean;
  waterAvailable?: boolean;
  /** 1 (bad) – 5 (clean). */
  cleanliness?: number;
};

export type ComputerLabAttributes = {
  unitsTotal?: number;
  unitsFree?: number;
};

export type ClinicAttributes = {
  /** Estimated queue wait in minutes. */
  waitMinutes?: number;
};

export type CanteenAttributes = {
  crowd?: "quiet" | "moderate" | "busy";
};

export type FacilityRecord = FacilityRecordBase &
  (
    | { type: "restroom"; attributes: RestroomAttributes }
    | { type: "computer_lab"; attributes: ComputerLabAttributes }
    | { type: "clinic"; attributes: ClinicAttributes }
    | { type: "canteen"; attributes: CanteenAttributes }
  );

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Perishability windows (#14): a CR rating lasts months, a lab-unit count
 * lasts hours. Past `fresh` the record is "aging"; past `aging` it is
 * "stale" and the UI must say so aggressively.
 */
const FRESHNESS_WINDOWS: Record<
  FacilityType,
  { freshMs: number; agingMs: number }
> = {
  restroom: { freshMs: 180 * DAY_MS, agingMs: 365 * DAY_MS },
  computer_lab: { freshMs: DAY_MS, agingMs: 3 * DAY_MS },
  clinic: { freshMs: DAY_MS, agingMs: 3 * DAY_MS },
  canteen: { freshMs: DAY_MS, agingMs: 3 * DAY_MS },
};

export type FacilityFreshness = "fresh" | "aging" | "stale";

export function facilityVerifiedMs(record: FacilityRecord): number {
  return Date.parse(record.verifiedAt);
}

export function facilityFreshness(
  record: FacilityRecord,
  now: Date = new Date(),
): FacilityFreshness {
  const at = facilityVerifiedMs(record);
  if (Number.isNaN(at)) return "stale";
  const age = now.getTime() - at;
  const window = FRESHNESS_WINDOWS[record.type];
  if (age <= window.freshMs) return "fresh";
  if (age <= window.agingMs) return "aging";
  return "stale";
}

/** "Verified 3 days ago" for restrooms, "Reported 5 hours ago" for the rest. */
export function facilityVerifiedLabel(
  record: FacilityRecord,
  now: Date = new Date(),
): string {
  const at = facilityVerifiedMs(record);
  if (Number.isNaN(at)) return "Never verified";
  const verb = record.type === "restroom" ? "Verified" : "Reported";
  return `${verb} ${relativeAgeLabel(at, now)}`;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * DAY_MS],
  ["month", 30 * DAY_MS],
  ["week", 7 * DAY_MS],
  ["day", DAY_MS],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

function relativeAgeLabel(at: number, now: Date): string {
  const age = Math.max(0, now.getTime() - at);
  if (age < 60 * 1000) return "just now";
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (age >= ms) return format.format(-Math.round(age / ms), unit);
  }
  return format.format(-Math.round(age / 1000), "second");
}

/** "Floor 3 · CR FB", "Floor 2", or "Whole building". */
export function facilityLocationLabel(record: FacilityRecord): string {
  const parts: string[] = [];
  if (record.floor != null) parts.push(`Floor ${record.floor}`);
  if (record.room?.trim()) parts.push(record.room.trim());
  return parts.length ? parts.join(" · ") : "Whole building";
}

/** Compact location for search suggestion secondary lines: "F3 · CR FB". */
export function facilityLocationShort(record: FacilityRecord): string {
  const parts: string[] = [];
  if (record.floor != null) parts.push(`F${record.floor}`);
  if (record.room?.trim()) parts.push(record.room.trim());
  return parts.length ? parts.join(" · ") : "Building";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optNonNegativeInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

const AUDIENCES: readonly RestroomAudience[] = ["male", "female", "all-gender"];
const CROWDS = ["quiet", "moderate", "busy"] as const;

function parseRestroomAttributes(raw: unknown): RestroomAttributes | null {
  if (!isPlainObject(raw)) return null;
  const attributes: RestroomAttributes = {};
  if (typeof raw.audience === "string") {
    const audience = AUDIENCES.find((a) => a === raw.audience);
    if (audience) attributes.audience = audience;
  }
  const pwd = optBool(raw.pwdAccessible);
  if (pwd !== undefined) attributes.pwdAccessible = pwd;
  for (const key of [
    "bidet",
    "flushWorking",
    "pailDipper",
    "waterAvailable",
  ] as const) {
    const flag = optBool(raw[key]);
    if (flag !== undefined) attributes[key] = flag;
  }
  if (typeof raw.cleanliness === "number") {
    const score = Math.round(raw.cleanliness);
    if (score >= 1 && score <= 5) attributes.cleanliness = score;
  }
  return attributes;
}

function parseComputerLabAttributes(
  raw: unknown,
): ComputerLabAttributes | null {
  if (!isPlainObject(raw)) return null;
  const attributes: ComputerLabAttributes = {};
  const total = optNonNegativeInt(raw.unitsTotal);
  const free = optNonNegativeInt(raw.unitsFree);
  if (total !== undefined) attributes.unitsTotal = total;
  if (free !== undefined) {
    attributes.unitsFree = total !== undefined ? Math.min(free, total) : free;
  }
  return attributes;
}

function parseClinicAttributes(raw: unknown): ClinicAttributes | null {
  if (!isPlainObject(raw)) return null;
  const attributes: ClinicAttributes = {};
  const wait = optNonNegativeInt(raw.waitMinutes);
  if (wait !== undefined) attributes.waitMinutes = wait;
  return attributes;
}

function parseCanteenAttributes(raw: unknown): CanteenAttributes | null {
  if (!isPlainObject(raw)) return null;
  const attributes: CanteenAttributes = {};
  if (typeof raw.crowd === "string") {
    const crowd = CROWDS.find((c) => c === raw.crowd);
    if (crowd) attributes.crowd = crowd;
  }
  return attributes;
}

const ATTRIBUTE_PARSERS = {
  restroom: parseRestroomAttributes,
  computer_lab: parseComputerLabAttributes,
  clinic: parseClinicAttributes,
  canteen: parseCanteenAttributes,
} as const;

/**
 * Validate one raw JSON row. Returns null for anything unusable — bad rows
 * are dropped rather than rendered half-parsed.
 */
export function parseFacilityRecord(raw: unknown): FacilityRecord | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  if (typeof raw.building !== "string" || !raw.building.trim()) return null;
  if (typeof raw.type !== "string") return null;
  if (!(FACILITY_TYPES as readonly string[]).includes(raw.type)) return null;
  if (typeof raw.verifiedAt !== "string") return null;
  if (Number.isNaN(Date.parse(raw.verifiedAt))) return null;
  if (
    raw.floor !== undefined &&
    raw.floor !== null &&
    !Number.isInteger(raw.floor)
  ) {
    return null;
  }

  const type = raw.type as FacilityType;
  const attributes = ATTRIBUTE_PARSERS[type](raw.attributes);
  if (!attributes) return null;

  const base: FacilityRecordBase = {
    id: raw.id.trim(),
    building: raw.building.trim(),
    verifiedAt: raw.verifiedAt,
  };
  const floor = raw.floor;
  if (typeof floor === "number") base.floor = floor;
  const room = optString(raw.room);
  if (room) base.room = room;
  const verifiedBy = optString(raw.verifiedBy);
  if (verifiedBy) base.verifiedBy = verifiedBy;
  const note = optString(raw.note);
  if (note) base.note = note;

  return { ...base, type, attributes } as FacilityRecord;
}

export function parseFacilityRecords(raw: unknown): FacilityRecord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const records: FacilityRecord[] = [];
  for (const row of raw) {
    const record = parseFacilityRecord(row);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    records.push(record);
  }
  return records;
}

/** Validated records from the committed dataset. */
export const FACILITY_RECORDS: FacilityRecord[] =
  parseFacilityRecords(rawRecords);

function buildingKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Records for one building, matched on `building_name` (case-insensitive). */
export function facilityRecordsForBuilding(
  buildingName: string,
  records: FacilityRecord[] = FACILITY_RECORDS,
): FacilityRecord[] {
  const key = buildingKey(buildingName);
  return records.filter((r) => buildingKey(r.building) === key);
}

/* ------------------------------------------------------------------ */
/* Search keywords (#11): query text → facility types / attributes.   */
/* ------------------------------------------------------------------ */

const FACILITY_KEYWORDS: Record<FacilityType, string[]> = {
  restroom: [
    "cr",
    "restroom",
    "restrooms",
    "comfort room",
    "comfort rooms",
    "toilet",
    "toilets",
    "bidet",
    "bidets",
  ],
  computer_lab: [
    "computer lab",
    "computer labs",
    "comlab",
    "comlabs",
    "computer room",
    "computer rooms",
    "ic lab",
    "ic labs",
  ],
  clinic: ["clinic", "clinics", "infirmary"],
  canteen: ["canteen", "cafeteria", "carinderia", "food court"],
};

/** Generic words that match every facility type. */
const GENERIC_KEYWORDS = ["facility", "facilities"];

/**
 * Attribute keywords refine restroom matches: "bidet" should surface
 * buildings whose CR actually has one, not every building with a CR.
 */
const RESTROOM_ATTRIBUTE_KEYWORDS: Record<
  string,
  (a: RestroomAttributes) => boolean
> = {
  bidet: (a) => a.bidet === true,
  bidets: (a) => a.bidet === true,
  flush: (a) => a.flushWorking === true,
  pail: (a) => a.pailDipper === true,
  "pail and dipper": (a) => a.pailDipper === true,
  dipper: (a) => a.pailDipper === true,
  water: (a) => a.waterAvailable === true,
  pwd: (a) => a.pwdAccessible === true,
  accessible: (a) => a.pwdAccessible === true,
  handicap: (a) => a.pwdAccessible === true,
  "all gender": (a) => a.audience === "all-gender",
  unisex: (a) => a.audience === "all-gender",
};

function normalizeQuery(query: string): string {
  return ` ${query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")} `;
}

function hasKeyword(query: string, keyword: string): boolean {
  return query.includes(` ${keyword} `);
}

export type FacilityQueryMatch = {
  /** Facility types the query names; empty when only room labels hit. */
  types: Set<FacilityType>;
  /** Restroom attribute predicates the query names ("bidet", "pwd", …). */
  restroomAttributes: ((a: RestroomAttributes) => boolean)[];
};

/**
 * Which facility types (and restroom attributes) a search query asks about.
 * Word-boundary matching only — "cr" must be its own word so "accreditation"
 * does not light up the CR index.
 */
export function matchFacilityQuery(query: string): FacilityQueryMatch {
  const normalized = normalizeQuery(query);
  const types = new Set<FacilityType>();
  for (const type of FACILITY_TYPES) {
    if (
      FACILITY_KEYWORDS[type].some((kw) => hasKeyword(normalized, kw)) ||
      GENERIC_KEYWORDS.some((kw) => hasKeyword(normalized, kw))
    ) {
      types.add(type);
    }
  }
  const restroomAttributes = Object.entries(RESTROOM_ATTRIBUTE_KEYWORDS)
    .filter(([kw]) => hasKeyword(normalized, kw))
    .map(([, predicate]) => predicate);
  return { types, restroomAttributes };
}

/* ------------------------------------------------------------------ */
/* Ranking + display helpers shared by search and the side panel.      */
/* ------------------------------------------------------------------ */

const FRESHNESS_RANK: Record<FacilityFreshness, number> = {
  fresh: 0,
  aging: 1,
  stale: 2,
};

const CROWD_RANK = { quiet: 0, moderate: 1, busy: 2 } as const;

/** Higher is better within a type; undefined attributes sort last. */
function attributeQuality(record: FacilityRecord): number {
  switch (record.type) {
    case "restroom":
      return record.attributes.cleanliness ?? 0;
    case "computer_lab":
      return record.attributes.unitsFree ?? -1;
    case "clinic":
      return record.attributes.waitMinutes === undefined
        ? Number.MAX_SAFE_INTEGER
        : -record.attributes.waitMinutes;
    case "canteen": {
      const crowd = record.attributes.crowd;
      return crowd === undefined ? Number.MAX_SAFE_INTEGER : CROWD_RANK[crowd];
    }
  }
}

/** Best records first: freshest, then best attribute quality. */
export function compareFacilityRecords(
  a: FacilityRecord,
  b: FacilityRecord,
  now: Date = new Date(),
): number {
  const freshness =
    FRESHNESS_RANK[facilityFreshness(a, now)] -
    FRESHNESS_RANK[facilityFreshness(b, now)];
  if (freshness !== 0) return freshness;
  const quality = attributeQuality(b) - attributeQuality(a);
  if (quality !== 0) return quality;
  const verified = facilityVerifiedMs(b) - facilityVerifiedMs(a);
  if (verified !== 0) return verified;
  return a.id.localeCompare(b.id);
}

function sortedRecords(records: FacilityRecord[], now: Date): FacilityRecord[] {
  return [...records].sort((a, b) => compareFacilityRecords(a, b, now));
}

/** One-line stat for chips and search secondary text. */
export function facilityStatLabel(record: FacilityRecord): string {
  switch (record.type) {
    case "restroom": {
      const parts: string[] = [];
      if (record.attributes.cleanliness !== undefined) {
        parts.push(`cleanliness ${record.attributes.cleanliness}/5`);
      }
      return parts.length ? parts.join(" · ") : "";
    }
    case "computer_lab": {
      const { unitsFree, unitsTotal } = record.attributes;
      if (unitsFree !== undefined && unitsTotal !== undefined) {
        return `${unitsFree} of ${unitsTotal} units free`;
      }
      if (unitsFree !== undefined) return `${unitsFree} units free`;
      return "";
    }
    case "clinic":
      return record.attributes.waitMinutes !== undefined
        ? `wait ~${record.attributes.waitMinutes} min`
        : "";
    case "canteen":
      return record.attributes.crowd ? `crowd: ${record.attributes.crowd}` : "";
  }
}

export type FacilityChip = { label: string; ok: boolean | null };

/**
 * Attribute chips for the side panel. `ok` is true/false for pass/fail
 * attributes, null for neutral facts (cleanliness score, crowd level).
 * Unreported attributes are omitted — unknown is not a failure.
 */
export function facilityAttributeChips(record: FacilityRecord): FacilityChip[] {
  const chips: FacilityChip[] = [];
  switch (record.type) {
    case "restroom": {
      const a = record.attributes;
      const flags: [string, boolean | undefined][] = [
        ["Bidet", a.bidet],
        ["Flush works", a.flushWorking],
        ["Pail + dipper", a.pailDipper],
        ["Water", a.waterAvailable],
        ["PWD-accessible", a.pwdAccessible],
      ];
      for (const [label, value] of flags) {
        if (value !== undefined) chips.push({ label, ok: value });
      }
      if (a.audience) {
        chips.push({
          label:
            a.audience === "all-gender"
              ? "All-gender"
              : a.audience === "male"
                ? "Men"
                : "Women",
          ok: null,
        });
      }
      if (a.cleanliness !== undefined) {
        chips.push({ label: `Cleanliness ${a.cleanliness}/5`, ok: null });
      }
      break;
    }
    case "computer_lab": {
      const stat = facilityStatLabel(record);
      if (stat) chips.push({ label: stat, ok: null });
      break;
    }
    case "clinic": {
      const stat = facilityStatLabel(record);
      if (stat) chips.push({ label: stat, ok: null });
      break;
    }
    case "canteen": {
      const stat = facilityStatLabel(record);
      if (stat) chips.push({ label: stat, ok: null });
      break;
    }
  }
  return chips;
}

export type FacilityFloorGroup = {
  /** null = building-wide / floor unknown. */
  floor: number | null;
  label: string;
  records: FacilityRecord[];
};

const TYPE_ORDER: Record<FacilityType, number> = {
  restroom: 0,
  computer_lab: 1,
  clinic: 2,
  canteen: 3,
};

/** Group a building's records by floor for the side panel, best first. */
export function groupFacilityRecordsByFloor(
  records: FacilityRecord[],
  now: Date = new Date(),
): FacilityFloorGroup[] {
  const byFloor = new Map<number | null, FacilityRecord[]>();
  for (const record of records) {
    const floor = record.floor ?? null;
    const list = byFloor.get(floor) ?? [];
    list.push(record);
    byFloor.set(floor, list);
  }
  const groups: FacilityFloorGroup[] = [...byFloor.entries()].map(
    ([floor, list]) => ({
      floor,
      label: floor === null ? "Building-wide" : `Floor ${floor}`,
      records: sortedRecords(list, now).sort(
        (a, b) =>
          TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
          (a.room ?? "").localeCompare(b.room ?? ""),
      ),
    }),
  );
  return groups.sort((a, b) => {
    if (a.floor === null) return 1;
    if (b.floor === null) return -1;
    return a.floor - b.floor;
  });
}
