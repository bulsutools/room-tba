import type { APIRoute } from "astro";
import { json } from "@lib/api/json";
import {
  checkRateLimit,
  clientIp,
  rateLimitResponse,
} from "@lib/api/rate-limit";
import {
  inSessionTermForDate,
  manilaTargetDateKey,
  parseRoomFinderQuery,
  runRoomFinder,
} from "@lib/room-finder";
import {
  getAllBuildings,
  getAllClasses,
  getAllPlaces,
  getAllRooms,
} from "@lib/services/map-data-service";
import { getAllTerms } from "@lib/services/term-service";

export const prerender = false;

/**
 * Natural-language room finder (#4): "free room near the library at 2pm".
 * Deterministic parse + rank in @lib/room-finder — no LLM in the path.
 * Availability joins the academic calendar and per-room class schedules;
 * rooms without schedule rows report "schedule unknown", never "free".
 */
export const GET = (async ({ request, url }) => {
  const rateLimit = checkRateLimit(
    `read:room-finder:${clientIp(request)}`,
    120,
    60_000,
  );
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const q = url.searchParams.get("q") ?? "";
  if (q.trim() === "") return json({ matched: false, results: [] });

  const query = parseRoomFinderQuery(q);
  if (!query.matched) return json({ matched: false, results: [] });

  const [rooms, places, buildings, terms] = await Promise.all([
    getAllRooms(),
    getAllPlaces(),
    getAllBuildings(),
    getAllTerms(),
  ]);

  // Schedules only count for the term in session on the target day. Outside
  // a term window the calendar itself says "no classes", so no class fetch.
  const term = inSessionTermForDate(
    terms,
    manilaTargetDateKey(new Date(), query.dayOffset),
  );
  const classes = term ? await getAllClasses(term.id) : [];

  const response = runRoomFinder(q, {
    rooms,
    classes,
    places,
    buildings,
    terms,
  });
  return json(response);
}) satisfies APIRoute;
