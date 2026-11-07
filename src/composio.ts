/**
 * CLAWD Composio Integration
 * Uses COMPOSIO_API_KEY from `composio login --agent` or dashboard.
 * Instant Tools + Firewall hooks for trading research and execution.
 */

import { Composio } from "@composio/core";
import { CLAWD_FIREWALL_HOOKS } from "./clawd-tool-catalog.js";

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;

let composio: Composio | null = null;

export function getComposio(): Composio {
  if (!COMPOSIO_API_KEY) {
    throw new Error("COMPOSIO_API_KEY not set. Run `composio login --agent` or set the key.");
  }
  if (!composio) {
    composio = new Composio({ apiKey: COMPOSIO_API_KEY });
  }
  return composio;
}

export interface ClawdComposioSessionOptions {
  userId?: string;
  toolkits?: string[];
  instant?: boolean;
  returnInstantCharge?: boolean;
  returnPricesInSearch?: boolean;
}

/**
 * Create a Composio session with CLAWD Firewall hooks.
 * Instant tools charge the org balance; CLAWD approval still required before execute.
 */
export async function createClawdComposioSession(opts: ClawdComposioSessionOptions = {}) {
  const c = getComposio();
  const session = await c.create(opts.userId ?? "clawd-agent", {
    toolkits: opts.toolkits ?? ["exa", "firecrawl"],
    instant: opts.instant === false
      ? false
      : {
          returnInstantCharge: opts.returnInstantCharge ?? true,
          returnPricesInSearch: opts.returnPricesInSearch ?? true,
        },
    hooks: CLAWD_FIREWALL_HOOKS,
  });
  return session;
}

/**
 * Search Instant tools and return prices when available.
 */
export async function searchInstantTools(query: string, toolkits?: string[]) {
  const session = await createClawdComposioSession({
    toolkits,
    returnPricesInSearch: true,
  });
  const results = await session.search({ query });
  return results;
}

/**
 * Execute an Instant tool. Caller must have already created a CLAWD approval.
 * Returns result + instantCharge when available.
 */
export async function executeInstantTool(
  toolSlug: string,
  args: Record<string, unknown>,
  options: { account?: string } = {}
) {
  const session = await createClawdComposioSession({
    returnInstantCharge: true,
  });
  const result = await session.execute(toolSlug, args, {
    account: options.account ?? "instant_account",
  });
  return result;
}

/**
 * Verify the project key works (no connected account required).
 */
export async function verifyComposioKey() {
  const c = getComposio();
  const result = await c.getClient().post<unknown>("/api/v3.1/tools/execute/HACKERNEWS_GET_USER", {
    body: { arguments: { username: "pg" } },
  });
  return result;
}
