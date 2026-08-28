import { apiFetch } from "./client";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
}

export function getEvents(start: string, end: string): Promise<CalendarEventsResponse> {
  return apiFetch<CalendarEventsResponse>(
    `/api/calendar/events?start=${start}&end=${end}`,
    { method: "GET" },
  );
}

export function createEvent(
  event: Omit<CalendarEvent, "id">,
): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>("/api/calendar/events", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

export function updateEvent(
  id: string,
  event: Omit<CalendarEvent, "id">,
): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>(`/api/calendar/events/${id}`, {
    method: "PUT",
    body: JSON.stringify(event),
  });
}

export function deleteEvent(id: string): Promise<void> {
  return apiFetch<void>(`/api/calendar/events/${id}`, { method: "DELETE" });
}
