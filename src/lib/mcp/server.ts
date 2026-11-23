/**
 * Streamable-HTTP MCP endpoint (#3): JSON-RPC 2.0 over POST at /api/mcp.
 * Read-only, public campus data — no auth, matching the existing public GET
 * routes. No SSE stream: single JSON responses only (spec allows it when the
 * client accepts application/json).
 */
import packageJson from "../../../package.json";
import { callTool, MCP_TOOLS, type McpDataSource } from "./tools";

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = {
  name: "room-tba",
  version: packageJson.version,
};

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function rpcError(id: JsonRpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

async function handleOne(
  source: McpDataSource,
  req: JsonRpcRequest,
): Promise<unknown | null> {
  const method = req.method;
  // Notifications (no id) get no response body entry.
  if (typeof method === "string" && method.startsWith("notifications/")) {
    return null;
  }
  if (!method) return rpcError(req.id, -32600, "Missing method");

  switch (method) {
    case "initialize": {
      const requested = req.params?.["protocolVersion"];
      return rpcResult(req.id, {
        protocolVersion:
          typeof requested === "string" ? requested : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    }
    case "ping":
      return rpcResult(req.id, {});
    case "tools/list":
      return rpcResult(req.id, { tools: MCP_TOOLS });
    case "tools/call": {
      const name = req.params?.["name"];
      const args = req.params?.["arguments"];
      if (typeof name !== "string") {
        return rpcResult(req.id, {
          content: [{ type: "text", text: "tools/call requires a tool name" }],
          isError: true,
        });
      }
      try {
        const data = await callTool(
          source,
          name,
          args && typeof args === "object"
            ? (args as Record<string, unknown>)
            : {},
        );
        return rpcResult(req.id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        });
      } catch (error) {
        return rpcResult(req.id, {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        });
      }
    }
    // Capability probes some clients send before tools/list.
    case "resources/list":
      return rpcResult(req.id, { resources: [] });
    case "resources/templates/list":
      return rpcResult(req.id, { resourceTemplates: [] });
    case "prompts/list":
      return rpcResult(req.id, { prompts: [] });
    case "logging/setLevel":
      return rpcResult(req.id, {});
    default:
      return rpcError(req.id, -32601, `Method not found: ${method}`);
  }
}

function jsonRpcResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** POST /api/mcp — JSON-RPC batch or single request. The caller supplies the
 * data source so this module stays DB-free and unit-testable. */
export async function handleMcpPost(
  request: Request,
  source: McpDataSource,
): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonRpcResponse(rpcError(null, -32700, "Parse error"), 400);
  }

  const isBatch = Array.isArray(payload);
  const list: unknown[] = Array.isArray(payload) ? payload : [payload];
  if (
    list.length === 0 ||
    list.some((r) => !r || typeof r !== "object" || Array.isArray(r))
  ) {
    return jsonRpcResponse(rpcError(null, -32600, "Invalid request"), 400);
  }

  const responses = (
    await Promise.all(
      (list as JsonRpcRequest[]).map((req) => handleOne(source, req)),
    )
  ).filter((r) => r !== null);

  // Notifications-only batches get 202 with no body per the spec.
  if (responses.length === 0) return new Response(null, { status: 202 });
  return jsonRpcResponse(isBatch ? responses : responses[0]);
}

export function handleMcpGet(): Response {
  return new Response(
    "Method Not Allowed: this MCP server does not offer an SSE stream",
    {
      status: 405,
      headers: { Allow: "POST" },
    },
  );
}

export function handleMcpUnsupported(): Response {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
