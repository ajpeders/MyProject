# DevTeam Orchestrator — Frontend Implementation Spec

**Date:** 2026-04-25
**Status:** Approved
**Features:** Task type selection, orchestrator tree view, task editing

---

## 1. Schema & API Changes

### 1.1 Types (`src/api/devteam.ts`)

```typescript
export type TaskType = "dev" | "review" | "qa" | "deploy" | "orchestrator";

export interface Task {
  id: string;
  project_id: string;
  description: string;
  status: TaskStatus;
  priority: number;
  type: TaskType;        // new: "orchestrator" | "dev" | "review" | "qa" | "deploy"
  parent_id: string;      // new: "" if no parent, else parent task ID
  revision: number;       // new: increments on edit, for stale detection
  created_at: string;
  updated_at: string;
  result?: string;
  error?: string;
  // Orchestrator-only fields (present when type === "orchestrator")
  plan?: string;
  decompose_prompt?: string;
  sub_tasks?: string[];   // child task IDs
}
```

### 1.2 New API Function

```typescript
// src/api/devteam.ts
export async function editTask(
  taskId: string,
  updates: {
    description?: string;
    params?: Record<string, unknown>;
    priority?: number;
  },
  expectedRevision: number
): Promise<Task> {
  const res = await devteamFetch<{ task: Task }>("/api/task/edit", {
    task_id: taskId,
    ...updates,
    revision: expectedRevision,
  });
  return res.task;
}
```

### 1.3 Reducer Changes

**New action types:**
- `SET_TASK_EDITING` — `{ type: "SET_TASK_EDITING"; taskId: string | null }`
- `TASK_UPDATED` — `{ type: "TASK_UPDATED"; task: Task }` (from WebSocket)
- `TASK_CREATED` — `{ type: "TASK_CREATED"; task: Task }` (already exists, used by WS)

**TaskEditingState (local to component, not in reducer):**
```typescript
interface TaskEditingState {
  editingTaskId: string | null;   // null = not editing
  editDescription: string;
  editPriority: number;
  editRevision: number;            // revision at time edit started
  editError: string;
}
```

---

## 2. Orchestrator Tree View

### 2.1 Grouping Logic (TaskList)

Group tasks by `parent_id` client-side:

1. Tasks with `parent_id === ""` are **root tasks**
2. Tasks with `parent_id !== ""` are **children** — find parent by ID
3. For display, filter: if `selectedTaskId` is set, only show that task + its descendants
4. Sorting: root tasks by `created_at` desc; children under each parent by `created_at` asc

### 2.2 Expand/Collapse State

```typescript
// Local state in TaskList (useState, not reducer)
const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
```

- Toggle: `setExpandedTasks(prev => { next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })`
- Only **orchestrator-type** root tasks are expandable
- Collapsed orchestrator shows child count badge: `"${childCount} sub-tasks"`

### 2.3 Rendering

```
[Toggle] [Icon] Task description            ← root task (indented 0)
  [Icon] Sub-task description               ← child (indented 16px)
  [Icon] Sub-task description
```

- Indent children: `margin-left: 16px` per level
- Orchestrator tasks show folder icon; child tasks show task-type icon
- Toggle button: `▶` when collapsed, `▼` when expanded (CSS, no emoji needed — use chevron CSS or inline SVG)

### 2.4 Filtering Interaction

- If filter text active and only children match, auto-expand parent to show matches
- Collapse parent when filter clears (or keep current expand state)

---

## 3. Task Editing

### 3.1 Edit Button Visibility

Show **Edit** button in `TaskDetailModal` when ALL of:
- `task.status !== "done" && task.status !== "failed"` (non-terminal)
- `task.type !== "orchestrator"` (orchestrator task editing deferred)

### 3.2 Edit Mode UI

When editing:
- Description textarea becomes editable (was read-only)
- Priority shows as editable `<input type="number">`
- Show current `revision` as hidden field
- **Save** and **Cancel** buttons replace Edit button
- Error display below form if `editError` is set

### 3.3 Save Flow

1. Call `editTask(taskId, { description, priority }, expectedRevision)`
2. On success: dispatch `SET_TASK_EDITING(null)`, clear local editing state
3. On 409 Conflict (revision mismatch): set `editError = "Task was modified by another client. Please re-edit."` — keep modal open with refreshed task data
4. On other errors: set `editError = err.message`

### 3.4 Cancel Flow

- Dispatch `SET_TASK_EDITING(null)`
- Reset local editing state to current task values

---

## 4. New Task Type Dropdown

### 4.1 In NewTaskModal

Add to form below description textarea:

```tsx
<label>
  Task Type
  <select value={newTaskType} onChange={e => onNewTaskTypeChange(e.target.value as TaskType)}>
    <option value="dev">Direct dev task</option>
    <option value="orchestrator">Orchestrator (auto-decompose)</option>
  </select>
</label>
```

Props added to `NewTaskModalProps`:
- `newTaskType: TaskType`
- `onNewTaskTypeChange: (v: TaskType) => void`

### 4.2 State

In DevTeamPage reducer, add `newTaskType: TaskType` to creation state (under `creatingTask: boolean`).

---

## 5. File Change Summary

| File | Changes |
|------|---------|
| `src/api/devteam.ts` | Add `TaskType` `"orchestrator"`, `parent_id`/`revision` to `Task`, add `editTask()` |
| `src/api/devteam.test.ts` | Add tests for `editTask` (success, 409, network error); update existing task fixture |
| `src/tools/devteam/DevTeamPage.tsx` | Add `SET_TASK_EDITING`/`TASK_UPDATED` actions, `TaskEditingState` local state, edit handlers |
| `src/tools/devteam/components/NewTaskModal.tsx` | Add `TaskType` dropdown, `newTaskType`/`onNewTaskTypeChange` props |
| `src/tools/devteam/components/TaskDetailModal.tsx` | Add Edit/Cancel/Save button, editable description+priority form, revision field |
| `src/tools/devteam/components/TaskList.tsx` | Add `parent_id` grouping, `expandedTasks` state, indent rendering, expand/collapse toggle |
| `src/app.css` | Add `.devteam-orchestrator-row`, `.devteam-task-children`, expand/collapse chevron styles |
| `src/tools/devteam/components/ConnectionPanel.tsx` | No changes |
| `src/tools/devteam/components/DevPool.tsx` | Not implemented in this cycle |

---

## 6. Out of Scope (Deferred)

- Orchestrator task editing (Edit button hidden for `type === "orchestrator"`)
- Dev pool panel (admin-only dev slot management)
- Orchestrator task `plan` / `decompose_prompt` fields in UI
- Sub-task creation UI (automatic via backend decomposition)
