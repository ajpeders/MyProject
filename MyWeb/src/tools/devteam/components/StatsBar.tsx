import type { DashboardStats } from "../../../api/devteam";

interface StatsBarProps {
  stats: DashboardStats | null;
}

export default function StatsBar({ stats }: StatsBarProps) {
  if (!stats) return null;
  return (
    <div className="devteam-stats" aria-label="Dashboard stats">
      <span>Total {stats.total}</span>
      <span>Pending {stats.pending}</span>
      <span>In Progress {stats.in_progress}</span>
      <span>Completed {stats.completed}</span>
      <span>Failed {stats.failed}</span>
    </div>
  );
}