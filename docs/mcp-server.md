# MCP server

Public read-only MCP endpoint at `POST /api/mcp` (#3). Streamable HTTP
transport, JSON-RPC 2.0, single JSON responses (no SSE stream — `GET`
returns `405`). No auth; it exposes the same public campus data as the
existing GET routes.

Point an MCP client at `https://<host>/api/mcp`. Clients must send
`Accept: application/json` (and may send `text/event-stream`); the server
always answers with `application/json`.

## Tools

| Tool | Args | Returns |
| --- | --- | --- |
| `find_place` | `query` (required) | Fuzzy matches across buildings, rooms, colleges, divisions, dorms, and places — canonical names, kind, coordinates when known. Uses the alias map (`searchAliases`) to boost curated synonyms. |
| `get_schedule` | `room_or_building` (required), `date` (`YYYY-MM-DD`, optional) | Class rows for the resolved room/building/college/division in the resolved term. `date` picks the term whose instructional window contains that Manila day; without it, the site's default term. Returns `status: "empty"` with an explicit message when the classes table has no rows — never fabricated timetables. `status: "no-term"` when the date falls between terms. |
| `get_academic_calendar` | none | Active terms with instructional/finals windows and change-of-matriculation dates, plus registrar milestones and holidays from `data/academic-calendar-*.json` via `src/lib/academic-milestones.ts`. |
| `search_announcements` | `query` (optional) | Currently-published announcements matching the keyword in title/body; empty query returns the latest published rows. |

## Layout

- `src/pages/api/mcp.ts` — thin Astro route (`POST`, `GET`/`DELETE` → 405).
- `src/lib/mcp/server.ts` — JSON-RPC dispatch (`initialize`, `ping`,
  `tools/list`, `tools/call`, empty `resources/*`/`prompts/*`), DB-free.
- `src/lib/mcp/tools.ts` — tool definitions, corpus building, fuzzy ranking,
  response shaping. Pure helpers are unit-tested in `tools.test.ts`.
- `src/lib/mcp/data-source.ts` — production `McpDataSource` wiring the
  existing `src/lib/services/*` functions.
- `src/lib/mcp/server.test.ts` — protocol-level tests with a stub source.

Schedule queries for non-room scopes use
`getClassesForScope` in `src/lib/services/map-data-service.ts` — one joined
query instead of one per room.

## Limits

`find_place` returns at most 10 matches; `get_schedule` caps classes at 500
and the room sample at 25; `search_announcements` returns at most 20 rows.
There is no rate limiter on this route yet — add one if abuse shows up.
