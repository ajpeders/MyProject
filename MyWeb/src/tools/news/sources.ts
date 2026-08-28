export type NewsTopic = "All" | "Tech" | "Music" | "World" | "US News" | "Hip Hop" | "Gaming";

export interface NewsSource {
  id: string;
  label: string;
  topic: NewsTopic;
  feedUrl: string;
  enabled: boolean;
}

export const TOPICS: NewsTopic[] = ["All", "Tech", "Music", "World", "US News", "Hip Hop", "Gaming"];
