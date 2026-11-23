// Build-time only: runs git against the repo the site is built from.
import { execFileSync } from "node:child_process";

export type WikiAuthor = {
  name: string;
  github?: string;
  commits: number;
};

export type WikiProvenance = {
  authors: WikiAuthor[];
  revisions: number;
  lastEdited: string | null;
  historyUrl: string;
  editUrl: string;
};

const REPO_URL = "https://github.com/bulsutools/room-tba";
const NOREPLY = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/;

/**
 * Authorship of a wiki page from its git history, plus GitHub history and
 * edit URLs. Identities are merged by GitHub username (noreply emails) or
 * email local part, so "Stimmie <...@up.edu.ph>" and
 * "smmariquit <...@users.noreply.github.com>" count as one author.
 */
export function wikiProvenance(sourcePath: string): WikiProvenance {
  const historyUrl = `${REPO_URL}/commits/main/${sourcePath}`;
  const editUrl = `${REPO_URL}/edit/main/${sourcePath}`;
  let log = "";
  try {
    log = execFileSync(
      "git",
      ["log", "--follow", "--format=%an%x09%ae%x09%aI", "--", sourcePath],
      { encoding: "utf8" },
    ).trim();
  } catch {
    // ponytail: no .git or shallow CI clone; the GitHub links still work.
  }
  if (!log) {
    return { authors: [], revisions: 0, lastEdited: null, historyUrl, editUrl };
  }

  const byKey = new Map<string, WikiAuthor>();
  const lines = log.split("\n");
  for (const line of lines) {
    const [name, email = ""] = line.split("\t");
    if (!name) continue;
    const github = NOREPLY.exec(email)?.[1];
    const key = (github ?? email.split("@")[0] ?? name).toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.commits += 1;
      // Newest commits come first; a github handle can surface later.
      existing.github ??= github;
    } else {
      byKey.set(key, { name, github, commits: 1 });
    }
  }

  return {
    authors: [...byKey.values()].sort((a, b) => b.commits - a.commits),
    revisions: lines.length,
    // %aI, newest first.
    lastEdited: lines[0]?.split("\t")[2] ?? null,
    historyUrl,
    editUrl,
  };
}
