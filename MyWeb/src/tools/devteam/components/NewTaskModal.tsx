import type { TaskType } from "../../../api/devteam";

interface NewTaskModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newTaskDesc: string;
  onNewTaskDescChange: (v: string) => void;
  newTaskType: TaskType;
  onNewTaskTypeChange: (v: TaskType) => void;
  createError: string;
  creatingTask: boolean;
}

export default function NewTaskModal({
  onClose,
  onSubmit,
  newTaskDesc,
  onNewTaskDescChange,
  newTaskType,
  onNewTaskTypeChange,
  createError,
  creatingTask,
}: NewTaskModalProps) {
  return (
    <div className="devteam-modal-overlay" onClick={onClose}>
      <div className="devteam-modal" onClick={(e) => e.stopPropagation()}>
        <div className="devteam-modal-header">
          <h2>Create New Task</h2>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="devteam-new-task-form" onSubmit={onSubmit}>
          <label>
            Description
            <textarea
              value={newTaskDesc}
              onChange={(e) => onNewTaskDescChange(e.target.value)}
              placeholder="Describe the task to be done..."
              rows={4}
              required
            />
          </label>
          <label>
            Task Type
            <select
              value={newTaskType}
              onChange={(e) => onNewTaskTypeChange(e.target.value as TaskType)}
            >
              <option value="dev">Direct dev task</option>
              <option value="orchestrator">Orchestrator (auto-decompose)</option>
            </select>
          </label>
          {createError ? <p className="devteam-error">{createError}</p> : null}
          <div className="devteam-modal-actions">
            <button type="submit" disabled={creatingTask || !newTaskDesc.trim()}>
              {creatingTask ? "Creating..." : "Create Task"}
            </button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}