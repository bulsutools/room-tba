import { describe, expect, test } from "bun:test";
import {
  collegeLabel,
  displayOrgName,
  splitTrailingAcronym,
} from "./directory-labels";

describe("directory labels", () => {
  test("splits a trailing acronym off a name", () => {
    expect(
      splitTrailingAcronym("College of Public Affairs and Development (CPAf)"),
    ).toEqual({
      name: "College of Public Affairs and Development",
      acronym: "CPAf",
    });
    expect(splitTrailingAcronym("Graduate School")).toEqual({
      name: "Graduate School",
      acronym: null,
    });
  });

  test("gives every college an acronym", () => {
    expect(
      collegeLabel("College of Arts and Sciences", "https://cas.bulsu.edu.ph"),
    ).toEqual({ name: "College of Arts and Sciences", acronym: "CAS" });
    expect(
      collegeLabel(
        "School of Environmental Science and Management (SESAM)",
        "https://sesam.bulsu.edu.ph",
      ),
    ).toEqual({
      name: "School of Environmental Science and Management",
      acronym: "SESAM",
    });
    expect(collegeLabel("Graduate School", null)).toEqual({
      name: "Graduate School",
      acronym: null,
    });
  });

  test("skips a www prefix instead of reading it as the acronym", () => {
    expect(
      collegeLabel("College of Forestry", "https://www.cfnr.bulsu.edu.ph"),
    ).toEqual({ name: "College of Forestry", acronym: "CFNR" });
  });

  test("title-cases all-caps org names and keeps the acronym", () => {
    expect(
      displayOrgName("ALLIANCE OF DEVELOPMENT COMMUNICATION STUDENTS (ADCS)"),
    ).toBe("Alliance of Development Communication Students (ADCS)");
    expect(
      displayOrgName("ALYANSA NG MGA KABITENYO SA BULSU (ANAK-BULSU)"),
    ).toBe("Alyansa ng mga Kabitenyo sa BULSU (ANAK-BULSU)");
    expect(displayOrgName("CALAMBEÑOS (UP CALAMBEÑOS)")).toBe(
      "Calambeños (UP CALAMBEÑOS)",
    );
    expect(displayOrgName("ACTUARIAL SCIENCE SOCIETY (BulSU ActSS)")).toBe(
      "Actuarial Science Society (BulSU ActSS)",
    );
    expect(displayOrgName("PAINTERS' CLUB (UPPC)")).toBe(
      "Painters' Club (UPPC)",
    );
  });

  test("leaves names a person already cased alone", () => {
    expect(displayOrgName("BulSU Computer Science Society")).toBe(
      "BulSU Computer Science Society",
    );
  });
});
