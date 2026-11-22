import type {
  BuildingData,
  DormData,
  EventData,
  OrgData,
  PlaceData,
} from "./types";
import type { QueryStoreState } from "./store.svelte";
import {
  compareFacilityRecords,
  facilityLocationShort,
  facilityStatLabel,
  FACILITY_TYPE_LABELS,
  matchFacilityQuery,
  type FacilityRecord,
  type FacilityType,
  type RestroomAttributes,
} from "./facility-status";

type Suggestion = {
  value: string;
  category: Exclude<QueryStoreState["category"], null>;
  eventSlug?: string;
  building?: BuildingData;
  event?: EventData;
  /** Supporting line under the value, e.g. a facility stat (#11). */
  secondary?: string | null;
  /** Map pin for "Add stop" while Get Directions is open. */
  lat?: number | null;
  lon?: number | null;
};

const MAX_SUGGESTIONS = 8;
const MAX_PER_CATEGORY = 4;

/**
 * Relevance of `needle` inside a display name; lower is better, null = miss.
 * 0 exact name or exact parenthesized acronym ("Institute of Computer
 *   Science (ICS)" for "ics"), 1 word-start ("Comp" in "Computer"), 2 mid-word
 *   substring ("ics" in "Economics").
 *
 * Mid-word matches used to win on alphabetical order alone: searching "ICS"
 * surfaced Econom-ics- and Kinet-ics- while the ICS building never made the
 * top 8.
 */
export function nameMatchScore(
  name: string | null | undefined,
  needle: string,
): number | null {
  if (!name) return null;
  const haystack = name.toLowerCase();
  const index = haystack.indexOf(needle);
  if (index === -1) return null;
  if (haystack === needle || haystack.includes(`(${needle})`)) return 0;
  const before = index === 0 ? "" : haystack[index - 1];
  return before === "" || !/[a-z0-9]/.test(before) ? 1 : 2;
}

/** Description hits rank behind any name hit. */
function descriptionMatchScore(
  description: string | null | undefined,
  needle: string,
): number | null {
  return description?.toLowerCase().includes(needle) ? 3 : null;
}

function bestScore(...scores: (number | null)[]): number | null {
  const hits = scores.filter((s): s is number => s !== null);
  return hits.length ? Math.min(...hits) : null;
}

type Scored = { score: number; suggestion: Suggestion };

function takeMatches<T>(
  items: T[],
  score: (item: T) => number | null,
  map: (item: T) => Suggestion,
): Scored[] {
  const out: Scored[] = [];
  for (const item of items) {
    const s = score(item);
    if (s === null) continue;
    out.push({ score: s, suggestion: map(item) });
  }
  return out
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.suggestion.value
          .toLowerCase()
          .localeCompare(b.suggestion.value.toLowerCase()),
    )
    .slice(0, MAX_PER_CATEGORY);
}

export function buildEntitySuggestions(
  searchString: string,
  data: {
    loaded: boolean;
    filteredBuildings: BuildingData[];
    filteredDorms: DormData[];
    colleges: { collegeName: string }[];
    divisions: { divisionName: string }[];
    events: EventData[];
    organizations: OrgData[];
    places: PlaceData[];
    /** Facility status records (#9/#14); buildings they point at must exist. */
    facilityRecords?: FacilityRecord[];
  },
): Suggestion[] {
  const needle = searchString.trim().toLowerCase();
  if (needle === "" || !data.loaded) return [];

  const suggestions = [
    ...takeMatches(
      data.filteredBuildings,
      ({ buildingName }) => nameMatchScore(buildingName, needle),
      (b) => ({
        value: b.buildingName,
        category: "building",
        building: b,
        lat: b.lat,
        lon: b.lon,
      }),
    ),
    ...takeMatches(
      data.colleges,
      ({ collegeName }) => nameMatchScore(collegeName, needle),
      ({ collegeName }) => ({ value: collegeName, category: "college" }),
    ),
    ...takeMatches(
      data.divisions,
      ({ divisionName }) => nameMatchScore(divisionName, needle),
      ({ divisionName }) => ({ value: divisionName, category: "division" }),
    ),
    ...takeMatches(
      data.filteredDorms,
      ({ dormName, shortName }) =>
        bestScore(
          nameMatchScore(dormName, needle),
          nameMatchScore(shortName, needle),
        ),
      (d) => ({
        value: d.dormName,
        category: "dorm",
        lat: d.lat,
        lon: d.lon,
      }),
    ),
    ...takeMatches(
      data.events,
      ({ title, description }) =>
        bestScore(
          nameMatchScore(title, needle),
          descriptionMatchScore(description, needle),
        ),
      (e) => ({
        value: e.title,
        category: "event",
        eventSlug: e.slug,
        event: e,
      }),
    ),
    ...takeMatches(
      data.organizations,
      ({ name, description }) =>
        bestScore(
          nameMatchScore(name, needle),
          descriptionMatchScore(description, needle),
        ),
      (o) => ({
        value: o.name,
        category: "organization",
        lat: o.lat,
        lon: o.lon,
      }),
    ),
    ...takeMatches(
      data.places,
      ({ name, description }) =>
        bestScore(
          nameMatchScore(name, needle),
          descriptionMatchScore(description, needle),
        ),
      (p) => ({
        value: p.name,
        category: "place",
        lat: p.lat,
        lon: p.lon,
      }),
    ),
    ...takeFacilityMatches(
      needle,
      data.facilityRecords ?? [],
      data.filteredBuildings,
    ),
  ];

  return suggestions
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.suggestion.value
          .toLowerCase()
          .localeCompare(b.suggestion.value.toLowerCase()),
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(({ suggestion }) => suggestion);
}

