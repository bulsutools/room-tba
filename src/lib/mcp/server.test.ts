import { describe, expect, test } from "bun:test";
import { handleMcpGet, handleMcpPost } from "./server";
import type { McpDataSource } from "./tools";

const emptySource: McpDataSource = {
  listBuildings: async () => [],
  listRooms: async () => [],
  listColleges: async () => [],
  listDivisions: async () => [],
  listDorms: async () => [],
  listPlaces: async () => [],
  listTerms: async () => [],
  listPublishedAnnouncements: async () => [],
  searchAliases: async () => [],
  classesForScope: async () => [],
};

function post(body: unknown): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("MCP Streamable HTTP endpoint", () => {
  test("initialize returns protocol version and server info", async () => {
    const res = await handleMcpPost(
      post({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      }),
      emptySource,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.protocolVersion).toBe("2025-03-26");
    expect(body.result.serverInfo.name).toBe("room-tba");
    expect(body.result.capabilities.tools).toBeDefined();
  });

  test("tools/list exposes the four campus tools", async () => {
    const res = await handleMcpPost(
      post({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      emptySource,
    );
    const body = await res.json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual([
      "find_place",
      "get_schedule",
      "get_academic_calendar",
      "search_announcements",
    ]);
  });

  test("tools/call runs find_place and returns JSON text content", async () => {
    const res = await handleMcpPost(
      post({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "find_place", arguments: { query: "coed" } },
      }),
      emptySource,
    );
    const body = await res.json();
    expect(body.result.isError).toBeUndefined();
    const payload = JSON.parse(body.result.content[0].text);
    expect(payload).toHaveProperty("results");
  });

  test("unknown tool returns isError, unknown method returns -32601", async () => {
    const badTool = await handleMcpPost(
      post({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "drop_tables", arguments: {} },
      }),
      emptySource,
    );
    expect((await badTool.json()).result.isError).toBe(true);

    const badMethod = await handleMcpPost(
      post({ jsonrpc: "2.0", id: 5, method: "bogus/method" }),
      emptySource,
    );
    expect((await badMethod.json()).error.code).toBe(-32601);
  });

  test("notifications get 202 with no body; batches work", async () => {
    const notif = await handleMcpPost(
      post({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      emptySource,
    );
    expect(notif.status).toBe(202);

    const batch = await handleMcpPost(
      post([
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
      ]),
      emptySource,
    );
    const bodies = await batch.json();
    expect(Array.isArray(bodies)).toBe(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].result).toEqual({});
  });

  test("malformed JSON returns parse error", async () => {
    const res = await handleMcpPost(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        body: "not json",
      }),
      emptySource,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(-32700);
  });

  test("GET is 405 — no SSE stream", () => {
    expect(handleMcpGet().status).toBe(405);
  });
});
