import { getJSONFetch } from "../local/data/utils.js";
import {
  parseRoomFinderQuery,
  type RoomFinderResponse,
} from "../room-finder.js";

/**
 * Client state for the natural-language room finder (#4). Suggestions.svelte
 * feeds it the debounced search text; results render as ordinary "room"
 * suggestions so the existing click → fly-to → RoomResult flow is reused.
 */
export class RoomFinderStore {
  /** Parsed intent matched and the endpoint answered — show the section. */
  matched = $state(false);
  results = $state<RoomFinderResponse["results"]>([]);
  slotLabel = $state<string | null>(null);
  placeLabel = $state<string | null>(null);
  loading = $state(false);
  /** Last query text sent to the endpoint, for dedupe in the UI. */
  query = $state("");
  private _requestId = 0;

  search = async (text: string) => {
    const trimmed = text.trim();
    const requestId = ++this._requestId;
    this.query = trimmed;
    if (trimmed === "" || !parseRoomFinderQuery(trimmed).matched) {
      // Plain entity searches never hit the endpoint.
      this.matched = false;
      this.results = [];
      this.slotLabel = null;
      this.placeLabel = null;
      this.loading = false;
      return;
    }
    // Show the section immediately; the endpoint confirms `matched`.
    this.matched = true;
    this.loading = true;
    try {
      const res = await getJSONFetch<RoomFinderResponse>(
        `/api/room-finder?q=${encodeURIComponent(trimmed)}`,
      );
      if (requestId !== this._requestId) return;
      this.matched = res.matched;
      this.results = res.results ?? [];
      this.slotLabel = res.slotLabel ?? null;
      this.placeLabel = res.placeLabel ?? null;
    } catch (e) {
      console.error("Room finder request failed:", e);
      if (requestId !== this._requestId) return;
      // Degrade quietly: the normal entity suggestions still render.
      this.matched = false;
      this.results = [];
      this.slotLabel = null;
      this.placeLabel = null;
    } finally {
      if (requestId === this._requestId) this.loading = false;
    }
  };

  clear = () => {
    this._requestId += 1;
    this.matched = false;
    this.results = [];
    this.slotLabel = null;
    this.placeLabel = null;
    this.loading = false;
    this.query = "";
  };
}
