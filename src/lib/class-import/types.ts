/** Loose registrar class payload before normalization. */
export type AmisClassRow = Record<string, unknown>;

export type AmisFetchOptions = {
  termId: number;
  bearerToken: string;
  sessionId?: string;
  /** Rows per source page (default 10000). */
  pageSize?: number;
  /** Delay between page requests in ms (default 400). */
  pageDelayMs?: number;
};

export type NormalizedAmisClass = {
  courseCode: string;
  section: string;
  type: string | null;
  courseTitle: string;
  schedule: string[];
  termId: number;
  facilityCode: string | null;
  /** College code as the source reports it,, e.g. "CAS" (#846). */
  acadGroup: string | null;
  /** Department code as the source reports it,, e.g. "LBICS" (#846). */
  acadOrg: string | null;
};
