import {
  candidateIsPlaceable,
  daysOnCampus,
  picksConflict,
  proposalIsFeasible,
  scoreProposal,
} from "./constraints.js";
import type {
  OfferingCandidate,
  SolveResult,
  TimetableConstraints,
  TimetableProposal,
} from "./types.js";

export type SolveInput = {
  /** Course codes that must each get exactly one offering. */
  requiredCourses: string[];
  /** All offerings to choose from (any course). */
  candidates: OfferingCandidate[];
  constraints?: TimetableConstraints;
  /** Max ranked proposals returned. Default 5. */
  maxProposals?: number;
  /**
   * Candidates considered per course before pruning. Deterministic —
   * candidates arrive pre-sorted by key. Default 16.
   */
  maxCandidatesPerCourse?: number;
  /** Backtracking node budget; stops early on pathological inputs. */
  maxNodes?: number;
};

const DEFAULT_MAX_PROPOSALS = 5;
const DEFAULT_MAX_CANDIDATES = 16;
// ponytail: 200k nodes covers ~6 courses x 16 sections comfortably; larger
// inputs degrade to "best effort so far" rather than hanging the UI thread.
const DEFAULT_MAX_NODES = 200_000;

/**
 * Deterministic constraint solver (#5): backtracking over one offering per
 * required course, pruning on pairwise block conflicts and the day cap.
 * No ML, no randomness — identical inputs always produce identical output.
 */
export function solveTimetable(input: SolveInput): SolveResult {
  const maxProposals = input.maxProposals ?? DEFAULT_MAX_PROPOSALS;
  const maxPerCourse = input.maxCandidatesPerCourse ?? DEFAULT_MAX_CANDIDATES;
  const maxNodes = input.maxNodes ?? DEFAULT_MAX_NODES;
  const constraints = input.constraints;

  const required = [...new Set(input.requiredCourses)].sort();
  const byCourse = new Map<string, OfferingCandidate[]>();
  for (const candidate of input.candidates) {
    if (!candidateIsPlaceable(candidate, constraints)) continue;
    const list = byCourse.get(candidate.courseCode) ?? [];
    list.push(candidate);
    byCourse.set(candidate.courseCode, list);
  }
  for (const list of byCourse.values()) {
    list.sort((a, b) => a.key.localeCompare(b.key));
  }

  const uncoveredCourses = required.filter(
    (code) => (byCourse.get(code) ?? []).length === 0,
  );
  // A course with zero placeable offerings makes every proposal incomplete —
  // report it instead of emitting plans that silently drop a class.
  if (uncoveredCourses.length > 0) {
    return { proposals: [], uncoveredCourses };
  }

  // Most-constrained course first: fewer options => earlier pruning.
  const ordered = required
    .map((code) => ({
      code,
      options: (byCourse.get(code) ?? []).slice(0, maxPerCourse),
    }))
    .filter((entry) => entry.options.length > 0)
    .sort((a, b) => a.options.length - b.options.length);

  // Collect a bounded pool of feasible combos, then keep the best-scoring
  // `maxProposals`. Stopping DFS at maxProposals would bias toward whatever
  // the first courses enumerate first.
  const collectCap = Math.max(maxProposals * 20, 100);
  const found: TimetableProposal[] = [];
  const seen = new Set<string>();
  let nodes = 0;
  const picked: OfferingCandidate[] = [];

  const search = (index: number) => {
    if (found.length >= collectCap || nodes >= maxNodes) return;
    if (index === ordered.length) {
      const picks = [...picked].sort((a, b) =>
        a.courseCode.localeCompare(b.courseCode),
      );
      const signature = picks.map((p) => p.key).join("|");
      if (seen.has(signature)) return;
      if (!proposalIsFeasible(picks, constraints)) return;
      seen.add(signature);
      const { score, notes } = scoreProposal(picks, constraints);
      found.push({
        rank: found.length,
        score,
        picks,
        daysOnCampus: daysOnCampus(picks.flatMap((p) => p.blocks)),
        notes,
      });
      return;
    }

    nodes++;
    for (const option of ordered[index].options) {
      if (nodes >= maxNodes || found.length >= collectCap) return;
      // Incremental prune: the new pick must not collide with earlier picks.
      if (picked.some((p) => picksConflict(p, option))) continue;
      picked.push(option);
      search(index + 1);
      picked.pop();
    }
  };

  search(0);

  return {
    proposals: found
      .sort(
        (a, b) =>
          b.score - a.score || signatureOf(a).localeCompare(signatureOf(b)),
      )
      .slice(0, maxProposals)
      .map((p, i) => ({ ...p, rank: i })),
    uncoveredCourses: [],
  };
}

function signatureOf(proposal: TimetableProposal): string {
  return proposal.picks.map((p) => p.key).join("|");
}
