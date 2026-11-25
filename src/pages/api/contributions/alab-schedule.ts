/**
 * ALAB schedule bridge — dataset contributions (#16).
 *
 * Receives the signed envelope documented in docs/alab-schedule-bridge.md,
 * verifies the app-level HMAC, dedupes against published classes and open
 * proposals, and files one `create_class` proposal per new mapping. The
 * personal-view path (`#schedule=` fragment) never reaches this route.
 *
 * Disabled (503) until ALAB_BRIDGE_SECRET is configured.
 */
import type { APIRoute } from "astro";
import { ALAB_BRIDGE_SECRET } from "astro:env/server";
import { termsTable } from "@drizzle/schema";
import {
  claimAlabNonce,
  verifyAlabEnvelopeSignature,
  type AlabContributionEnvelope,
} from "@lib/alab-schedule/signature";
import {
  parseAlabSchedulePayload,
  resolvePayloadTermId,
  type AlabScheduleTerm,
} from "@lib/alab-schedule/payload";
import {
  ALAB_PROPOSAL_SUBMITTER_NAME,
  enforceAlabSubmitLimits,
  planAlabContribution,
} from "@lib/alab-schedule/contribute";
import { errorResponse, json } from "@lib/api/json";
import { clientIp, rateLimitResponse } from "@lib/api/rate-limit";
import { db } from "@lib/db";
import {
  pendingClassProposalKeys,
  publishedClassNaturalKeys,
} from "@lib/services/class-service";
import {
  ProposalValidationError,
  submitProposal,
} from "@lib/services/proposal-service";

export const prerender = false;

/** Envelope payload is base64url JSON; 100 classes fit well under this. */
const MAX_BODY_BYTES = 512 * 1024;

function envelopeStudentHash(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const hash = (body as Record<string, unknown>)["studentHash"];
  return typeof hash === "string" ? hash : null;
}

function decodePayload(envelope: AlabContributionEnvelope): unknown {
  return JSON.parse(
    Buffer.from(envelope.payload, "base64url").toString("utf8"),
  );
}

async function resolveTermId(
  term: AlabScheduleTerm | undefined,
): Promise<number | null> {
  if (!term) return null;
  const rows = await db
    .select({
      id: termsTable.id,
      label: termsTable.label,
      schoolYear: termsTable.schoolYear,
      semester: termsTable.semester,
    })
    .from(termsTable);
  return resolvePayloadTermId({ schemaVersion: 1, classes: [], term }, rows);
}

export const POST: APIRoute = async ({ request }) => {
  if (!ALAB_BRIDGE_SECRET) {
    return errorResponse("ALAB schedule bridge is not configured.", 503);
  }

  const ip = clientIp(request);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse("Payload too large.", 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  // Rate-limit before signature verification: the studentHash here is
  // unverified, so it can only ever waste its own bucket — the per-IP caps
  // are the real guard against forged hashes.
  const denied = enforceAlabSubmitLimits(ip, envelopeStudentHash(body) ?? "anon");
  if (denied) {
    return rateLimitResponse(denied.resetAt);
  }

  const verified = verifyAlabEnvelopeSignature(body, ALAB_BRIDGE_SECRET);
  if (!verified.ok) {
    return errorResponse(verified.error, 401);
  }
  const envelope = verified.envelope;

  // Claim the nonce only after the signature proves the envelope is genuine —
  // a forged nonce must not burn a legitimate submission's nonce.
  if (!claimAlabNonce(envelope.nonce, envelope.exp)) {
    return errorResponse("Duplicate submission (nonce replay).", 409);
  }

  let rawPayload: unknown;
  try {
    rawPayload = decodePayload(envelope);
  } catch {
    return errorResponse("Payload is not valid base64url JSON.", 400);
  }

  const parsed = parseAlabSchedulePayload(rawPayload);
  if (!parsed.ok) {
    return errorResponse(parsed.error, 400);
  }

  const termId = await resolveTermId(parsed.payload.term);
  if (termId === null) {
    return errorResponse(
      "Could not resolve the payload's term to a Room TBA term.",
      400,
    );
  }

  const [publishedKeys, pendingKeys] = await Promise.all([
    publishedClassNaturalKeys(termId),
    pendingClassProposalKeys(),
  ]);
  const plan = planAlabContribution(
    parsed.payload,
    termId,
    envelope.studentHash,
    publishedKeys,
    pendingKeys,
  );

  const proposalIds: number[] = [];
  const errors: string[] = [];
  for (const patch of plan.patches) {
    try {
      const proposal = await submitProposal({
        entityType: "create_class",
        entityId: 0,
        baseVersion: 0,
        patch: { ...patch },
        submitterName: ALAB_PROPOSAL_SUBMITTER_NAME,
        submitterNote: `Via GradeSim/ALAB bridge (student hash ${envelope.studentHash.slice(0, 12)}…). Schedule fields only; verify against ALAB before approving.`,
        submitterUserId: null,
      });
      proposalIds.push(proposal.id);
      // No emitProposalSubmitted: one student can file dozens of mappings and
      // per-class Discord pings would flood #contributors. The review queue
      // is the notification surface for this source.
    } catch (err) {
      if (err instanceof ProposalValidationError) {
        errors.push(err.message);
        continue;
      }
      console.error("Failed to file ALAB class proposal:", err);
      errors.push("Failed to file proposal.");
    }
  }

  return json(
    {
      success: true,
      termId,
      submitted: proposalIds.length,
      proposalIds,
      skipped: plan.skipped,
      warnings: parsed.warnings,
      errors,
    },
    proposalIds.length > 0 ? 201 : 200,
  );
};
