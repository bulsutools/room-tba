<script lang="ts">
  import { plannerStore, termStore, toastStore } from "@lib/store.svelte";
  import {
    offeringsFromClasses,
    planStudyBlocks,
    solveTimetable,
    formatMinutes,
  } from "@lib/timetable";
  import type {
    StudyBlockProposal,
    TimetableConstraints,
    TimetableProposal,
  } from "@lib/timetable";
  import type { ClassMapValue } from "@lib/types";

  /**
   * Timetable assistant (#5): constraint-based section proposals plus a
   * study-block planner fallback when no schedule data is loaded. Read-only —
   * "Use this option" writes through the existing planner store only on click.
   */
  let { rows, onopenroom }: {
    rows: ClassMapValue[];
    onopenroom: (roomCode: string) => void;
  } = $props();

  const DAY_LABELS = ["M", "T", "W", "Th", "F", "S"] as const;

  const plan = $derived(plannerStore.activePlan);
  const courseCodes = $derived(
    [
      ...new Set((plan?.sections ?? []).map((s) => s.courseCode)),
    ].sort(),
  );
  const candidates = $derived(offeringsFromClasses(rows));
  const hasScheduleData = $derived(
    candidates.some((c) => !c.unscheduled && c.blocks.length > 0),
  );

  // --- Constraints ---------------------------------------------------------
  let earliest = $state(""); // "HH:MM" 24h, empty = no bound
  let latest = $state("");
  let dayChecks = $state<boolean[]>([true, true, true, true, true, true]);
  let maxDays = $state("");
  let studyMinutes = $state("120");

  function toMin(value: string): number | null {
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function buildConstraints(): TimetableConstraints {
    const window = {
      startMin: toMin(earliest) ?? undefined,
      endMin: toMin(latest) ?? undefined,
    };
    const constraints: TimetableConstraints = {};
    if (window.startMin != null || window.endMin != null) {
      constraints.window = window;
    }
    const days = dayChecks
      .map((on, i) => (on ? i : -1))
      .filter((i) => i >= 0);
    if (days.length > 0 && days.length < 6) constraints.allowedDays = days;
    const max = Number(maxDays);
    if (Number.isFinite(max) && max >= 1 && max <= 6) {
      constraints.maxDaysOnCampus = Math.floor(max);
    }
    return constraints;
  }

  // --- Class proposals -----------------------------------------------------
  let proposals = $state<TimetableProposal[]>([]);
  let uncovered = $state<string[]>([]);
  let solving = $state(false);
  let solveNote = $state<string | null>(null);

  function solve() {
    if (courseCodes.length === 0) return;
    solving = true;
    solveNote = null;
    // Defer a tick so the button state paints before the search runs.
    setTimeout(() => {
      const result = solveTimetable({
        requiredCourses: courseCodes,
        candidates,
        constraints: buildConstraints(),
        maxProposals: 5,
      });
      proposals = result.proposals;
      uncovered = result.uncoveredCourses;
      if (result.uncoveredCourses.length > 0) {
        solveNote = `No schedule data for ${result.uncoveredCourses.join(", ")}`;
      } else if (result.proposals.length === 0) {
        solveNote =
          "No conflict-free combination fits those constraints. Loosen a rule and try again.";
      }
      solving = false;
    }, 0);
  }

  function applyProposal(proposal: TimetableProposal) {
    for (const pick of proposal.picks) {
      plannerStore.replaceCourse(pick.courseCode, pick.rows);
    }
    toastStore.show(`Applied option ${proposal.rank + 1}`, "success");
  }

  function scheduleLines(pick: TimetableProposal["picks"][number]): string[] {
    return [
      ...new Set(
        pick.rows
          .flatMap((r) => r.schedule ?? [])
          .filter((s) => s && s !== "TBA"),
      ),
    ];
  }

  // --- Study-block mode ------------------------------------------------------
  let studyProposals = $state<StudyBlockProposal[]>([]);
  let studying = $state(false);

  function runStudy() {
    studying = true;
    setTimeout(() => {
      studyProposals = planStudyBlocks({
        term: termStore.activeTerm,
        constraints: buildConstraints(),
        sessionMinutes: Number(studyMinutes),
        maxProposals: 3,
      });
      studying = false;
    }, 0);
  }
</script>

<section class="assistant" aria-label="Timetable assistant">
  <h2 class="planner-side__heading">Assistant</h2>
  <p class="assistant__hint" role="note">
    {#if hasScheduleData}
      Proposes conflict-free section combinations for this plan's courses.
      Nothing changes until you pick one.
    {:else}
      No class schedule data for these courses — plan study blocks instead.
      Works with zero schedule data.
    {/if}
  </p>

  <div class="assistant__constraints">
    <label class="assistant__field">
      <span>From</span>
      <input type="time" bind:value={earliest} aria-label="Earliest start" />
    </label>
    <label class="assistant__field">
      <span>Until</span>
      <input type="time" bind:value={latest} aria-label="Latest end" />
    </label>
    <label class="assistant__field">
      <span>Max days</span>
      <input
        type="number"
        min="1"
        max="6"
        bind:value={maxDays}
        placeholder="—"
        aria-label="Max days on campus"
      />
    </label>
    <fieldset class="assistant__days">
      <legend>Days</legend>
      {#each DAY_LABELS as label, i (label)}
        <label class="assistant__day">
          <input type="checkbox" bind:checked={dayChecks[i]} />
          {label}
        </label>
      {/each}
    </fieldset>
  </div>

  {#if hasScheduleData}
    <button
      type="button"
      class="assistant__run"
      onclick={solve}
      disabled={solving || courseCodes.length === 0}
    >
      {solving ? "Solving…" : "Find proposals"}
    </button>

    {#if solveNote}
      <p class="assistant__note" role="status">{solveNote}</p>
    {/if}
    {#if uncovered.length > 0}
      <p class="assistant__note" role="status">
        Missing schedule data for {uncovered.join(", ")}.
      </p>
    {/if}

    {#if proposals.length > 0}
      <ol class="assistant__proposals">
        {#each proposals as proposal (proposal.rank)}
          <li class="assistant__proposal">
            <div class="assistant__proposal-head">
              <span class="assistant__proposal-title">
                Option {proposal.rank + 1}
              </span>
              <span class="assistant__proposal-meta">
                {proposal.daysOnCampus}d · {proposal.notes.join(" · ")}
              </span>
            </div>
            <ul class="assistant__picks">
              {#each proposal.picks as pick (pick.key)}
                <li class="assistant__pick">
                  <span class="assistant__pick-course">
                    {pick.courseCode} {pick.section}
                  </span>
                  <span class="assistant__pick-schedule">
                    {scheduleLines(pick).join("; ")}
                  </span>
                  {#each pick.roomCodes as room (room)}
                    <button
                      type="button"
                      class="assistant__room"
                      onclick={() => onopenroom(room)}
                    >
                      {room}
                    </button>
                  {/each}
                </li>
              {/each}
            </ul>
            <button
              type="button"
              class="assistant__apply"
              onclick={() => applyProposal(proposal)}
            >
              Use this option
            </button>
          </li>
        {/each}
      </ol>
    {/if}
  {:else}
    <label class="assistant__field assistant__field--block">
      <span>Session length</span>
      <select bind:value={studyMinutes} aria-label="Study session length">
        <option value="60">60 min</option>
        <option value="90">90 min</option>
        <option value="120">2 hours</option>
        <option value="180">3 hours</option>
      </select>
    </label>
    <button
      type="button"
      class="assistant__run"
      onclick={runStudy}
      disabled={studying}
    >
      {studying ? "Planning…" : "Plan study blocks"}
    </button>

    {#if studyProposals.length > 0}
      <ol class="assistant__proposals">
        {#each studyProposals as proposal (proposal.rank)}
          <li class="assistant__proposal">
            <div class="assistant__proposal-head">
              <span class="assistant__proposal-title">
                Option {proposal.rank + 1}
              </span>
              <span class="assistant__proposal-meta">
                {proposal.notes.join(" · ")}
              </span>
            </div>
            <ul class="assistant__picks">
              {#each proposal.sessions.slice(0, 4) as session (session.date + session.startMin)}
                <li class="assistant__pick">
                  <span class="assistant__pick-course">
                    {new Date(`${session.date}T00:00:00Z`).toLocaleDateString(
                      "en-PH",
                      { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" },
                    )}
                  </span>
                  <span class="assistant__pick-schedule">
                    {formatMinutes(session.startMin)}–{formatMinutes(session.endMin)}
                  </span>
                </li>
              {/each}
              {#if proposal.sessions.length > 4}
                <li class="assistant__pick-schedule">
                  +{proposal.sessions.length - 4} more sessions
                </li>
              {/if}
            </ul>
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
</section>

<style>
  .assistant {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--map-chrome-border, hsl(0, 0%, 82%));
  }

  .assistant__hint {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.4;
    color: hsl(0, 0%, 40%);
  }

  .assistant__constraints {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .assistant__field {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: hsl(0, 0%, 40%);
  }

  .assistant__field input,
  .assistant__field select {
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--map-chrome-border, hsl(0, 0%, 75%));
    border-radius: 0.375rem;
    background: white;
    color: inherit;
  }

  .assistant__field input[type="number"] {
    width: 3rem;
  }

  .assistant__days {
    display: flex;
    gap: 0.375rem;
    border: none;
    margin: 0;
    padding: 0;
  }

  .assistant__days legend {
    font-size: 0.6875rem;
    font-weight: 600;
    color: hsl(0, 0%, 40%);
    padding: 0;
    margin-bottom: 0.125rem;
  }

  .assistant__day {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    font-size: 0.75rem;
    color: hsl(0, 0%, 30%);
  }

  .assistant__run,
  .assistant__apply {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem 0.75rem;
    border-radius: 999px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
  }

  .assistant__run {
    background: hsl(5, 53%, 32%);
    color: white;
    align-self: flex-start;
  }

  .assistant__run:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .assistant__apply {
    align-self: flex-start;
    border: 1px solid hsl(5, 53%, 82%);
    color: hsl(5, 53%, 32%);
    background: white;
  }

  .assistant__apply:hover,
  .assistant__apply:focus-visible {
    background: hsl(5, 53%, 96%);
  }

  .assistant__note {
    margin: 0;
    font-size: 0.75rem;
    color: hsl(0, 0%, 45%);
  }

  .assistant__proposals {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .assistant__proposal {
    border: 1px solid var(--map-chrome-border, hsl(0, 0%, 85%));
    border-radius: 0.5rem;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    background: white;
  }

  .assistant__proposal-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    align-items: baseline;
    justify-content: space-between;
  }

  .assistant__proposal-title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: hsl(5, 53%, 32%);
  }

  .assistant__proposal-meta {
    font-size: 0.6875rem;
    color: hsl(0, 0%, 45%);
  }

  .assistant__picks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .assistant__pick {
    display: flex;
    flex-wrap: wrap;
    gap: 0.125rem 0.375rem;
    align-items: baseline;
    font-size: 0.75rem;
  }

  .assistant__pick-course {
    font-weight: 600;
    color: hsl(0, 0%, 20%);
  }

  .assistant__pick-schedule {
    color: hsl(0, 0%, 45%);
    flex-basis: 100%;
  }

  .assistant__room {
    all: unset;
    font-size: 0.6875rem;
    font-weight: 600;
    color: hsl(5, 53%, 32%);
    border: 1px solid hsl(5, 53%, 82%);
    border-radius: 999px;
    padding: 0.0625rem 0.375rem;
    cursor: pointer;
  }

  .assistant__room:hover,
  .assistant__room:focus-visible {
    background: hsl(5, 53%, 96%);
  }
</style>
