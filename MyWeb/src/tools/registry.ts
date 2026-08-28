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
