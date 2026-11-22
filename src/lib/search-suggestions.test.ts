import { describe, expect, it } from "bun:test";
import { buildEntitySuggestions, nameMatchScore } from "./search-suggestions";
import type { FacilityRecord } from "./facility-status";
import type { BuildingData } from "./types";

function building(name: string): BuildingData {
  return { buildingName: name, lat: 14.16, lon: 121.24 } as BuildingData;
}

const emptyData = {
  loaded: true,
  filteredBuildings: [] as BuildingData[],
  filteredDorms: [],
  colleges: [],
  divisions: [],
  events: [],
  organizations: [],
  places: [],
};

describe("nameMatchScore", () => {
  it("scores exact and parenthesized-acronym matches best", () => {
    expect(nameMatchScore("ICS", "ics")).toBe(0);
    expect(nameMatchScore("Institute of Computer Science (ICS)", "ics")).toBe(
      0,
    );
  });

  it("scores word-start above mid-word substring", () => {
    expect(nameMatchScore("Computer Science", "comp")).toBe(1);
    expect(nameMatchScore("College of Economics", "ics")).toBe(2);
  });

  it("misses cleanly", () => {
    expect(nameMatchScore("Baker Hall", "ics")).toBeNull();
    expect(nameMatchScore(undefined, "ics")).toBeNull();
  });
});

describe("buildEntitySuggestions", () => {
  it("ranks the ICS building above mid-word -ics- matches (prod bug)", () => {
    const suggestions = buildEntitySuggestions("ics", {
      ...emptyData,
      // Alphabetical data order used to fill the per-category cap with
      // mid-word matches before the ICS building was ever considered.
      filteredBuildings: [
        building("CEM Building"),
        building("Department of Human Kinetics"),
        building("Hydraulics Laboratory"),
        building("Institute of Statistics"),
        building("Institute of Computer Science (ICS)"),
      ],
      colleges: [{ collegeName: "College of Economics and Management" }],
    });

    expect(suggestions[0]?.value).toBe("Institute of Computer Science (ICS)");
  });

  it("still caps per category and overall", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      building(`Physics Building ${i}`),
    );
    const suggestions = buildEntitySuggestions("physics", {
      ...emptyData,
      filteredBuildings: many,
    });
    expect(suggestions.length).toBe(4);
  });
});

describe("facility status suggestions (#11)", () => {
  const facilities: FacilityRecord[] = [
    {
      id: "coe-b2-f3-cr",
      type: "restroom",
      building: "COE Building 2",
      floor: 3,
      room: "CR FB",
      verifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      attributes: { cleanliness: 4, bidet: true, pwdAccessible: true },
    },
    {
      id: "ics-lab-1",
      type: "computer_lab",
      building: "Institute of Computer Science (ICS)",
      room: "IC LAB 1",
      verifiedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      attributes: { unitsFree: 12, unitsTotal: 30 },
    },
  ];

  const data = {
    ...emptyData,
    filteredBuildings: [
      building("COE Building 2"),
      building("Institute of Computer Science (ICS)"),
    ],
    facilityRecords: facilities,
  };

  it("returns buildings for CR queries with a stat secondary line", () => {
    const suggestions = buildEntitySuggestions("cr", data);
    const hit = suggestions.find((s) => s.value === "COE Building 2");
    expect(hit?.category).toBe("building");
    expect(hit?.secondary).toContain("cleanliness 4/5");
    // Lab building has no restroom records — must not surface for "cr".
    expect(
      suggestions.some((s) => s.value.includes("Institute of Computer")),
    ).toBe(false);
  });

  it("ranks the cleaner/fresher building first for generic queries", () => {
    const suggestions = buildEntitySuggestions("restroom", data);
    expect(suggestions[0]?.value).toBe("COE Building 2");
  });

  it("matches computer lab queries and room labels", () => {
    const byType = buildEntitySuggestions("computer lab", data);
    expect(byType.some((s) => s.value.includes("Institute of Computer"))).toBe(
      true,
    );
    const byLabel = buildEntitySuggestions("IC LAB", data);
    expect(byLabel.some((s) => s.value.includes("Institute of Computer"))).toBe(
      true,
    );
  });

  it("narrows restroom matches by attribute keywords", () => {
    const withPwd = buildEntitySuggestions("pwd cr", data);
    expect(withPwd.some((s) => s.value === "COE Building 2")).toBe(true);
  });

  it("does not dump facilities for unrelated queries", () => {
    const suggestions = buildEntitySuggestions("physics", data);
    expect(suggestions.every((s) => s.value !== "COE Building 2")).toBe(true);
  });
});
