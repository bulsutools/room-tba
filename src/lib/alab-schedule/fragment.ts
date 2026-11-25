/**
 * `#schedule=` URL fragment for the personal ALAB view
 * (docs/alab-schedule-bridge.md, use case A).
 *
 * The fragment carries base64url JSON of an unsigned payload v1. Decoding is
 * client-side only — the payload never touches a server endpoint and nothing
 * is published; the parsed classes become an ordinary Planner plan.
 */
import {
  parseAlabSchedulePayload,
  type AlabSchedulePayload,
} from "./payload";

export const SCHEDULE_FRAGMENT_PREFIX = "#schedule=";

const toBase64Url = (text: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const fromBase64Url = (encoded: string): string => {
  const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** Encode a payload for a `#schedule=` fragment (exporter/test helper). */
export function encodeScheduleFragment(payload: AlabSchedulePayload): string {
  return `${SCHEDULE_FRAGMENT_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
}

export type DecodedScheduleFragment = {
  payload: AlabSchedulePayload;
  warnings: string[];
};

/**
 * Decode a `location.hash` value into a validated payload. Returns null when
 * the hash is not a schedule fragment or the payload is malformed.
 */
export function decodeScheduleFragment(
  hash: string | null | undefined,
): DecodedScheduleFragment | null {
  if (!hash?.startsWith(SCHEDULE_FRAGMENT_PREFIX)) return null;
  const encoded = hash.slice(SCHEDULE_FRAGMENT_PREFIX.length).trim();
  if (!encoded) return null;
  try {
    const parsed = parseAlabSchedulePayload(JSON.parse(fromBase64Url(encoded)));
    if (!parsed.ok) return null;
    return { payload: parsed.payload, warnings: parsed.warnings };
  } catch {
    return null;
  }
}
