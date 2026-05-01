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

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onCancel: (task: Task) => void;
  onApproveDeploy: (task: Task) => void;
  editingTaskId: string | null;
  editDescription: string;
  editPriority: number;
  editRevision: number;
  editError: string;
  onStartEdit: (task: Task) => void;
  onEditDescriptionChange: (v: string) => void;
  onEditPriorityChange: (v: number) => void;
  onSaveEdit: (task: Task) => void;
  onCancelEdit: () => void;
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function TaskDetailModal({
  task,
  onClose,
  onCancel,
  onApproveDeploy,
  editingTaskId,
  editDescription,
  editPriority,
  editRevision,
  editError,
  onStartEdit,
  onEditDescriptionChange,
  onEditPriorityChange,
  onSaveEdit,
  onCancelEdit,
}: TaskDetailModalProps) {
  const isEditing = editingTaskId === task.id;
  const canEdit = !TERMINAL_STATUSES.has(task.status) && task.type !== "orchestrator";

  return (
    <div className="devteam-modal-overlay" onClick={onClose}>
      <div className="devteam-modal" onClick={(e) => e.stopPropagation()}>
        <div className="devteam-modal-header">
          <div className="devteam-modal-meta">
            <span className={`type-badge type-${task.type}`}>{TYPE_LABELS[task.type]}</span>
            <span className={`status-badge status-${task.status}`}>
              {STATUS_LABELS[task.status]}
            </span>
            <span className="task-id">{task.id}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="devteam-modal-body">
          {isEditing ? (
            <form
              className="devteam-task-edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                onSaveEdit(task);
              }}
            >
              <label>
                Description
                <textarea
                  value={editDescription}
                  onChange={(e) => onEditDescriptionChange(e.target.value)}
                  rows={4}
                  required
                />
              </label>
              <label>
                Priority
                <input
                  type="number"
                  value={editPriority}
                  onChange={(e) => onEditPriorityChange(Number(e.target.value))}
                  min={1}
                  max={10}
                />
              </label>
              <p className="devteam-revision-info">Revision: {editRevision}</p>
              {editError ? <p className="devteam-error">{editError}</p> : null}
              <div className="devteam-modal-actions">
                <button type="submit">Save</button>
                <button type="button" onClick={onCancelEdit}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <dl className="devteam-detail-grid">
                <dt>Description</dt>
                <dd>{task.description}</dd>

                <dt>Priority</dt>
                <dd>{task.priority}</dd>

                <dt>Revision</dt>
                <dd>{task.revision}</dd>

                <dt>Parent</dt>
                <dd>{task.parent_id || "—"}</dd>

                <dt>Created</dt>
                <dd>{formatTime(task.created_at)}</dd>

                <dt>Updated</dt>
                <dd>{formatTime(task.updated_at)}</dd>

                {task.result ? (
                  <>
                    <dt>Result</dt>
                    <dd><pre>{task.result}</pre></dd>
                  </>
                ) : null}
                {task.error ? (
                  <>
                    <dt>Error</dt>
                    <dd className="devteam-error">{task.error}</dd>
                  </>
                ) : null}
              </dl>

              <div className="devteam-modal-actions">
                {canEdit ? (
                  <button type="button" onClick={() => onStartEdit(task)}>
                    Edit
                  </button>
                ) : null}
                {!TERMINAL_STATUSES.has(task.status) ? (
                  <button type="button" onClick={() => void onCancel(task)}>
                    Cancel Task
                  </button>
                ) : null}
                {task.type === "qa" && task.status === "completed" ? (
                  <button type="button" onClick={() => void onApproveDeploy(task)}>
                    Approve Deploy
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
