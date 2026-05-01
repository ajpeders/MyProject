import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";

describe("HomePage", () => {
  it("renders MyAgent Tools heading", () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "MyAgent Tools" })).toBeInTheDocument();
  });

  it("renders all tool links", () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Mail" })).toHaveAttribute("href", "/mail");
    expect(screen.getByRole("link", { name: "News" })).toHaveAttribute("href", "/news");
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/chat");
    expect(screen.getByRole("link", { name: "Memory" })).toHaveAttribute("href", "/memory");
    expect(screen.getByRole("link", { name: "DevTeam" })).toHaveAttribute("href", "/devteam");
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("renders tool descriptions", () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/Read and triage email across accounts/)).toBeInTheDocument();
    expect(screen.getByText(/Track breaking stories and compare major news services/)).toBeInTheDocument();
    expect(screen.getByText(/Ask questions, review web results/)).toBeInTheDocument();
    expect(screen.getByText(/Ask web-backed questions and get inline answers/)).toBeInTheDocument();
    expect(screen.getByText(/Store, search, and delete personal memories/)).toBeInTheDocument();
    expect(screen.getByText(/Manage development task pipeline/)).toBeInTheDocument();
    expect(screen.getByText(/Inspect users, sessions, and database health/)).toBeInTheDocument();
    expect(screen.getByText(/Manage IMAP accounts and preferences/)).toBeInTheDocument();
  });
});
