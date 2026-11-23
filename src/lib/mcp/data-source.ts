/**
 * Production McpDataSource for /api/mcp (#3): thin wrappers over the same
 * service functions the REST API routes use. Lives apart from server.ts so
 * the protocol layer stays importable under `bun test` (no astro:env).
 */
import {
  getAllBuildings,
  getAllColleges,
  getAllDivisions,
  getAllDorms,
  getAllPlaces,
  getAllRooms,
  getClassesForScope,
  searchAliases,
  type ClassScope,
} from "@lib/services/map-data-service";
import { listPublishedAnnouncements } from "@lib/services/announcement-service";
import { getAllTerms } from "@lib/services/term-service";
import type { McpDataSource } from "./tools";

export function defaultDataSource(): McpDataSource {
  return {
    listBuildings: getAllBuildings,
    listRooms: getAllRooms,
    listColleges: getAllColleges,
    listDivisions: getAllDivisions,
    listDorms: getAllDorms,
    listPlaces: getAllPlaces,
    listTerms: getAllTerms,
    listPublishedAnnouncements,
    searchAliases,
    classesForScope: (scope: ClassScope, termId?: number, limit?: number) =>
      getClassesForScope(scope, termId, limit),
  };
}
