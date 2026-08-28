/**
 * Mirror of MyWeb/src/tools/registry.ts so both clients share one source of
 * truth for what tools exist. The Home screen on each client renders this
 * list and routes to /<path> when a tool is tapped/clicked.
 */
export interface ToolEntry {
  name: string;
  path: string;
  description: string;
}

export const tools: ToolEntry[] = [
  {
    name: "Mail",
    path: "/mail",
    description: "Read and triage email across accounts",
  },
  {
    name: "Budget",
    path: "/budget",
    description: "Review spending and categorize transactions",
  },
  {
    name: "Settings",
    path: "/settings",
    description: "Manage IMAP accounts and preferences",
  },
];
