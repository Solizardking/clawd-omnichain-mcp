# CLAWD MCP

Omnichain agent MCP server for Solana (Pump.fun, Raydium, Phoenix, Backpack), Base (Wallet MCP), Coinbase, Robinhood, OWS, and Composio Instant Tools.

## Features

- Custom CLAWD approvals for every write
- MCP Apps UI (approval cards)
- MCP Events (`clawd.approval.pending`, `clawd.trade.filled`)
- Composio Instant Tools with Firewall hooks
- OWS signing for Solana
- Proxies for Robinhood MCP, Wallet MCP, Coinbase

## Quick start

```bash
# Install
npm install
cd web && npm install && npm run build && cd ..

# Env
export COMPOSIO_API_KEY=...          # from `composio login --agent`
export OWS_WALLET=clawd-treasury
export OWS_API_KEY=ows_key_...

# Run
npm run dev
```

## Structure

```
clawd-mcp/
├── src/
│   ├── server.ts       # MCP server
│   ├── catalog.ts      # Tool definitions
│   └── composio.ts     # Instant + Firewall
├── web/
│   └── approval-card.tsx
├── docs/
│   ├── TOOLS.md        # Tool catalog
│   └── SETUP.md
└── scripts/
```

## Tools

See [docs/TOOLS.md](docs/TOOLS.md) for the full list.

## Connect

```json
{
  "mcpServers": {
    "clawd": { "command": "npx", "args": ["tsx", "src/server.ts"] }
  }
}
```

## License

MIT
