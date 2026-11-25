/**
 * HMAC envelope for ALAB schedule contributions (docs/alab-schedule-bridge.md).
 *
 * App-level signature: proves the submission came from a holder of the shared
 * bridge secret (the GradeSim/ALAB extension build) and is fresh. It does not
 * prove enrollment — see the doc for the threat model.
 *
 * Node-only (node:crypto); the client never verifies signatures.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const ALAB_ENVELOPE_VERSION = 1;
export const ALAB_SIGNATURE_DOMAIN = "alab-schedule-v1";
/** Envelope lifetime: exporter signs at send time, submit follows immediately. */
export const ALAB_ENVELOPE_TTL_SECONDS = 24 * 60 * 60;
/** Reject envelopes dated further than this in the future (clock skew). */
export const ALAB_ENVELOPE_MAX_FUTURE_SKEW_SECONDS = 5 * 60;

export type AlabContributionEnvelope = {
  v: typeof ALAB_ENVELOPE_VERSION;
  /** H(student_number + salt) computed by the exporter; stored, never raw. */
  studentHash: string;
  /** Unix seconds after which the envelope is rejected. */
  exp: number;
  /** Single-use random token; replayed nonces are rejected. */
  nonce: string;
  /** base64url of the exact payload JSON bytes (see payload.ts). */
  payload: string;
  /** base64url HMAC-SHA256 over the canonical signing string. */
  sig: string;
};

export type AlabEnvelopeVerifyResult =
  | { ok: true; envelope: AlabContributionEnvelope }
  | { ok: false; error: string };

const HASH_RE = /^[A-Za-z0-9_-]{8,128}$/;
const NONCE_RE = /^[A-Za-z0-9_-]{8,128}$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

/** Canonical signing string: domain + student hash + expiry + nonce + payload. */
export function alabSigningString(
  envelope: Pick<
    AlabContributionEnvelope,
    "studentHash" | "exp" | "nonce" | "payload"
  >,
): string {
  return [
    ALAB_SIGNATURE_DOMAIN,
    envelope.studentHash,
    String(envelope.exp),
    envelope.nonce,
    envelope.payload,
  ].join("\n");
}

/** Sign an envelope body (everything except `sig`). Exporter-side helper. */
export function signAlabEnvelope(
  body: Omit<AlabContributionEnvelope, "sig">,
  secret: string,
): string {
  return sign(alabSigningString(body), secret).toString("base64url");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseEnvelope(value: unknown): AlabContributionEnvelope | null {
  const row = asRecord(value);
  if (!row) return null;
  if (row["v"] !== ALAB_ENVELOPE_VERSION) return null;
  if (
    typeof row["studentHash"] !== "string" ||
    !HASH_RE.test(row["studentHash"])
  ) {
    return null;
  }
  if (typeof row["exp"] !== "number" || !Number.isInteger(row["exp"])) {
    return null;
  }
  if (typeof row["nonce"] !== "string" || !NONCE_RE.test(row["nonce"])) {
    return null;
  }
  if (
    typeof row["payload"] !== "string" ||
    !BASE64URL_RE.test(row["payload"])
  ) {
    return null;
  }
  if (typeof row["sig"] !== "string" || !BASE64URL_RE.test(row["sig"])) {
    return null;
  }
  return row as unknown as AlabContributionEnvelope;
}

/**
 * Verify signature, version, expiry, and field shapes. Nonce replay is checked
 * separately via {@link claimAlabNonce} so a bad signature never burns a nonce.
 */
export function verifyAlabEnvelopeSignature(
  value: unknown,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): AlabEnvelopeVerifyResult {
  const envelope = parseEnvelope(value);
  if (!envelope) {
    return { ok: false, error: "Malformed contribution envelope." };
  }

  const expected = sign(alabSigningString(envelope), secret);
  let provided: Buffer;
  try {
    provided = Buffer.from(envelope.sig, "base64url");
  } catch {
    return { ok: false, error: "Malformed signature." };
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, error: "Invalid signature." };
  }

  if (envelope.exp <= nowSeconds) {
    return { ok: false, error: "Envelope expired." };
  }
  // exp - now is bounded by TTL + skew, so a valid envelope cannot claim a
  // longer lifetime than the documented exporter produces.
  if (
    envelope.exp >
    nowSeconds + ALAB_ENVELOPE_MAX_FUTURE_SKEW_SECONDS + ALAB_ENVELOPE_TTL_SECONDS
  ) {
    return { ok: false, error: "Envelope expiry is too far in the future." };
  }
  return { ok: true, envelope };
}

// ── Nonce replay guard ──────────────────────────────────────────────────────
// ponytail: per-instance in-memory set. Same ceiling as the app's other
// in-memory rate limiters; a cross-instance replay inside the exp window is
// stopped by contribution dedupe, not here. Move to a table if abuse appears.
const seenNonces = new Map<string, number>();

/**
 * Claim a nonce for the envelope's lifetime. Returns false when the nonce was
 * already claimed (replay). Entries expire with the envelope.
 */
export function claimAlabNonce(
  nonce: string,
  expSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  for (const [key, expiresAt] of seenNonces) {
    if (expiresAt <= nowSeconds) seenNonces.delete(key);
  }
  if (seenNonces.has(nonce)) return false;
  seenNonces.set(nonce, expSeconds);
  return true;
}

/** @internal test helper */
export function resetAlabNoncesForTests() {
  seenNonces.clear();
}
