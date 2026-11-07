/**
 * CLAWD Tool Catalog
 * Custom trading tools + Composio Instant Tools + Firewall hooks
 *
 * Uses COMPOSIO_API_KEY (from `composio login --agent` or dashboard).
 * All write tools go through CLAWD approvals before execution.
 */

export type Rail = "robinhood" | "solana" | "base" | "coinbase" | "ows" | "composio";

export interface ClawdToolDef {
  name: string;
  title: string;
  description: string;
  rail: Rail;
  group: string;
  requiresApproval: boolean;
  composioSlug?: string; // if backed by Composio Instant
  instant?: boolean;
}

export const CLAWD_TOOLS: ClawdToolDef[] = [
  // ---------------------------------------------------------------------------
  // Approvals (always first)
  // ---------------------------------------------------------------------------
  {
    name: "clawd_create_approval",
    title: "Create CLAWD approval",
    description: "Create a pending action that requires explicit user approval in the CLAWD UI.",
    rail: "ows",
    group: "approvals",
    requiresApproval: false,
  },
  {
    name: "clawd_list_approvals",
    title: "List CLAWD approvals",
    description: "List pending and recent CLAWD approval requests.",
    rail: "ows",
    group: "approvals",
    requiresApproval: false,
  },
  {
    name: "clawd_decide_approval",
    title: "Decide CLAWD approval",
    description: "Approve or reject a pending CLAWD request.",
    rail: "ows",
    group: "approvals",
    requiresApproval: false,
  },

  // ---------------------------------------------------------------------------
  // Composio Instant — research / data (no approval)
  // ---------------------------------------------------------------------------
  {
    name: "clawd_composio_verify",
    title: "Verify Composio key",
    description: "Verify COMPOSIO_API_KEY works with a no-auth Instant call.",
    rail: "composio",
    group: "composio-research",
    requiresApproval: false,
  },
  {
    name: "clawd_instant_trading_research",
    title: "Instant trading research",
    description: "One-shot Instant research for a symbol (news + price). No approval needed.",
    rail: "composio",
    group: "composio-research",
    requiresApproval: false,
  },
  {
    name: "clawd_composio_execute_instant",
    title: "Execute Composio Instant tool",
    description: "Execute a Composio Instant tool after CLAWD approval. Uses Instant account and returns charge.",
    rail: "composio",
    group: "composio-execute",
    requiresApproval: true,
    instant: true,
  },

  // ---------------------------------------------------------------------------
  // Robinhood
  // ---------------------------------------------------------------------------
  {
    name: "clawd_rh_preview_equity",
    title: "Preview Robinhood equity order",
    description: "Preview an equity order on Robinhood. Creates CLAWD approval.",
    rail: "robinhood",
    group: "robinhood",
    requiresApproval: true,
  },
  {
    name: "clawd_rh_place_equity",
    title: "Place Robinhood equity order",
    description: "Place an equity order after CLAWD approval.",
    rail: "robinhood",
    group: "robinhood",
    requiresApproval: true,
  },
  {
    name: "clawd_rh_preview_crypto",
    title: "Preview Robinhood crypto order",
    description: "Preview a crypto order on Robinhood. Requires RH Crypto account.",
    rail: "robinhood",
    group: "robinhood",
    requiresApproval: true,
  },

  // ---------------------------------------------------------------------------
  // Solana / Phoenix / Pump.fun
  // ---------------------------------------------------------------------------
  {
    name: "clawd_solana_preview",
    title: "Preview Solana action",
    description: "Preview Pump.fun, Raydium, Phoenix, or Backpack action. Creates CLAWD approval.",
    rail: "solana",
    group: "solana",
    requiresApproval: true,
  },
  {
    name: "clawd_solana_execute",
    title: "Execute Solana action via OWS",
    description: "Execute approved Solana action. Signs with OWS.",
    rail: "solana",
    group: "solana",
    requiresApproval: true,
  },
  {
    name: "clawd_phoenix_prepare_order",
    title: "Prepare Phoenix perps order",
    description: "Build unsigned Phoenix market/limit order for user-signed or OWS path.",
    rail: "solana",
    group: "phoenix",
    requiresApproval: true,
  },

  // ---------------------------------------------------------------------------
  // Wallet MCP / Coinbase
  // ---------------------------------------------------------------------------
  {
    name: "clawd_wallet_get_portfolio",
    title: "Wallet MCP portfolio",
    description: "Proxy to Wallet MCP get_portfolio.",
    rail: "base",
    group: "wallet-mcp",
    requiresApproval: false,
  },
  {
    name: "clawd_coinbase_balance",
    title: "Coinbase balance",
    description: "Proxy to Coinbase for Agents balance.",
    rail: "coinbase",
    group: "coinbase",
    requiresApproval: false,
  },

  // ---------------------------------------------------------------------------
  // Cross-rail
  // ---------------------------------------------------------------------------
  {
    name: "clawd_portfolio_summary",
    title: "Cross-rail portfolio summary",
    description: "Unified view across Robinhood, Solana, Wallet MCP, and Coinbase.",
    rail: "ows",
    group: "portfolio",
    requiresApproval: false,
  },
];

export const CLAWD_GROUPS = [
  "approvals",
  "composio-research",
  "composio-execute",
  "robinhood",
  "solana",
  "phoenix",
  "wallet-mcp",
  "coinbase",
  "portfolio",
] as const;

/** Firewall hooks for Composio sessions (trading safety) */
export const CLAWD_FIREWALL_HOOKS = [
  {
    id: "no_unapproved_large_trades",
    type: "before_execute" as const,
    appliesTo: "all",
    handler: {
      type: "condition_check" as const,
      condition: "Placing a trade or transfer larger than $500 without an existing CLAWD approval requestId",
      action: "block" as const,
    },
  },
  {
    id: "no_secrets_in_results",
    type: "after_execute" as const,
    appliesTo: "all",
    handler: {
      type: "condition_check" as const,
      condition: "A tool result that contains a private key, seed phrase, API key, or password",
      action: "block" as const,
    },
  },
  {
    id: "block_injection",
    type: "after_execute" as const,
    appliesTo: "all",
    handler: {
      type: "prompt_injection_check" as const,
      action: "block" as const,
    },
  },
];
