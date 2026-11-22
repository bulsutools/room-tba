import { describe, expect, it } from "bun:test";
import rawAcadOrgs from "../../data/acad-orgs.json";
import { decodeAcadOrg } from "./acad-orgs";

describe("decodeAcadOrg (#846)", () => {
  it("returns null for every code while the data file is empty", () => {
    // The upstream acad_org table was removed; BulSU codes land here as a class
    // importer produces them.
    expect(decodeAcadOrg("LBICS")).toBeNull();
    expect(decodeAcadOrg("LBIoP")).toBeNull();
  });

  it("returns null for uncurated, blank, and null codes", () => {
    expect(decodeAcadOrg("LBNOPE")).toBeNull();
    expect(decodeAcadOrg("")).toBeNull();
    expect(decodeAcadOrg(null)).toBeNull();
    expect(decodeAcadOrg(undefined)).toBeNull();
    expect(decodeAcadOrg("$comment")).toBeNull();
  });

  it("every data-file entry has a non-empty name (and decodes)", () => {
    for (const [code, entry] of Object.entries(rawAcadOrgs)) {
      if (code.startsWith("$")) continue;
      expect(typeof entry).toBe("object");
      const { name } = entry as { name?: string };
      expect(name && name.length > 0).toBe(true);
      expect(decodeAcadOrg(code)?.name).toBe(name as string);
    }
  });
});
