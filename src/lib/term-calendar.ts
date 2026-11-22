import type { Term } from "@lib/types";

/**
 * Instructional windows per term (date-only, Asia/Manila). The BulSU fork has
 * no registrar calendar import yet, so the map is empty: entries land here
 * (or in the terms table) once a BulSU academic calendar source exists.
 */
export const TERM_CALENDAR_WINDOWS: Record<
  number,
  {
    startsOn: string;
    endsOn: string;
    finalsStartsOn?: string;
    finalsEndsOn?: string;
  }
> = {};

/**
 * Last day of change of enrollment per term (Asia/Manila, date-only). Until
 * this date, course offerings can still change — surfaced in the planner note.
 */
export const CHANGE_OF_MATRICULATION_ENDS: Record<number, string> = {};

/** Human date ("August 7, 2026") for a term's last day of change of
 *  enrollment, or null when unknown. */
export function changeOfMatriculationLabel(
  termId: number | null | undefined,
): string | null {
  const iso = termId == null ? undefined : CHANGE_OF_MATRICULATION_ENDS[termId];
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A term's change of enrollment (CE) window, date-only (Asia/Manila). */
export type ChangeOfMatriculationPeriod = { startsOn: string; endsOn: string };

/**
 * Parsed registrar calendar milestones (the upstream registrar PDFs fed this
 * shape via a PDF extractor). Empty until a BulSU academic calendar source
 * exists.
 */
const REGISTRAR_CALENDAR_MILESTONES: {
  termId: number;
  label: string;
  startsOn?: string;
  endsOn?: string;
}[] = [];

/**
 * The registrar's "Change of Enrollment Period" for a term, from the
 * calendar milestones. Falls back to term start through the last CE day when
 * only the end is known. Null when neither is on file.
 */
export function changeOfMatriculationPeriod(
  termId: number | null | undefined,
): ChangeOfMatriculationPeriod | null {
  if (termId == null) return null;
  const milestone = REGISTRAR_CALENDAR_MILESTONES.find(
    (m) =>
      m.termId === termId &&
      /change of (?:matriculation|enrollment)/i.test(m.label) &&
      m.startsOn &&
      m.endsOn,
  );
  if (milestone?.startsOn && milestone.endsOn) {
    return { startsOn: milestone.startsOn, endsOn: milestone.endsOn };
  }
  const endsOn = CHANGE_OF_MATRICULATION_ENDS[termId];
  const startsOn = TERM_CALENDAR_WINDOWS[termId]?.startsOn;
  return endsOn && startsOn ? { startsOn, endsOn } : null;
}

/** "Aug 3–7, 2026", "Jan 30 – Feb 3, 2027", "Dec 28, 2026 – Jan 2, 2027". */
export function formatDateRange(startsOn: string, endsOn: string): string {
  const parse = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  };
  const start = parse(startsOn);
  const end = parse(endsOn);
  const fmt = (date: Date, options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  if (startsOn === endsOn) {
    return fmt(start, { month: "short", day: "numeric", year: "numeric" });
  }
  if (sameYear && start.getUTCMonth() === end.getUTCMonth()) {
    return `${fmt(start, { month: "short", day: "numeric" })}\u2013${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${fmt(start, { month: "short", day: "numeric" })} \u2013 ${fmt(end, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return `${fmt(start, { month: "short", day: "numeric", year: "numeric" })} \u2013 ${fmt(end, { month: "short", day: "numeric", year: "numeric" })}`;
}

/** YYYY-MM-DD for `date` as seen in Asia/Manila — the app's notion of "today". */
export function toManilaDateKey(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function termDateKey(value: string | null | undefined) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toManilaDateKey(new Date(value));
}

/** True when `date` falls on an instructional day for the term (inclusive). */
export function isDateWithinTerm(
  term: Pick<Term, "startsOn" | "endsOn">,
  date: Date,
) {
  const day = toManilaDateKey(date);
  const start = termDateKey(term.startsOn);
  const end = termDateKey(term.endsOn);
  if (!start || !end) return false;
  return day >= start && day <= end;
}

function finalsWindowForTerm(term: Pick<Term, "id">) {
  return TERM_CALENDAR_WINDOWS[term.id];
}

/** True when `date` falls within the configured finals window for the term. */
export function isFinalsWeek(
  date: Date,
  term: Pick<Term, "id" | "startsOn" | "endsOn">,
) {
  const window = finalsWindowForTerm(term);
  if (!window?.finalsStartsOn || !window.finalsEndsOn) return false;
  const day = toManilaDateKey(date);
  return day >= window.finalsStartsOn && day <= window.finalsEndsOn;
}

/** Pick the active term for a calendar day; null when between terms. */
export function resolveActiveTermByDate<T extends Term>(
  terms: T[],
  date = new Date(),
): T | null {
  const active = terms.filter(
    (term) => term.isActive && isDateWithinTerm(term, date),
  );
  if (active.length === 0) return null;
  return (
    active.sort((a, b) => b.sortOrder - a.sortOrder || b.id - a.id)[0] ?? null
  );
}

/** Default term for visitors: in-session window, then legacy flag, then newest active. */
export function resolveDefaultTermFromList<T extends TermPick>(
  terms: T[],
  date = new Date(),
): T | null {
  const calendarTerm = resolveActiveTermByDate(terms, date);
  if (calendarTerm) {
    if ((calendarTerm.classCount ?? 0) > 0) return calendarTerm;
    return pickTermWithClasses(terms) ?? calendarTerm;
  }

  return (
    terms.find((term) => term.isDefault && term.isActive) ??
    pickTermWithClasses(terms) ??
    terms.find((term) => term.isActive) ??
    terms[0] ??
    null
  );
}

type TermPick = Term & { classCount?: number };

function isStoredTermUsable(term: TermPick | undefined) {
  if (!term) return false;
  if ((term.classCount ?? 0) > 0) return true;
  return term.startsOn != null && term.endsOn != null;
}

function pickTermWithClasses<T extends TermPick>(terms: T[]): T | null {
  return (
    terms
      .filter((term) => term.isActive && (term.classCount ?? 0) > 0)
      .sort((a, b) => b.sortOrder - a.sortOrder || b.id - a.id)[0] ?? null
  );
}

/**
 * Resolve the interactive term on load.
 * URL wins; stale local picks (no classes / undated 1251-era rows) lose to the
 * calendar default; otherwise honor a prior manual selection.
 */
export function resolveInitialTermId(
  terms: TermPick[],
  options: {
    fromUrl: number | null;
    storedId: number | null;
    date?: Date;
  },
): number | null {
  const urlValid =
    options.fromUrl !== null &&
    terms.some((term) => term.id === options.fromUrl);
  if (urlValid) return options.fromUrl;

  const calendarDefault = resolveActiveTermByDate(terms, options.date);
  const storedTerm =
    options.storedId !== null
      ? terms.find((term) => term.id === options.storedId)
      : undefined;
  const storedValid = storedTerm !== undefined;

  if (calendarDefault) {
    if (!storedValid || !isStoredTermUsable(storedTerm)) {
      if ((calendarDefault.classCount ?? 0) > 0) return calendarDefault.id;
      return pickTermWithClasses(terms)?.id ?? calendarDefault.id;
    }
    return options.storedId;
  }

  const fallback = resolveDefaultTermFromList(terms, options.date);
  if (storedValid) return options.storedId;
  return fallback?.id ?? null;
}

/** "Dec 1 – Dec 7" official finals window for a term, or null when unknown. */
export function finalsWindowLabel(termId: number | null | undefined) {
  const window = termId == null ? undefined : TERM_CALENDAR_WINDOWS[termId];
  if (!window?.finalsStartsOn || !window.finalsEndsOn) return null;
  return formatTermDateRange({
    startsOn: window.finalsStartsOn,
    endsOn: window.finalsEndsOn,
  });
}

export function formatTermDateRange(term: Pick<Term, "startsOn" | "endsOn">) {
  const start = termDateKey(term.startsOn);
  const end = termDateKey(term.endsOn);
  if (!start || !end) return null;

  const startLabel = formatShortDate(start);
  const endLabel = formatShortDate(end);
  return `${startLabel} – ${endLabel}`;
}

/** "Oct 28" for a date-only key, rendered in the campus calendar's own zone. */
export function formatShortDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
