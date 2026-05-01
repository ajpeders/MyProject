import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";

vi.mock("../api/auth", () => ({
  isAdmin: vi.fn(() => false),
}));

import { isAdmin } from "../api/auth";

function TestLayout() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<div>Home Content</div>} />
      </Route>
    </Routes>
  );
}

describe("Layout", () => {
  it("renders sidebar with nav links", () => {
    vi.mocked(isAdmin).mockReturnValue(true);
    render(<MemoryRouter><TestLayout /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mail" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DevTeam" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("hides Admin link for non-admin users", () => {
    vi.mocked(isAdmin).mockReturnValue(false);
    render(<MemoryRouter><TestLayout /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
    expect(screen.getByRole("link", { name: "Mail" })).toBeInTheDocument();
  });

  it("renders MyAgent heading", () => {
    render(<MemoryRouter><TestLayout /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "MyAgent" })).toBeInTheDocument();
  });

  it("renders logout and collapse buttons", () => {
    render(<MemoryRouter><TestLayout /></MemoryRouter>);
    const buttons = screen.getAllByRole("button");
    expect(buttons.some(b => b.textContent?.includes("Logout"))).toBe(true);
    expect(buttons.some(b => b.textContent?.includes("collapse"))).toBe(true);
  });

  it("renders outlet content", () => {
    render(<MemoryRouter><TestLayout /></MemoryRouter>);
    expect(screen.getByText("Home Content")).toBeInTheDocument();
  });
});