/**
 * Facility status hits (#11): "CR", "restroom", "computer lab", "clinic",
 * "canteen" queries — plus direct room-label hits like "IC LAB" — surface the
 * buildings that have reports, ranked by the index (freshness first, then
 * attribute quality). One suggestion per building; the side panel carries
 * the per-floor detail.
 */
function recordMatchesFacilityQuery(
  record: FacilityRecord,
  needle: string,
  query: ReturnType<typeof matchFacilityQuery>,
): boolean {
  // Direct label hit: the record's room code/name matches the query itself.
  if (record.room && nameMatchScore(record.room, needle) !== null) {
    return true;
  }
  if (!query.types.has(record.type)) return false;
  // Attribute keywords ("bidet", "pwd") narrow restroom matches to records
  // that actually report the attribute — unknown is not a match.
  if (
    record.type === "restroom" &&
    query.restroomAttributes.length > 0 &&
    !query.restroomAttributes.every((predicate) =>
      predicate(record.attributes as RestroomAttributes),
    )
  ) {
    return false;
  }
  return true;
}

function facilitySecondary(records: FacilityRecord[]): string {
  const parts = records.slice(0, 2).map((record) => {
    const stat = facilityStatLabel(record);
    return stat
      ? `${facilityLocationShort(record)} ${stat}`
      : `${FACILITY_TYPE_LABELS[record.type]} · ${facilityLocationShort(record)}`;
  });
  if (records.length > 2) parts.push(`+${records.length - 2} more`);
  return parts.join(" · ");
}

function takeFacilityMatches(
  needle: string,
  records: FacilityRecord[],
  buildings: BuildingData[],
): Scored[] {
  if (records.length === 0) return [];
  const matched = matchFacilityQuery(needle);
  // Attribute-only queries ("pwd", "bidet") imply restroom intent.
  const query =
    matched.types.size === 0 && matched.restroomAttributes.length > 0
      ? { ...matched, types: new Set<FacilityType>(["restroom"]) }
      : matched;
  const roomOnlyQuery = query.types.size === 0;

  const buildingByKey = new Map(
    buildings.map((b) => [b.buildingName.trim().toLowerCase(), b]),
  );
  const groups = new Map<
    string,
    { building: BuildingData; records: FacilityRecord[] }
  >();
  for (const record of records) {
    // Without a type keyword, only explicit room-label hits count — an
    // arbitrary query must not dump every facility onto the map.
    if (roomOnlyQuery) {
      if (!record.room || nameMatchScore(record.room, needle) === null) {
        continue;
      }
    } else if (!recordMatchesFacilityQuery(record, needle, query)) {
      continue;
    }
    const key = record.building.trim().toLowerCase();
    const building = buildingByKey.get(key);
    if (!building) continue;
    const group = groups.get(key) ?? { building, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  if (groups.size === 0) return [];

  const now = new Date();
  const ranked = [...groups.values()]
    .map((group) => ({
      ...group,
      best: [...group.records].sort((a, b) =>
        compareFacilityRecords(a, b, now),
      )[0],
    }))
    .filter((group) => group.best !== undefined)
    .sort((a, b) => compareFacilityRecords(a.best, b.best, now))
    .slice(0, MAX_PER_CATEGORY);

  // Score sits between word-start name matches (1) and mid-word (2): a
  // facility hit beats "-ics-" noise but never an exact building name.
  return ranked.map((group, index) => ({
    score: 1.5 + index * 0.001,
    suggestion: {
      value: group.building.buildingName,
      category: "building" as const,
      building: group.building,
      secondary: facilitySecondary(group.records),
      lat: group.building.lat,
      lon: group.building.lon,
    },
  }));
}
