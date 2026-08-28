import { useState } from "react";
import type { Task, TaskType, TaskStatus } from "../../../api/devteam";

const TYPE_LABELS: Record<TaskType, string> = {
  dev: "Dev",
  review: "Review",
  qa: "QA",
  deploy: "Deploy",
  orchestrator: "Orchestrator",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In Progress",
  blocked: "Blocked",
  needs_changes: "Needs Changes",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const TERMINAL_STATUSES = new Set<TaskStatus>(["completed", "failed", "cancelled"]);

interface TaskGroup {
  id: string;
  name: string;
  repoUrl: string;
  tasks: Task[];
}

interface TaskListProps {
  groupedTaskSections: TaskGroup[];
  onSelectTask: (task: Task) => void;
  loading: boolean;
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function truncateId(id: string, len = 8) {
  return id.length > len ? id.slice(0, len) + "…" : id;
}

function truncateText(text: string | undefined, len = 50) {
  if (!text) return "—";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function pipelineCounts(groupTasks: Task[]) {
  return (["dev", "review", "qa", "deploy", "orchestrator"] as TaskType[]).map((type) => ({
    type,
    total: groupTasks.filter((task) => task.type === type).length,
    active: groupTasks.filter((task) => task.type === type && !TERMINAL_STATUSES.has(task.status)).length,
  }));
}

interface TreeNode {
  task: Task;
  children: Task[];
  depth: number;
}

function buildTree(tasks: Task[]): TreeNode[] {
  const childrenByParent = new Map<string, Task[]>();
  const rootTasks: Task[] = [];

  // Separate roots and children
  tasks.forEach((task) => {
    if (task.parent_id) {
      const existing = childrenByParent.get(task.parent_id) || [];
      existing.push(task);
      childrenByParent.set(task.parent_id, existing);
    } else {
      rootTasks.push(task);
    }
  });

  // Sort children by created_at asc
  childrenByParent.forEach((children) => {
    children.sort((a, b) => a.created_at.localeCompare(b.created_at));
  });

  // Sort roots by created_at desc (most recent first)
  rootTasks.sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Build flat list with depth
  const result: TreeNode[] = [];
  function addNode(task: Task, depth: number) {
    const children = childrenByParent.get(task.id) || [];
    result.push({ task, children, depth });
    if (children.length > 0) {
      children.forEach((child) => addNode(child, depth + 1));
    }
  }

  rootTasks.forEach((root) => addNode(root, 0));
  return result;
}

function TaskRow({
  node,
  isExpanded,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  isExpanded: boolean;
  onToggle: (taskId: string) => void;
  onSelect: (task: Task) => void;
}) {
  const { task, children, depth } = node;
  const isOrchestrator = task.type === "orchestrator";
  const hasChildren = children.length > 0;

  return (
    <>
      <tr
        onClick={() => onSelect(task)}
        className={`devteam-row ${isOrchestrator ? "devteam-orchestrator-row" : ""}`}
        style={{ marginLeft: depth * 16 }}
      >
        <td>
          <span className="task-id">{truncateId(task.id)}</span>
        </td>
        <td>
          <span className={`type-badge type-${task.type}`}>{TYPE_LABELS[task.type]}</span>
        </td>
        <td>
          <span className={`status-badge status-${task.status}`}>
            {STATUS_LABELS[task.status]}
          </span>
        </td>
        <td>
          <span className="task-desc">{truncateText(task.description)}</span>
        </td>
        <td>{task.priority || "—"}</td>
        <td>{formatTime(task.created_at)}</td>
        <td>
          {isOrchestrator && hasChildren && (
            <button
              type="button"
              className="devteam-expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(task.id);
              }}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          )}
          {isOrchestrator && hasChildren && (
            <span className="devteam-child-count">
              {children.length} sub-task{children.length === 1 ? "" : "s"}
            </span>
          )}
        </td>
      </tr>
    </>
  );
}

export default function TaskList({ groupedTaskSections, onSelectTask, loading }: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  function toggleExpand(taskId: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  if (loading && groupedTaskSections.length === 0) {
    return <p>Loading...</p>;
  }

  if (groupedTaskSections.length === 0) {
    return <p className="devteam-empty">No tasks found.</p>;
  }

  return (
    <div className="devteam-project-sections">
      {groupedTaskSections.map((group) => (
        <section key={group.id} className="devteam-project-section">
          <header className="devteam-project-section-header">
            <div>
              <h2>{group.name}</h2>
              {group.repoUrl ? <p>{group.repoUrl}</p> : null}
            </div>
            <span>{group.tasks.length} task{group.tasks.length === 1 ? "" : "s"}</span>
          </header>
          <div className="devteam-pipeline" aria-label={`${group.name} pipeline`}>
            {pipelineCounts(group.tasks).map((stage, index) => (
              <div key={stage.type} className={`devteam-pipeline-step ${stage.active > 0 ? "active" : ""}`}>
                <span>{TYPE_LABELS[stage.type]}</span>
                <strong>{stage.total}</strong>
                {index < 4 ? <em>→</em> : null}
              </div>
            ))}
          </div>
          <div className="devteam-list">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Priority</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {buildTree(group.tasks).map((node) => {
                  const isExpanded = expandedTasks.has(node.task.id);
                  // Skip children if parent not expanded
                  if (node.depth > 0 && !expandedTasks.has(node.task.parent_id)) {
                    return null;
                  }
                  return (
                    <TaskRow
                      key={node.task.id}
                      node={node}
                      isExpanded={isExpanded}
                      onToggle={toggleExpand}
                      onSelect={onSelectTask}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
