/**
 * CLAWD Omnichain MCP Server
 * With Robinhood client, OWS signing path, Wallet MCP / Coinbase proxies,
 * React UI resource, and MCP Events.
 */

import { CLAWD_TOOLS, type Rail } from "./catalog.js";
import {
  createClawdComposioSession,
  searchInstantTools,
  executeInstantTool,
  verifyComposioKey,
} from "./composio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Instant trading toolkits (Composio Instant)
const INSTANT_TRADING_TOOLKITS = [
  "exa",           // research / news
  "firecrawl",     // scrape DEX/CEX pages
  "birdeye",       // Solana token data (if Instant supported)
  "jupiter",       // quotes (if Instant supported)
  "helius",        // wallet / RPC (if Instant supported)
];

const ROBINHOOD_MCP_URL = process.env.ROBINHOOD_MCP_URL ?? "https://agent.robinhood.com/mcp/trading";
const WALLET_MCP_URL = process.env.WALLET_MCP_URL ?? "https://wallet-mcp.coinbase.com";
const COINBASE_MCP_URL = process.env.COINBASE_MCP_URL ?? "https://agents.coinbase.com/mcp";
const OWS_CLI = process.env.OWS_CLI ?? "ows";
const OWS_WALLET = process.env.OWS_WALLET ?? "clawd-treasury";
const OWS_API_KEY = process.env.OWS_API_KEY;

// ---------------------------------------------------------------------------
// Types & store
// ---------------------------------------------------------------------------

type Rail = "robinhood" | "solana" | "base" | "coinbase" | "ows";

interface ApprovalRequest {
  id: string;
  rail: Rail;
  action: string;
  summary: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired" | "executed";
  createdAt: string;
  expiresAt: string;
  approvalUrl: string;
  result?: unknown;
}

const approvals = new Map<string, ApprovalRequest>();

function createApproval(
  rail: Rail,
  action: string,
  summary: string,
  payload: Record<string, unknown>
): ApprovalRequest {
  const id = `req_${randomUUID().slice(0, 8)}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const req: ApprovalRequest = {
    id,
    rail,
    action,
    summary,
    payload,
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt,
    approvalUrl: `https://clawd.local/approve/${id}`,
  };
  approvals.set(id, req);
  // Emit event (stub — real implementation would webhook)
  emitEvent("clawd.approval.pending", { requestId: id, rail, summary });
  return req;
}

// ---------------------------------------------------------------------------
// MCP Events (in-memory subscriptions)
// ---------------------------------------------------------------------------

interface Subscription {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  delivery: { mode: string; url: string; secret: string };
  refreshBefore: string;
}

const subscriptions = new Map<string, Subscription>();

function emitEvent(name: string, data: Record<string, unknown>) {
  // In a full implementation, sign and POST to each matching subscription URL.
  // For now we just log.
  console.error(`[event] ${name}`, data);
  for (const sub of subscriptions.values()) {
    if (sub.name === name) {
      // TODO: Standard Webhooks signed POST to sub.delivery.url
    }
  }
}

// ---------------------------------------------------------------------------
// Remote MCP clients (lazy)
// ---------------------------------------------------------------------------

