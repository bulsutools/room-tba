import type { APIRoute } from "astro";
import { defaultDataSource } from "@lib/mcp/data-source";
import {
  handleMcpGet,
  handleMcpPost,
  handleMcpUnsupported,
} from "@lib/mcp/server";

export const prerender = false;

export const POST = (({ request }) =>
  handleMcpPost(request, defaultDataSource())) satisfies APIRoute;

// No SSE stream on this endpoint; GET/DELETE are not part of the contract.
export const GET = (() => handleMcpGet()) satisfies APIRoute;
export const DELETE = (() => handleMcpUnsupported()) satisfies APIRoute;
