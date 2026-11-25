import { beforeEach, describe, expect, test } from "bun:test";
import {
  ALAB_ENVELOPE_TTL_SECONDS,
  claimAlabNonce,
  resetAlabNoncesForTests,
  signAlabEnvelope,
  verifyAlabEnvelopeSignature,
  type AlabContributionEnvelope,
} from "./signature";

const SECRET = "test-bridge-secret";
const NOW = 1_800_000_000;

function makeBody(
  overrides: Partial<Omit<AlabContributionEnvelope, "sig">> = {},
): Omit<AlabContributionEnvelope, "sig"> {
  return {
    v: 1,
    studentHash: "abc123hash",
    exp: NOW + ALAB_ENVELOPE_TTL_SECONDS,
    nonce: "nonce-12345678",
    payload: "eyJzY2hlbWFWZXJzaW9uIjoxfQ",
    ...overrides,
  };
}

function makeEnvelope(
  overrides: Partial<Omit<AlabContributionEnvelope, "sig">> = {},
  secret = SECRET,
): AlabContributionEnvelope {
  const body = makeBody(overrides);
  return { ...body, sig: signAlabEnvelope(body, secret) };
}

describe("verifyAlabEnvelopeSignature", () => {
  beforeEach(() => resetAlabNoncesForTests());

  test("accepts a correctly signed fresh envelope", () => {
    const result = verifyAlabEnvelopeSignature(
      makeEnvelope(),
      SECRET,
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  test("rejects tampered payload, studentHash, exp, and nonce", () => {
    const valid = makeEnvelope();
    for (const tamper of [
      { payload: "tampered" },
      { studentHash: "otherhash99" },
      { exp: NOW + 999999 },
      { nonce: "nonce-87654321" },
    ]) {
      // Mutate a signed envelope without re-signing — the real attack.
      const result = verifyAlabEnvelopeSignature(
        { ...valid, ...tamper },
        SECRET,
        NOW,
      );
      expect(result.ok).toBe(false);
    }
  });

  test("rejects wrong secret and malformed input", () => {
    expect(
      verifyAlabEnvelopeSignature(makeEnvelope({}, "other-secret"), SECRET, NOW)
        .ok,
    ).toBe(false);
    expect(verifyAlabEnvelopeSignature(null, SECRET, NOW).ok).toBe(false);
    expect(verifyAlabEnvelopeSignature("str", SECRET, NOW).ok).toBe(false);
    expect(
      verifyAlabEnvelopeSignature({ v: 2 }, SECRET, NOW).ok,
    ).toBe(false);
  });

  test("rejects expired envelopes and far-future expiry", () => {
    const expired = makeEnvelope({ exp: NOW - 1 });
    expect(verifyAlabEnvelopeSignature(expired, SECRET, NOW).ok).toBe(false);

    const farFuture = makeEnvelope({
      exp: NOW + ALAB_ENVELOPE_TTL_SECONDS + 3600,
    });
    // Sign after setting exp so only the expiry bound rejects it.
    const result = verifyAlabEnvelopeSignature(farFuture, SECRET, NOW);
    expect(result.ok).toBe(false);
  });
});

describe("claimAlabNonce", () => {
  beforeEach(() => resetAlabNoncesForTests());

  test("first claim wins, replay loses, expiry frees the nonce", () => {
    expect(claimAlabNonce("n-12345678", NOW + 100, NOW)).toBe(true);
    expect(claimAlabNonce("n-12345678", NOW + 100, NOW)).toBe(false);
    expect(claimAlabNonce("n-12345678", NOW + 100, NOW + 101)).toBe(true);
  });
});
