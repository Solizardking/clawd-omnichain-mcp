# CLAWD Tools — Complete List

Generated from `src/catalog.ts`. All write tools require CLAWD approval.

## Approvals

| Tool | Rail | Approval | Description |
|------|------|----------|-------------|
| `clawd_create_approval` | ows | No | Create pending action |
| `clawd_list_approvals` | ows | No | List approvals |
| `clawd_decide_approval` | ows | No | Approve or reject |

## Composio Instant

| Tool | Rail | Approval | Description |
|------|------|----------|-------------|
| `clawd_composio_search` | composio | No | Search Instant tools + prices |
| `clawd_composio_verify` | composio | No | Verify COMPOSIO_API_KEY |
| `clawd_instant_trading_research` | composio | No | One-shot research for a symbol |
| `clawd_composio_execute_instant` | composio | Yes | Execute Instant tool, returns charge |

**Instant trading toolkits:** `exa`, `firecrawl`, `birdeye`, `jupiter`, `helius`

## Robinhood

| Tool | Rail | Approval | Description |
|------|------|----------|-------------|
| `clawd_rh_preview_equity` | robinhood | Yes | Preview equity order |
| `clawd_rh_place_equity` | robinhood | Yes | Place equity order |
| `clawd_rh_preview_crypto` | robinhood | Yes | Preview crypto order |

## Solana

| Tool | Rail | Approval | Description |
|------|------|----------|-------------|
| `clawd_solana_preview` | solana | Yes | Preview Pump.fun / Raydium / Phoenix / Backpack |
| `clawd_solana_execute` | solana | Yes | Execute via OWS |
| `clawd_phoenix_prepare_order` | solana | Yes | Prepare Phoenix perps order |

## Wallet MCP / Coinbase

| Tool | Rail | Approval | Description |
|------|------|----------|-------------|
| `clawd_wallet_get_portfolio` | base | No | Wallet MCP portfolio |
| `clawd_coinbase_balance` | coinbase | No | Coinbase balance |

## Portfolio

| Tool | Rail | Approval | Description |
|------|------|----------|-------------|
| `clawd_portfolio_summary` | ows | No | Cross-rail summary |

## Firewall hooks

- `no_unapproved_large_trades` — blocks trades > $500 without CLAWD requestId
- `no_secrets_in_results` — blocks results with keys/passphrases
- `block_injection` — prompt injection check

## Events

- `clawd.approval.pending`
- `clawd.trade.filled`