async function callRemoteTool(
  url: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  // Note: remote MCPs require OAuth. This is a skeleton.
  // In production, use an authenticated StreamableHTTPClientTransport
  // with the user's session token.
  const client = new Client({ name: "clawd-proxy", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url));
  await client.connect(transport);
  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    return result;
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// OWS signing helper
// ---------------------------------------------------------------------------

async function owsSignTx(chain: string, txHex: string): Promise<string> {
  if (!OWS_API_KEY) {
    throw new Error("OWS_API_KEY not set");
  }
  const { stdout } = await execFileAsync(OWS_CLI, [
    "sign",
    "tx",
    "--wallet",
    OWS_WALLET,
    "--chain",
    chain,
    "--tx",
    txHex,
  ], {
    env: { ...process.env, OWS_PASSPHRASE: OWS_API_KEY },
  });
  // Parse signature from CLI output (implementation-specific)
  return stdout.trim();
}

// ---------------------------------------------------------------------------
// UI resource (expects built component; falls back to inline)
// ---------------------------------------------------------------------------

const APPROVAL_CARD_URI = "ui://clawd/approval-card";

function getApprovalCardHtml(): string {
  try {
    const js = readFileSync("./web/dist/approval-card.js", "utf8");
    return `<!doctype html><html><head><meta charset="utf-8"><title>CLAWD Approval</title></head><body><div id="root"></div><script type="module">${js}</script></body></html>`;
  } catch {
    return `<!doctype html><html><body><p>Build the React component first: cd web && npm run build</p></body></html>`;
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer(
  { name: "clawd", version: "0.2.0" },
  {
    capabilities: {
      tools: {},
      resources: {},
      events: {},
    },
  }
);

// UI resource
server.registerResource(
  "approval-card",
  APPROVAL_CARD_URI,
  {},
  async () => ({
    contents: [
      {
        uri: APPROVAL_CARD_URI,
        mimeType: "text/html;profile=mcp-app",
        text: getApprovalCardHtml(),
        _meta: { ui: { prefersBorder: true } },
      },
    ],
  })
);

// ---------------------------------------------------------------------------
// MCP Events handlers
// ---------------------------------------------------------------------------

server.setRequestHandler("events/list", async () => ({
  events: [
    {
      name: "clawd.approval.pending",
      description: "A new CLAWD approval request was created.",
      delivery: ["webhook"],
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      payloadSchema: {
        type: "object",
        properties: {
          requestId: { type: "string" },
          rail: { type: "string" },
          summary: { type: "string" },
        },
        required: ["requestId", "rail", "summary"],
      },
    },
    {
      name: "clawd.trade.filled",
      description: "A CLAWD-approved trade was executed.",
      delivery: ["webhook"],
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      payloadSchema: {
        type: "object",
        properties: {
          requestId: { type: "string" },
          rail: { type: "string" },
          result: { type: "object" },
        },
        required: ["requestId", "rail"],
      },
    },
  ],
}));

server.setRequestHandler("events/subscribe", async (request) => {
  const { name, arguments: args, delivery } = request.params as any;
  const id = `sub_${randomUUID().slice(0, 8)}`;
  const refreshBefore = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  subscriptions.set(id, { id, name, arguments: args ?? {}, delivery, refreshBefore });
  return { id, refreshBefore, cursor: null, truncated: false };
});

server.setRequestHandler("events/unsubscribe", async (request) => {
  const { name, delivery } = request.params as any;
  for (const [id, sub] of subscriptions) {
    if (sub.name === name && sub.delivery.url === delivery?.url) {
      subscriptions.delete(id);
    }
  }
  return {};
});

// ---------------------------------------------------------------------------
// Core approval tools
// ---------------------------------------------------------------------------

server.registerTool(
  "clawd_create_approval",
  {
    title: "Create CLAWD approval",
    description: "Create a pending action that requires explicit user approval.",
    inputSchema: {
      rail: z.enum(["robinhood", "solana", "base", "coinbase", "ows"]),
      action: z.string(),
      summary: z.string(),
      payload: z.record(z.unknown()).optional(),
    },
    _meta: {
      ui: { resourceUri: APPROVAL_CARD_URI },
      "openai/ui": { entrypoints: [{ type: "thread" }] },
    },
  },
  async ({ rail, action, summary, payload }) => {
    const req = createApproval(rail, action, summary, payload ?? {});
    return {
      structuredContent: req,
      content: [{ type: "text", text: `Approval created: ${req.id}\n${req.summary}` }],
    };
  }
);

server.registerTool(
  "clawd_list_approvals",
  {
    title: "List CLAWD approvals",
    description: "List pending and recent CLAWD approval requests.",
    inputSchema: {
      status: z.enum(["pending", "approved", "rejected", "expired", "executed"]).optional(),
    },
  },
  async ({ status }) => {
    const list = Array.from(approvals.values()).filter((a) => !status || a.status === status);
    return {
      structuredContent: { approvals: list },
      content: [{ type: "text", text: `Found ${list.length} approval(s).` }],
    };
  }
);

server.registerTool(
  "clawd_decide_approval",
  {
    title: "Approve or reject a CLAWD request",
    description: "Mark a pending approval as approved or rejected.",
    inputSchema: {
      requestId: z.string(),
      decision: z.enum(["approve", "reject"]),
    },
  },
  async ({ requestId, decision }) => {
    const req = approvals.get(requestId);
    if (!req) return { content: [{ type: "text", text: "Not found" }], isError: true };
    if (req.status !== "pending") {
      return { content: [{ type: "text", text: `Already ${req.status}` }], isError: true };
    }
    req.status = decision === "approve" ? "approved" : "rejected";
    return {
      structuredContent: req,
      content: [{ type: "text", text: `Approval ${requestId} ${req.status}.` }],
    };
  }
);

// ---------------------------------------------------------------------------
// Robinhood wrappers (real MCP calls)
// ---------------------------------------------------------------------------

server.registerTool(
  "clawd_rh_preview_equity",
  {
    title: "Preview Robinhood equity order",
    description: "Preview an equity order via Robinhood MCP. Creates CLAWD approval.",
    inputSchema: {
      symbol: z.string(),
      side: z.enum(["buy", "sell"]),
      type: z.enum(["market", "limit", "stop_limit", "stop_market"]),
      quantity: z.number().optional(),
      quoteSize: z.number().optional(),
      limitPrice: z.number().optional(),
    },
  },
  async (args) => {
    // Call Robinhood review tool
    let preview: unknown = { note: "preview failed or unauthenticated" };
    try {
      preview = await callRemoteTool(ROBINHOOD_MCP_URL, "review_equity_order", args);
    } catch (e) {
      preview = { error: String(e) };
    }
    const summary = `${args.side.toUpperCase()} ${args.symbol} (${args.type})`;
    const req = createApproval("robinhood", "place_equity_order", summary, { ...args, preview });
    return {
      structuredContent: { ...req, preview },
      content: [{ type: "text", text: `Preview created. Approve ${req.id}.` }],
    };
  }
);

server.registerTool(
  "clawd_rh_place_equity",
  {
    title: "Place Robinhood equity order",
    description: "Place an equity order after CLAWD approval.",
    inputSchema: { requestId: z.string() },
  },
  async ({ requestId }) => {
    const req = approvals.get(requestId);
    if (!req || req.status !== "approved" || req.rail !== "robinhood") {
      return { content: [{ type: "text", text: "Valid approved request required." }], isError: true };
    }
    const result = await callRemoteTool(ROBINHOOD_MCP_URL, "place_equity_order", req.payload);
    req.status = "executed";
    req.result = result;
    emitEvent("clawd.trade.filled", { requestId, rail: "robinhood", result });
    return {
      structuredContent: { executed: true, requestId, result },
      content: [{ type: "text", text: `Order placed for ${requestId}.` }],
    };
  }
);

// ---------------------------------------------------------------------------
// Solana + OWS
// ---------------------------------------------------------------------------

server.registerTool(
  "clawd_solana_preview",
  {
    title: "Preview Solana action",
    description: "Preview a Solana action (Pump.fun, Raydium, Phoenix, Backpack). Creates CLAWD approval.",
    inputSchema: {
      protocol: z.enum(["pumpfun", "raydium", "phoenix", "backpack", "transfer"]),
      summary: z.string(),
      payload: z.record(z.unknown()),
    },
  },
  async ({ protocol, summary, payload }) => {
    const req = createApproval("solana", protocol, summary, payload);
    return {
      structuredContent: req,
      content: [{ type: "text", text: `Solana preview created. Approve ${req.id}.` }],
    };
  }
);

server.registerTool(
  "clawd_solana_execute",
  {
    title: "Execute approved Solana action via OWS",
    description: "Execute a previously approved Solana action. Signs with OWS.",
    inputSchema: { requestId: z.string() },
  },
  async ({ requestId }) => {
    const req = approvals.get(requestId);
    if (!req || req.status !== "approved" || req.rail !== "solana") {
      return { content: [{ type: "text", text: "Valid approved Solana request required." }], isError: true };
    }
    const txHex = (req.payload.txHex as string) ?? "";
    if (!txHex) {
      return { content: [{ type: "text", text: "payload.txHex required for signing." }], isError: true };
    }
    const signature = await owsSignTx("solana", txHex);
    // TODO: broadcast via RPC or protocol client
    req.status = "executed";
    req.result = { signature };
    emitEvent("clawd.trade.filled", { requestId, rail: "solana", result: { signature } });
    return {
      structuredContent: { executed: true, requestId, signature },
      content: [{ type: "text", text: `Signed via OWS: ${signature.slice(0, 16)}…` }],
    };
  }
);

// ---------------------------------------------------------------------------
// Wallet MCP / Coinbase proxies
// ---------------------------------------------------------------------------

server.registerTool(
  "clawd_wallet_get_portfolio",
  {
    title: "Get Wallet MCP portfolio",
    description: "Proxy to Wallet MCP get_portfolio.",
    inputSchema: {
      chain: z.string().optional(),
      query: z.string().optional(),
    },
  },
  async (args) => {
    const result = await callRemoteTool(WALLET_MCP_URL, "get_portfolio", args);
    return {
      structuredContent: result,
      content: [{ type: "text", text: "Wallet MCP portfolio fetched." }],
    };
  }
);

server.registerTool(
  "clawd_coinbase_balance",
  {
    title: "Get Coinbase balance",
    description: "Proxy to Coinbase for Agents balance tool.",
    inputSchema: {},
  },
  async () => {
    const result = await callRemoteTool(COINBASE_MCP_URL, "balance", {});
    return {
      structuredContent: result,
      content: [{ type: "text", text: "Coinbase balance fetched." }],
    };
  }
);

// ---------------------------------------------------------------------------
// Composio Instant trading toolkits
// ---------------------------------------------------------------------------

server.registerTool(
  "clawd_composio_search",
  {
    title: "Search Composio Instant tools",
    description: "Search Instant toolkits for trading research (Exa, Firecrawl, Birdeye, Jupiter, Helius). Returns prices when available.",
    inputSchema: {
      query: z.string(),
      toolkits: z.array(z.string()).optional(),
    },
  },
  async ({ query, toolkits }) => {
    const results = await searchInstantTools(query, toolkits ?? INSTANT_TRADING_TOOLKITS);
    return {
      structuredContent: results,
      content: [{ type: "text", text: `Instant search complete for: ${query}` }],
    };
  }
);

server.registerTool(
  "clawd_composio_execute_instant",
  {
    title: "Execute Composio Instant tool",
    description: "Execute an Instant tool after CLAWD approval. Charges org balance and returns instantCharge.",
    inputSchema: {
      requestId: z.string(),
      toolSlug: z.string(),
      arguments: z.record(z.unknown()),
    },
  },
  async ({ requestId, toolSlug, arguments: args }) => {
    const req = approvals.get(requestId);
    if (!req || req.status !== "approved") {
      return { content: [{ type: "text", text: "Valid approved CLAWD request required." }], isError: true };
    }
    const result = await executeInstantTool(toolSlug, args);
    req.status = "executed";
    req.result = result;
    emitEvent("clawd.trade.filled", { requestId, rail: "composio", result });
    return {
      structuredContent: { executed: true, requestId, toolSlug, result },
      content: [{ type: "text", text: `Instant tool ${toolSlug} executed for ${requestId}.` }],
    };
  }
);

server.registerTool(
  "clawd_composio_verify",
  {
    title: "Verify Composio key",
    description: "Verify COMPOSIO_API_KEY works with a no-auth Instant call.",
    inputSchema: {},
  },
  async () => {
    const result = await verifyComposioKey();
    return {
      structuredContent: result,
      content: [{ type: "text", text: "Composio key verified." }],
    };
  }
);

server.registerTool(
  "clawd_instant_trading_research",
  {
    title: "Instant trading research",
    description: "One-shot Instant research: search + optional scrape for a token/symbol. No approval needed for research.",
    inputSchema: {
      symbol: z.string(),
      query: z.string().optional(),
    },
  },
  async ({ symbol, query }) => {
    const q = query ?? `latest news and price action for ${symbol}`;
    const results = await searchInstantTools(q, INSTANT_TRADING_TOOLKITS);
    return {
      structuredContent: { symbol, query: q, results },
      content: [{ type: "text", text: `Instant research for ${symbol} complete.` }],
    };
  }
);

// ---------------------------------------------------------------------------
// Portfolio summary
// ---------------------------------------------------------------------------

server.registerTool(
  "clawd_portfolio_summary",
  {
    title: "Cross-rail portfolio summary",
    description: "Unified view across Robinhood, Solana, Wallet MCP, and Coinbase.",
    inputSchema: {},
  },
  async () => {
    const pending = Array.from(approvals.values()).filter((a) => a.status === "pending").length;
    return {
      structuredContent: {
        pendingApprovals: pending,
        note: "Call individual rail tools for live data.",
      },
      content: [{ type: "text", text: `Pending approvals: ${pending}` }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CLAWD MCP server v0.2 running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
