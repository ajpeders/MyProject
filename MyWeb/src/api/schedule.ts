import { apiFetch } from "./client";

export interface ScheduledTask {
  task_id: string;
  task_type: string;
  schedule: string;
  last_run_at: number | null;
  next_run_at: number;
  enabled: boolean;
}

export function getSchedule(): Promise<{ tasks: ScheduledTask[] }> {
  return apiFetch<{ tasks: ScheduledTask[] }>("/api/schedule", { method: "GET" });
}

export function updateSchedule(taskId: string, updates: { schedule?: string; enabled?: boolean }): Promise<ScheduledTask> {
  return apiFetch<ScheduledTask>(`/api/schedule/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}
