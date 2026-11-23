// One list of wiki pages. The index, the "see also" list, the sitemap, and the
// internal-link test all read it, so a new article is added in one place.

import { GITHUB_ROOM_TBA_URL } from "@constants/community-links";

export type WikiPage = {
  path: string;
  /** The article's own h1. */
  title: string;
  /** Short category shown on the index. */
  kicker: string;
  blurb: string;
  /** Repo-relative source file, for provenance and the edit link. */
  sourcePath: string;
};

export const WIKI_INDEX_PATH = "/wiki";

export const WIKI_PAGES: readonly WikiPage[] = [
  {
    path: "/wiki/using-room-tba",
    title: "Finding a room, a class, or a way across campus",
    kicker: "How-to",
    blurb:
      "Look up a room or class, plan a week and save the map for offline use, step by step. It also points to the official sources for enrollment, grades and the academic calendar.",
    sourcePath: "src/pages/wiki/using-room-tba.astro",
  },
  {
    path: "/wiki/fork-for-your-campus",
    title: "Fork this for your campus",
    kicker: "For other campuses",
    blurb:
      "Room TBA is built for BulSU. This is what you replace to run it for a different campus, from the BulSU data and glue to rip out and the config to repoint to the parts you write yourself (class import).",
    sourcePath: "src/pages/wiki/fork-for-your-campus.astro",
  },
] as const;

/** Every wiki URL, index first. */
export const WIKI_PATHS: readonly string[] = [
  WIKI_INDEX_PATH,
  ...WIKI_PAGES.map((page) => page.path),
];

export const WIKI_REPO_URL = GITHUB_ROOM_TBA_URL;

/**
 * GitHub issue form prefilled for a wiki correction. Students do not need a
 * GitHub-edit workflow to say "this number is wrong".
 */
export function wikiCorrectionUrl(pageTitle: string, path: string): string {
  const params = new URLSearchParams({
    title: `Wiki correction: ${pageTitle}`,
    body: `Page: https://room-tba.bulsu.tools${path}\n\nWhat is wrong:\n\nWhat it should say (with a source if you have one):\n`,
  });
  return `${WIKI_REPO_URL}/issues/new?${params.toString()}`;
}
