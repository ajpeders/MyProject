import type { TaskType, TaskStatus } from "../../../api/devteam";

interface TaskToolbarProps {
  filterType: TaskType | "";
  onFilterTypeChange: (v: TaskType | "") => void;
  filterStatus: TaskStatus | "";
  onFilterStatusChange: (v: TaskStatus | "") => void;
  onRefresh: () => void;
  onNewTask: () => void;
  loading: boolean;
  apiKey: string;
  selectedProjectId: string;
}

export default function TaskToolbar({
  filterType,
  onFilterTypeChange,
  filterStatus,
  onFilterStatusChange,
  onRefresh,
  onNewTask,
  loading,
  apiKey,
  selectedProjectId,
}: TaskToolbarProps) {
  return (
    <div className="devteam-toolbar">
      <button type="button" onClick={() => void onRefresh()} disabled={loading}>
        refresh
      </button>
      <button type="button" onClick={() => onNewTask()} disabled={!apiKey || !selectedProjectId}>
        + New Task
      </button>
      <select
        value={filterType}
        onChange={(e) => onFilterTypeChange(e.target.value as TaskType | "")}
        aria-label="Filter by type"
      >
        <option value="">All types</option>
        <option value="dev">Dev</option>
        <option value="review">Review</option>
        <option value="qa">QA</option>
        <option value="deploy">Deploy</option>
        <option value="orchestrator">Orchestrator</option>
      </select>
      <select
        value={filterStatus}
        onChange={(e) => onFilterStatusChange(e.target.value as TaskStatus | "")}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="assigned">Assigned</option>
        <option value="in_progress">In Progress</option>
        <option value="blocked">Blocked</option>
        <option value="needs_changes">Needs Changes</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>
  );
}
