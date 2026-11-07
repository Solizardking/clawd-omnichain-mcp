# CLAWD Setup

## Composio (unattended)

```bash
curl -fsSL https://composio.dev/install | sh
export PATH="$HOME/.local/bin:$PATH"
composio login --agent
composio agent whoami

set +x
COMPOSIO_API_KEY="$(jq -er '.composio.api_key | strings | select(length > 0)' \
  "${COMPOSIO_CACHE_DIR:-$HOME/.composio}/agent.json")"
export COMPOSIO_API_KEY
```

## OWS

```bash
curl -fsSL https://docs.openwallet.sh/install.sh | bash
ows wallet create --name clawd-treasury
ows policy create --file clawd-limits.json
ows key create --name clawd-agent --wallet clawd-treasury --policy clawd-limits
export OWS_WALLET=clawd-treasury
export OWS_API_KEY=ows_key_...
```

## MCP endpoints

- Robinhood: `https://agent.robinhood.com/mcp/trading`
- Wallet MCP: `https://wallet-mcp.coinbase.com`
- Coinbase: `https://agents.coinbase.com/mcp`

## Build UI

```bash
cd web
npm install
npm run build
```
