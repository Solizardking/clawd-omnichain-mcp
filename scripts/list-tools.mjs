#!/usr/bin/env node
/**
 * Generate a markdown tools list from the catalog.
 * Usage: node scripts/list-tools.mjs
 */
import { CLAWD_TOOLS, CLAWD_GROUPS } from "../src/catalog.ts";

console.log("# CLAWD Tools\n");
console.log(`Total: ${CLAWD_TOOLS.length}\n`);

for (const group of CLAWD_GROUPS) {
  const tools = CLAWD_TOOLS.filter((t) => t.group === group);
  if (!tools.length) continue;
  console.log(`## ${group}\n`);
  console.log("| Tool | Rail | Approval | Description |");
  console.log("|------|------|----------|-------------|");
  for (const t of tools) {
    console.log(`| \`${t.name}\` | ${t.rail} | ${t.requiresApproval ? "Yes" : "No"} | ${t.description} |`);
  }
  console.log();
}
