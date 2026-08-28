import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";

describe("HomePage", () => {
  it("renders MyAgent Tools heading", () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "MyAgent Tools" })).toBeInTheDocument();
  });

  it("renders Mail, Budget, and Settings links", () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Mail" })).toHaveAttribute("href", "/mail");
    expect(screen.getByRole("link", { name: "Budget" })).toHaveAttribute("href", "/budget");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("renders tool descriptions", () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/Read and triage email across accounts/)).toBeInTheDocument();
    expect(screen.getByText(/Review spending and categorize transactions/)).toBeInTheDocument();
    expect(screen.getByText(/Manage IMAP accounts and preferences/)).toBeInTheDocument();
  });
});
