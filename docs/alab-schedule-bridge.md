# ALAB schedule bridge (#16)

Contract between the GradeSim/ALAB exporter (`bulsutools/alab-grade-tools`)
and Room TBA. Two use cases share one payload:

- **Personal view (use case A):** the exporter encodes the payload as
  base64url JSON in a URL fragment; `https://room-tba.uplb.tools/#schedule=<payload>`.
  The app decodes it client-side and imports the classes into the Planner as
  an ordinary plan. Nothing is POSTed, nothing is published, no auth.
- **Dataset contribution (use case B):** the exporter wraps the same payload
  in a signed envelope and POSTs it to `/api/contributions/alab-schedule`.
  Room TBA verifies the signature, rate-limits, dedupes, and files one
  `create_class` proposal per new section→room mapping through the normal
  review queue.

Machine-readable schema: [alab-schedule-payload.v1.schema.json](alab-schedule-payload.v1.schema.json).
Implementation: `src/lib/alab-schedule/`, `src/pages/api/contributions/alab-schedule.ts`.

## Payload v1

```json
{
  "schemaVersion": 1,
  "source": "alab-grade-tools",
  "exportedAt": "2026-09-01T08:00:00Z",
  "term": { "id": 1261, "label": "AY 2026-2027 1st Semester", "schoolYear": "2026-2027", "semester": "1" },
  "classes": [
    {
      "courseCode": "CS 21",
      "courseTitle": "Introduction to Computing",
      "section": "A",
      "type": "LEC",
      "professor": "Dela Cruz, Juan",
      "isOnline": false,
      "meetings": [
        {
          "weekday": "M",
          "startTime": "07:00",
          "endTime": "08:30",
          "mode": "LEC",
          "isOnline": false,
          "room": { "code": "A1-101", "name": "Computer Laboratory 1" }
        }
      ]
    }
  ]
}
```

Rules:

- `schemaVersion` is `1`. Bump it for any breaking change; receivers reject
  unknown versions.
- `term.id` is the Room TBA `terms.id` **when the exporter knows it**
  (the CRS/SAIS term id; AMIS uses the same numbering). When unknown, send
  `schoolYear` + `semester` (or `label`) and the receiver resolves the term.
- `meetings[].weekday` accepts `M T W Th F S Su`, `TH`, or full English day
  names, any case. `Su` meetings are kept in the payload but cannot render on
  the M–S schedule grid, so receivers drop them from schedule slots.
- Times are 24-hour `HH:MM`. Receivers convert to the app's slot format
  (`M 07:00AM-08:30AM`, see `parseScheduleTime` in `src/lib/schedule-renderer.ts`).
- One `classes[]` entry is one section component (LEC/LAB/SEM). A section
  meeting in two different rooms still fits: receivers group meetings by
  room code and emit one class row per room.
- **Grades never.** No grades, scores, attendance, or financial data in any
  field, at any level. `additionalProperties` is tolerated for forward
  compatibility, but new fields must stay schedule-only.
- The payload contains **no student identity**. Student number, name, and
  grade data stay in the exporter.

## Signed contribution envelope

`POST /api/contributions/alab-schedule` accepts:

```json
{
  "v": 1,
  "studentHash": "<base64url or hex>",
  "exp": 1730000000,
  "nonce": "<random>",
  "payload": "<base64url of the payload JSON above>",
  "sig": "<base64url HMAC-SHA256>"
}
```

- `payload` is the base64url encoding of the exact payload JSON bytes. The
  signature covers that string, so receivers never re-serialize JSON.
- `sig = HMAC-SHA256(ALAB_BRIDGE_SECRET, "alab-schedule-v1\n" + studentHash + "\n" + exp + "\n" + nonce + "\n" + payload)`,
  output base64url. `exp` is a unix timestamp; receivers reject expired
  envelopes and reuse of a `nonce` (in-memory; see limits below).
- `studentHash = H(student_number + salt)` computed **by the exporter** with a
  salt shared at build time. Room TBA stores only this hash, for rate
  limiting and audit, and never a raw student number. The hash is inside the
  signature, so it cannot be swapped without the bridge secret.

What the HMAC proves: the submission came from a holder of the bridge secret
(the extension build) and is fresh. It does **not** prove enrollment;
student numbers are not secrets and ALAB tokens cannot be validated here.
Reviewers treat every contribution as unverified volunteer data, same as any
other proposal.

## Server behavior

1. `ALAB_BRIDGE_SECRET` unset → endpoint returns 503 (bridge disabled).
2. Per-IP and per-`studentHash` rate limits (in-memory, per instance).
3. Signature + expiry + nonce verified before any DB write.
4. Payload parsed per the v1 rules; unknown term → 400; invalid entries are
   skipped and reported.
5. Dedupe per class entry, two keys:
   - `dedupeKey = (courseCode, section, type, roomCode)` normalized; the
     dataset key from the issue recon. A mapping already on an open
     `create_class` proposal with the same key is skipped
     (`pending_review`); the same offering reported with a *different* room
     still reaches review so a human resolves the conflict.
   - `naturalKey = (courseCode, section, type)`; matches the `classes`
     table's natural key (term-scoped). A live `classes` row with the same
     natural key skips the mapping (`already_published`) regardless of room,
     because the table cannot hold a second row for one offering.
6. Each surviving mapping becomes one `create_class` proposal
   (`entity_id = 0`), submitter name `GradeSim/ALAB`, patch stamped with
   `source: "alab-grade-tools"` and the `studentHash`. Approving publishes a
   `classes` row; `professor`/`isOnline` stay review-context only (no
   columns yet).

## Known limits

- Nonce replay protection is per server instance (in-memory). A replayed
  envelope within its `exp` window on a different instance can double-submit,
  but dedupe on the mapping key makes that a no-op.
- Rate limits are per instance, same as the rest of the app's in-memory
  limiters.
- Room codes that do not resolve to a `rooms` row publish with `room_id =
  null`; the schedule still lands, the room link does not. Reviewers can
  request changes or add the room first.
