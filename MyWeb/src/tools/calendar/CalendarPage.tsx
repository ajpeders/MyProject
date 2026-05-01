import { type FormEvent, useEffect, useState } from "react";
import { type MailSummary, getMailByDateRange } from "../../api/mail";
import {
  type CalendarEvent,
  createEvent,
  deleteEvent,
  getEvents,
  updateEvent,
} from "../../api/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function groupMailByDay(emails: MailSummary[]): Map<string, MailSummary[]> {
  const map = new Map<string, MailSummary[]>();
  for (const email of emails) {
    if (!email.date) continue;
    const key = email.date.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(email);
    map.set(key, list);
  }
  return map;
}

function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.date.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }
  return map;
}

export default function CalendarPage() {
  const [today] = useState(() => new Date());
  const [year, setYear] = useState(() => today.getFullYear());
  const [month, setMonth] = useState(() => today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [mailByDay, setMailByDay] = useState<Map<string, MailSummary[]>>(new Map());
  const [eventsByDay, setEventsByDay] = useState<Map<string, CalendarEvent[]>>(new Map());
  const [mailLoading, setMailLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  // Form fields
  const [formTitle, setFormTitle] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  async function fetchMonthData() {
    const start = formatDateKey(year, month, 1);
    const end = formatDateKey(year, month, daysInMonth);
    const [mailRes, eventRes] = await Promise.all([
      getMailByDateRange(start, end).catch(() => ({ emails: [] })),
      getEvents(start, end).catch(() => ({ events: [] })),
    ]);
    return { mailRes, eventRes };
  }

  function refreshMonth() {
    setMailLoading(true);
    fetchMonthData()
      .then(({ mailRes, eventRes }) => {
        setMailByDay(groupMailByDay(mailRes.emails));
        setEventsByDay(groupEventsByDay(eventRes.events));
      })
      .finally(() => setMailLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag before async fetch is intentional
    setMailLoading(true);
    fetchMonthData()
      .then(({ mailRes, eventRes }) => {
        if (cancelled) return;
        setMailByDay(groupMailByDay(mailRes.emails));
        setEventsByDay(groupEventsByDay(eventRes.events));
      })
      .finally(() => {
        if (!cancelled) setMailLoading(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, daysInMonth]);

  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  function resetForm() {
    setFormTitle("");
    setFormTime("");
    setFormDescription("");
    setShowAddForm(false);
    setEditingEvent(null);
  }

  function goToPrev() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
    setSelectedDay(null);
    resetForm();
  }

  function goToNext() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDay(null);
    resetForm();
  }

  function goToToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(today.getDate());
    resetForm();
  }

  function startEditing(event: CalendarEvent) {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormTime(event.time ?? "");
    setFormDescription(event.description ?? "");
    setShowAddForm(false);
  }

  function startAdding() {
    resetForm();
    setShowAddForm(true);
  }

  function mailCountForDay(day: number): number {
    const key = formatDateKey(year, month, day);
    return mailByDay.get(key)?.length ?? 0;
  }

  function eventCountForDay(day: number): number {
    const key = formatDateKey(year, month, day);
    return eventsByDay.get(key)?.length ?? 0;
  }

  function mailForSelectedDay(): MailSummary[] {
    if (selectedDay === null) return [];
    const key = formatDateKey(year, month, selectedDay);
    return mailByDay.get(key) ?? [];
  }

  function eventsForSelectedDay(): CalendarEvent[] {
    if (selectedDay === null) return [];
    const key = formatDateKey(year, month, selectedDay);
    return eventsByDay.get(key) ?? [];
  }

  async function handleSubmitEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedDay || !formTitle.trim()) return;
    setSaving(true);
    setError("");
    const payload = {
      title: formTitle.trim(),
      date: formatDateKey(year, month, selectedDay),
      time: formTime || undefined,
      description: formDescription.trim() || undefined,
    };
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
      } else {
        await createEvent(payload);
      }
      resetForm();
      refreshMonth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(id: string) {
    setDeletingId(id);
    setError("");
    try {
      await deleteEvent(id);
      if (editingEvent?.id === id) resetForm();
      refreshMonth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setDeletingId("");
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells.push(null);

  const selectedDate = selectedDay
    ? new Date(year, month, selectedDay).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const selectedMail = mailForSelectedDay();
  const selectedEvents = eventsForSelectedDay();
  const isFormOpen = showAddForm || editingEvent !== null;

  return (
    <section className="calendar-page">
      <div className="calendar-header">
        <h1>Calendar</h1>
        <p>View and navigate by month.</p>
      </div>

      <div className="calendar-nav">
        <button type="button" onClick={goToPrev}>&lt; Prev</button>
        <span className="calendar-nav-label">
          {MONTH_NAMES[month]} {year}
        </span>
        <button type="button" onClick={goToNext}>Next &gt;</button>
        <button type="button" onClick={goToToday}>Today</button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="calendar-weekday">{wd}</div>
        ))}
        {cells.map((day, i) => {
          const mailCount = day !== null ? mailCountForDay(day) : 0;
          const eventCount = day !== null ? eventCountForDay(day) : 0;
          return (
            <button
              key={i}
              type="button"
              className={[
                "calendar-cell",
                day === null ? "calendar-cell--empty" : "",
                day !== null && isToday(day) ? "calendar-cell--today" : "",
                day !== null && day === selectedDay ? "calendar-cell--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={day === null}
              onClick={() => { if (day !== null) setSelectedDay(day); resetForm(); }}
            >
              {day}
              {(mailCount > 0 || eventCount > 0) && (
                <span className="calendar-cell-badges">
                  {eventCount > 0 && <span className="calendar-event-badge">{eventCount}</span>}
                  {mailCount > 0 && <span className="calendar-mail-badge">{mailCount}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {mailLoading && <p className="calendar-loading">Loading...</p>}
      {error && <p className="calendar-error">{error}</p>}

      {selectedDate && (
        <div className="calendar-detail">
          <div className="calendar-detail-header">
            <h2>{selectedDate}</h2>
            {!isFormOpen && (
              <button
                type="button"
                className="calendar-add-btn"
                onClick={startAdding}
              >
                + Add Event
              </button>
            )}
          </div>

          {isFormOpen && (
            <form className="calendar-event-form" onSubmit={handleSubmitEvent}>
              <label>
                Title
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Event title"
                  required
                  disabled={saving}
                />
              </label>
              <label>
                Time (optional)
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  disabled={saving}
                />
              </label>
              <label>
                Description (optional)
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Details..."
                  rows={2}
                  disabled={saving}
                />
              </label>
              <div className="calendar-event-form-actions">
                <button type="submit" disabled={saving || !formTitle.trim()}>
                  {saving ? "Saving..." : editingEvent ? "Update" : "Save"}
                </button>
                <button type="button" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="calendar-events-section">
            <h3>Events</h3>
            {selectedEvents.length > 0 ? (
              <ul className="calendar-event-list">
                {selectedEvents.map((event) => (
                  <li key={event.id} className="calendar-event-item">
                    <div className="calendar-event-info">
                      <strong>{event.title}</strong>
                      {event.time && <span className="calendar-event-time">{event.time}</span>}
                      {event.description && (
                        <span className="calendar-event-desc">{event.description}</span>
                      )}
                    </div>
                    <div className="calendar-event-actions">
                      <button
                        type="button"
                        className="calendar-event-edit"
                        onClick={() => startEditing(event)}
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="calendar-event-delete"
                        onClick={() => void handleDeleteEvent(event.id)}
                        disabled={deletingId === event.id}
                      >
                        {deletingId === event.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="calendar-detail-empty">No events for this day.</p>
            )}
          </div>

          <div className="calendar-mail-section">
            <h3>Mail</h3>
            {selectedMail.length > 0 ? (
              <ul className="calendar-mail-list">
                {selectedMail.map((email, i) => (
                  <li key={email.id ?? i} className="calendar-mail-item">
                    <div className="calendar-mail-subject">
                      {!email.read && <span className="calendar-mail-unread">new</span>}
                      <strong>{email.subject ?? "(no subject)"}</strong>
                    </div>
                    <span className="calendar-mail-from">{email.from ?? "unknown"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="calendar-detail-empty">No mail for this day.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
