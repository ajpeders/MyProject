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
    name: "News",
    path: "/news",
    description: "Track breaking stories and compare major news services",
  },
  {
    name: "Search",
    path: "/search",
    description: "Ask questions, review web results, and browse page summaries",
  },
  {
    name: "Chat",
    path: "/chat",
    description: "Ask web-backed questions and get inline answers",
  },
  {
    name: "Memory",
    path: "/memory",
    description: "Store, search, and delete personal memories",
  },
  {
    name: "MyAgent",
    path: "/myagent",
    description: "Local LLM chat with full conversation history",
  },
  {
    name: "DevTeam",
    path: "/devteam",
    description: "Manage development task pipeline",
  },
  {
    name: "Calendar",
    path: "/calendar",
    description: "View and navigate a monthly calendar",
  },
  {
    name: "Admin",
    path: "/admin",
    description: "Inspect users, sessions, and database health",
  },
  {
    name: "Settings",
    path: "/settings",
    description: "Manage IMAP accounts and preferences",
  },
  {
    name: "Whisper",
    path: "/whisper",
    description: "Test surface for voice transcription (temporary)",
  },
];
