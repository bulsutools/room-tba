import { describe, expect, test } from "bun:test";
import { decodeScheduleFragment, encodeScheduleFragment } from "./fragment";
import { plannedSectionsFromPayload } from "./payload";
import type { AlabSchedulePayload } from "./payload";

const payload: AlabSchedulePayload = {
  schemaVersion: 1,
  term: { id: 1261 },
  classes: [
    {
      courseCode: "CS 21",
      section: "A",
      type: "LEC",
      professor: "Dela Cruz, Juan",
      meetings: [
        {
          weekday: "M",
          startTime: "07:00",
          endTime: "08:30",
          room: { code: "A1-101" },
        },
      ],
    },
  ],
};

describe("schedule fragment codec", () => {
  test("round-trips a payload through #schedule=", () => {
    const hash = encodeScheduleFragment(payload);
    expect(hash.startsWith("#schedule=")).toBe(true);
    const decoded = decodeScheduleFragment(hash);
    expect(decoded?.payload.classes).toHaveLength(1);
    expect(decoded?.payload.classes[0]?.courseCode).toBe("CS 21");
  });

  test("decoded payload feeds plannedSectionsFromPayload", () => {
    const decoded = decodeScheduleFragment(encodeScheduleFragment(payload));
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    const sections = plannedSectionsFromPayload(decoded.payload);
    expect(sections[0]!.schedule).toEqual(["M 07:00AM-08:30AM"]);
    expect(sections[0]!.note).toBe("Dela Cruz, Juan");
  });

  test("rejects non-schedule hashes and garbage", () => {
    expect(decodeScheduleFragment("")).toBeNull();
    expect(decodeScheduleFragment(null)).toBeNull();
    expect(decodeScheduleFragment("#plan=abc")).toBeNull();
    expect(decodeScheduleFragment("#schedule=")).toBeNull();
    expect(decodeScheduleFragment("#schedule=!!!not-base64!!!")).toBeNull();
    expect(decodeScheduleFragment("#schedule=bm90LWpzb24")).toBeNull();
  });
});
