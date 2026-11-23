import { describe, expect, it } from "bun:test";
import {
  compareFacilityRecords,
  facilityAttributeChips,
  facilityFreshness,
  facilityLocationLabel,
  facilityLocationShort,
  facilityRecordsForBuilding,
  facilityStatLabel,
  facilityVerifiedLabel,
  groupFacilityRecordsByFloor,
  matchFacilityQuery,
  parseFacilityRecords,
  type FacilityRecord,
} from "./facility-status";

const NOW = new Date("2026-06-01T12:00:00Z");
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

function restroom(overrides: Record<string, unknown> = {}): FacilityRecord {
  return {
    id: "b1-f3-cr",
    type: "restroom",
    building: "COE Building 2",
    floor: 3,
    room: "CR FB",
    verifiedAt: daysAgo(10),
    attributes: { cleanliness: 4, bidet: true },
    ...overrides,
  } as FacilityRecord;
}

describe("parseFacilityRecords", () => {
  it("keeps valid rows and drops malformed ones", () => {
    const records = parseFacilityRecords([
      restroom(),
      { id: "bad", type: "restroom", building: "X" }, // no verifiedAt
      { id: "bad2", type: "castle", building: "X", verifiedAt: daysAgo(1) },
      "not-an-object",
      restroom(), // duplicate id
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe("b1-f3-cr");
  });

  it("sanitizes attributes per type", () => {
    const [record] = parseFacilityRecords([
      {
        id: "lab-1",
        type: "computer_lab",
        building: "ICS",
        verifiedAt: daysAgo(0),
        attributes: { unitsTotal: 30, unitsFree: 45, bogus: true },
      },
    ]);
    expect(record?.type).toBe("computer_lab");
    if (record?.type === "computer_lab") {
      // unitsFree clamps to unitsTotal; unknown keys are dropped.
      expect(record.attributes).toEqual({ unitsTotal: 30, unitsFree: 30 });
    }
  });

  it("rejects out-of-range cleanliness", () => {
    const [record] = parseFacilityRecords([
      {
        id: "cr-1",
        type: "restroom",
        building: "X",
        verifiedAt: daysAgo(1),
        attributes: { cleanliness: 9 },
      },
    ]);
    if (record?.type === "restroom") {
      expect(record.attributes.cleanliness).toBeUndefined();
    }
  });
});

describe("facilityFreshness", () => {
  it("uses long windows for restrooms, short ones for perishable types", () => {
    const oldRestroom = restroom({ verifiedAt: daysAgo(100) });
    expect(facilityFreshness(oldRestroom, NOW)).toBe("fresh");

    const staleRestroom = restroom({ verifiedAt: daysAgo(400) });
    expect(facilityFreshness(staleRestroom, NOW)).toBe("stale");

    const lab = {
      id: "lab-1",
      type: "computer_lab",
      building: "ICS",
      verifiedAt: daysAgo(2),
      attributes: {},
    } as FacilityRecord;
    expect(facilityFreshness(lab, NOW)).toBe("aging");

    const staleLab = { ...lab, verifiedAt: daysAgo(10) } as FacilityRecord;
    expect(facilityFreshness(staleLab, NOW)).toBe("stale");
  });

  it("labels verified vs reported by type", () => {
    expect(facilityVerifiedLabel(restroom(), NOW)).toBe("Verified last week");
    const lab = {
      id: "lab-1",
      type: "computer_lab",
      building: "ICS",
      verifiedAt: daysAgo(0),
      attributes: {},
    } as FacilityRecord;
    expect(facilityVerifiedLabel(lab, NOW)).toContain("Reported");
  });
});

describe("matchFacilityQuery", () => {
  it("matches CR synonyms as whole words only", () => {
    for (const q of ["CR", "cr", "restroom", "comfort room", "toilet"]) {
      expect(matchFacilityQuery(q).types.has("restroom")).toBe(true);
    }
    // "accreditation" contains "cr" mid-word — must not match.
    expect(matchFacilityQuery("accreditation").types.size).toBe(0);
  });

  it("maps lab, clinic, and canteen keywords to their types", () => {
    expect(matchFacilityQuery("computer lab").types.has("computer_lab")).toBe(
      true,
    );
    expect(matchFacilityQuery("clinic").types.has("clinic")).toBe(true);
    expect(matchFacilityQuery("canteen").types.has("canteen")).toBe(true);
    expect(matchFacilityQuery("facilities").types.size).toBe(4);
  });

  it("detects restroom attribute keywords", () => {
    const match = matchFacilityQuery("pwd accessible cr");
    expect(match.types.has("restroom")).toBe(true);
    expect(match.restroomAttributes.length).toBeGreaterThan(0);
  });
});

describe("labels and chips", () => {
  it("formats location labels", () => {
    expect(facilityLocationLabel(restroom())).toBe("Floor 3 · CR FB");
    expect(facilityLocationLabel(restroom({ floor: null, room: null }))).toBe(
      "Whole building",
    );
    expect(facilityLocationShort(restroom())).toBe("F3 · CR FB");
  });

  it("emits pass/fail chips only for reported attributes", () => {
    const chips = facilityAttributeChips(
      restroom({
        attributes: {
          audience: "female",
          pwdAccessible: false,
          bidet: true,
          cleanliness: 4,
        },
      } as never),
    );
    const byLabel = new Map(chips.map((c) => [c.label, c.ok]));
    expect(byLabel.get("Bidet")).toBe(true);
    expect(byLabel.get("PWD-accessible")).toBe(false);
    // flushWorking/pailDipper/waterAvailable unreported → no chips.
    expect(byLabel.has("Flush works")).toBe(false);
    expect(byLabel.get("Cleanliness 4/5")).toBeNull();
    expect(byLabel.get("Women")).toBeNull();
  });

  it("summarizes per-type stats", () => {
    expect(facilityStatLabel(restroom())).toBe("cleanliness 4/5");
    const lab = {
      id: "l",
      type: "computer_lab",
      building: "X",
      verifiedAt: daysAgo(0),
      attributes: { unitsFree: 12, unitsTotal: 30 },
    } as FacilityRecord;
    expect(facilityStatLabel(lab)).toBe("12 of 30 units free");
  });
});

describe("grouping and ranking", () => {
  it("groups by floor, building-wide last, best records first", () => {
    const groups = groupFacilityRecordsByFloor(
      [
        restroom({ id: "a", floor: 3, verifiedAt: daysAgo(300) }),
        restroom({
          id: "b",
          floor: 1,
          verifiedAt: daysAgo(5),
          attributes: { cleanliness: 5 },
        }),
        restroom({ id: "c", floor: null, verifiedAt: daysAgo(1) }),
      ],
      NOW,
    );
    expect(groups.map((g) => g.label)).toEqual([
      "Floor 1",
      "Floor 3",
      "Building-wide",
    ]);
    // Within floor 1 the single record wins; floor 3's stale record is last
    // overall only by floor ordering — freshness ranks inside each group.
    expect(groups[0]?.records[0]?.id).toBe("b");
  });

  it("ranks fresher, cleaner records first", () => {
    const dirtyFresh = restroom({
      id: "dirty",
      verifiedAt: daysAgo(1),
      attributes: { cleanliness: 1 },
    });
    const cleanFresh = restroom({
      id: "clean",
      verifiedAt: daysAgo(10),
      attributes: { cleanliness: 5 },
    });
    const ancient = restroom({
      id: "ancient",
      verifiedAt: daysAgo(400),
      attributes: { cleanliness: 5 },
    });
    // Freshness beats cleanliness: the stale 5-star CR ranks below the
    // fresh 1-star one.
    expect(compareFacilityRecords(dirtyFresh, ancient, NOW)).toBeLessThan(0);
    // Same freshness: cleanliness decides.
    expect(compareFacilityRecords(cleanFresh, dirtyFresh, NOW)).toBeLessThan(0);
  });

  it("matches records to buildings case-insensitively", () => {
    const records = facilityRecordsForBuilding("coe building 2", [restroom()]);
    expect(records).toHaveLength(1);
    expect(facilityRecordsForBuilding("Other", [restroom()])).toHaveLength(0);
  });
});
