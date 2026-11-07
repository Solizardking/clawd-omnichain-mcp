/**
 * CLAWD Approval Card — React component for MCP Apps
 * Build with esbuild and inline into the server, or serve as a resource.
 */

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface ApprovalData {
  id: string;
  rail: string;
  action: string;
  summary: string;
  status: string;
  expiresAt: string;
  payload?: Record<string, unknown>;
}

function ApprovalCard() {
  const [data, setData] = useState<ApprovalData | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    // MCP Apps bridge: listen for tool-result notifications
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const msg = event.data;
      if (!msg || msg.jsonrpc !== "2.0") return;
      if (msg.method === "ui/notifications/tool-result") {
        const content = msg.params?.structuredContent as ApprovalData | undefined;
        if (content) setData(content);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function decide(decision: "approve" | "reject") {
    if (!data) return;
    setStatusMsg(decision === "approve" ? "Approving…" : "Rejecting…");
    // Call tool via MCP Apps bridge
    window.parent.postMessage(
      {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "clawd_decide_approval",
          arguments: { requestId: data.id, decision },
        },
      },
      "*"
    );
    setStatusMsg(decision === "approve" ? "Approved" : "Rejected");
  }

  if (!data) {
    return <div style={{ padding: 16, color: "#888" }}>Waiting for approval data…</div>;
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 16,
        background: "#0f0f12",
        color: "#eee",
        borderRadius: 12,
        maxWidth: 440,
        border: "1px solid #333",
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 12,
          background: "#2a2a3a",
          marginBottom: 8,
        }}
      >
        {data.rail}
      </div>
      <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{data.action}</h2>
      <div style={{ color: "#ccc", marginBottom: 12 }}>{data.summary}</div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
        Request: {data.id} · Expires: {data.expiresAt}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => decide("approve")}
          style={{
            flex: 1,
            padding: 10,
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            background: "#22c55e",
            color: "#000",
            cursor: "pointer",
          }}
        >
          Approve
        </button>
        <button
          onClick={() => decide("reject")}
          style={{
            flex: 1,
            padding: 10,
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            background: "#ef4444",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Reject
        </button>
      </div>
      {statusMsg && <div style={{ marginTop: 12, fontSize: 14 }}>{statusMsg}</div>}
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<ApprovalCard />);
}
