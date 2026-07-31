import { describe, expect, test } from "bun:test";
import {
  DISCORD_URL,
  GITHUB_REPO,
  GITHUB_ROOM_TBA_URL,
  MESSENGER_CONTRIBUTE_TARGET,
  MESSENGER_CONTRIBUTE_URL,
  MESSENGER_MAINTAIN_TARGET,
  MESSENGER_MAINTAIN_URL,
  MESSENGER_SHORT_CONTRIBUTE_URL,
  MESSENGER_URL,
  ORG_LABEL,
  UPLB_TOOLS_URL,
} from "./community-links.ts";
import { SITE_URL } from "../lib/site.ts";

describe("community-links", () => {
  test("org + github point at bulsutools fork", () => {
    expect(ORG_LABEL).toBe("bulsutools");
    expect(UPLB_TOOLS_URL).toBe("https://github.com/bulsutools");
    expect(GITHUB_ROOM_TBA_URL).toBe("https://github.com/bulsutools/room-tba");
    expect(GITHUB_REPO).toBe("bulsutools/room-tba");
  });

  test("volunteer Messenger defaults to contribute app URL", () => {
    expect(MESSENGER_URL).toBe(MESSENGER_CONTRIBUTE_URL);
    expect(MESSENGER_CONTRIBUTE_URL).toBe(`${SITE_URL}/messenger/contribute`);
    expect(MESSENGER_MAINTAIN_URL).toBe(`${SITE_URL}/messenger/maintain`);
    expect(MESSENGER_SHORT_CONTRIBUTE_URL).toBe("");
  });

  test("contribute / maintain targets use GitHub issues until chats exist", () => {
    expect(MESSENGER_CONTRIBUTE_TARGET).toContain("github.com/bulsutools");
    expect(MESSENGER_MAINTAIN_TARGET).toContain("github.com/bulsutools");
  });

  test("Discord URL falls back to the fork repo", () => {
    expect(DISCORD_URL).toBe(GITHUB_ROOM_TBA_URL);
  });
});
