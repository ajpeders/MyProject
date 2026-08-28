import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CalendarPage from "./CalendarPage";
import * as mail from "../../api/mail";
import * as calendar from "../../api/calendar";

vi.mock("../../api/mail", () => ({
  getMailByDateRange: vi.fn(),
}));

vi.mock("../../api/calendar", () => ({
  getEvents: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mail, "getMailByDateRange").mockResolvedValue({ emails: [] });
    vi.spyOn(calendar, "getEvents").mockResolvedValue({ events: [] });
    vi.spyOn(calendar, "createEvent").mockResolvedValue({
      id: "evt-1",
      title: "Test event",
      date: "2026-04-25",
    });
    vi.spyOn(calendar, "updateEvent").mockResolvedValue({
      id: "evt-1",
      title: "Updated event",
      date: "2026-04-25",
    });
    vi.spyOn(calendar, "deleteEvent").mockResolvedValue(undefined);
  });

  it("renders the calendar heading and weekday headers", async () => {
    render(<CalendarPage />);

    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
  });

  it("displays day numbers for the current month", async () => {
    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("28")).toBeInTheDocument();
    });
  });

  it("highlights today", async () => {
    render(<CalendarPage />);

    const today = new Date();
    const todayCell = screen.getByText(String(today.getDate()), {
      selector: ".calendar-cell--today",
    });
    expect(todayCell).toBeInTheDocument();
  });

  it("navigates to previous and next month", async () => {
    render(<CalendarPage />);

    const today = new Date();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    // Check current month is shown
    expect(screen.getByText(new RegExp(monthNames[today.getMonth()]))).toBeInTheDocument();

    // Go to next month
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    const nextMonth = (today.getMonth() + 1) % 12;
    expect(screen.getByText(new RegExp(monthNames[nextMonth]))).toBeInTheDocument();

    // Go back twice to previous month
    fireEvent.click(screen.getByRole("button", { name: /Prev/ }));
    fireEvent.click(screen.getByRole("button", { name: /Prev/ }));
    const prevMonth = (today.getMonth() + 11) % 12;
    expect(screen.getByText(new RegExp(monthNames[prevMonth]))).toBeInTheDocument();
  });

  it("selects a day and shows the detail panel", async () => {
    render(<CalendarPage />);

    await waitFor(() => expect(calendar.getEvents).toHaveBeenCalled());

    fireEvent.click(screen.getByText("10"));

    expect(screen.getByText(/No events for this day\./)).toBeInTheDocument();
    expect(screen.getByText(/No mail for this day\./)).toBeInTheDocument();
  });

  it("shows the add event form and creates an event", async () => {
    render(<CalendarPage />);

    await waitFor(() => expect(calendar.getEvents).toHaveBeenCalled());

    // Select a day
    fireEvent.click(screen.getByText("15"));

    // Click add event
    fireEvent.click(screen.getByRole("button", { name: "+ Add Event" }));

    // Fill in the form
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Team meeting" } });
    fireEvent.change(screen.getByLabelText("Time (optional)"), { target: { value: "14:00" } });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(calendar.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Team meeting",
          time: "14:00",
        }),
      );
    });
  });

  it("shows events for a selected day", async () => {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-10`;

    vi.spyOn(calendar, "getEvents").mockResolvedValue({
      events: [
        { id: "evt-1", title: "Standup", date: dateKey, time: "09:00" },
        { id: "evt-2", title: "Lunch", date: dateKey, description: "With team" },
      ],
    });

    render(<CalendarPage />);

    await waitFor(() => expect(calendar.getEvents).toHaveBeenCalled());

    fireEvent.click(screen.getByText("10"));

    expect(await screen.findByText("Standup")).toBeInTheDocument();
    expect(screen.getByText("09:00")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText("With team")).toBeInTheDocument();
  });

  it("deletes an event", async () => {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-10`;

    vi.spyOn(calendar, "getEvents").mockResolvedValue({
      events: [{ id: "evt-1", title: "Old event", date: dateKey }],
    });

    render(<CalendarPage />);

    await waitFor(() => expect(calendar.getEvents).toHaveBeenCalled());

    fireEvent.click(screen.getByText("10"));
    expect(await screen.findByText("Old event")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(calendar.deleteEvent).toHaveBeenCalledWith("evt-1");
    });
  });

  it("shows mail count badges on day cells", async () => {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-05`;

    vi.spyOn(mail, "getMailByDateRange").mockResolvedValue({
      emails: [
        { index: 1, from: "alice@test.com", subject: "Hello", date: dateKey, read: false },
        { index: 2, from: "bob@test.com", subject: "Update", date: dateKey, read: true },
      ],
    });

    render(<CalendarPage />);

    // The badge should show "2" for that day
    await waitFor(() => {
      const badge = screen.getByText("2", { selector: ".calendar-mail-badge" });
      expect(badge).toBeInTheDocument();
    });
  });

  it("fetches data for the visible month range", async () => {
    render(<CalendarPage />);

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    await waitFor(() => {
      expect(mail.getMailByDateRange).toHaveBeenCalledWith(start, end);
      expect(calendar.getEvents).toHaveBeenCalledWith(start, end);
    });
  });

  it("returns to today when Today button is clicked", async () => {
    render(<CalendarPage />);

    // Navigate away
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    // Click Today
    fireEvent.click(screen.getByRole("button", { name: "Today" }));

    const today = new Date();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const label = screen.getByText(new RegExp(monthNames[today.getMonth()]), {
      selector: ".calendar-nav-label",
    });
    expect(label).toBeInTheDocument();
  });

  it("edits an existing event", async () => {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-10`;

    vi.spyOn(calendar, "getEvents").mockResolvedValue({
      events: [{ id: "evt-1", title: "Standup", date: dateKey, time: "09:00", description: "Daily sync" }],
    });

    render(<CalendarPage />);

    await waitFor(() => expect(calendar.getEvents).toHaveBeenCalled());

    fireEvent.click(screen.getByText("10"));
    expect(await screen.findByText("Standup")).toBeInTheDocument();

    // Click Edit
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    // Form should be pre-filled
    expect(screen.getByLabelText("Title")).toHaveValue("Standup");

    // Change the title
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated standup" } });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      expect(calendar.updateEvent).toHaveBeenCalledWith(
        "evt-1",
        expect.objectContaining({
          title: "Updated standup",
          time: "09:00",
        }),
      );
    });
  });

  it("cancels editing and hides the form", async () => {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-10`;

    vi.spyOn(calendar, "getEvents").mockResolvedValue({
      events: [{ id: "evt-1", title: "Standup", date: dateKey }],
    });

    render(<CalendarPage />);

    await waitFor(() => expect(calendar.getEvents).toHaveBeenCalled());

    fireEvent.click(screen.getByText("10"));
    expect(await screen.findByText("Standup")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Title")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Title")).toBeNull();
  });
});
